#!/usr/bin/env python3
# Puts an attack sheet made outside the game (ChatGPT) into sprites/: 3 x 3 cells (rows front, side facing east, back;
# columns the strike's wind-up, middle and follow-through), each 256 x 192 pixels (64 x 48 world pixels at 4 a world
# pixel: twice a walking cell's width, for the weapon), the figure as tall as the player sheet's, its feet's middle at
# the cell's middle, on the walking sheet's feet line. Kept as painted.
#   python3 tests/install-attack-sheet.py <picture.png> sprites/player-attack-spear.png
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

CELL_W, CELL_H, FEET_Y, CENTRE_X = 256, 192, 184, 128

def figure(cell):
    """The biggest piece in a cell (the hero and the weapon in their hands), cut out, as an RGBA array."""
    a = np.array(cell.convert('RGBA'))
    solid = a[:, :, 3] > 100
    lab, n = ndimage.label(solid)
    if not n:
        return None
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = lab == (1 + int(np.argmax(sizes)))
    keep = ndimage.binary_dilation(keep, iterations=3) & (a[:, :, 3] > 0)
    a[~keep] = 0
    ys, xs = np.where(a[:, :, 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def feet_x(fig):
    """The middle of the feet: the solid columns in the lowest eighth of the figure (not the spear's blade, which is
    thin there: the widest run of solid pixels)."""
    h = fig.shape[0]
    low = fig[int(h * 0.88):, :, 3] > 100
    cols = low.any(axis=0)
    runs, start = [], None
    for x, c in enumerate(list(cols) + [False]):
        if c and start is None: start = x
        if not c and start is not None: runs.append((start, x)); start = None
    # (the feet: the runs within the body's width, the two widest together)
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    best = runs[:2] if runs else [(0, fig.shape[1])]
    return (min(r[0] for r in best) + max(r[1] for r in best)) / 2

def install(src, out):
    im = Image.open(src).convert('RGBA')
    W, H = im.size
    cw, ch = W / 3, H / 3
    walk = np.array(Image.open('sprites/player-sheet.png').convert('RGBA'))[:192, :128, 3] > 100
    ys = np.where(walk.any(axis=1))[0]
    target = ys.max() - ys.min() + 1  # the walking hero's height, standing, from the front
    # (the nine figures cut out of the whole picture, not cell by cell: a figure reaching over its cell's edge stays whole)
    a = np.array(im)
    solid = a[:, :, 3] > 100
    lab, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    big = sorted(range(1, n + 1), key=lambda k: -sizes[k - 1])[:9]
    figs = [[None] * 3 for _ in range(3)]
    for k in big:
        ys_, xs_ = np.where(lab == k)
        r, c = min(2, int(ys_.mean() // ch)), min(2, int(xs_.mean() // cw))
        keep = ndimage.binary_dilation(lab == k, iterations=3) & (a[:, :, 3] > 0)
        f = a.copy(); f[~keep] = 0
        figs[r][c] = f[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]
    # (one scale for the sheet: the front middle of the swing, the spear level, is the hero's full height)
    scale = target / figs[0][1].shape[0]
    sheet = Image.new('RGBA', (CELL_W * 3, CELL_H * 3), (0, 0, 0, 0))
    for r in range(3):
        for c in range(3):
            f = figs[r][c]
            if f is None: continue
            pic = Image.fromarray(f).resize((max(1, round(f.shape[1] * scale)), max(1, round(f.shape[0] * scale))), Image.LANCZOS)
            fx = feet_x(np.array(pic))
            at = (c * CELL_W + CENTRE_X - round(fx), r * CELL_H + FEET_Y - pic.height)
            tile = Image.new('RGBA', sheet.size, (0, 0, 0, 0)); tile.paste(pic, at)
            box = (c * CELL_W, r * CELL_H, (c + 1) * CELL_W, (r + 1) * CELL_H)
            clip = Image.new('RGBA', sheet.size, (0, 0, 0, 0)); clip.paste(tile.crop(box), box[:2])
            sheet = Image.alpha_composite(sheet, clip)
    sheet.save(out)
    print(f'Wrote {out}: {sheet.size[0]} x {sheet.size[1]}, scale {scale:.3f}')

if __name__ == '__main__':
    install(sys.argv[1], sys.argv[2])
