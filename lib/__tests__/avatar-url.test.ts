import { sizedAvatarUrl } from '../avatar-url';

describe('sizedAvatarUrl', () => {
  it('asks GitHub for the drawn size and keeps the version', () => {
    expect(sizedAvatarUrl('https://avatars.githubusercontent.com/u/7430173?v=4', 120)).toBe('https://avatars.githubusercontent.com/u/7430173?v=4&s=120');
    expect(sizedAvatarUrl('https://avatars.githubusercontent.com/u/1?v=4&s=460', 80)).toBe('https://avatars.githubusercontent.com/u/1?v=4&s=80');
  });

  it('leaves other hosts and broken strings alone', () => {
    expect(sizedAvatarUrl('https://example.com/a.png', 120)).toBe('https://example.com/a.png');
    expect(sizedAvatarUrl('not a url', 120)).toBe('not a url');
  });
});
