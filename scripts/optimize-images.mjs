/**
 * Optimises product/artist photos for the web.
 *
 * Reads the full-resolution originals from `source-assets/` (git-ignored) and
 * writes resized, recompressed copies into `public/`. next/image then serves
 * WebP/AVIF variants on top of these — but keeping the source files small
 * makes the optimiser faster and the mobile payload far lighter.
 *
 * Run:  npm run optimize:images
 * Idempotent — always reads the untouched originals, never re-compresses.
 */
import sharp from "sharp";
import path from "node:path";

const root = process.cwd();
const p = (...parts) => path.join(root, ...parts);

const photos = [
  {
    src: "source-assets/regenerated/hero.jpeg",
    out: "public/hero.webp",
    width: 1920,
    quality: 78,
  },
  {
    src: "source-assets/regenerated/font.jpeg",
    out: "public/front.webp",
    width: 1400,
    quality: 80,
  },
  {
    src: "source-assets/regenerated/back.jpeg",
    out: "public/back.webp",
    width: 1400,
    quality: 80,
  },
  {
    src: "source-assets/regenerated/artist-front.jpeg",
    out: "public/artist-front.webp",
    width: 1400,
    quality: 80,
  },
  {
    src: "source-assets/regenerated/artist-back.jpeg",
    out: "public/artist-back.webp",
    width: 1400,
    quality: 80,
  },
];

let total = 0;

for (const { src, out, width, quality } of photos) {
  const info = await sharp(p(src))
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toFile(p(out));
  total += info.size;
  console.log(
    `${out.padEnd(26)} ${info.width}w  ${(info.size / 1024).toFixed(0)} KB`,
  );
}

// Logo — recoloured at runtime via CSS filter; just needs to be small.
const logo = await sharp(p("source-assets/logo.png"))
  .resize({ height: 140, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true })
  .toFile(p("public/logo.png"));
total += logo.size;
console.log(
  `${"public/logo.png".padEnd(26)} ${logo.height}h  ${(logo.size / 1024).toFixed(0)} KB`,
);

console.log(`\nTotal: ${(total / 1024 / 1024).toFixed(2)} MB`);
