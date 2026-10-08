"""Encode the recorded loops (transparent PNG frames from record.mjs with ALPHA=1) as animated WebP
for README.md, plus a still of the first frame for visitors who prefer reduced motion.

    python3 art/src/encode.py <frames-root> art      (needs Pillow: pip install pillow)
"""
import json
import sys
from pathlib import Path

from PIL import Image

frames_root, out = Path(sys.argv[1]), Path(sys.argv[2])
for name, quality in (('banner', 46), ('superuser', 50), ('mnesio', 50), ('murmuration', 50), ('ferro', 50)):
    d = frames_root / name
    picked = [e for e in json.loads((d / 'manifest.json').read_text()) if e[0] != 'end'][::3]  # 30 fps to 10
    frames = []
    for file, _ in picked:
        im = Image.open(d / file).convert('RGBA').convert('RGBa')  # resample premultiplied: no dark fringe
        frames.append(im.resize((1000, round(1000 * im.height / im.width)), Image.LANCZOS).convert('RGBA'))
    frames[0].save(out / f'{name}.webp', save_all=True, append_images=frames[1:], duration=100, loop=0,
                   quality=quality, alpha_quality=90, method=6)
    frames[0].save(out / f'{name}-still.webp', quality=82, alpha_quality=90, method=6)
    print(f'{name}.webp {(out / f"{name}.webp").stat().st_size / 1048576:.2f} MB')
