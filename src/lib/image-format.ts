import { AVATAR_MAX_BYTES, AVATAR_MAX_DIMENSION, AVATAR_MIN_DIMENSION } from "@/lib/constants";

/**
 * Checks an uploaded profile photo by reading its own header, with no image library: it
 * must be a still WebP or JPEG of a sane size. The browser already shrinks and re-encodes
 * the photo; this is the server not taking its word for it. Pure functions on bytes.
 */

export type AvatarImage = { mime: "image/webp" | "image/jpeg"; extension: "webp" | "jpg"; width: number; height: number };
export type AvatarInspection = { image: AvatarImage } | { error: string };

type Size = { width: number; height: number };

const WEBP_HEADER_BYTES = 30;
const VP8_START_CODE = [0x9d, 0x01, 0x2a];
const VP8X_ANIMATION_FLAG = 0x02;
const VP8_DIMENSION_MASK = 0x3fff;
const JPEG_MIN_BYTES = 4;
// SOF markers carry the image size: C0-CF except C4 (huffman tables), C8 (reserved) and CC (arithmetic coding).
const JPEG_NON_SOF_MARKERS = [0xc4, 0xc8, 0xcc];

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readUint32LE(bytes: Uint8Array, at: number): number {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

function readUint24LE(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
}

/** Lossy WebP: after the frame tag comes a start code, then two 14-bit sizes. */
function readLossyWebp(bytes: Uint8Array): Size | null {
  if (!VP8_START_CODE.every((value, index) => bytes[23 + index] === value)) return null;
  return {
    width: (bytes[26] | (bytes[27] << 8)) & VP8_DIMENSION_MASK,
    height: (bytes[28] | (bytes[29] << 8)) & VP8_DIMENSION_MASK,
  };
}

/** Lossless WebP: a signature byte, then two 14-bit sizes (minus one) packed together. */
function readLosslessWebp(bytes: Uint8Array): Size | null {
  if (bytes[20] !== 0x2f) return null;
  return {
    width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
    height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)),
  };
}

/** Extended WebP: canvas size as two 24-bit values (minus one). Animated files are refused. */
function readExtendedWebp(bytes: Uint8Array): Size | null {
  if (bytes[20] & VP8X_ANIMATION_FLAG) return null;
  return { width: 1 + readUint24LE(bytes, 24), height: 1 + readUint24LE(bytes, 27) };
}

function readWebpSize(bytes: Uint8Array): Size | null {
  if (bytes.length < WEBP_HEADER_BYTES) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  // The RIFF size must account for every byte: nothing may trail the image.
  if (readUint32LE(bytes, 4) + 8 !== bytes.length) return null;

  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") return readLossyWebp(bytes);
  if (chunk === "VP8L") return readLosslessWebp(bytes);
  if (chunk === "VP8X") return readExtendedWebp(bytes);
  return null;
}

function isJpegSizeMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && !JPEG_NON_SOF_MARKERS.includes(marker);
}

/** Walks the JPEG's segments until the one that holds the size. */
function readJpegSize(bytes: Uint8Array): Size | null {
  const isJpeg = bytes.length >= JPEG_MIN_BYTES && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const endsProperly = bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (!isJpeg || !endsProperly) return null;

  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) { at += 1; continue; } // padding byte
    const segmentLength = (bytes[at + 2] << 8) | bytes[at + 3];
    if (isJpegSizeMarker(marker)) {
      if (at + 9 > bytes.length) return null;
      return { height: (bytes[at + 5] << 8) | bytes[at + 6], width: (bytes[at + 7] << 8) | bytes[at + 8] };
    }
    if (marker === 0xda || marker === 0xd9 || segmentLength < 2) return null; // image data started with no size seen
    at += 2 + segmentLength;
  }
  return null;
}

function isReasonableSize({ width, height }: Size): boolean {
  const inRange = (value: number) => value >= AVATAR_MIN_DIMENSION && value <= AVATAR_MAX_DIMENSION;
  return inRange(width) && inRange(height);
}

export function inspectAvatarImage(bytes: Uint8Array): AvatarInspection {
  if (bytes.length === 0) return { error: "The photo is empty." };
  if (bytes.length > AVATAR_MAX_BYTES) return { error: "The photo is too large." };

  const webp = readWebpSize(bytes);
  const jpeg = webp ? null : readJpegSize(bytes);
  const size = webp ?? jpeg;
  if (!size) return { error: "Use a WebP or JPEG photo." };
  if (!isReasonableSize(size)) return { error: "The photo has an unsupported size." };

  const kind = webp
    ? { mime: "image/webp" as const, extension: "webp" as const }
    : { mime: "image/jpeg" as const, extension: "jpg" as const };
  return { image: { ...kind, ...size } };
}
