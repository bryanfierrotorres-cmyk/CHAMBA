#!/usr/bin/env node
/**
 * Genera icon.png, adaptive-icon.png y splash.png para Expo / APK.
 * npm run assets:generate-icons
 */
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'images');

const BG = '#111827';
const GRADIENT_STOPS = [
  { offset: '0%', color: '#0B1220' },
  { offset: '45%', color: '#111827' },
  { offset: '100%', color: '#1F2937' },
];
const BOLT = '#FACC15';
const BOLT_GLOW = '#FDE047';
const TEXT = '#FFFFFF';

/** Rayo centrado (viewBox 0 0 1024 1024). */
const BOLT_PATH =
  'M 512 248 L 392 548 L 488 548 L 428 776 L 632 448 L 536 448 Z';

const textureDots = () => {
  let dots = '';
  for (let y = 80; y < 1024; y += 48) {
    for (let x = 80; x < 1024; x += 48) {
      const o = ((x * 17 + y * 31) % 100) / 500;
      dots += `<circle cx="${x}" cy="${y}" r="1.2" fill="#FFFFFF" opacity="${0.03 + o}"/>`;
    }
  }
  return dots;
};

/**
 * @param {{ width: number; height: number; layout: 'icon' | 'splash' }} opts
 */
function buildSvg({ width, height, layout }) {
  const isSplash = layout === 'splash';
  const cx = width / 2;
  const scale = isSplash ? Math.min(width, height) / 1024 : width / 1024;
  const boltY = isSplash ? height * 0.42 : height * 0.46;
  const labelY = isSplash ? height * 0.58 : height * 0.72;
  const fontSize = Math.round(96 * scale);
  const letterSpacing = Math.round(10 * scale);
  const glowR = Math.round(220 * scale);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      ${GRADIENT_STOPS.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('\n      ')}
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1E293B" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.9"/>
    </radialGradient>
    <filter id="boltGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#vignette)"/>
  <g opacity="0.55">${textureDots()}</g>
  <circle cx="${cx}" cy="${boltY}" r="${glowR}" fill="${BOLT_GLOW}" opacity="0.12"/>
  <g transform="translate(${cx - 512 * scale}, ${boltY - 512 * scale}) scale(${scale})" filter="url(#boltGlow)">
    <path d="${BOLT_PATH}" fill="${BOLT}"/>
  </g>
  <text
    x="${cx}"
    y="${labelY}"
    text-anchor="middle"
    font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"
    font-weight="800"
    font-size="${fontSize}"
    fill="${TEXT}"
    letter-spacing="${letterSpacing}"
  >CHAMBA</text>
</svg>`;
}

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('❌ Instalá sharp: npm install --save-dev sharp');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const iconSvg = buildSvg({ width: 1024, height: 1024, layout: 'icon' });
  const splashSvg = buildSvg({ width: 1284, height: 2778, layout: 'splash' });

  const iconPath = join(OUT_DIR, 'icon.png');
  const adaptivePath = join(OUT_DIR, 'adaptive-icon.png');
  const splashPath = join(OUT_DIR, 'splash.png');
  const icon512Path = join(OUT_DIR, 'icon-512.png');

  const iconBuffer = await sharp(Buffer.from(iconSvg)).png({ compressionLevel: 9 }).toBuffer();

  await sharp(iconBuffer).toFile(iconPath);
  await sharp(iconBuffer).toFile(adaptivePath);
  await sharp(Buffer.from(splashSvg)).png({ compressionLevel: 9 }).toFile(splashPath);
  await sharp(iconBuffer).resize(512, 512).png({ compressionLevel: 9 }).toFile(icon512Path);

  const assetsRoot = join(ROOT, 'assets');
  await sharp(iconBuffer).resize(96, 96).png({ compressionLevel: 9 }).toFile(join(assetsRoot, 'notification-icon.png'));
  await sharp(iconBuffer).resize(48, 48).png({ compressionLevel: 9 }).toFile(join(assetsRoot, 'favicon.png'));

  const readme = join(OUT_DIR, 'README.txt');
  await writeFile(
    readme,
    'Generado por scripts/generate-app-icons.mjs\n'
    + '- icon.png / adaptive-icon.png: 1024×1024\n'
    + '- icon-512.png: 512×512 (referencia)\n'
    + '- splash.png: 1284×2778\n'
    + '- ../notification-icon.png: 96×96\n'
    + '- ../favicon.png: 48×48\n',
    'utf8',
  );

  console.log('✅ Assets generados en assets/images/:');
  console.log('   icon.png (1024×1024)');
  console.log('   adaptive-icon.png (1024×1024)');
  console.log('   icon-512.png (512×512)');
  console.log('   splash.png (1284×2778)');
  console.log('   ../notification-icon.png (96×96)');
  console.log('   ../favicon.png (48×48)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
