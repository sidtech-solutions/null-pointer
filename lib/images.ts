import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { toHex } from './bytes';
import { randomHex } from './random';

// What devnull accepts on a commit, as the web checks it (CreateCommitImages).
export const MaxImages = 3;
export const MaxImageBytes = 10 * 1024 * 1024;
export const MaxImageDimension = 6000;
export const MaxDescriptionLength = 1000;
export const InvalidImageMessage = 'Only JPEG, PNG, or WebP images up to 10 MB.';

/** Photos larger than this are scaled down before upload, so a 48 MP shot never trips the server's limits. */
const UploadDimension = 4096;
const UploadBytes = 8 * 1024 * 1024;

const Accepted = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageType = (typeof Accepted)[number];

/** An image picked for a commit: a local file plus what the server needs to know about it. */
export type Attachment = {
  id: string;
  uri: string;
  name: string;
  type: ImageType;
  width: number;
  height: number;
  size: number;
  description: string;
};

export class ImageError extends Error {}

export type Source = 'library' | 'camera';

/**
 * Opens the photo library or the camera and returns the images that fit, ready to upload.
 * Returns an empty list when the user cancelled. Throws an ImageError the composer can show.
 */
export async function pickImages(source: Source, capacity: number): Promise<Attachment[]> {
  if (capacity <= 0) {
    throw new ImageError(`Up to ${MaxImages} images per commit.`);
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  let result: ImagePicker.ImagePickerResult;

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      throw new ImageError(permission.canAskAgain ? 'fatal: camera permission denied.' : 'fatal: camera permission denied. Allow it in Settings.');
    }

    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: capacity > 1, selectionLimit: capacity, orderedSelection: true });
  }

  if (result.canceled) {
    return [];
  }

  const assets = result.assets.slice(0, capacity);
  const prepared: Attachment[] = [];
  let rejected = false;

  for (const asset of assets) {
    try {
      prepared.push(await prepare(asset));
    } catch {
      rejected = true;
    }
  }

  if (rejected && prepared.length === 0) {
    throw new ImageError(InvalidImageMessage);
  }

  return prepared;
}

/** A file another app shared, as the share sheet describes it. */
export type SharedFile = { path: string; mimeType: string; fileName: string; size: number | null; width: number | null; height: number | null };

/**
 * The images another app shared, ready to upload: the ones that fit as they
 * are, the rest re-encoded, anything that is not an image left out.
 */
export async function attachmentsFromShared(files: SharedFile[], capacity: number): Promise<Attachment[]> {
  const prepared: Attachment[] = [];

  for (const file of files.filter((candidate) => candidate.mimeType.toLowerCase().startsWith('image/')).slice(0, Math.max(0, capacity))) {
    try {
      prepared.push(await prepare({ uri: file.path, mimeType: file.mimeType, fileName: file.fileName, fileSize: file.size ?? undefined, width: file.width ?? 0, height: file.height ?? 0, type: 'image' } as ImagePicker.ImagePickerAsset));
    } catch {
      // A shared file the server would refuse is skipped rather than blocking the rest.
    }
  }

  return prepared;
}

/** Keeps an image the server would accept as it is; re-encodes anything else (HEIC, too large) as JPEG. */
async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<Attachment> {
  if (asset.type === 'video') {
    throw new ImageError(InvalidImageMessage);
  }

  const original = new File(asset.uri);
  const type = typeOf(asset.mimeType, asset.uri);
  const size = asset.fileSize ?? original.size;
  const fits = type !== null && size > 0 && size <= UploadBytes && asset.width <= UploadDimension && asset.height <= UploadDimension;

  if (fits) {
    return { id: randomHex(8), uri: asset.uri, name: fileName(asset.fileName, type), type, width: asset.width, height: asset.height, size, description: '' };
  }

  const context = ImageManipulator.manipulate(asset.uri, { maxWidth: UploadDimension, maxHeight: UploadDimension });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  const file = new File(saved.uri);

  if (!file.exists || file.size === 0 || file.size > MaxImageBytes) {
    throw new ImageError(InvalidImageMessage);
  }

  return { id: randomHex(8), uri: saved.uri, name: fileName(asset.fileName, 'image/jpeg'), type: 'image/jpeg', width: saved.width, height: saved.height, size: file.size, description: '' };
}

function typeOf(mimeType: string | undefined, uri: string): ImageType | null {
  const lower = (mimeType ?? '').toLowerCase();

  if (lower === 'image/jpg') {
    return 'image/jpeg';
  }

  if ((Accepted as readonly string[]).includes(lower)) {
    return lower as ImageType;
  }

  if (lower === '') {
    const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();

    return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : null;
  }

  return null;
}

function fileName(name: string | null | undefined, type: ImageType): string {
  const extension = type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';
  const base = (name ?? '').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');

  return `${base || 'image'}.${extension}`;
}

/** The file's bytes, to send exactly as read, with their SHA-256 (hex) as the server hashes the upload. */
export async function readForUpload(uri: string): Promise<{ bytes: Uint8Array; sha256: string }> {
  const bytes = await new File(uri).bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);

  return { bytes, sha256: toHex(new Uint8Array(digest)) };
}
