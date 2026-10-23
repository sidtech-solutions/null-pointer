import { hexToHsl, hslToHex, isHex } from '../color';

describe('color', () => {
  it('round-trips the lane colours through HSL', () => {
    for (const hex of ['#f97316', '#22c55e', '#8b5cf6', '#14b8a6', '#f43f5e', '#ca8a04', '#000000', '#ffffff', '#808080']) {
      const hsl = hexToHsl(hex);

      expect(hsl).not.toBeNull();
      expect(hslToHex(hsl!)).toBe(hex);
    }
  });

  it('reads pure hues', () => {
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(hexToHsl('#00ff00')?.h).toBe(120);
    expect(hexToHsl('#0000ff')?.h).toBe(240);
  });

  it('rejects anything that is not six hex digits', () => {
    expect(hexToHsl('#fff')).toBeNull();
    expect(hexToHsl('red')).toBeNull();
    expect(isHex('#abcdef')).toBe(true);
    expect(isHex('abcdef')).toBe(false);
  });
});
