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
for i, gid in enumerate(ids):
    if gid == '-': continue
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
