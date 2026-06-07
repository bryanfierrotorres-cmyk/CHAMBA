#!/usr/bin/env python3
"""Quita fondos sólidos (negro/gris) de iconos 3D → PNG transparente."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets' / 'services-3d'

FILES = [
    'limpieza.png',
    'car_wash.png',
    'ac.png',
    'jardineria.png',
    'mascotas.png',
    'mandados.png',
]

TOLERANCE = 48


def color_dist(a: tuple[int, ...], b: tuple[int, ...]) -> float:
    return sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)) ** 0.5


def is_neutral_gray(r: int, g: int, b: int) -> bool:
    spread = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    return spread <= 28 and 130 <= avg <= 235


def flood_remove(img: Image.Image, tolerance: float) -> Image.Image:
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    visited: set[tuple[int, int]] = set()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]

    for sx, sy in seeds:
        bg = px[sx, sy][:3]
        queue: deque[tuple[int, int]] = deque([(sx, sy)])
        while queue:
            x, y = queue.popleft()
            if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
                continue
            visited.add((x, y))
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if color_dist((r, g, b), bg) <= tolerance:
                px[x, y] = (r, g, b, 0)
                queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return img


def remove_neutral_floor(img: Image.Image) -> Image.Image:
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if is_neutral_gray(r, g, b):
                px[x, y] = (r, g, b, 0)
    return img


def trim_transparent(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    return img.crop((left, top, right, bottom))


def process_file(path: Path) -> None:
    img = Image.open(path)
    img = flood_remove(img, TOLERANCE)
    img = remove_neutral_floor(img)
    img = trim_transparent(img, pad=10)

    # Canvas cuadrado para consistencia visual en la app
    side = max(img.width, img.height, 512)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    offset = ((side - img.width) // 2, (side - img.height) // 2)
    canvas.paste(img, offset, img)
    canvas.save(path, format='PNG', optimize=True)
    print(f'OK {path.name} -> {canvas.size[0]}x{canvas.size[1]}')


def main() -> None:
    for name in FILES:
        path = ASSETS / name
        if not path.exists():
            print(f'SKIP missing {name}')
            continue
        process_file(path)

    jpg = ASSETS / 'jardineria.jpg'
    if jpg.exists():
        jpg.unlink()
        print('Removed legacy jardineria.jpg')


if __name__ == '__main__':
    main()
