// What opens the image viewer (app/image.tsx) on one of a commit's or a message's images.

export type ViewerImage = { url: string; alt?: string | null };

/** The params that open the viewer on one of a commit's images. */
export function viewerParams(images: ViewerImage[], index: number): { url: string; alt: string; gallery: string; index: string } {
  const picked = images[index] ?? images[0];

  return { url: picked.url, alt: picked.alt ?? '', gallery: JSON.stringify(images.map((image) => ({ url: image.url, alt: image.alt ?? '' }))), index: String(index) };
}
