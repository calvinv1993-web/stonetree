#!/usr/bin/env python3
# Takes the old tree emblem (Oakvale's) out of SORTIA's vocation-screen paintings, leaving plain cloth and steel (the
# owner's choice: no emblem at all): the hall's banners and the cloth on the chest (sprites/ui/sortia/vocation-hall.webp,
# then its tall version), Bastion's shield and breastplate (bastion-portrait.webp), and the wax seal at the foot of the
# story's parchment (sprites/ui/parchment/story-panel.webp, from docs/parchment-ui/story-parchment.png). Each spot is a box on the
# painting: the tree's gold is found by its colour inside it and painted over from the cloth or steel round it (OpenCV
# inpainting). A spot can still be given the SORTIA seal, worked in gold: (size, tint, alpha) in place of None.
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
    (68, 70, 152, 215, False, None),
    (868, 52, 952, 198, False, None),
    (470, 440, 554, 562, 'dim', None),
    (56, 1326, 140, 1456, False, None),
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
    (330, 245, 432, 448, False, None),
    (148, 178, 218, 244, True, None),
])
bastion.save(ROOT + 'bastion-portrait.webp', 'WEBP', quality=90)
# the story's parchment (and the name screen's, the same picture): the tree on the wax seal at its foot; its alpha kept
panel = Image.open('sprites/ui/parchment/story-panel.webp').convert('RGBA')
alpha = panel.getchannel('A')
panel = treat(panel, [(538, 1032, 662, 1140, False, None)]).convert('RGBA')
# (the tree's shadow still shows in the wax: the seal's flat middle smoothed, its raised rim as it is)
from PIL import ImageFilter, ImageDraw
soft = panel.filter(ImageFilter.GaussianBlur(9))
disc = Image.new('L', panel.size, 0)
ImageDraw.Draw(disc).ellipse((600 - 50, 1084 - 50, 600 + 50, 1084 + 50), fill=255)
panel = Image.composite(soft, panel, disc.filter(ImageFilter.GaussianBlur(6)))
panel.putalpha(alpha)
panel.save('sprites/ui/parchment/story-panel.webp', 'WEBP', lossless=True)
print('done')
