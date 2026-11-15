# Fill-in templates for Lickii Adventures: fixed frames with magenta corner marks (so a filled sheet can be cut out even
# when it comes back resized), guides, and the style card. Out: docs/templates/*.png
import math, os
from PIL import Image, ImageDraw, ImageFont
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'templates', '')
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22); Fm=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',16); Fs=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
card=Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'style-reference.png')).convert('RGB'); card=card.resize((card.width*260//card.height,260))
MAG=(255,0,255); BG='#f4f0e6'
def marks(d,x0,y0,x1,y1):
    L=18
    for (x,y,dx,dy) in [(x0,y0,1,1),(x1,y0,-1,1),(x0,y1,1,-1),(x1,y1,-1,-1)]:
        d.rectangle([min(x,x+dx*L),min(y,y+dy*5)-0,max(x,x+dx*L),max(y,y+dy*5)],fill=MAG)
        d.rectangle([min(x,x+dx*5),min(y,y+dy*L),max(x,x+dx*5),max(y,y+dy*L)],fill=MAG)
def dash(d,a,b,col,w=2):
    (x1,y1),(x2,y2)=a,b; n=max(1,int(math.hypot(x2-x1,y2-y1)//10))
    for k in range(n):
        t0=k/n;t1=(k+.5)/n; d.line([(x1+(x2-x1)*t0,y1+(y2-y1)*t0),(x1+(x2-x1)*t1,y1+(y2-y1)*t1)],fill=col,width=w)
def text(d,x,y,w,t,font=Fs,fill='#3a3020'):
    line=''
    for wd in t.split(' '):
        if d.textlength(line+wd,font=font)>w: d.text((x,y),line,fill=fill,font=font); line=''; y+=20
        line+=wd+' '
    d.text((x,y),line,fill=fill,font=font); return y+26
def page(name,title,frames,rules,W=None):
    """frames: list of (label, w, h, guide fn) laid out left to right; rules: text"""
    pad=40; gap=50
    W=W or max(900,pad*2+sum(f[1] for f in frames)+gap*(len(frames)-1)); H=1000
    c=Image.new('RGB',(W,2200),BG); d=ImageDraw.Draw(c)
    d.text((pad,20),title,fill='#5a3010',font=F)
    x=pad; y=90; rowh=0
    for lab,w,h,guide in frames:
        if x+w>W-pad: x=pad; y+=rowh+70; rowh=0
        d.text((x,y-26),lab,fill='#2a6a2a',font=Fm)
        d.rectangle([x,y,x+w-1,y+h-1],fill='#ffffff',outline='#9a9080')
        if guide: guide(d,x,y,w,h)
        marks(d,x-8,y-8,x+w+7,y+h+7)
        x+=w+gap; rowh=max(rowh,h)
    y+=rowh+40
    y=text(d,pad,y,W-2*pad,'FILL IN ONLY THE WHITE FRAMES. Keep the sheet and the pink corner marks as they are. '+rules,font=Fm)
    c.paste(card,(pad,y+10)); c=c.crop((0,0,W,y+card.height+30)); c.save(OUT+name+'.png'); print(name, c.size)

# 1. a wall: its face (4 tiles, straight on) and its top (seen from above)
def g_face(d,x,y,w,h):
    for k in range(1,4): dash(d,(x+k*w//4,y),(x+k*w//4,y+h),(200,200,200),1)
    d.text((x+6,y+h-22),'ground',fill='#b0a890',font=Fs)
def g_top(d,x,y,w,h):
    for k in range(1,4): dash(d,(x+k*w//4,y),(x+k*w//4,y+h),(200,200,200),1)
page('wall','WALL - fill in: the wall seen straight on, and its top seen from above',
     [('1. FACE: 4 wall tiles side by side, straight on (512 x 128)',512,128,g_face),('2. TOP: the same 4 tiles seen from above (512 x 32)',512,32,g_top)],
     'Flat, no perspective, no side showing. Left and right edges must join seamlessly (the strip repeats). Light from the top left. I build the wall from these myself: posts, corners, both directions, its shaded side and bevels.')
# 2. ground / roof: one square, seen from above
page('ground','GROUND or ROOF - fill in: one square seen from straight above',
     [('one square, seen from above (512 x 512 = 4 x 4 tiles)',512,512,lambda d,x,y,w,h:[dash(d,(x+k*128,y),(x+k*128,y+h),(220,220,220),1) or dash(d,(x,y+k*128),(x+w,y+k*128),(220,220,220),1) for k in range(1,4)])],
     'Flat, from straight above, no perspective. Must repeat seamlessly in both directions (left joins right, top joins bottom). For a roof: rows of tiles running left to right, the lower edge of each row lit. Light from the top left.')
# 3. a thing on a wall, straight on
def g_wallthing(d,x,y,w,h):
    d.rectangle([x,y+h-8,x+w,y+h],fill='#e8e2d4'); d.text((x+6,y+h-30),'bottom of the wall tile',fill='#b0a890',font=Fs)
page('on-wall','ON A WALL - fill in: a thing hung on or set in a wall (door, window, sign, lantern, banner), straight on',
     [('one wall tile, straight on (256 x 256)',256,256,g_wallthing)],
     'Draw only the thing; leave the rest of the frame empty (transparent or plain white), the wall shows there. Flat, no perspective. I lay it into the wall in both directions and give it its depth (or set it into the wall, for a window or a door).')
# 4. a standing thing in the world's camera
def g_thing(n):
    def f(d,x,y,w,h):
        t=w//(n+1)
        for k in range(n+2): d.line([(x+k*t,y),(x+k*t,y+h)],fill='#ece6da'); d.line([(x,y+k*t),(x+w,y+k*t)],fill='#ece6da')
        x0,y0=x+t,y+t; d.rectangle([x0,y0,x0+n*t-1,y0+n*t-1],outline=(60,150,60),width=3)
        L=int(0.6*t)
        for ax,ay in [(0,0),(n*t,0),(0,n*t),(n*t,n*t)]: dash(d,(x0+ax,y0+ay),(x0+ax-L,y0+ay-L),(40,90,200))
        d.text((x0+4,y0+n*t-24),'foot',fill=(60,150,60),font=Fs)
    return f
page('thing','STANDING THING - fill in: a thing that stands on the ground, in the world\'s camera (like the statue)',
     [('1 tile (256 x 256)',256,256,g_thing(1)),('2 x 2 tiles (384 x 384)',384,384,g_thing(2)),('3 x 3 tiles (512 x 512)',512,512,g_thing(3))],
     'Use the frame that fits its size; leave the others empty. It stands on the green tiles (its foot); its height goes UP and to the LEFT (the blue dashes: one floor up). Built of solid chunky blocks like the statue. Transparent background.',W=1420)
# 5. an item icon
page('item','ITEM - fill in: an item as it shows in the bag and on the ground',
     [('one item (256 x 256)',256,256,None)],
     'The item alone, filling most of the frame, seen slightly from above, lit from the top left, a thin dark edge. Transparent background.')

# 6. a standing thing from its front alone: the game builds its top and sides (tests/front-to-thing.py)
def g_front(d,x,y,w,h):
    d.rectangle([x,y+h-6,x+w,y+h],fill='#d8cfbc'); d.text((x+6,y+h-30),'ground: it stands here',fill='#b0a890',font=Fs)
    for k in range(1,4): dash(d,(x+k*w//4,y),(x+k*w//4,y+h),(225,225,225),1)
page('front','STANDING THING, FRONT ONLY - fill in: the thing seen straight from the front',
     [('the front (512 x 512; a tile is a quarter of the width)',512,512,g_front)],
     'Straight on from the front, flat: no top, no sides, no perspective. Standing on the ground line, as big as it is (a tile is a quarter of the frame). Built of solid chunky blocks like the statue. Transparent background. Say how deep it is (in tiles); I build its top and sides from this.')
