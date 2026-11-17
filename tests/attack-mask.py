#!/usr/bin/env python3
# A parts map for an attack sheet (install-attack-sheet.py), worked out from its colours, cell by cell: the hair (red: the
# biggest brown blob at the top of the figure), the tunic (blue: its blue), the trousers (green: the dull grey-browns
# between the belt and the boots) and the boots (yellow: the dark browns at the feet). The weapon is left out: it is thin,
# and what it's made of keeps its own colours.
#   python3 tests/attack-mask.py sprites/player-attack-spear.png sprites/player-attack-spear-mask.png
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

CELL_W, CELL_H = 256, 192
src, out = sys.argv[1:3]
im = np.array(Image.open(src).convert('RGBA')).astype(float) / 255
r, g, b, a = (im[:, :, i] for i in range(4))
v = im[:, :, :3].max(axis=2); mn = im[:, :, :3].min(axis=2); d = v - mn
s = np.where(v > 0, d / np.maximum(v, 1e-6), 0)
dd = np.maximum(d, 1e-6)
h = np.where(v == r, ((g - b) / dd) % 6, np.where(v == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
h = np.where(d == 0, 0, (h + 360) % 360)
solid = a > 0.5
mask = np.zeros(im.shape[:2] + (4,), np.uint8)
paint = (lambda m, rgb: mask.__setitem__(m, list(rgb) + [255]))

def biggest(m, n=1, least=0):
    lab, k = ndimage.label(m)
    if not k: return np.zeros_like(m)
    sizes = ndimage.sum(m, lab, range(1, k + 1))
    keep = [i + 1 for i in np.argsort(-sizes)[:n] if sizes[i] >= least]
    return np.isin(lab, keep)

for row in range(3):
    for col in range(3):
        y0, x0 = row * CELL_H, col * CELL_W
        sl = (slice(y0, y0 + CELL_H), slice(x0, x0 + CELL_W))
        S, H, V, Sa, A = solid[sl], h[sl], v[sl], s[sl], np.ones_like(solid[sl])
        ys = np.where(S.any(axis=1))[0]
        if not len(ys): continue
        top, bot = ys.min(), ys.max()
        # (the body's own top: the head, not the spear's blade above it, from the widest rows' extent)
        widths = S.sum(axis=1)
        body = np.where(widths > 18)[0]
        top = body.min() if len(body) else top
        tall = bot - top
        yy = np.arange(CELL_H)[:, None] * np.ones((1, CELL_W))
        S = S & (A > 0) & (a[sl] > 0.9)  # (the soft shadow under the feet is see-through: never a part)
        brown = S & ((H < 45) | (H > 340)) & (Sa > 0.25) & (V > 0.12) & (V < 0.75)
        hair = biggest(ndimage.binary_opening(brown & (yy < top + tall * 0.42), iterations=2))  # (not the spear's thin shaft)
        hair = ndimage.binary_dilation(hair, iterations=2) & brown & (yy < top + tall * 0.42)
        tunic = S & (H > 200) & (H < 250) & (Sa > 0.3)
        tunic = ndimage.binary_closing(tunic, iterations=1) & S & ~hair & (Sa > 0.2) & (H > 190) & (H < 260)
        # the legs: the browns below the tunic, in one piece with the body (not the spear's thin shaft); in this picture
        # the trousers and boots are both brown, so they're told apart by height: the boots the lowest part of the legs
        # (not the belt: anything with the tunic's hem still below it in its column)
        below = np.flipud(np.maximum.accumulate(np.flipud(tunic), axis=0))
        brownish = S & ((H < 50) | (H > 330)) & (Sa > 0.24) & (V > 0.07) & (V < 0.62) & ~hair & ~tunic & ~below
        legs = brownish & (yy > top + tall * 0.6)
        legs = ndimage.binary_opening(legs, iterations=3)
        near = ndimage.binary_dilation(tunic, iterations=4)
        lab, k = ndimage.label(legs)
        legs = np.isin(lab, [i for i in range(1, k + 1) if (lab == i).sum() >= 40 and ((near & (lab == i)).any() or ((lab == i) & (yy > top + tall * 0.8)).any())])
        legs = ndimage.binary_dilation(legs, iterations=2) & brownish & (yy > top + tall * 0.6)
        foot = legs & (yy > top + tall * 0.83)
        trousers = legs & ~foot
        # (a boot is joined to the trousers: the spear's blade, low beside the feet in a follow-through, isn't)
        lab, k = ndimage.label(foot)
        touch = ndimage.binary_dilation(trousers, iterations=2)
        boots = np.isin(lab, [i for i in range(1, k + 1) if (touch & (lab == i)).any()])
        xs = np.where(trousers.any(axis=0))[0]
        if len(xs): boots[:, :max(0, xs.min() - 6)] = False; boots[:, xs.max() + 7:] = False  # (no wider than the legs)
        for m, rgb in ((hair, (255, 0, 0)), (tunic, (0, 0, 255)), (trousers, (0, 200, 0)), (boots, (255, 220, 0))):
            full = np.zeros_like(solid); full[sl] = m
            paint(full, rgb)
Image.fromarray(mask, 'RGBA').save(out)
print('parts', [(mask[:, :, :3] == c).all(axis=2).sum() for c in ((255, 0, 0), (0, 0, 255), (0, 200, 0), (255, 220, 0))])
