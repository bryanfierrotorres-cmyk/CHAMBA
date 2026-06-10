#!/usr/bin/env node
/**
 * Quita fondo negro/oscuro de PNG 3D (flood-fill desde bordes) → alpha transparente.
 * Uso: node scripts/remove-3d-image-background.mjs [archivo.png ...]
 */
import sharp from 'sharp';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_FILES = [
  join(ROOT, 'assets', 'services-3d', 'ac_mantenimiento.png'),
];

const isBackgroundPixel = (r, g, b, threshold = 52) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return max <= threshold || (max <= threshold + 28 && sat < 0.12);
};

async function removeDarkBackground(filePath, { threshold = 52 } = {}) {
  if (!existsSync(filePath)) {
    console.warn('⚠️  No existe:', filePath);
    return false;
  }

  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];

  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2], threshold)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    const i = idx * 4;
    data[i + 3] = 0;

    pushIfBg(x - 1, y);
    pushIfBg(x + 1, y);
    pushIfBg(x, y - 1);
    pushIfBg(x, y + 1);
  }

  // Suavizar halo en píxeles semi-oscuros adyacentes al transparente
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const i = idx * 4;
      if (data[i + 3] === 0) continue;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      if (max > threshold + 35) continue;

      const neighbors = [
        data[(idx - 1) * 4 + 3],
        data[(idx + 1) * 4 + 3],
        data[(idx - width) * 4 + 3],
        data[(idx + width) * 4 + 3],
      ];
      if (neighbors.some((a) => a === 0)) {
        const t = Math.max(0, (max - threshold) / 35);
        data[i + 3] = Math.round(Math.min(data[i + 3], t * 255));
      }
    }
  }

  await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toFile(filePath);

  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparent += 1;
  }
  const rel = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  console.log(`✅ ${rel} — ${Math.round((transparent / total) * 100)}% transparente`);
  return true;
}

const targets = process.argv.slice(2);
const files = targets.length > 0 ? targets : DEFAULT_FILES;
for (const f of files) {
  await removeDarkBackground(f);
}
