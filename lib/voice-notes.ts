/**
 * Voice notes go to dev-null.sh as 16 kHz, mono, 16-bit PCM WAV, the one upload format a phone can make, with the
 * waveform drawn here since the server never decodes the audio. Keep the limits in step with App\Services\VoiceNotes.
 */
export const VoiceLimits = { minMs: 500, maxMs: 60_000, bars: 48 } as const;

export const VoiceSpeeds = [1, 1.5, 2] as const;

/** A recorded voice note that hasn't been pushed yet: the WAV on this phone, how long it plays, and its bars. */
export type VoiceDraft = { uri: string; duration_ms: number; waveform: number[] };

/**
 * The loudest peak of each slice, from 0 to 100, drawn the way the web draws it: peaks from 0 to 1, as many as there
 * are, squashed or stretched to the number of bars, on a square root so quiet speech still shows.
 */
export function waveformOf(peaks: number[], bars: number = VoiceLimits.bars): number[] {
  if (peaks.length === 0) {
    return Array.from({ length: bars }, () => 0);
  }

  return Array.from({ length: bars }, (_, bar) => {
    const from = Math.floor((peaks.length * bar) / bars);
    const to = Math.max(from + 1, Math.floor((peaks.length * (bar + 1)) / bars));
    let peak = 0;

    for (let index = from; index < to && index < peaks.length; index++) {
      peak = Math.max(peak, Math.abs(peaks[index] ?? 0));
    }

    return Math.round(Math.sqrt(Math.min(peak, 1)) * 100);
  });
}

/** "0:07", "1:00". */
export function formatVoiceTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
