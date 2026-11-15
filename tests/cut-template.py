"""Cut the frames out of a filled-in template (docs/templates/*.png) at their exact sizes.

    python3 tests/cut-template.py <filled.png> <template name: wall|ground|on-wall|thing|item> <out folder>

Finds the pink corner marks round each frame (also when the sheet came back scaled), cuts each frame out and scales it
to the frame's own size; a plain white or checkerboard background is made see-through. Writes <name>-<n>.png.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

SIZES = {'wall': [(512, 128), (512, 32)], 'ground': [(512, 512)], 'on-wall': [(256, 256)],
         'thing': [(256, 256), (384, 384), (512, 512)], 'item': [(256, 256)], 'front': [(512, 512)]}

def frames(img):
    """The frames on the sheet, top-left first: [(x0, y0, x1, y1, scale)] in the sheet's pixels, the frame's own edges."""
    a = np.array(img.convert('RGB')).astype(int)
    pink = (a[:, :, 0] > 200) & (a[:, :, 1] < 90) & (a[:, :, 2] > 200)
    lab, n = ndimage.label(pink)
    corners = {'tl': [], 'tr': [], 'bl': [], 'br': []}
    for s in ndimage.find_objects(lab):
        y0, y1, x0, x1 = s[0].start, s[0].stop - 1, s[1].start, s[1].stop - 1
        if (x1 - x0) < 6 or (y1 - y0) < 6: continue
        scale = (x1 - x0 + 1) / 19                                  # (a mark's arm is 19 px long on the template)
        box = pink[y0:y1 + 1, x0:x1 + 1]
        # its outer corner: where a full row and a full column of the mark meet (an L: one row, one column)
        rows = {'t': box[:max(2, box.shape[0] // 4)].mean(), 'b': box[-max(2, box.shape[0] // 4):].mean()}
        cols = {'l': box[:, :max(2, box.shape[1] // 4)].mean(), 'r': box[:, -max(2, box.shape[1] // 4):].mean()}
        v, h = max(rows, key=rows.get), max(cols, key=cols.get)
        corners[v + h].append((x0 if h == 'l' else x1, y0 if v == 't' else y1, scale))
    rects = []
    for (x0, y0, s) in corners['tl']:
        tr = [c for c in corners['tr'] if abs(c[1] - y0) < 6 * s and c[0] > x0]
        bl = [c for c in corners['bl'] if abs(c[0] - x0) < 6 * s and c[1] > y0]
        if not tr or not bl: continue
        x1 = min(tr)[0]; y1 = min(bl, key=lambda c: c[1])[1]
        m = 8 * s                                                   # (the marks sit 8 px outside the frame)
        rects.append((x0 + m, y0 + m, x1 - m + 1, y1 - m + 1))
    return sorted(rects, key=lambda r: (round(r[1] / 60), r[0]))

def clean(piece):
    a = np.array(piece.convert('RGBA')).astype(int)
    mx, mn = a[:, :, :3].max(2), a[:, :, :3].min(2)
    bg = (mx - mn < 14) & (mn > 215)
    lab, n = ndimage.label(bg)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    a[np.isin(lab, list(edge)), 3] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    src, kind, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    img = Image.open(src)
    rects, sizes = frames(img), SIZES[kind]
    for k, ((x0, y0, x1, y1), (w, h)) in enumerate(zip(rects, sizes)):
        box = (round(x0), round(y0), round(x1), round(y1))
        piece = img.crop(box).resize((w, h), Image.LANCZOS)
        if kind not in ('wall', 'ground'): piece = clean(piece)
        piece.save(os.path.join(out, f'{kind}-{k + 1}.png'))
        print(f'{kind}-{k + 1}.png', box, (w, h))
