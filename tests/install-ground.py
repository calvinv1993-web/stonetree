"""Put a filled-in ground template (docs/templates/ground.png) into the game.

    python3 tests/install-ground.py <filled.png> <ground id: cobble, grass, rock_top, temple_paving, marble, mountain, roof_tiles...>

Cuts the square out (seamless both ways, see cut-template.py), saves it as sprites/<id>-own.png at 4 tiles across
(2 pixels a world pixel, 256 x 256; a roof's 128 x 128 is one tile), and lists it in sprites/custom.js as <id>.
"""
import sys, os, re, subprocess, tempfile
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
src, gid = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp()
subprocess.run([sys.executable, '-I', os.path.join(here, 'cut-template.py'), src, 'ground', tmp], check=True)
size = 128 if gid.startswith('roof') else 256
out = gid.replace('_', '-') + '-own.png'
Image.open(os.path.join(tmp, 'ground-1.png')).convert('RGB').resize((size, size), Image.LANCZOS).save(os.path.join(root, 'sprites', out))
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
js = re.sub(rf"\n  {gid}: '[^']*',[^\n]*", '', js)
js = js.replace('const CUSTOM_SPRITES = {\n', f"const CUSTOM_SPRITES = {{\n  {gid}: '{out}', // the owner's {gid}, from above (the ground template)\n", 1)
open(custom, 'w').write(js); print('installed', gid, '->', out)
