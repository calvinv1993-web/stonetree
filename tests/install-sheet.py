#!/usr/bin/env python3
# Puts a character sheet made outside the game (ChatGPT) into sprites/, laid out like the player sheet: 3 x 3 cells of
# 128 x 192 pixels (rows front, side facing east, back; columns standing and two steps), feet on the same line.
#   python3 tests/install-sheet.py <picture.png> <out.png> [height]
# height: the standing figure's height in pixels (146: Sister Ama, every grown-up; a child or a goblin about 110;
#   more for a tall hat, so the body matches: Postmaster Hobb's wide hat 168).
# It keeps each cell's biggest figure (stray specks and the red or yellow fringe ChatGPT leaves are dropped), scales
# every cell alike so the standing front figure has that height, and puts the feet at the same spot as Sister Ama's.
# Where a walking step repeats the other one (ChatGPT does that, the back view most), the second is the first mirrored.
# Every figure gets Sister Ama's thin edge: its outermost pixels darkened to a warm dark brown (EDGE), so all sheets
# stand out from the ground alike, whatever outline ChatGPT drew.
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageOps

CELL_W, CELL_H, FEET_Y, CENTRE_X = 128, 192, 184, 64
EDGE, EDGE_MIX = (78, 58, 38), 0.8  # Sister Ama's edge colour, and how much of it

def main_figure(cell):
    a = np.array(cell.convert('RGBA'))
    r, g, b, alpha = (a[:, :, i].astype(int) for i in range(4))
    # (bright red specks ChatGPT leaves along the edges: only near the empty background, never red inside a figure)
    clear = alpha <= 100
    near = clear.copy()
    for _ in range(3):
        n = near.copy(); n[1:] |= near[:-1]; n[:-1] |= near[1:]; n[:, 1:] |= near[:, :-1]; n[:, :-1] |= near[:, 1:]; near = n
    fringe = (r > 150) & (g < 90) & (b < 90) & near
    mask = (alpha > 100) & ~fringe
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            comp, q = [], deque([(y, x)])
            seen[y, x] = True
            while q:
                cy, cx = q.popleft()
                comp.append((cy, cx))
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            if len(comp) > len(best):
                best = comp
    keep = np.zeros_like(mask)
    ys, xs = zip(*best)
    keep[list(ys), list(xs)] = True
    for _ in range(2):  # (a little round it: the soft edge)
        k = keep.copy()
        k[1:] |= keep[:-1]; k[:-1] |= keep[1:]; k[:, 1:] |= keep[:, :-1]; k[:, :-1] |= keep[:, 1:]
        keep = k
    a[~keep] = 0
    a[fringe & keep, 3] = 0
    out = Image.fromarray(a)
    return out.crop(out.getbbox())

def edge(fig):
    a = np.array(fig.convert('RGBA')).astype(float)
    solid = a[:, :, 3] > 128
    pad = np.pad(solid, 1)
    inner = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    ring = solid & ~inner
    a[ring, :3] = a[ring, :3] * (1 - EDGE_MIX) + np.array(EDGE) * EDGE_MIX
    a[ring, 3] = 255
    return Image.fromarray(a.astype(np.uint8))

def alike(p, q):
    """How alike two figures are, 0 (nothing alike) to 1 (the same)."""
    size = (64, 96)
    x = np.array(p.resize(size)).astype(float)
    y = np.array(q.resize(size)).astype(float)
    return 1 - np.abs(x - y).mean() / 255

def install(src_path, out_path, height=146):
    src = Image.open(src_path).convert('RGBA')
    cw, ch = src.width / 3, src.height / 3
    figs = [[main_figure(src.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))) for c in range(3)] for r in range(3)]
    scale = height / figs[0][0].height
    sheet = Image.new('RGBA', (CELL_W * 3, CELL_H * 3), (0, 0, 0, 0))
    for r in range(3):
        if alike(figs[r][1], figs[r][2]) > 0.97:  # (two steps the same: the second is the first, mirrored)
            figs[r][2] = ImageOps.mirror(figs[r][1]) if r != 1 else figs[r][2]
            print(f'row {r + 1}: the second step repeated the first: mirrored' if r != 1 else 'row 2: the steps look alike (side view, kept)')
        for c in range(3):
            f = figs[r][c]
            f = edge(f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS))
            sheet.alpha_composite(f, (c * CELL_W + CENTRE_X - f.width // 2, r * CELL_H + FEET_Y - f.height))
    sheet.save(out_path)

if __name__ == '__main__':
    install(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 146)
