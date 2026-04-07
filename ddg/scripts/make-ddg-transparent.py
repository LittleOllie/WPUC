#!/usr/bin/env python3
"""Rebuild assets/ddg.png from assets/ddg1.png: remove white background, keep circular art.

Requires Pillow and numpy (e.g. pip install --target ../.pip-pillow Pillow numpy
and PYTHONPATH=../.pip-pillow python3 scripts/make-ddg-transparent.py).
"""
from __future__ import annotations

import os
import sys
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, ".pip-pillow"))

import numpy as np
from PIL import Image


def main() -> None:
    src = os.path.join(ROOT, "assets", "ddg1.png")
    out = os.path.join(ROOT, "assets", "ddg.png")
    tol = 88

    im = Image.open(src).convert("RGBA")
    rgb = np.array(im)
    h, w = rgb.shape[:2]

    def flood_from_seed(sx: int, sy: int) -> np.ndarray:
        sr, sg, sb = rgb[sy, sx, :3].astype(np.int32)
        mask = np.zeros((h, w), dtype=bool)
        q = deque([(sx, sy)])
        mask[sy, sx] = True
        while q:
            x, y = q.popleft()
            for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    continue
                if mask[ny, nx]:
                    continue
                r, g, b = rgb[ny, nx, :3].astype(np.int32)
                d = float(np.sqrt((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2))
                if d <= tol:
                    mask[ny, nx] = True
                    q.append((nx, ny))
        return mask

    bg = np.zeros((h, w), dtype=bool)
    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        bg |= flood_from_seed(sx, sy)

    rgba = rgb.astype(np.float32)
    rgba[:, :, 3] = np.where(bg, 0, rgba[:, :, 3])
    out_im = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8))
    out_im.save(out, optimize=True)
    print("Wrote", out, "(background pixels:", int(bg.sum()), ")")


if __name__ == "__main__":
    main()
