/**
 * Regenerates every brand icon from the one master mark below (three faders,
 * dark on a lime tile): public/icon.svg, favicon.ico (16/32/48 px), the 192 and
 * 512 px PNGs, the maskable 512 px PNG for Android, and the 180 px iOS touch
 * icon. Edit MARK, run this, commit the output.
 *
 * Google crops favicons to a circle and wants a multiple of 48 px, so the art
 * stays inside the circle and favicon.ico includes a 48 px image.
 *
 * Usage:
 *   node scripts/generate-brand-icons.mjs
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const LIME = "#d4ff3f";
const INK = "#0b0b0c";
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Faders on a 32x32 grid: three rails, each with a cap at a different height. */
const FADERS = [
  { rail: 6.75, cap: { x: 4.5, y: 18 } },
  { rail: 14.75, cap: { x: 12.5, y: 7 } },
  { rail: 22.75, cap: { x: 20.5, y: 12 } },
];

function faderShapes(color) {
  return FADERS.map(
    ({ rail, cap }) =>
      `<rect x="${rail}" y="5" width="2.5" height="22" fill="${color}"/><rect x="${cap.x}" y="${cap.y}" width="7" height="6" fill="${color}"/>`
  ).join("");
}

/** The mark, optionally shrunk toward the centre so a maskable icon's art stays inside the platform's safe zone. */
function markSvg(scale = 1) {
  const offset = 16 * (1 - scale);
  return (
    `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="32" height="32" fill="${LIME}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">${faderShapes(INK)}</g>` +
    `</svg>`
  );
}

const MASKABLE_ART_SCALE = 0.72;
const ICO_SIZES = [16, 32, 48];
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

function renderPng(svg, size) {
  // High density so small sizes are drawn from the vector, not scaled down from 32 px.
  return sharp(Buffer.from(svg), { density: (72 * size * 4) / 32 }).resize(size, size).png().toBuffer();
}

/** An .ico holding PNG images (supported by every current browser). */
function buildIco(images) {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(ICO_ENTRY_BYTES);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

async function main() {
  const svg = markSvg();
  const out = (name) => path.join(PUBLIC_DIR, name);

  await writeFile(out("icon.svg"), svg + "\n");
  await writeFile(out("icon-192.png"), await renderPng(svg, 192));
  await writeFile(out("icon-512.png"), await renderPng(svg, 512));
  await writeFile(out("apple-touch-icon.png"), await renderPng(svg, 180));
  await writeFile(out("icon-maskable-512.png"), await renderPng(markSvg(MASKABLE_ART_SCALE), 512));

  const icoImages = await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await renderPng(svg, size) })));
  await writeFile(out("favicon.ico"), buildIco(icoImages));

  console.log("Wrote icon.svg, favicon.ico, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
