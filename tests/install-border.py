"""Put a filled-in border template (docs/templates/border.png) into the game: a ground's ragged edge over lower ground.

    python3 tests/install-border.py <filled.png> <ground id, e.g. grass>

Cuts the edge strip (the ground at its top, its edge fading to transparent), makes it seamless, and turns it for the four
sides: sprites/edge-<id>-n/e/s/w.png, listed in sprites/custom.js as edge_<id>_n... The game lays it wherever the
ground meets a lower one (Sprites.ownEdge): straight edges, outer corners bent round, inner corners where two sides meet.
"""
import sys, os, re, subprocess, tempfile
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
src, gid = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp()
subprocess.run([sys.executable, '-I', os.path.join(here, 'cut-template.py'), src, 'border', tmp], check=True)
strip = Image.open(os.path.join(tmp, 'border-1.png')).convert('RGBA').resize((256, 32), Image.LANCZOS)
# The game's side pictures (Sprites.ownEdge): a row of tile cells, 64 x 64 each (2 pixels a world pixel), the border
# reaching into the cell from that side. North: the strip along the cell's top; east, south, west: that cell turned.
cells = []
for k in range(4):
    c = Image.new('RGBA', (64, 64)); c.alpha_composite(strip.crop((k * 64, 0, k * 64 + 64, 32)), (0, 0)); cells.append(c)
turn = {'n': 0, 'e': -90, 's': 180, 'w': 90}
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
for d, a in turn.items():
    row = Image.new('RGBA', (256, 64))
    for k, c in enumerate(cells): row.alpha_composite(c.rotate(a), (k * 64, 0))
    out = f'edge-{gid.replace("_", "-")}-{d}.png'; row.save(os.path.join(root, 'sprites', out))
    js = re.sub(rf"\n  edge_{gid}_{d}: '[^']*',[^\n]*", '', js)
    js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  edge_{gid}_{d}: '{out}', // the owner's {gid} border, from the border template\n", 1)
open(custom, 'w').write(js); print('installed edge_' + gid + '_n/e/s/w')
