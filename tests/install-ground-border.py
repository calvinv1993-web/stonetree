"""Put a filled-in ground + border template (docs/templates/ground-border.png) into the game in one go.

    python3 tests/install-ground-border.py <filled.png> <ground id, e.g. grass>

The square becomes the ground (as install-ground.py), the strip its ragged border on all four sides (as install-border.py),
both from the one sheet, so they match exactly.
"""
import sys, os, subprocess, tempfile, shutil
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
src, gid = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp()
subprocess.run([sys.executable, '-I', os.path.join(here, 'cut-template.py'), src, 'ground-border', tmp], check=True)
import numpy as np
from scipy import ndimage
sys.path.insert(0, here)
import importlib.util
spec = importlib.util.spec_from_file_location('ct', os.path.join(here, 'cut-template.py')); ct = importlib.util.module_from_spec(spec); spec.loader.exec_module(ct)
root = os.path.join(here, '..')
# the ground: as install-ground.py
size = 256
out = gid.replace('_', '-') + '-own.png'
g = np.array(Image.open(os.path.join(tmp, 'ground-border-1.png')).convert('RGB')).astype(int)
# (its edges: drop any rows and columns of the sheet's pale paper or frame line, then make it seamless again)
pale = lambda v: ((v.min(-1) > 190) & (v.max(-1) - v.min(-1) < 50)).mean() > 0.05
H, W = g.shape[:2]; E = 48  # (within this of each edge: the last pale line there and all outside it go)
t = max([y + 1 for y in range(E) if pale(g[y])], default=0)
b_ = min([y for y in range(H - E, H) if pale(g[y])], default=H)
l = max([x + 1 for x in range(E) if pale(g[:, x])], default=0)
r = min([x for x in range(W - E, W) if pale(g[:, x])], default=W)
m = 3; g = g[t + m:b_ - m, l + m:r - m]
gi = ct.seamless(Image.fromarray(g.astype(np.uint8)).resize((512, 512), Image.LANCZOS), both=True)
gi.convert('RGB').resize((size, size), Image.LANCZOS).save(os.path.join(root, 'sprites', out))
# the border: the sheet's pale paper and bleed made see-through (all of it connected to the strip's lower edge, and any
# pale rows along its top), the strip trimmed to where the ground starts, made seamless, then turned for the four sides
a = np.array(Image.open(os.path.join(tmp, 'ground-border-2.png')).convert('RGBA')).astype(int)
mx, mn = a[:, :, :3].max(2), a[:, :, :3].min(2)
paper = (mn > 165) & (mx - mn < 45)   # (the paper, and the pale fringe it left round the tufts)
lab, n = ndimage.label(paper)
edge = set(np.unique(np.concatenate([lab[-1], lab[0], lab[:, 0], lab[:, -1]]))) - {0}
a[np.isin(lab, list(edge)), 3] = 0
rows = np.nonzero((a[:, :, 3] > 0).mean(1) > 0.9)[0]
top = rows[0] if len(rows) else 0
a = a[top:]
cut = max(4, a.shape[1] // 40); a = a[:, cut:-cut]   # (its ends: the sheet's bleed and frame lines)
filled = np.nonzero((a[:, :, 3] > 0).mean(1) > 0.02)[0]; a = a[:filled[-1] + 2]
# every white or near-white pixel left anywhere in the border (paper caught between tufts, a pale fringe) goes too,
# and what borders it is faded, so no light halo stays round the tufts
light = (a[:, :, :3].min(2) > 150) & ((a[:, :, :3].max(2) - a[:, :, :3].min(2)) < 60)
a[light, 3] = 0
near = ndimage.binary_dilation(light, iterations=1) & ~light
a[near, 3] = a[near, 3] // 2
strip = Image.fromarray(a.astype(np.uint8), 'RGBA')
strip = ct.seamless(strip.resize((512, max(16, round(strip.height * 512 / strip.width))), Image.LANCZOS), both=False)
strip = strip.resize((256, 32), Image.LANCZOS)
cells = []
for k in range(4):
    c = Image.new('RGBA', (64, 64)); c.alpha_composite(strip.crop((k * 64, 0, k * 64 + 64, 32)), (0, 0)); cells.append(c)
import re
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
js = re.sub(rf"\n  {gid}: '[^']*',[^\n]*", '', js)
js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  {gid}: '{out}', // the owner's {gid}, from above (ground + border template)\n", 1)
for d, ang in {'n': 0, 'e': -90, 's': 180, 'w': 90}.items():
    row = Image.new('RGBA', (256, 64))
    for k, c in enumerate(cells): row.alpha_composite(c.rotate(ang), (k * 64, 0))
    name = f'edge-{gid.replace("_", "-")}-{d}.png'; row.save(os.path.join(root, 'sprites', name))
    js = re.sub(rf"\n  edge_{gid}_{d}: '[^']*',[^\n]*", '', js)
    js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  edge_{gid}_{d}: '{name}', // the owner's {gid} border (ground + border template)\n", 1)
open(custom, 'w').write(js); print('installed', gid, 'and its border')
