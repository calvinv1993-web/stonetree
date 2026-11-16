"""Put a sheet of painted world things (seen in the game's own camera) into the game.

    python3 tests/install-world.py <sheet.png> <columns> <id=kind:w[:h]> ...   (- to skip a cell)

kind: flat (lies on its tile, from above: fitted into w tiles, centred on it) or stand (stands on its tile and rises
up-left: fitted into w tiles wide and h tall, its foot at the bottom right, as every thing with height is drawn).
Each is cut by its painted shape (in reading order), the fringe a painting tool leaves round its edges dropped (red,
yellow, and pale half see-through), and saved as sprites/<id>@4x.png: 80 x 80 world pixels at 4 pixels each, its
tile in the bottom-right corner, listed in sprites/custom.js. Then run node tests/sprite-versions.js.
"""
import sys, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
src, cols, specs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
a = np.array(Image.open(src).convert('RGBA')).astype(float)
R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
lum = (R + G + B) / 3
fringe = (A < 235) & (((R > G + 50) & (R > B + 50)) | ((R > 150) & (G > 150) & (B < 90)) | ((lum > 165) & (A < 200)))
a[fringe, 3] = 0
solid = a[..., 3] > 110
lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=8))
sizes = ndimage.sum(solid, lab, range(1, n + 1))
big = [k + 1 for k, s in enumerate(sizes) if s >= np.median(sorted(sizes)[-len(specs):]) * 0.1]
boxes = {k: ndimage.find_objects((lab == k).astype(int))[0] for k in big}
cy = {k: (b[0].start + b[0].stop) / 2 for k, b in boxes.items()}; cx = {k: (b[1].start + b[1].stop) / 2 for k, b in boxes.items()}
rowh = a.shape[0] / ((len(specs) + cols - 1) // cols)
rows = []
for k in sorted(big, key=lambda k: cy[k]):
    if rows and abs(cy[k] - np.mean([cy[j] for j in rows[-1]])) < rowh * 0.5: rows[-1].append(k)
    else: rows.append([k])
blobs = [k for r in rows for k in sorted(r, key=lambda k: cx[k])]
if len(blobs) != len(specs): sys.exit(f'found {len(blobs)} shapes for {len(specs)} cells')
T, S = 128, 320  # a tile at 4 pixels a world pixel; the picture: 80 x 80 world pixels
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
for k, spec in zip(blobs, specs):
    if spec == '-': continue
    gid, how = spec.split('='); kind, *dims = how.split(':'); dims = [float(d) for d in dims]
    b = boxes[k]; cell = a[b[0], b[1]].copy(); cell[lab[b[0], b[1]] != k, 3] = 0
    ys, xs = np.nonzero(cell[..., 3] > 12); cell = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = Image.fromarray(cell.clip(0, 255).astype(np.uint8), 'RGBA')
    w, h = dims[0] * T, (dims[1] if len(dims) > 1 else dims[0]) * T
    s = min(w / img.width, h / img.height); img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (S, S))
    if kind == 'flat': out.alpha_composite(img, (S - T + (T - img.width) // 2, S - T + (T - img.height) // 2))
    else: out.alpha_composite(img, (max(0, S - img.width - 4), max(0, S - img.height - 6)))  # (its foot at the tile's bottom right)
    name = f'{gid.replace("_", "-")}@4x.png'; out.save(os.path.join(root, 'sprites', name))
    js = re.sub(rf"\n  {gid}: '[^']*',[^\n]*", '', js)
    js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  {gid}: '{name}', // the owner's picture, in the world's camera (install-world.py)\n", 1)
    print('installed', gid)
open(custom, 'w').write(js)
