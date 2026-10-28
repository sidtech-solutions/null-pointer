import { formatVoiceTime, waveformOf } from '../voice-notes';

describe('waveformOf', () => {
  it('draws as many bars as asked, from the loudest peak of each slice', () => {
    const peaks = [0, 0.25, 1, 0.25, 0, 0, 0.04, 0.01];

    expect(waveformOf(peaks, 4)).toEqual([50, 100, 0, 20]);
  });

  it('stretches a few peaks over many bars and squashes many into few', () => {
    expect(waveformOf([1], 3)).toEqual([100, 100, 100]);
    expect(waveformOf(Array.from({ length: 480 }, (_, index) => (index === 479 ? 1 : 0)), 48).at(-1)).toBe(100);
  });

  it('is silent with nothing recorded and never above 100', () => {
    expect(waveformOf([], 3)).toEqual([0, 0, 0]);
    expect(waveformOf([4, -2], 1)).toEqual([100]);
  });
});

describe('formatVoiceTime', () => {
  it('reads minutes and zero-padded seconds', () => {
    expect(formatVoiceTime(0)).toBe('0:00');
    expect(formatVoiceTime(7_400)).toBe('0:07');
    expect(formatVoiceTime(60_000)).toBe('1:00');
    expect(formatVoiceTime(-5)).toBe('0:00');
  });
});
