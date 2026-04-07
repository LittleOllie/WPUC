#!/usr/bin/env python3
"""Rebuild assets/fish.png from a white-background PNG: flood-remove white, flip horizontal.

Save your unprocessed art as assets/fish_raw.png (optional), or temporarily copy it to
assets/fish.png before running. Requires Pillow + numpy in ../.pip-pillow.

  PYTHONPATH=../.pip-pillow python3 scripts/process-fish-pickup.py
"""
from __future__ import annotations

import os
import sys
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, ".pip-pillow"))

import numpy as np
from PIL import Image

TOL = 88


def main() -> None:
    raw = os.path.join(ROOT, "assets", "fish_raw.png")
    src = raw if os.path.isfile(raw) else os.path.join(ROOT, "assets", "fish.png")
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
                if d <= TOL:
                    mask[ny, nx] = True
                    q.append((nx, ny))
        return mask

    bg = np.zeros((h, w), dtype=bool)
    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        bg |= flood_from_seed(sx, sy)

    rgba = rgb.astype(np.float32)
    rgba[:, :, 3] = np.where(bg, 0, rgba[:, :, 3])
    out_im = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8))
    out_im = out_im.transpose(Image.FLIP_LEFT_RIGHT)
    out_path = os.path.join(ROOT, "assets", "fish.png")
    out_im.save(out_path, optimize=True)
    print("Wrote", out_path, "from", src)


if __name__ == "__main__":
    main()
