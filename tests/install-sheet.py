#!/usr/bin/env python3
# Puts a character sheet made outside the game (ChatGPT) into sprites/, laid out like the player sheet: 3 x 3 cells of
# 128 x 192 pixels (rows front, side facing east, back; columns standing and two steps), feet on the same line.
#   python3 tests/install-sheet.py <picture.png> <out.png> [size]
# size: 1 for a grown-up (the default), about 0.75 for a child or a goblin, more for a tall hat (Hobb's: 1.12).
# It keeps each cell's biggest figure and its painted shadow (stray specks and the red fringe ChatGPT leaves are
# dropped), and scales every cell alike so the standing front figure is HEIGHT times size tall, feet on Sister Ama's line.
# Where a walking step repeats the other one (ChatGPT does that, the back view most), the second is the first mirrored.
# Nothing is painted over: no filter, no added edge (SHEET_VIVID and SHEET_EDGE=1 can still add them).
import os
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageOps, ImageEnhance

CELL_W, CELL_H, FEET_Y, CENTRE_X = 128, 192, 184, 64
EDGE, EDGE_MIX = (78, 58, 38), 0.8  # an added edge's colour, and how much of it
EDGE_ON = os.environ.get('SHEET_EDGE') == '1'  # an extra dark edge round each figure: off (the owner's choice: as painted)
HEIGHT = 146  # a grown-up's standing height in pixels of the sheet, feet to the top of the head (Sister Ama's)
VIVID = float(os.environ.get('SHEET_VIVID', '1.0'))  # colour strength: 1 as painted, more for fuller colours (and a touch more contrast)

def main_figure(cell):
    a = np.array(cell.convert('RGBA'))
    r, g, b, alpha = (a[:, :, i].astype(int) for i in range(4))
    # (bright red specks ChatGPT leaves along the edges: only near the empty background, never red inside a figure)
    clear = alpha <= 100
    near = clear.copy()
    for _ in range(3):
        n = near.copy(); n[1:] |= near[:-1]; n[:-1] |= near[1:]; n[:, 1:] |= near[:, :-1]; n[:, :-1] |= near[:, 1:]; near = n
    # (and pure, glaring red anywhere: no figure is painted in it, but ChatGPT sometimes floods the gaps with it)
    # (only see-through specks: red hair along a figure's own edge is solid and stays)
    fringe = ((r > 150) & (g < 90) & (b < 90) & near & (alpha < 220)) | ((r > 200) & (g < 40) & (b < 40))
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
    # its soft shadow on the ground too: the faint pixels that touch it (a shadow painted under its feet)
    faint = (alpha > 6) & ~fringe & ~((r > 120) & (r > g * 1.8) & (r > b * 1.8)) & ((r + g + b) < 330)  # (the shadow is dark: never red, never a pale haze)
    q = deque(zip(*np.nonzero(keep)))
    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
            if 0 <= ny < h and 0 <= nx < w and faint[ny, nx] and not keep[ny, nx] and alpha[ny, nx] < 200:
                keep[ny, nx] = True
                q.append((ny, nx))
    a[~keep] = 0
    a[fringe & keep, 3] = 0
    out = Image.fromarray(a)
    return out.crop(out.getbbox())  # (with its shadow: the feet are found from the solid part, see install)

def edge(fig):
    a = np.array(fig.convert('RGBA')).astype(float)
    solid = a[:, :, 3] > 200  # (the figure itself; its soft shadow gets no edge)
    pad = np.pad(solid, 1)
    inner = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    ring = solid & ~inner
    a[ring, :3] = a[ring, :3] * (1 - EDGE_MIX) + np.array(EDGE) * EDGE_MIX
    a[ring, 3] = 255
    return Image.fromarray(a.astype(np.uint8))

