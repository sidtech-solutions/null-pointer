import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync } from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { MediaStream, RTCPeerConnection } from 'react-native-webrtc';

type RTCDataChannel = ReturnType<RTCPeerConnection['createDataChannel']>;

import { api, ApiError } from '@/lib/client';
import { notify, tap } from '@/lib/haptics';
import { callsAvailable, webrtc } from '@/lib/webrtc';
import type { IncomingCall, User } from '@/lib/types';

/**
 * A call, as dev-null.sh's web does it: the two phones swap an offer and an
 * answer through the server, then the audio and video go between them through
 * a relay, encrypted end to end, so neither dev-null.sh nor the relay can hear
 * or see it, and neither person ever sees the other's IP address.
 *
 * The state lives outside React so the bar over every screen and the console
 * in the thread read the same call; `useCall()` subscribes a component to it.
 */
export type CallState =
  | { status: 'idle' }
  | { status: 'calling'; partner: User; since: number }
  | { status: 'ringing'; partner: User; sdp: string }
  | { status: 'connecting'; partner: User }
  | {
      status: 'connected';
      partner: User;
      startedAt: number;
      isMicMuted: boolean;
      camera: MediaStream | null;
      partnerCamera: MediaStream | null;
      isPartnerCameraOn: boolean;
      /** Eight hex digits from both ends' key fingerprints; the same on both phones means nobody sits in between. */
      code: string;
    }
  | { status: 'ended'; partner: User; reason: string };

const AnswerPoll = 1_500;
const IncomingPoll = 3_000;
const RingFor = 45_000;
const ConnectFor = 20_000;
const EndedFor = 4_000;

let state: CallState = { status: 'idle' };
let connection: RTCPeerConnection | null = null;
let channel: RTCDataChannel | null = null;
let microphone: MediaStream | null = null;
let camera: MediaStream | null = null;
let partnerCamera: MediaStream | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let endTimer: ReturnType<typeof setTimeout> | undefined;
/** The offer the user declined, so it does not ring again while the server still holds it. */
let seenOffer: string | null = null;
/** Until the API has the call routes, every call request answers 404; after the first, nothing asks again this session. */
let supported = true;
/** The threads showing the call in their own console right now, so the bar over the screen steps aside. */
let consoles: string[] = [];
const listeners = new Set<() => void>();

// Messenger's sounds, as the web plays them: the ring for whoever is called, the ringback for the caller.
let ring: AudioPlayer | null = null;
let ringback: AudioPlayer | null = null;
let hangupTone: AudioPlayer | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToCall(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function callSnapshot(): CallState {
  return state;
}

export function useCall(): CallState {
  return useSyncExternalStore(subscribeToCall, callSnapshot, callSnapshot);
}

/** Whether this build can call at all, and the server has answered as if it could. */
export function callsEnabled(): boolean {
  return callsAvailable() && supported;
}

export function useCallsEnabled(): boolean {
  return useSyncExternalStore(subscribeToCall, callsEnabled, callsEnabled);
}

export function callConsoles(): string[] {
  return consoles;
}

/** Marks the partner's thread as showing the call. Returns the function that unmarks it. */
export function showCallConsole(handle: string): () => void {
  consoles = [...consoles, handle];
  emit();

  return () => {
    const index = consoles.indexOf(handle);
    consoles = consoles.filter((_, at) => at !== index);
    emit();
  };
}

function player(sound: AudioPlayer | null, source: number, loop: boolean): AudioPlayer {
  if (sound) {
    return sound;
  }

  const created = createAudioPlayer(source);
  created.loop = loop;

  return created;
}

function startRing(kind: 'ring' | 'ringback'): void {
  stopRinging();

  if (kind === 'ring') {
    ring = player(ring, require('../assets/sounds/ring.mp3'), true);
    ring.seekTo(0);
    ring.play();
  } else {
    ringback = player(ringback, require('../assets/sounds/ringback.mp3'), true);
    ringback.seekTo(0);
    ringback.play();
  }
}

function stopRinging(): void {
  ring?.pause();
  ringback?.pause();
}

function playHangup(): void {
  hangupTone = player(hangupTone, require('../assets/sounds/hangup.mp3'), false);
  hangupTone.seekTo(0);
  hangupTone.play();
}

function update(next: CallState): void {
  if (next.status !== state.status) {
    stopRinging();

    if (next.status === 'calling') {
      startRing('ringback');
    }
  }

  state = next;
  emit();
}

function unsupported(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 404 && supported) {
    supported = false;
    emit();

    return true;
  }

  return false;
}

