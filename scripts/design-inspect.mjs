#!/usr/bin/env node
/**
 * Inspector de imágenes de referencia para clonado pixel-perfect.
 * Extrae colores exactos, mide distancias y calcula la escala px→pt,
 * para dejar de adivinar medidas/colores al reproducir un mockup.
 *
 * Uso:
 *   node scripts/design-inspect.mjs <img> info
 *   node scripts/design-inspect.mjs <img> color <x> <y> [radio]
 *   node scripts/design-inspect.mjs <img> palette [n]
 *   node scripts/design-inspect.mjs <img> grid <cols> <rows>
 *   node scripts/design-inspect.mjs <img> scale <anchoLogicoPt>   (default 390)
 */
import sharp from 'sharp';

const [, , imgPath, cmd = 'info', a, b, c] = process.argv;

if (!imgPath) {
  console.error('Falta la ruta de la imagen.\nEj: node scripts/design-inspect.mjs ref.png color 120 240');
  process.exit(1);
}

const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

const load = async () => {
  const img = sharp(imgPath);
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { meta, data, info };
};

const sampleAvg = (data, info, cx, cy, radius = 2) => {
  const { width, height, channels } = info;
  let r = 0, g = 0, bl = 0, n = 0;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const o = (y * width + x) * channels;
      r += data[o]; g += data[o + 1]; bl += data[o + 2]; n++;
    }
  }
  return { r: r / n, g: g / n, b: bl / n };
};

const run = async () => {
  const { meta, data, info } = await load();

  if (cmd === 'info') {
    console.log(`tamaño: ${meta.width} x ${meta.height} px  (formato ${meta.format})`);
    console.log(`escala a 390pt: 1pt ≈ ${(meta.width / 390).toFixed(3)} px  |  1px ≈ ${(390 / meta.width).toFixed(3)} pt`);
    return;
  }

  if (cmd === 'color') {
    const x = Number(a), y = Number(b), radius = c ? Number(c) : 2;
    const { r, g, b: bl } = sampleAvg(data, info, x, y, radius);
    console.log(`(${x},${y}) → ${toHex(r, g, bl)}   rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bl)})`);
    return;
  }

  if (cmd === 'scale') {
    const target = a ? Number(a) : 390;
    const f = meta.width / target;
    console.log(`ancho imagen ${meta.width}px  →  ancho lógico ${target}pt`);
    console.log(`factor: 1pt = ${f.toFixed(3)} px   |   para convertir una medida del mockup a pt: px / ${f.toFixed(3)}`);
    return;
  }

  if (cmd === 'grid') {
    const cols = a ? Number(a) : 6, rows = b ? Number(b) : 10;
    for (let ry = 0; ry < rows; ry++) {
      const line = [];
      for (let rx = 0; rx < cols; rx++) {
        const x = Math.round(((rx + 0.5) / cols) * info.width);
        const y = Math.round(((ry + 0.5) / rows) * info.height);
        const { r, g, b: bl } = sampleAvg(data, info, x, y, 2);
        line.push(toHex(r, g, bl));
      }
      console.log(line.join('  '));
    }
    return;
  }

  if (cmd === 'palette') {
    const n = a ? Number(a) : 8;
    const small = await sharp(imgPath).resize(80, 80, { fit: 'inside' }).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const counts = new Map();
    const { data: d, info: si } = small;
    for (let i = 0; i < d.length; i += si.channels) {
      if (si.channels === 4 && d[i + 3] < 128) continue; // ignorar transparentes
      const q = (v) => Math.round(v / 24) * 24; // cuantizar
      const key = `${q(d[i])},${q(d[i + 1])},${q(d[i + 2])}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, n);
    const total = [...counts.values()].reduce((s, v) => s + v, 0);
    console.log('Colores dominantes:');
    for (const [key, cnt] of top) {
      const [r, g, bl] = key.split(',').map(Number);
      console.log(`  ${toHex(r, g, bl)}   ${((cnt / total) * 100).toFixed(1)}%`);
    }
    return;
  }

  console.error(`Comando desconocido: ${cmd}`);
  process.exit(1);
};

run().catch((e) => { console.error(e.message); process.exitCode = 1; });