# Where the eyes are in a cell (the middle of the pair of tall dark ovals every face has), or None.
def eye_y(cell):
    a=np.array(cell.convert('RGBA')).astype(int)
    lum=(a[:,:,0]*30+a[:,:,1]*59+a[:,:,2]*11)/100
    m=(a[:,:,3]>200)&(lum<40)
    h,w=m.shape; seen=np.zeros_like(m); blobs=[]
    for y in range(h):
        for x in range(w):
            if m[y,x] and not seen[y,x]:
                q=deque([(y,x)]); seen[y,x]=True; pts=[]
                while q:
                    cy,cx=q.popleft(); pts.append((cy,cx))
                    for ny,nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                        if 0<=ny<h and 0<=nx<w and m[ny,nx] and not seen[ny,nx]: seen[ny,nx]=True; q.append((ny,nx))
                ys=[p[0] for p in pts]; xs=[p[1] for p in pts]
                bh=max(ys)-min(ys)+1; bw=max(xs)-min(xs)+1
                blobs.append((len(pts),bh,bw,np.mean(ys),np.mean(xs)))
    # eyes: a pair of tall small blobs at about the same height
    cand=[b for b in blobs if b[1]>=b[2]*1.2 and 0.0005*h*w<b[0]<0.01*h*w and b[3]<h*0.65]
    best=None
    for i in range(len(cand)):
        for j in range(i+1,len(cand)):
            p,q=cand[i],cand[j]
            # (a pair: the same height on the face, alike in size and shape, side by side; of several, the highest)
            if (abs(p[3]-q[3])<h*0.03 and abs(p[0]-q[0])<max(p[0],q[0])*0.3 and abs(p[1]-q[1])<=max(p[1],q[1])*0.3
                    and w*0.08<abs(p[4]-q[4])<w*0.45):
                y=(p[3]+q[3])/2
                if not best or y<best[1]: best=(0,y)
    return best[1] if best else None

def alike(p, q):
    """How alike two figures are, 0 (nothing alike) to 1 (the same)."""
    size = (64, 96)
    x = np.array(p.resize(size)).astype(float)
    y = np.array(q.resize(size)).astype(float)
    return 1 - np.abs(x - y).mean() / 255

def build(figs, scale):
    sheet = Image.new('RGBA', (CELL_W * 3, CELL_H * 3), (0, 0, 0, 0))
    for r in range(3):
        for c in range(3):
            f = figs[r][c]
            f = f.resize((max(1, round(f.width * scale)), max(1, round(f.height * scale))), Image.LANCZOS)
            if VIVID != 1:  # (fuller colours; whites, greys and silver stay as they are: only what has colour gets more)
                alpha = f.getchannel('A')
                rich = ImageEnhance.Contrast(ImageEnhance.Color(f.convert('RGB')).enhance(VIVID)).enhance(1 + (VIVID - 1) * 0.25)
                hsv = np.array(f.convert('HSV')).astype(float)
                sat, hue = hsv[:, :, 1] / 255, hsv[:, :, 0] * 360 / 255
                # (yellows, oranges and skin get only a little of it: fuller, not yellower)
                warm = np.clip(1 - np.abs(hue - 35) / 30, 0, 1)
                weight = np.clip((sat - 0.12) / 0.25, 0, 1) * (1 - 0.75 * warm)
                weight = Image.fromarray((weight * 255).astype(np.uint8))
                f = Image.composite(rich, f.convert('RGB'), weight).convert('RGBA')
                f.putalpha(alpha)
            if EDGE_ON:
                f = edge(f)
            # (placed by the figure itself, not its shadow: its feet on the line, its middle in the middle)
            sx0, sy0, sx1, sy1 = f.getchannel('A').point(lambda v: 255 if v > 200 else 0).getbbox() or (0, 0, f.width, f.height)
            sheet.alpha_composite(f, (c * CELL_W + CENTRE_X - (sx0 + sx1) // 2, r * CELL_H + FEET_Y - sy1))
    return sheet

def install(src_path, out_path, size=1.0):
    src = Image.open(src_path).convert('RGBA')
    cw = src.width / 3
    # (the rows are cut where the picture is emptiest near each third, not at the thirds themselves: a tall bun or a hat
    # can reach up past them into the row above)
    solid_rows = (np.array(src)[:, :, 3] > 150).sum(axis=1)
    def cut(at):
        lo, hi = int(at - src.height * 0.12), int(at + src.height * 0.12)
        return lo + int(np.argmin(solid_rows[lo:hi]))
    ys = [0, cut(src.height / 3), cut(src.height * 2 / 3), src.height]
    figs = [[main_figure(src.crop((int(c * cw), ys[r], int((c + 1) * cw), ys[r + 1]))) for c in range(3)] for r in range(3)]
    for r in (0, 2):  # (two steps the same, front or back: the second is the first, mirrored)
        if alike(figs[r][1], figs[r][2]) > 0.97:
            figs[r][2] = ImageOps.mirror(figs[r][1])
            print(f'row {r + 1}: the second step repeated the first: mirrored')
    solid = figs[0][0].getchannel('A').point(lambda v: 255 if v > 200 else 0).getbbox()
    # (sized by the standing front figure's own height, its shadow left out: HEIGHT times size; finding the eyes
    # proved unreliable across ChatGPT's sheets, so a tall hat is given its own size instead)
    scale = HEIGHT * size / ((solid[3] - solid[1]) if solid else figs[0][0].height)
    build(figs, scale).save(out_path)

if __name__ == '__main__':
    install(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
