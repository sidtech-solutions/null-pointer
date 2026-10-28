import { type AudioRecording, AudioStudioModule, extractPreviewBars, useAudioRecorder } from '@siteed/audio-studio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { removeFile } from './images';
import { type VoiceDraft, VoiceLimits, waveformOf } from './voice-notes';

export type VoiceNoteState = { status: 'idle' } | { status: 'starting' } | { status: 'recording' } | { status: 'stopping' } | { status: 'recorded'; draft: VoiceDraft };

const Idle: VoiceNoteState = { status: 'idle' };

/**
 * Records a voice note for a thread's composer. The microphone is only open while recording, and a recording that
 * only finishes after a discard, or after the screen went away, is deleted instead of shown. Each start gets a new
 * generation so late results are told apart.
 */
export function useVoiceNote(onError: (message: string) => void) {
  const recorder = useAudioRecorder();
  const [state, setState] = useState<VoiceNoteState>(Idle);
  const peaks = useRef<number[]>([]);
  const generation = useRef(0);
  const finished = useRef<string | null>(null);
  const report = useRef(onError);
  const latest = useRef(recorder);

  useEffect(() => {
    report.current = onError;
    latest.current = recorder;
  });

  // Leaving the screen mid-recording stops it and throws the file away.
  useEffect(
    () => () => {
      generation.current++;

      if (latest.current.isRecording) {
        latest.current
          .stopRecording()
          .then((recording) => removeFile(recording.fileUri))
          .catch(() => undefined);
      }
    },
    [],
  );

  const finish = useCallback(async (recording: AudioRecording, current: number) => {
    if (finished.current === recording.fileUri) {
      return;
    }

    finished.current = recording.fileUri;

    if (current !== generation.current) {
      removeFile(recording.fileUri);

      return;
    }

    if (recording.durationMs < VoiceLimits.minMs) {
      removeFile(recording.fileUri);
      setState(Idle);
      report.current('fatal: voice note shorter than half a second.');

      return;
    }

    // The bars come from the file, as the web draws them; the live peaks stand in if reading it fails.
    let waveform: number[];

    try {
      const preview = await extractPreviewBars({ fileUri: recording.fileUri, numberOfBars: VoiceLimits.bars });

      waveform = waveformOf(preview.bars.map((bar) => bar.amplitude));
    } catch {
      waveform = waveformOf(peaks.current);
    }

    if (current !== generation.current) {
      removeFile(recording.fileUri);

      return;
    }

    setState({ status: 'recorded', draft: { uri: recording.fileUri, duration_ms: Math.min(recording.durationMs, VoiceLimits.maxMs), waveform } });
  }, []);

  const start = useCallback(async () => {
    const current = ++generation.current;

    setState({ status: 'starting' });

    try {
      const permission = await AudioStudioModule.requestPermissionsAsync();

      if (!permission.granted) {
        throw new Error('fatal: microphone access denied. Allow it in Settings to record a voice note.');
      }

      peaks.current = [];
      finished.current = null;

      await recorder.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        output: { primary: { enabled: true, format: 'wav' }, compressed: { enabled: false } },
        enableProcessing: true,
        keepFullAnalysis: false,
        intervalAnalysis: 100,
        segmentDurationMs: 50,
        onAudioAnalysis: async (analysis) => {
          analysis.dataPoints.forEach((point) => peaks.current.push(point.amplitude));
        },
        maxDurationMs: VoiceLimits.maxMs,
        autoStopOnMaxDuration: true,
        // Fires for a manual stop and for the minute running out alike, with the finished file.
        onRecordingStopped: (recording) => {
          void finish(recording, current);
        },
        ios: { audioSession: { category: 'PlayAndRecord', mode: 'Default', categoryOptions: ['DefaultToSpeaker', 'AllowBluetooth'] } },
        android: { audioFocusStrategy: 'interactive' },
      });

      if (current === generation.current) {
        setState({ status: 'recording' });
      }
    } catch (exception) {
      if (current === generation.current) {
        setState(Idle);
        report.current(exception instanceof Error && exception.message.startsWith('fatal:') ? exception.message : 'fatal: could not record a voice note.');
      }
    }
  }, [recorder, finish]);

  const stop = useCallback(async () => {
    if (state.status !== 'recording') {
      return;
    }

    const current = generation.current;

    setState({ status: 'stopping' });

    try {
      await finish(await recorder.stopRecording(), current);
    } catch {
      if (current === generation.current) {
        setState(Idle);
        report.current('fatal: could not finish the voice note.');
      }
    }
  }, [recorder, finish, state.status]);

  /** Drops whatever there is: stops a recording in progress, deletes a recorded draft. */
  const discard = useCallback(async () => {
    generation.current++;

    const draft = state.status === 'recorded' ? state.draft : null;

    setState(Idle);

    if (recorder.isRecording) {
      try {
        removeFile((await recorder.stopRecording()).fileUri);
      } catch {
        // Nothing to delete.
      }
    }

    if (draft) {
      removeFile(draft.uri);
    }
  }, [recorder, state]);

  /** Hands the draft over to be pushed and forgets it here, keeping its file for the upload. */
  const take = useCallback((): VoiceDraft | null => {
    if (state.status !== 'recorded') {
      return null;
    }

    generation.current++;
    setState(Idle);

    return state.draft;
  }, [state]);

  const peak = useCallback(() => peaks.current.at(-1) ?? 0, []);

  return { state, start, stop, discard, take, peak, durationMs: recorder.durationMs };
}
