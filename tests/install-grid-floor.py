"""Put a filled-in ground sheet of square slabs in a straight grid (temple paving, a crypt's flagstones) into the game.

    python3 tests/install-grid-floor.py <filled.png> <ground id> [<out name>]

The sheet's frame lies on its outer joints, where the red cut line spoils them: the inner joints are found, the picture
is cut from one outer joint to the other (one slab further out than the outer inner ones), and the joints along its
edges are laid from a clean inner one, so it repeats without a seam. Writes sprites/<out name> (256 x 256) and lists it
in sprites/custom.js. The ground needs a SEAMLESS entry in js/sprites.js drawing its own picture over 4 x 4 tiles.
"""
import sys, os, re, subprocess, tempfile
import numpy as np
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
src, gid = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else gid.replace('_', '-') + '-own.png'
tmp = tempfile.mkdtemp()
subprocess.run([sys.executable, '-I', os.path.join(here, 'cut-template.py'), src, 'ground', tmp], check=True, capture_output=True)
g = np.array(Image.open(os.path.join(tmp, 'ground-1.png')).convert('RGB'))
d = g.astype(int).mean(2)
def lines(prof):  # (the darkest lines: the joints)
    m = prof.mean()
    return [i for i in range(4, len(prof) - 4) if prof[i] < m - 25 and prof[i] == prof[max(0, i - 6):i + 7].min()]
rows = [r + 40 for r in lines(d[40:-40].mean(1))]; cols = [c + 40 for c in lines(d[:, 40:-40].mean(0))]
assert len(rows) >= 2 and len(cols) >= 2, f'no grid of joints found: rows {rows}, cols {cols}'
sy = (rows[-1] - rows[0]) / (len(rows) - 1); sx = (cols[-1] - cols[0]) / (len(cols) - 1)
y0, y1, x0, x1 = round(rows[0] - sy), round(rows[-1] + sy), round(cols[0] - sx), round(cols[-1] + sx)
a = g[y0:y1, x0:x1].copy(); h, w = a.shape[:2]; B = 6  # (half a joint, and a little: the cut line beside it goes too)
r1, c1 = rows[len(rows) // 2], cols[len(cols) // 2]
band_r = g[r1 - B:r1 + B, x0:x1]; band_c = g[y0:y1, c1 - B:c1 + B]
a[0:B] = band_r[B:]; a[h - B:h] = band_r[:B]; a[:, 0:B] = band_c[:, B:]; a[:, w - B:w] = band_c[:, :B]
a[0:B, 0:B] = g[r1:r1 + B, c1:c1 + B]; a[0:B, w - B:w] = g[r1:r1 + B, c1 - B:c1]
a[h - B:h, 0:B] = g[r1 - B:r1, c1:c1 + B]; a[h - B:h, w - B:w] = g[r1 - B:r1, c1 - B:c1]
Image.fromarray(a).resize((256, 256), Image.LANCZOS).save(os.path.join(root, 'sprites', out))
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
js = re.sub(rf"\n  {gid}: '[^']*',[^\n]*", '', js)
js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  {gid}: '{out}', // the owner's {gid}, slabs in a grid (install-grid-floor.py)\n", 1)
open(custom, 'w').write(js)
print('installed', gid, 'rows', rows, 'cols', cols)
