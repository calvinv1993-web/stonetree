#!/usr/bin/env python3
"""Placeholder pictures for the story panorama's demonstration (js/story-demo.js, the story with ?storydemo).

Each plane is drawn at the pixels per world unit given below, with a grid every 100 world units labelled in world
coordinates, its name, its depth and its file size, so the development view (?storydev) can be checked against it.
The main depth's upper planes are see-through above a skyline, the foreground's objects are cut-out PNGs.
Run from the project folder:  python3 tests/story-placeholders.py   (then: node tests/sprite-versions.js)
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join('sprites', 'ui', 'story', 'demo')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
def font(path, size):
    try: return ImageFont.truetype(path, size)
    except OSError: return ImageFont.load_default()

# (id, depth, x, y, w, h, px per world unit, kind)
PLANES = [
    ('bg-1', 'background', -200, -100, 1760, 1200, 1.0, 'sky'),
    ('bg-2', 'background', 1500, -100, 1700, 1200, 1.0, 'sky'),
    ('main-1-top', 'main', 0, 0, 1040, 440, 3.0, 'skyline'),
    ('main-2-top', 'main', 1000, 0, 1040, 440, 3.0, 'skyline'),
    ('main-3-top', 'main', 2000, 0, 1000, 440, 3.0, 'skyline'),
    ('main-1-low', 'main', 0, 400, 1040, 600, 3.0, 'land'),
    ('main-2-low', 'main', 1000, 400, 1040, 600, 3.0, 'land'),
    ('main-3-low', 'main', 2000, 400, 1000, 600, 3.0, 'land'),
    ('fg-ground-1', 'foreground', -400, 860, 1880, 160, 2.0, 'grass'),
    ('fg-ground-2', 'foreground', 1440, 860, 2060, 160, 2.0, 'grass'),
    ('fg-tree', 'foreground', 560, 80, 360, 900, 2.0, 'tree'),
    ('fg-post', 'foreground', 1720, 560, 120, 420, 2.0, 'post'),
    ('fg-banner', 'foreground', 2460, 120, 300, 820, 2.0, 'banner'),
]
TONE = {'background': (40, 70, 110), 'main': (150, 120, 70), 'foreground': (190, 60, 150)}

def grid(d, x0, y0, w, h, k, color, fsmall):
    for gx in range(math.ceil(x0 / 100) * 100, int(x0 + w) + 1, 100):
        X = (gx - x0) * k
        d.line([(X, 0), (X, h * k)], fill=color + (90,), width=1 if gx % 500 else 3)
        for gy in range(math.ceil(y0 / 100) * 100, int(y0 + h) + 1, 200):
            d.text((X + 6, (gy - y0) * k + 4), f'{gx},{gy}', font=fsmall, fill=color + (200,))
    for gy in range(math.ceil(y0 / 100) * 100, int(y0 + h) + 1, 100):
        Y = (gy - y0) * k
        d.line([(0, Y), (w * k, Y)], fill=color + (90,), width=1 if gy % 500 else 3)

def skyline_y(x):  # where the main depth's buildings start (world y), for every world x
    return 300 + 60 * math.sin(x / 90) + 40 * math.sin(x / 37 + 1)

def draw(pid, depth, x0, y0, w, h, k, kind):
    W, H = round(w * k), round(h * k)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, 'RGBA')
    big, small = font(FONT, max(18, int(36 * k))), font(MONO, max(11, int(11 * k)))
    tone = TONE[depth]
    wx = lambda X: (X - x0) * k; wy = lambda Y: (Y - y0) * k
    if kind == 'sky':
        for j in range(H):
            t = j / H
            d.line([(0, j), (W, j)], fill=(int(20 + 40 * t), int(30 + 50 * t), int(60 + 70 * t), 255))
        pts = [(0, H)] + [(i, wy(560 + 90 * math.sin((x0 + i / k) / 210) + 50 * math.sin((x0 + i / k) / 77))) for i in range(0, W + 8, 8)] + [(W, H)]
        d.polygon(pts, fill=(30, 45, 75, 255))
    elif kind == 'skyline':
        pts = [(0, H)]
        for i in range(0, W + 4, 4):
            X = x0 + i / k
            top = skyline_y(X) if int(X // 70) % 3 else skyline_y(X) - 90  # towers every few blocks
            pts.append((i, wy(min(top, y0 + h))))
        pts.append((W, H))
        d.polygon(pts, fill=(95, 85, 70, 255))
        for X in range(int(x0) - int(x0) % 70, int(x0 + w), 70):  # windows
            for Y in range(int(skyline_y(X)) + 30, int(y0 + h) - 10, 45):
                d.rectangle([wx(X + 20), wy(Y), wx(X + 34), wy(Y + 18)], fill=(240, 190, 90, 255))
    elif kind == 'land':
        d.rectangle([0, 0, W, H], fill=(85, 75, 60, 255))
        for i in range(0, H, max(1, int(6 * k))): d.line([(0, i), (W, i)], fill=(70, 62, 50, 255), width=max(1, int(k)))
        d.rectangle([0, wy(700), W, wy(760)], fill=(60, 90, 120, 255))  # a river through all three
    elif kind == 'grass':
        pts = [(0, H)] + [(i, wy(880 + 14 * math.sin((x0 + i / k) / 23))) for i in range(0, W + 6, 6)] + [(W, H)]
        d.polygon(pts, fill=(60, 30, 55, 255))
    elif kind == 'tree':
        d.rectangle([wx(x0 + 150), wy(y0 + 220), wx(x0 + 210), H], fill=(70, 30, 60, 255))
        d.ellipse([0, 0, W, wy(y0 + 420)], fill=(120, 40, 100, 230))
    elif kind == 'post':
        d.rectangle([wx(x0 + 40), 0, wx(x0 + 80), H], fill=(110, 50, 95, 255))
        d.ellipse([wx(x0 + 20), wy(y0), wx(x0 + 100), wy(y0 + 80)], fill=(255, 200, 110, 255))
    elif kind == 'banner':
        d.rectangle([wx(x0 + 20), 0, wx(x0 + 40), H], fill=(90, 40, 80, 255))
        d.polygon([(wx(x0 + 40), wy(y0 + 40)), (W, wy(y0 + 80)), (wx(x0 + 40), wy(y0 + 360))], fill=(170, 50, 140, 240))
    if kind not in ('tree', 'post', 'banner'):
        grid(d, x0, y0, w, h, k, (255, 255, 255), small)
    d.rectangle([0, 0, W - 1, H - 1], outline=tone + (255,), width=max(2, int(2 * k)))
    label = f'{depth.upper()} · {pid}'
    info = f'x {x0} y {y0} · {w}×{h} units · {W}×{H} px ({k:g} px/unit)'
    tx, ty = (wx(x0 + 30), wy(y0 + 30)) if kind != 'skyline' else (wx(x0 + 30), wy(y0 + 160))
    if kind in ('tree', 'post', 'banner'): tx, ty = 8, H * 0.45
    d.rectangle([tx - 8, ty - 6, tx + d.textlength(info if len(info) > len(label) else label, font=small) * (1 if len(info) > len(label) else 1) + 260, ty + 36 * k + 24], fill=(0, 0, 0, 140))
    d.text((tx, ty), label, font=big, fill=(255, 255, 255, 255))
    d.text((tx, ty + 36 * k + 2), info, font=small, fill=(230, 230, 230, 255))
    return im

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for p in PLANES:
        im = draw(*p)
        im.save(os.path.join(OUT, f'{p[0]}.png'), optimize=True)
        print(p[0], im.size, os.path.getsize(os.path.join(OUT, f'{p[0]}.png')) // 1024, 'kB')
