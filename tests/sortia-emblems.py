#!/usr/bin/env python3
# Takes the old tree emblem (Oakvale's) out of SORTIA's vocation-screen paintings and, where it was a crest, puts the
# SORTIA seal there instead, worked in the same gold: the hall's banners and the cloth on the chest (sprites/ui/sortia/
# vocation-hall.webp, then its tall version), and Bastion's shield and breastplate (bastion-portrait.webp).
# Each spot is a box on the painting: the tree's gold is found by its colour inside it, painted over from the cloth or
# steel round it (OpenCV inpainting), and the seal laid on it, sized to the box, as embroidery or engraving.
#   python3 -I tests/sortia-emblems.py <the seal: sortia-seal-native.png>
# Run it once on the kit's originals (it reads and writes sprites/ui/sortia/); then node tests/sprite-versions.js.
import sys
import numpy as np
import cv2
from PIL import Image, ImageEnhance

SEAL = Image.open(sys.argv[1]).convert('RGBA')
ROOT = 'sprites/ui/sortia/'

def gold_mask(px, strict):
    r, g, b = (px[..., i].astype(int) for i in range(3))
    if strict == 'dim':  # (the far banner, deep in the dark: its tree only a little brighter than the cloth)
        lum = 0.3 * r + 0.59 * g + 0.11 * b
        return (lum > np.median(lum) + 4) & (r - b >= 2)
    gold = (r > 70) & (g > 0.48 * r) & (g > b + 12) & (r - b > 30)
    if strict:  # (on steel: only the warm gold, not the grey metal)
        gold &= (r - b > 45)
    return gold

def seal_tile(size, tint, alpha):
    s = SEAL.copy()
    k = size / max(s.size)
    s = s.resize((max(1, round(s.width * k)), max(1, round(s.height * k))), Image.LANCZOS)
    a = np.array(s).astype(float)
    lum = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]) / 255
    out = np.zeros_like(a)
    for i in range(3):
        out[..., i] = np.clip(tint[i] * (0.35 + 1.1 * lum), 0, 255)
    out[..., 3] = a[..., 3] * alpha
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def treat(img, spots):
    px = np.array(img.convert('RGB'))
    mask = np.zeros(px.shape[:2], np.uint8)
    for (x0, y0, x1, y1, strict, *_ ) in spots:
        m = gold_mask(px[y0:y1, x0:x1], strict)
        mask[y0:y1, x0:x1][m] = 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
    bgr = cv2.cvtColor(px, cv2.COLOR_RGB2BGR)
    bgr = cv2.inpaint(bgr, mask, 6, cv2.INPAINT_TELEA)
    out = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).convert('RGBA')
    for (x0, y0, x1, y1, strict, seal) in spots:
        if not seal:
            continue
        size, tint, alpha = seal
        t = seal_tile(size, tint, alpha)
        out.alpha_composite(t, ((x0 + x1 - t.width) // 2, (y0 + y1 - t.height) // 2))
    return out.convert('RGB')

GOLD = (214, 168, 92)
# the hall: the two banners up front, the far banner (dim), the cloth on the chest
hall = Image.open(ROOT + 'vocation-hall.webp')
hall = treat(hall, [
    (68, 70, 152, 215, False, (64, GOLD, 0.78)),
    (868, 52, 952, 198, False, (64, GOLD, 0.78)),
    (470, 440, 554, 562, 'dim', (54, (120, 88, 50), 0.45)),
    (56, 1326, 140, 1456, False, (60, GOLD, 0.72)),
])
hall.save(ROOT + 'vocation-hall.webp', 'WEBP', quality=86)
# (its tall version for a tall phone: the dark middle drawn out, banners and candles as they are)
W, H = hall.size
top, mid, foot = hall.crop((0, 0, W, 620)), hall.crop((0, 620, W, 1040)), hall.crop((0, 1040, W, H))
newH = 2220; midH = newH - 620 - (H - 1040)
tall = Image.new('RGB', (W, newH)); tall.paste(top, (0, 0)); tall.paste(mid.resize((W, midH), Image.LANCZOS), (0, 620)); tall.paste(foot, (0, 620 + midH))
tall.save(ROOT + 'vocation-hall-tall.webp', 'WEBP', quality=82)
# Bastion: the shield's crest and the breastplate's engraving
bastion = Image.open(ROOT + 'bastion-portrait.webp')
bastion = treat(bastion, [
    (330, 245, 432, 448, False, (84, GOLD, 0.85)),
    (148, 178, 218, 244, True, (48, (196, 160, 104), 0.62)),
])
bastion.save(ROOT + 'bastion-portrait.webp', 'WEBP', quality=90)
print('done')
