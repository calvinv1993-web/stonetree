"""Check every wall strip and top in sprites/ repeats without a seam.

    python3 tests/check-seams.py

A strip's last column must run on into its first about as smoothly as any two columns inside it do (ratio under 1.5);
a square top the same both ways. tests/cut-template.py makes them so when a filled sheet comes in.
"""
import glob, os, sys
import numpy as np
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sprites')
def ratio(a):
    return np.abs(a[:, 0] - a[:, -1]).mean() / max(1e-6, np.abs(np.diff(a, axis=1)).mean())
bad = 0
for p in sorted(glob.glob(os.path.join(root, 'wall-*-face*.png')) + glob.glob(os.path.join(root, 'wall-*-top.png')) +
                [os.path.join(root, n) for n in ('rampart-face.png', 'cliff-face.png')]):
    if not os.path.exists(p): continue
    a = np.array(Image.open(p).convert('RGB')).astype(float)
    r = [ratio(a)] + ([ratio(a.transpose(1, 0, 2))] if a.shape[0] == a.shape[1] else [])
    tops_with_slabs = os.path.basename(p) == 'wall-crypt-top.png'  # (rows of slabs: their edges are drawn joints)
    ok = all(x < 1.5 for x in r) or (tops_with_slabs and r[0] < 3)
    bad += not ok
    print(('ok  ' if ok else 'SEAM'), os.path.basename(p), ' '.join(f'{x:.2f}' for x in r))
print('all seamless' if not bad else f'{bad} with a seam'); sys.exit(1 if bad else 0)
