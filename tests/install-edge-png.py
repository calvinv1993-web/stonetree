"""Put a ground's ragged edge, given as a loose see-through PNG, into the game.

    python3 tests/install-edge-png.py <edge.png> <ground id, e.g. sand>

The PNG: the ground along its top, its ragged edge below fading to transparent (no template sheet, no paper). It is cut
to what's painted, its two ends trimmed and blended into each other so it repeats, and turned for the four sides:
sprites/edge-<id>-n/e/s/w.png, listed in sprites/custom.js as edge_<id>_n... (as tests/install-ground-border.py does
from a sheet).
"""
import sys, os, re
import importlib.util
import numpy as np
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
spec = importlib.util.spec_from_file_location('ct', os.path.join(here, 'cut-template.py')); ct = importlib.util.module_from_spec(spec); spec.loader.exec_module(ct)
src, gid = sys.argv[1], sys.argv[2]

a = np.array(Image.open(src).convert('RGBA'))
solid = a[:, :, 3] > 20
ys, xs = np.nonzero(solid)
a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
# its ends: a straight cut or a soft fade there would show where it repeats; a little of each goes
cut = max(4, a.shape[1] // 50); a = a[:, cut:-cut]
# the rows along its top that aren't filled across (a soft start) go too, so the ground meets the tile's edge
rows = np.nonzero((a[:, :, 3] > 200).mean(1) > 0.97)[0]
if len(rows): a = a[rows[0]:]
strip = Image.fromarray(a, 'RGBA')
strip = ct.seamless(strip.resize((512, max(16, round(strip.height * 512 / strip.width))), Image.LANCZOS), both=False)
strip = strip.resize((256, 32), Image.LANCZOS)
cells = []
for k in range(4):
    c = Image.new('RGBA', (64, 64)); c.alpha_composite(strip.crop((k * 64, 0, k * 64 + 64, 32)), (0, 0)); cells.append(c)
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
for d, ang in {'n': 0, 'e': -90, 's': 180, 'w': 90}.items():
    row = Image.new('RGBA', (256, 64))
    for k, c in enumerate(cells): row.alpha_composite(c.rotate(ang), (k * 64, 0))
    name = f'edge-{gid.replace("_", "-")}-{d}.png'; row.save(os.path.join(root, 'sprites', name))
    js = re.sub(rf"\n  edge_{gid}_{d}: '[^']*',[^\n]*", '', js)
    js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  edge_{gid}_{d}: '{name}', // the owner's {gid} border (a loose PNG: install-edge-png.py)\n", 1)
open(custom, 'w').write(js)
print('installed the border of', gid)
