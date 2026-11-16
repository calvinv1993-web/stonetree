"""Put a sheet of painted item pictures into the game.

    python3 tests/install-items.py <sheet.png> <columns> <id> <id> ...

The sheet: a transparent PNG with the items in a grid (columns across, as many rows as needed), in the order of the
ids given (use - to skip a cell). Each cell is cut to what's painted in it (faint specks and the reddish fringe a
painting tool leaves round its edges dropped), centred on a 96 x 96 picture with a little margin, saved as
sprites/items/<id>@3x.png and listed in sprites/custom.js (replacing what was there for that id). Then run
node tests/sprite-versions.js.
"""
import sys, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
src, cols, ids = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
a = np.array(Image.open(src).convert('RGBA')).astype(float)
H, W = a.shape[:2]; rows = (len(ids) + cols - 1) // cols
cw, ch = W / cols, H / rows
SIZE, MARGIN = 96, 3
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
os.makedirs(os.path.join(root, 'sprites', 'items'), exist_ok=True)
# Where each item lies: the painted blobs of the whole sheet (parts near each other joined), big ones only, in reading
# order (rows by height, then left to right). A painting whose items reach past their grid cell is cut right this way;
# if the count doesn't match the ids, the grid's cells are used instead.
solid_all = a[..., 3] > 110
joined = ndimage.binary_dilation(solid_all, iterations=6)
lab_all, n_all = ndimage.label(joined)
sizes_all = ndimage.sum(solid_all, lab_all, range(1, n_all + 1))
big = [k + 1 for k, sz in enumerate(sizes_all) if sz >= np.median(sorted(sizes_all)[-len(ids):]) * 0.12]
boxes = {k: ndimage.find_objects((lab_all == k).astype(int))[0] for k in big}
cent = {k: ((bx[0].start + bx[0].stop) / 2, (bx[1].start + bx[1].stop) / 2) for k, bx in boxes.items()}
order = []
for k in sorted(big, key=lambda k: cent[k][0]):  # rows: a new one where the height jumps by over half a cell
    if order and abs(cent[k][0] - np.mean([cent[j][0] for j in order[-1]])) < ch * 0.5: order[-1].append(k)
    else: order.append([k])
blobs = [k for row in order for k in sorted(row, key=lambda k: cent[k][1])]
use_blobs = len(blobs) == len(ids)
print('cut by', 'the painted shapes' if use_blobs else f'the grid (found {len(blobs)} shapes for {len(ids)} ids)')
for i, gid in enumerate(ids):
    if gid == '-': continue
    if use_blobs:
        k = blobs[i]; bx = boxes[k]
        cell = a[bx[0], bx[1]].copy()
        cell[(lab_all[bx[0], bx[1]] != k), 3] = 0
    else:
        r, c = divmod(i, cols)
        cell = a[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)].copy()
    al = cell[..., 3]
    # the reddish fringe round the edges: half see-through and red
    R, G, B = cell[..., 0], cell[..., 1], cell[..., 2]
    fringe = (al < 235) & (R > G + 50) & (R > B + 50)
    cell[fringe, 3] = 0
    solid = cell[..., 3] > 110
    lab, n = ndimage.label(solid)
    if not n: print('nothing in the cell of', gid); continue
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = np.isin(lab, [k + 1 for k, s in enumerate(sizes) if s >= max(30, sizes.max() * 0.02)])
    near = ndimage.binary_dilation(keep, iterations=3)
    cell[~near, 3] = 0           # faint specks away from the item go
    cell[near & (cell[..., 3] < 25), 3] = 0
    ys, xs = np.nonzero(cell[..., 3] > 20)
    crop = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = Image.fromarray(crop.clip(0, 255).astype(np.uint8), 'RGBA')
    s = (SIZE - 2 * MARGIN) / max(img.width, img.height)
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE)); out.alpha_composite(img, ((SIZE - img.width) // 2, (SIZE - img.height) // 2))
    name = f'items/{gid}@3x.png'; out.save(os.path.join(root, 'sprites', name))
    js = re.sub(rf"\n  {gid}: '[^']*',[^\n]*", '', js)
    js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  {gid}: '{name}', // the owner's item picture (install-items.py)\n", 1)
    print('installed', gid)
open(custom, 'w').write(js)
