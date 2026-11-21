#!/usr/bin/env python3
"""The parchment panel's pictures (css/parchment.css, js ParchmentPanel), made from the supplied originals in
docs/parchment-ui/: the frame's pieces, the paper and the ornament, as WebP in sprites/ui/parchment/.

The supplied frame-* crops are exact cuts of parchment-border.png (checked: each matches it pixel for pixel at its
place), so every piece is cut from parchment-border.png itself, at those same places: the gold bars then meet without
a seam. The pale haze painted round the frame (nearly white, mostly see-through) is taken out: on the paper it would
cloud the gold. The paper is parchment-torn.png (aged, torn edges), its black made see-through.
Pieces are kept at half the original size (a panel shows them at a fifth to a third of it).

    python3 tests/parchment-kit.py        (then: node tests/sprite-versions.js)
"""
import os
from PIL import Image, ImageFilter
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'docs', 'parchment-ui')
OUT = os.path.join(ROOT, 'sprites', 'ui', 'parchment')
HALF = 0.5

# where each piece lies in parchment-border.png (1536 x 1024): x0, y0, x1, y1. The bars: left 30-66, right 1470-1506,
# top 77-109, bottom 955-984 (measured from the crops).
PIECES = {
    'corner-tl': (0, 0, 320, 500),      # frame-top-left (its banner and ivy)
    'corner-tr': (1216, 0, 1536, 500),  # frame-top-right
    'corner-bl': (0, 824, 320, 1024),   # frame-bottom-left
    'corner-br': (1216, 824, 1536, 1024),
    'edge-top': (350, 0, 530, 150),     # frame-top, down to just under its bar: repeated across
    'edge-bottom': (320, 824, 1216, 1024),  # frame-bottom, repeated across
    'edge-left': (0, 500, 110, 824),    # frame-left, out to just past its bar: repeated down
    'edge-right': (1426, 500, 1536, 824),
    'crest': (540, 0, 996, 200),        # frame-top-center: the tree medallion, never stretched
}


def clean(img):
    """Takes the pale haze out: nearly white, mostly see-through pixels; the gold and its soft edge stay."""
    a = np.array(img.convert('RGBA')).astype(np.int32)
    lum = (a[:, :, 0] * 3 + a[:, :, 1] * 6 + a[:, :, 2]) // 10
    haze = (a[:, :, 3] < 110) & (lum > 190)
    a[haze, 3] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def save(img, name, scale=HALF):
    w, h = img.size
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    img.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=90, method=6)
    return img.size


def main():
    os.makedirs(OUT, exist_ok=True)
    border = clean(Image.open(os.path.join(SRC, 'parchment-border.png')))
    for name, box in PIECES.items():
        print(name, box, '->', save(border.crop(box), name))
    # the torn paper (parchment-torn.png: aged paper with torn, burnt edges on black): the black made see-through, so
    # its own torn rim shows round the panel's paper (corners as painted, sides kept their thickness: border-image)
    torn = np.array(Image.open(os.path.join(SRC, 'parchment-torn.png')).convert('RGB')).astype(np.float32)
    tl = torn.mean(axis=2)
    ta = np.clip((tl - 10) / 34, 0, 1)
    rgba = np.dstack([torn, ta * 255]).astype(np.uint8)
    print('paper-torn', save(Image.fromarray(rgba, 'RGBA'), 'paper-torn', 1024 / 1536))
    # the ornament: cut to what it shows, at 600 wide
    orn = Image.open(os.path.join(SRC, 'parchment-ornament.png')).convert('RGBA')
    orn = orn.crop(orn.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox())
    print('ornament', save(orn, 'ornament', 600 / orn.size[0]))


if __name__ == '__main__':
    main()