/** Rings the partner. The offer carries this phone's addresses, so it only goes once the person confirmed. */
export async function startCall(partner: User): Promise<void> {
  if ((state.status !== 'idle' && state.status !== 'ended') || !callsEnabled()) {
    return;
  }

  clearTimeout(endTimer);
  update({ status: 'calling', partner, since: Date.now() });

  try {
    const peer = await connect(partner, true);
    await peer.setLocalDescription(await peer.createOffer({}));
    await api.startCall(partner.handle, await gathered(peer));
  } catch (error) {
    unsupported(error);
    end(partner, failure(error, `Could not call @${partner.handle}.`));

    return;
  }

  const ringsUntil = Date.now() + RingFor;

  const poll = async () => {
    if (state.status !== 'calling' || connection === null) {
      return;
    }

    try {
      const call = await api.outgoingCall(partner.handle);

      if (call?.answer) {
        update({ status: 'connecting', partner });
        await connection.setRemoteDescription({ type: 'answer', sdp: call.answer });
        void forget(partner);
        giveUpConnecting(partner);

        return;
      }

      if (call === null || Date.now() > ringsUntil) {
        void forget(partner);
        end(partner, 'No answer.');

        return;
      }
    } catch {
      // Try again on the next poll.
    }

    timer = setTimeout(() => void poll(), AnswerPoll);
  };

  timer = setTimeout(() => void poll(), AnswerPoll);
}

/** Answers the call ringing. Only now does this phone's own address leave it. */
export async function acceptCall(): Promise<void> {
  if (state.status !== 'ringing') {
    return;
  }

  const { partner, sdp } = state;
  tap();
  update({ status: 'connecting', partner });

  try {
    const peer = await connect(partner, false);
    await peer.setRemoteDescription({ type: 'offer', sdp });
    peer.getTransceivers().forEach((transceiver) => {
      if (transceiver.receiver.track?.kind === 'video') {
        transceiver.direction = 'sendrecv';
      }
    });
    await peer.setLocalDescription(await peer.createAnswer());
    await api.answerCall(partner.handle, await gathered(peer));
  } catch (error) {
    void forget(partner, true);
    end(partner, failure(error, 'Could not answer the call.'));

    return;
  }

  giveUpConnecting(partner);
}

export function declineCall(): void {
  if (state.status !== 'ringing') {
    return;
  }

  tap();
  void forget(state.partner);
  seenOffer = state.sdp;
  update({ status: 'idle' });
}

export function hangUp(): void {
  if (state.status === 'idle' || state.status === 'ended') {
    return;
  }

  tap();

  if (state.status === 'calling') {
    void forget(state.partner);
  }

  end(state.partner, 'Call ended.');
}

export function toggleMicrophone(): void {
  if (state.status !== 'connected') {
    return;
  }

  const isMicMuted = !state.isMicMuted;
  microphone?.getAudioTracks().forEach((track) => {
    track.enabled = !isMicMuted;
  });
  tap();
  update({ ...state, isMicMuted });
}

/**
 * Turns the camera on or off. The call was set up with room for video, so the
 * camera only swaps into it, straight to the partner, who hears about it over
 * the call itself. Returns why it could not, if it could not.
 */
