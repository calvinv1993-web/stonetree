#!/usr/bin/env python3
# A first parts map for a player sheet, worked out from its colours (until a painted one is made: install-sheet.py --mask):
#   python3 tests/auto-mask.py sprites/player-sheet.png sprites/player-mask.png <preview.png>   (female: a file name with "female")
# a parts map for a player sheet, worked out from its colours: hair (red), tunic (blue), trousers (green), boots (yellow)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out, prev = sys.argv[1:4]
im = np.array(Image.open(src).convert('RGBA')).astype(float)
r, g, b, a = [im[:, :, i] / 255 for i in range(4)]
v = np.max(im[:, :, :3], axis=2) / 255; mn = np.min(im[:, :, :3], axis=2) / 255; d = v - mn
s = np.where(v > 0, d / np.maximum(v, 1e-6), 0)
dd = np.maximum(d, 1e-6)
h = np.where(v == r, ((g - b) / dd) % 6, np.where(v == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
h = np.where(d == 0, 0, (h + 360) % 360)
H, W = v.shape
yy = (np.arange(H)[:, None] % 192) / 4 * np.ones_like(v)
solid = a > 0.5
part = np.zeros((H, W), int)

female = 'female' in src
row = (np.arange(H)[:, None] // 192) * np.ones((1, W), int)  # 0 front, 1 side, 2 back
skin = solid & (h > 12) & (h < 32) & (s > 0.3) & (s < 0.62) & (v > 0.7) & (yy > 13)
cream = solid & (h > 22) & (h < 58) & (s < 0.45) & (v > 0.5) & ~skin
gold = solid & (h > 33) & (h < 60) & (s >= 0.45) & (v > 0.55)
brown = solid & ((h < 40) | (h > 340)) & (s > 0.3) & (v > 0.12) & (v < 0.7) & ~skin
# the hair: the dark browns joined to the top of the head; a man's ends at the neck, a woman's hangs to the waist (where
# it is told from the leather by its colour: a cooler, darker brown)
hairish = brown & (yy < (34 if female else 24.5))
if female:
    hairish &= (yy < 26) | ((h < 23.5) & (v < 0.5))
lab, n = ndimage.label(hairish)
hair = np.isin(lab, list(set(np.unique(lab[hairish & (yy < 15)])) - {0}))
body = ndimage.binary_closing(cream, iterations=1) & solid & ~gold & ~skin & ~hair
# the boots: the browns that reach the ground (and their part down there)
low = brown & ~hair & ~body & (yy >= 34) & (h < 28)
lab, n = ndimage.label(ndimage.binary_opening(low, iterations=2))
boots = np.isin(lab, list(set(np.unique(lab[low & (yy >= 44)])) - {0}))
boots = ndimage.binary_dilation(boots, iterations=2) & low
part[body] = 2
part[hair] = 1
part[boots] = 4
pal = np.array([[0, 0, 0, 0], [255, 0, 0, 255], [0, 90, 255, 255], [0, 200, 0, 255], [255, 220, 0, 255]], np.uint8)
Image.fromarray(pal[part]).save(out, optimize=True)
o = im.copy(); on = part > 0
o[on, :3] = o[on, :3] * 0.35 + pal[part][on, :3] * 0.65
bg = np.zeros_like(o); bg[:, :] = [122, 154, 90, 255]
al = o[:, :, 3:4] / 255
comp = (o[:, :, :3] * al + bg[:, :, :3] * (1 - al)).astype(np.uint8)
Image.fromarray(comp).resize((W * 2, H * 2), Image.NEAREST).save(prev)
print([(part == k).sum() for k in range(5)])
