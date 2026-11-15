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
# hand each piece on as the sheet its own installer expects: a sheet of one frame is cut back to the same picture
for kind, piece in (('ground', 'ground-border-1.png'), ('border', 'ground-border-2.png')):
    sheet = os.path.join(tmp, f'{kind}-sheet.png')
    im = Image.open(os.path.join(tmp, piece)).convert('RGBA'); W, H = im.size; B = 40
    s = Image.new('RGBA', (W + 2 * B, H + 2 * B), (244, 240, 230, 255)); s.alpha_composite(im, (B, B))
    from PIL import ImageDraw
    d = ImageDraw.Draw(s); M = (255, 0, 255, 255)
    for (x, y, dx, dy) in [(B - 24, B - 24, 1, 1), (B + W + 23, B - 24, -1, 1), (B - 24, B + H + 23, 1, -1), (B + W + 23, B + H + 23, -1, -1)]:
        d.rectangle([min(x, x + dx * 18), min(y, y + dy * 5), max(x, x + dx * 18), max(y, y + dy * 5)], fill=M)
        d.rectangle([min(x, x + dx * 5), min(y, y + dy * 18), max(x, x + dx * 5), max(y, y + dy * 18)], fill=M)
    s.save(sheet)
    subprocess.run([sys.executable, '-I', os.path.join(here, f'install-{kind}.py'), sheet, gid], check=True)