export async function toggleCamera(): Promise<string | null> {
  const rtc = webrtc();
  const sender = connection?.getTransceivers().find((transceiver) => transceiver.receiver.track?.kind === 'video')?.sender;

  if (state.status !== 'connected' || sender === undefined || rtc === null) {
    return null;
  }

  tap();

  if (camera !== null) {
    camera.getTracks().forEach((track) => track.stop());
    camera = null;
    await sender.replaceTrack(null);
  } else {
    try {
      camera = await rtc.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      await sender.replaceTrack(camera.getVideoTracks()[0]);
    } catch (error) {
      camera?.getTracks().forEach((track) => track.stop());
      camera = null;

      return denied(error) ? 'Allow the camera to turn it on.' : 'Could not turn the camera on.';
    }
  }

  if (state.status === 'connected') {
    update({ ...state, camera });
  }

  if (channel?.readyState === 'open') {
    channel.send(JSON.stringify({ camera: camera !== null }));
  }

  return null;
}

export function dismissCall(): void {
  if (state.status === 'ended') {
    clearTimeout(endTimer);
    update({ status: 'idle' });
  }
}

/**
 * Checks for a call ringing the user while the app is in front and nothing
 * else is going on, and rings along with it unless the remote is muted.
 * Returns the function that stops watching.
 */
export function watchIncomingCalls(): () => void {
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const poll = async () => {
    clearTimeout(pollTimer);

    if (AppState.currentState === 'active' && isFree() && callsEnabled()) {
      try {
        const call = await api.incomingCall();

        // Unless the user started a call while it checked.
        if (isFree()) {
          takeIncomingCall(call);
        }
      } catch (error) {
        unsupported(error);
      }
    }

    if (!stopped && callsEnabled()) {
      pollTimer = setTimeout(() => void poll(), IncomingPoll);
    }
  };

  void poll();
  // Back in front: ask at once rather than up to three seconds later.
  const subscription = AppState.addEventListener('change', (status) => {
    if (status === 'active' && !stopped) {
      void poll();
    }
  });

  return () => {
    stopped = true;
    clearTimeout(pollTimer);
    subscription.remove();
  };
}

function isFree(): boolean {
  return state.status === 'idle' || state.status === 'ended' || state.status === 'ringing';
}

function takeIncomingCall(call: IncomingCall | null): void {
  if (call === null || call.sdp === seenOffer) {
    if (state.status === 'ringing') {
      end(state.partner, `Missed call from @${state.partner.handle}.`);
    }
  } else if (state.status !== 'ringing' || state.sdp !== call.sdp) {
    clearTimeout(endTimer);
    update({ status: 'ringing', partner: call.partner, sdp: call.sdp });
    notify('warning');

    if (!call.is_muted) {
      startRing('ring');
    }
  }
}

async function connect(partner: User, isCaller: boolean): Promise<RTCPeerConnection> {
  const rtc = webrtc();

  if (rtc === null) {
    throw new Error('This build cannot call.');
  }

  const { iceServers, relayOnly } = await api.callIceServers(partner.handle);
  const stream = await rtc.mediaDevices.getUserMedia({ audio: true });
  // Only through the relay: a direct route would hand each person the other's IP address.
  const peer = new rtc.RTCPeerConnection({ iceServers, iceTransportPolicy: relayOnly ? 'relay' : 'all' });
  microphone = stream;
  connection = peer;
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));

  peer.addEventListener('track', (event) => {
    if (event.track?.kind === 'video') {
      partnerCamera = new rtc.MediaStream([event.track]);

      if (state.status === 'connected' && connection === peer) {
        update({ ...state, partnerCamera });
      }
    }
    // Audio plays by itself once the track arrives.
  });

  // Hanging up closes the channel on both ends at once, with no server in between. It also says when the
  // partner's camera goes on or off.
  const watchChannel = (opened: RTCDataChannel) => {
    channel = opened;
    opened.onclose = () => {
      if (connection === peer) {
        end(partner, 'Call ended.');
      }
    };
    opened.onmessage = (event) => {
      const data: unknown = 'data' in event && typeof event.data === 'string' ? JSON.parse(event.data) : null;

      if (state.status === 'connected' && connection === peer && typeof data === 'object' && data !== null && 'camera' in data && typeof data.camera === 'boolean') {
        update({ ...state, isPartnerCameraOn: data.camera });
      }
    };
  };

  if (isCaller) {
    peer.addTransceiver('video', { direction: 'sendrecv' });
    watchChannel(peer.createDataChannel('call'));
  } else {
    peer.addEventListener('datachannel', (event: { channel: RTCDataChannel }) => watchChannel(event.channel));
  }

  peer.addEventListener('connectionstatechange', () => {
    if (connection !== peer) {
      return;
    }

    if (peer.connectionState === 'connected' && state.status === 'connecting') {
      clearTimeout(timer);
      notify('success');
      update({ status: 'connected', partner, startedAt: Date.now(), isMicMuted: false, camera: null, partnerCamera, isPartnerCameraOn: false, code: '' });
      void verificationCode(peer).then((code) => {
        if (state.status === 'connected' && connection === peer) {
          update({ ...state, code });
        }
      });
    } else if (peer.connectionState === 'failed') {
      end(partner, state.status === 'connected' ? 'Call ended.' : "Couldn't connect the call.");
    }
  });

  return peer;
}

