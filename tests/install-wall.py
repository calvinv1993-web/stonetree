"""Put a filled-in wall template (docs/templates/wall.png) into the game.

    python3 tests/install-wall.py <filled.png> <wall id, e.g. wall_stone> [--inside]

Cuts the face (512 x 128) and the top (512 x 32) out of the sheet, writes sprites/<wall-id>-face.png and -top.png
(with --inside: -face-in.png, the face where it looks into a building) and lists them in sprites/custom.js as
<id>_face, <id>_top (<id>_face_in). The game then builds every wall of that kind from them (wallFromStrip in
js/sprites.js): posts, corners, both directions, the east faces in shade.
"""
import sys, os, re, subprocess, tempfile
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
src, wid = sys.argv[1], sys.argv[2]; inside = '--inside' in sys.argv
tmp = tempfile.mkdtemp()
subprocess.run([sys.executable, '-I', os.path.join(here, 'cut-template.py'), src, 'wall', tmp], check=True)
name = wid.replace('_', '-')
pieces = {f'{wid}_face_in': ('wall-1.png', f'{name}-face-in.png')} if inside else \
         {f'{wid}_face': ('wall-1.png', f'{name}-face.png'), f'{wid}_top': ('wall-2.png', f'{name}-top.png')}
custom = os.path.join(root, 'sprites', 'custom.js'); js = open(custom).read()
for key, (cut, out) in pieces.items():
    os.replace(os.path.join(tmp, cut), os.path.join(root, 'sprites', out))
    line = f"  {key}: '{out}', // the owner's {wid} strip, straight on (see wallFromStrip)\n"
    js = re.sub(rf"  {key}: '[^']*',[^\n]*\n", '', js)
    js = js.replace('const CUSTOM_SPRITES = {\n', 'const CUSTOM_SPRITES = {\n' + line, 1)
    print('installed', key, '->', out)
open(custom, 'w').write(js)
