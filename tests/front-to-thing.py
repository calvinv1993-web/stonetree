"""Build a thing in the world's camera from its front view alone.

    python3 tests/front-to-thing.py <front.png> <out@4x.png> [--tiles 1] [--width 28] [--depth 16]

The front view (transparent background) is stood up on the south side of its footprint and pushed back `depth` world
pixels: in this camera depth goes straight up the screen and height up-left, so the layers behind it show as its top
(lit) and its east side (in shade), as a block. The footprint is `width` x `depth` world pixels in the middle of
`tiles` x `tiles` tiles (the tile bottom right, as every thing's picture). Out: a picture at 4 pixels a world pixel,
for sprites/custom.js (name it <id>@4x.png).
"""
import sys, argparse
import numpy as np
from PIL import Image

K = 4  # pixels a world pixel

def build(front, tiles=1, width=28, depth=16):
    size = (32 * tiles + 64) * K
    img = front.convert('RGBA'); img = img.crop(img.getbbox())
    w = width * K; h = round(img.height * w / img.width)
    F = np.array(img.resize((w, h), Image.LANCZOS)).astype(float)
    a = F[:, :, 3] > 100
    # which way each pixel faces once pushed back: nothing above it -> the top; nothing right of it -> the east side
    up = np.zeros_like(a); up[1:] = a[:-1]
    right = np.zeros_like(a); right[:, :-1] = a[:, 1:]
    top, east = a & ~up, a & up & ~right
    shade = np.ones(a.shape); shade[top] = 1.12; shade[east] = 0.58; shade[a & up & right] = 0.75
    out = np.zeros((size, size, 4))
    x0 = (64 + (32 * tiles - width) / 2) * K           # the footprint's west edge
    vf = (64 + 32 * tiles - (32 * tiles - depth) / 2) * K  # its south edge (the front's foot)
    rows, cols = np.nonzero(a)
    hgt = (h - 1 - rows)                               # height above the ground, in pixels
    for t in range(depth * K, -1, -1):                 # from the back to the front
        X = np.round(x0 + cols - hgt).astype(int); Y = np.round(vf - 1 - hgt - t).astype(int)
        ok = (X >= 0) & (X < size) & (Y >= 0) & (Y < size)
        if t == 0: col = F[rows, cols, :3]
        else: # the top and the east side in the same material: the front's own texture, read further in, not a streak
            tt = (t // 1) % max(1, h // 2)
            rr = np.where(top[rows, cols], np.clip(rows + tt, 0, h - 1), rows)
            cc = np.where(top[rows, cols], cols, np.clip(cols - tt, 0, w - 1))
            okp = a[rr, cc]; rr = np.where(okp, rr, rows); cc = np.where(okp, cc, cols)
            col = F[rr, cc, :3] * shade[rows, cols][:, None]
        out[Y[ok], X[ok], :3] = np.clip(col[ok], 0, 255); out[Y[ok], X[ok], 3] = F[rows[ok], cols[ok], 3]
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('front'); p.add_argument('out')
    p.add_argument('--tiles', type=int, default=1); p.add_argument('--width', type=int, default=28); p.add_argument('--depth', type=int, default=16)
    o = p.parse_args()
    build(Image.open(o.front), o.tiles, o.width, o.depth).save(o.out)
    print('wrote', o.out)
