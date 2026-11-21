#!/usr/bin/env python3
"""The parchment panel's pictures (css/parchment.css, js ParchmentPanel), made from the supplied originals in
docs/parchment-ui/: the frame's pieces, the paper and the ornament, as WebP in sprites/ui/parchment/.

The supplied frame-* crops are exact cuts of parchment-border.png (checked: each matches it pixel for pixel at its
place), so every piece is cut from parchment-border.png itself, at those same places: the gold bars then meet without
a seam. The pale haze painted round the frame (nearly white, mostly see-through) is taken out: on the paper it would
cloud the gold. That haze is the original paper's darkened, cloudy rim: it becomes paper-edge.webp, laid over the paper.
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
    # the paper's aged edge: the original's own cloudy band round the paper (the pale haze, read as how much of the
    # paper's darkened rim shows there), as dark sepia over the paper, cut to the paper's place inside the frame
    # (48-1488 x 93-970); laid over the whole paper (a panel's paper has nearly the original's shape)
    raw = np.array(Image.open(os.path.join(SRC, 'parchment-border.png')).convert('RGBA')).astype(np.float32)
    lum = (raw[:, :, 0] * 3 + raw[:, :, 1] * 6 + raw[:, :, 2]) / 10
    band = np.where((raw[:, :, 3] < 110) & (lum > 190), raw[:, :, 3] / 109.0, 0.0)[93:970, 48:1488]
    # (where the banners, the ivy and the crest stood over it, the band was never painted: filled from round about)
    covered = (raw[:, :, 3] >= 110)[93:970, 48:1488]
    small = Image.fromarray((band * 255).astype(np.uint8), 'L').resize((w0 := band.shape[1] // 8, band.shape[0] // 8), Image.BILINEAR)
    grown = np.array(small.filter(ImageFilter.MaxFilter(9)).resize((band.shape[1], band.shape[0]), Image.BILINEAR)).astype(np.float32) / 255
    near = np.array(Image.fromarray(covered.astype(np.uint8) * 255, 'L').filter(ImageFilter.MaxFilter(9))) > 0
    band = np.where(near, np.maximum(band, grown * 0.9), band)
    band_img = Image.fromarray((band * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(16))
    band = np.array(band_img).astype(np.float32) / 255
    h, w = band.shape
    yy, xx = np.mgrid[0:h, 0:w]
    rim = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]).astype(np.float32)
    shade = np.clip(1 - rim / 26, 0, 1) ** 1.6  # (the paper darkest right under the gold: it lies inside the frame)
    alpha = np.clip(band ** 0.8 * 0.68 + shade * 0.55, 0, 0.8)
    edge = np.zeros((h, w, 4), np.uint8)
    edge[:, :, 0], edge[:, :, 1], edge[:, :, 2] = 118, 72, 26
    edge[:, :, 3] = (alpha * 255).astype(np.uint8)
    print('paper-edge', save(Image.fromarray(edge, 'RGBA'), 'paper-edge'))
    # the paper: as supplied (shown at its own size, never stretched)
    Image.open(os.path.join(SRC, 'parchment-texture.webp')).convert('RGB').save(os.path.join(OUT, 'paper.webp'), 'WEBP', quality=88, method=6)
    # the ornament: cut to what it shows, at 600 wide
    orn = Image.open(os.path.join(SRC, 'parchment-ornament.png')).convert('RGBA')
    orn = orn.crop(orn.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox())
    print('ornament', save(orn, 'ornament', 600 / orn.size[0]))


if __name__ == '__main__':
    main()
