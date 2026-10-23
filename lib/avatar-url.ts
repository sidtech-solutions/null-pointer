/**
 * GitHub serves avatars at 460px unless asked for less, so they are fetched
 * at the size they are drawn, as the web's sizedAvatarUrl does. Any other
 * host's URL is left alone.
 */
export function sizedAvatarUrl(url: string, pixels: number): string {
  try {
    const avatar = new URL(url);

    if (avatar.hostname !== 'avatars.githubusercontent.com') {
      return url;
    }

    avatar.searchParams.set('s', String(Math.max(1, Math.round(pixels))));

    return avatar.toString();
  } catch {
    return url;
  }
}