/** Waits until the phone knows every way to reach it, so one offer or answer holds everything. */
async function gathered(peer: RTCPeerConnection): Promise<string> {
  if (peer.iceGatheringState !== 'complete') {
    await new Promise<void>((resolve) => {
      const done = setTimeout(resolve, 3_000);
      peer.addEventListener('icegatheringstatechange', () => {
        if (peer.iceGatheringState === 'complete') {
          clearTimeout(done);
          resolve();
        }
      });
    });
  }

  return peer.localDescription?.sdp ?? '';
}

/** Eight hex digits from both fingerprints, read like a short hash: `3f9a c217`. */
async function verificationCode(peer: RTCPeerConnection): Promise<string> {
  const fingerprints = [peer.localDescription?.sdp, peer.remoteDescription?.sdp]
    .map((sdp) => /a=fingerprint:(.+)/.exec(sdp ?? '')?.[1]?.trim() ?? '')
    .sort()
    .join('|');
  const hex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, fingerprints, { encoding: CryptoEncoding.HEX });

  return `${hex.slice(0, 4)} ${hex.slice(4, 8)}`;
}

/** When the relay cannot be reached, the call stops waiting after a while instead of hanging. */
function giveUpConnecting(partner: User): void {
  timer = setTimeout(() => {
    if (state.status === 'connecting') {
      end(partner, "Couldn't connect the call.");
    }
  }, ConnectFor);
}

/** Forgets the call with the partner. Failing to answer it says so, so the remote does not log it as declined. */
async function forget(partner: User, failed = false): Promise<void> {
  await api.endCall(partner.handle, failed).catch(() => undefined);
}

function denied(error: unknown): boolean {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  const message = error instanceof Error ? error.message : '';

  return name === 'NotAllowedError' || /permission/i.test(message);
}

function failure(error: unknown, fallback: string): string {
  if (denied(error)) {
    return 'Allow the microphone to call.';
  }

  if (error instanceof ApiError && error.status === 404) {
    return 'Calls are not on the app yet.';
  }

  return error instanceof ApiError ? error.firstError() : fallback;
}

function end(partner: User, reason: string): void {
  clearTimeout(timer);
  connection?.close();
  connection = null;
  channel = null;
  [microphone, camera].forEach((stream) => stream?.getTracks().forEach((track) => track.stop()));
  microphone = null;
  camera = null;
  partnerCamera = null;

  // A call that never rang through on this side, a missed one, ends quietly.
  if (state.status !== 'ringing') {
    playHangup();
  }

  update({ status: 'ended', partner, reason });
  clearTimeout(endTimer);
  endTimer = setTimeout(dismissCall, EndedFor);
}

/** How long the call has lasted, as `m:ss` or `h:mm:ss`. */
export function callDuration(startedAt: number, now: number): string {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
