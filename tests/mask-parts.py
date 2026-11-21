#!/usr/bin/env python3
# Completes a player sheet's map of its parts (sprites/player-mask*.png: red hair, blue shirt, green leather, yellow
# trousers and boots), so every colour of the outfit window has something to colour:
#   - the shirt's embroidery (light pixels inside the blue, left out by the first map) becomes shirt, so a new colour
#     covers the whole shirt and its pattern shows as lighter lines
#   - the leather (shoulder pieces, belt, bracers, straps, pouch: brown pixels round the shirt, not skin) becomes green,
#     the outfit's Secondary
#   - small stray bits of red below the head (a pouch painted over as hair) are dropped
# Gold (buckles, a necklace), skin, eyes and the dark outline are left as painted.
#   python3 tests/mask-parts.py <sheet.png> <mask.png> [<out mask.png>]     (out: the mask itself)
import sys
from collections import deque
import numpy as np
from PIL import Image

CELL_W, CELL_H = 128, 192
RED, BLUE, GREEN, YELLOW = (255, 0, 0), (0, 90, 255), (0, 200, 0), (255, 220, 0)

def kind(m):
    r, g, b, a = (m[..., i] for i in range(4))
    k = np.zeros(r.shape, np.uint8)
    on = a >= 128
    k[on & (r > 200) & (g < 60) & (b < 60)] = 1
    k[on & (r < 60) & (b > 200)] = 2
    k[on & (r < 60) & (g > 150) & (b < 60)] = 3
    k[on & (r > 200) & (g > 180) & (b < 60)] = 4
    return k

def components(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            q, pts = deque([(y, x)]), []
            seen[y, x] = True
            while q:
                cy, cx = q.popleft(); pts.append((cy, cx))
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            yield pts

def neighbours(k, part, radius):
    # how many pixels of the part lie in the square round each pixel
    on = (k == part).astype(np.int32)
    p = np.pad(on, radius)
    s = np.cumsum(np.cumsum(p, 0), 1)
    s = np.pad(s, ((1, 0), (1, 0)))
    d = 2 * radius + 1
    return s[d:, d:] - s[:-d, d:] - s[d:, :-d] + s[:-d, :-d]

def fix_cell(px, k):
    r, g, b, a = (px[..., i].astype(int) for i in range(4))
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    fig = a >= 128
    free = fig & (k == 0)
    skin = (r > 190) & (g > 115) & (b > 75) & (r - g >= 38) & (r - g < 95) & (g - b < 75)  # (peach: redder than the cream cloth)
    gold = (r > 170) & (g > 130) & (b < 95) & (r - b > 110)
    # where the shirt starts: the first row with a good deal of it (a few blue pixels in the eyes don't count; they're dropped)
    full = np.where((k == 2).sum(1) >= 8)[0]
    if len(full):
        k[:max(0, full.min() - 2)][k[:max(0, full.min() - 2)] == 2] = 0
    # (the hair's own dark edges and shadows, next to it: hair)
    for _ in range(2):
        k[(fig & (k == 0)) & (neighbours(k, 1, 1) >= 4) & (lum < 110)] = 1
    free = fig & (k == 0)
    # the shirt's embroidery: light, inside the shirt
    for _ in range(4):
        inside = neighbours(k, 2, 2) >= 7
        k[free & inside & (lum > 100) & ~skin & ~gold] = 2
        free = fig & (k == 0)
    # the leather: brown, round the shirt (between its top and its foot), not skin
    rows = np.where((k == 2).sum(1) >= 8)[0]
    if len(rows):
        top, foot = rows.min() - 10, rows.max() + 2
        band = np.zeros_like(fig); band[max(0, top):foot + 1] = True
        brown = (lum > 26) & (lum < 150) & (r > b + 12) & ~skin & ~gold
        leather = free & band & brown
        k[leather] = 3
        # (its lit edges: a little lighter, next to it)
        for _ in range(2):
            near = neighbours(k, 3, 1) >= 3
            k[(fig & (k == 0)) & band & near & (lum < 175) & (r > b + 12) & ~skin & ~gold] = 3
    # stray red below the head: small bits of "hair" well under the hair's mass
    hair = k == 1
    if hair.any():
        for pts in components(hair):
            ys = [p[0] for p in pts]
            if len(pts) < 160 and rows.size and min(ys) > rows.min() + 6:
                for y, x in pts:
                    k[y, x] = 0
    return k

def main():
    sheet, mask_in = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else mask_in
    px = np.array(Image.open(sheet).convert('RGBA'))
    m = np.array(Image.open(mask_in).convert('RGBA'))
    k = kind(m)
    for y0 in range(0, px.shape[0], CELL_H):
        for x0 in range(0, px.shape[1], CELL_W):
            sl = (slice(y0, y0 + CELL_H), slice(x0, x0 + CELL_W))
            k[sl] = fix_cell(px[sl], k[sl].copy())
    o = np.zeros_like(m)
    for part, col in ((1, RED), (2, BLUE), (3, GREEN), (4, YELLOW)):
        o[k == part] = (*col, 255)
    Image.fromarray(o).save(out)
    print(f'{out}: ' + ', '.join(f'{n} {int((k == p).sum())}' for p, n in ((1, 'hair'), (2, 'shirt'), (3, 'leather'), (4, 'trousers and boots'))))

if __name__ == '__main__':
    main()
