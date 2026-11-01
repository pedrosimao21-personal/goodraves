import { AVATAR_MAX_BYTES, AVATAR_MAX_SOURCE_BYTES, AVATAR_OUTPUT_QUALITY, AVATAR_OUTPUT_SIZE } from "@/lib/constants";

/**
 * Prepares a profile photo in the browser: crops the middle square, shrinks it to
 * AVATAR_OUTPUT_SIZE px and re-encodes it (WebP, or JPEG where the browser can't write
 * WebP, as Safari can't). That makes the upload a few KB, drops metadata such as GPS
 * position, and keeps the server's job to checking, not image processing. Browser only.
 */

const WEBP = "image/webp";
const JPEG = "image/jpeg";
// JPEG has no transparency: a see-through PNG would turn black without a backdrop.
const JPEG_BACKDROP = "#141416";

export class AvatarPhotoError extends Error {}

async function loadPhoto(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file); // honours the photo's rotation
  } catch {
    return loadWithImageElement(file);
  }
}

function loadWithImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new AvatarPhotoError("This photo can't be read. Try a JPEG, PNG or WebP.")); };
    image.src = url;
  });
}

function sizeOf(photo: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return photo instanceof HTMLImageElement ? { width: photo.naturalWidth, height: photo.naturalHeight } : photo;
}

function drawMiddleSquare(canvas: HTMLCanvasElement, photo: ImageBitmap | HTMLImageElement, backdrop: string | null): void {
  const { width, height } = sizeOf(photo);
  const side = Math.min(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new AvatarPhotoError("Your browser can't prepare photos.");
  context.imageSmoothingQuality = "high";
  if (backdrop) { context.fillStyle = backdrop; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(photo, (width - side) / 2, (height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, AVATAR_OUTPUT_QUALITY));
}

/** The cropped, shrunk photo as a WebP or JPEG blob that is small enough to upload. */
export async function prepareAvatarPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new AvatarPhotoError("Choose an image file.");
  if (file.size > AVATAR_MAX_SOURCE_BYTES) throw new AvatarPhotoError("That photo is too large. Choose one under 15 MB.");

  const photo = await loadPhoto(file);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  drawMiddleSquare(canvas, photo, null);
  let blob = await encode(canvas, WEBP);
  if (blob?.type !== WEBP) {
    drawMiddleSquare(canvas, photo, JPEG_BACKDROP);
    blob = await encode(canvas, JPEG);
  }
  if (!blob || blob.size > AVATAR_MAX_BYTES) throw new AvatarPhotoError("This photo can't be prepared. Try another one.");
  return blob;
}
