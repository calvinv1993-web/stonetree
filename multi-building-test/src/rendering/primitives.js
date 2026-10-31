// Stonetree: src/rendering/primitives.js
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function line(x,y,X,Y,c){ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke();}
function poly(p,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(...p[0]);for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);ctx.closePath();ctx.fill();}
function windowAt(wx,wy){
 rect(wx-3,wy-3,34,37,'#514d43');rect(wx,wy,28,28,'#37677b');
 rect(wx+12,wy,3,28,'#8fb2b8');rect(wx,wy+12,28,3,'#8fb2b8');
 rect(wx-4,wy+29,36,5,'#d6c8a8');
}
function playerSprite(x,y){
 rect(x-9,y+11,18,5,'#30352e');rect(x-9,y-2,18,15,'#384f76');
 rect(x-7,y-13,14,13,'#d8b38c');rect(x-8,y-15,16,5,'#493a2c');
 rect(x-8,y+11,6,6,'#292c32');rect(x+2,y+11,6,6,'#292c32');
}
function grass(x,y,w,h){
 for(let gy=Math.floor(-y/TILE)-1;gy<=Math.ceil((h-y)/TILE)+1;gy++)
 for(let gx=Math.floor(-x/TILE)-1;gx<=Math.ceil((w-x)/TILE)+1;gx++){
  const n=((gx*73856093)^(gy*19349663))>>>0,xx=x+gx*TILE,yy=y+gy*TILE;
  rect(xx,yy,TILE,TILE,['#4f7b42','#578548','#608b4d'][n%3]);
  rect(xx+8+n%18,yy+9+(n>>>5)%19,4,3,'#719b58');
 }
}

function rootheartGround(){
 const area=ROOTHEART;
 const left=Math.max(area.left,Math.floor(-camera.x/TILE)-1);
 const right=Math.min(area.left+area.size-1,Math.ceil((camera.width-camera.x)/TILE)+1);
 const top=Math.max(area.top,Math.floor(-camera.y/TILE)-1);
 const bottom=Math.min(area.top+area.size-1,Math.ceil((camera.height-camera.y)/TILE)+1);
 for(let gy=top;gy<=bottom;gy++)for(let gx=left;gx<=right;gx++){
  const px=camera.x+gx*TILE,py=camera.y+gy*TILE;
  const dx=Math.abs(gx-area.centerX),dy=Math.abs(gy-area.centerY);
  const plaza=dx<=6&&dy<=6;
  const road=(dx<=1||dy<=1);
  const seed=((gx*73856093)^(gy*19349663))>>>0;
  if(plaza||road){
   rect(px,py,TILE,TILE,plaza?(seed%3?'#999486':'#a49c8b'):(seed%3?'#817f73':'#8c8879'));
   rect(px,py+TILE-2,TILE,2,'#69695f');
   rect(px+TILE-2,py,2,TILE,'#6c6b62');
   if(seed%5===0)rect(px+9,py+12,13,2,'#aaa394');
  }else{
   rect(px,py,TILE,TILE,['#456d3e','#4b7542','#527a45'][seed%3]);
   rect(px+6+(seed%22),py+7+((seed>>>5)%22),5,3,'#648d4d');
   if(seed%11===0)rect(px+22,py+18,8,5,'#777668');
  }
 }
}

const ROOTHEART_APPROACHES=[
  // North: connect the inn and smithy south-facing doors to the main north road.
  {x0:57,x1:57,y0:-6,y1:-3},
  {x0:57,x1:64,y0:-3,y1:-3},
  {x0:74,x1:74,y0:-7,y1:-3},
  {x0:64,x1:74,y0:-3,y1:-3},
  {x0:64,x1:64,y0:-3,y1:-2},
  // South: both entrances face south at y=16; connect below the buildings.
  {x0:57,x1:57,y0:16,y1:17},
  {x0:57,x1:75,y0:17,y1:17},
  {x0:75,x1:75,y0:16,y1:17},
  {x0:64,x1:64,y0:2,y1:17},
  // East: the house entrance is at (85,6).
  {x0:66,x1:85,y0:6,y1:6}
 ];
function rootheartApproachTile(x,y){return ROOTHEART_APPROACHES.some(b=>x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1);}
function rootheartApproaches(){
 const a=ROOTHEART;
 const left=Math.max(a.left,Math.floor(-camera.x/TILE)-1);
 const right=Math.min(a.left+a.size-1,Math.ceil((camera.width-camera.x)/TILE)+1);
 const top=Math.max(a.top,Math.floor(-camera.y/TILE)-1);
 const bottom=Math.min(a.top+a.size-1,Math.ceil((camera.height-camera.y)/TILE)+1);
 // Branch paths connect the existing north/south roads to building entrances.
 // Paths are purely visual: existing doors and collision remain authoritative.

 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  if(!rootheartApproachTile(x,y))continue;
  if(BUILDINGS.some(b=>contains(b,x,y)))continue;
  const px=camera.x+x*TILE,py=camera.y+y*TILE;
  const n=((x*73856093)^(y*19349663))>>>0;
  rect(px,py,TILE,TILE,n%2?'#8f897a':'#999182');
  rect(px,py+TILE-2,TILE,2,'#66665d');
  rect(px+TILE-2,py,2,TILE,'#777166');
  if(n%4===0)line(px+8,py+11,px+22,py+11,'#b3a998');
 }
}
function rootheartNature(){
 const a=ROOTHEART;
 const left=Math.max(a.left,Math.floor(-camera.x/TILE)-2);
 const right=Math.min(a.left+a.size-1,Math.ceil((camera.width-camera.x)/TILE)+2);
 const top=Math.max(a.top,Math.floor(-camera.y/TILE)-2);
 const bottom=Math.min(a.top+a.size-1,Math.ceil((camera.height-camera.y)/TILE)+2);
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  const dx=Math.abs(x-a.centerX),dy=Math.abs(y-a.centerY);
  if(dx<=7&&dy<=7||dx<=2||dy<=2||rootheartApproachTile(x,y)||BUILDINGS.some(b=>contains(b,x,y)))continue;
  // Leave a clear border around building entrances and approach paths.
  if(BUILDINGS.some(b=>x>=b.position.x-1&&x<=b.position.x+b.width&&
                         y>=b.position.y-1&&y<=b.position.y+b.height))continue;
  const n=((x*73856093)^(y*19349663))>>>0;
  if(n%29!==0&&n%37!==0&&n%43!==0)continue;
  const px=camera.x+x*TILE,py=camera.y+y*TILE;
  if(n%29===0){
   rect(px+8,py+23,25,7,'#365b36');
   rect(px+12,py+13,18,15,'#527d43');
   rect(px+17,py+8,12,11,'#6b9252');
   rect(px+10,py+18,7,5,'#789d5c');
  }else if(n%37===0){
   poly([[px+7,py+29],[px+14,py+14],[px+30,py+17],[px+35,py+29]],'#777a71');
   line(px+14,py+16,px+28,py+18,'#b2b2a0');
  }else{
   rect(px+17,py+22,7,11,'#655344');
   rect(px+9,py+12,23,15,'#3c6540');
   rect(px+14,py+5,15,14,'#58804a');
   rect(px+18,py+8,6,4,'#83a264');
  }
 }
}
function rootheartPlazaDetails(){
 const area=ROOTHEART,cx=area.centerX,cy=area.centerY;
 // Decorative paving and vegetation only; keep the tree's 3x3 collision footprint.
 const p=(x,y)=>({x:camera.x+x*TILE,y:camera.y+y*TILE});
 // The visible 3x3 foundation matches the trunk's blocked movement tiles.
 for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
  const q=p(x,y),edge=x===cx-1||x===cx+1||y===cy-1||y===cy+1;
  rect(q.x,q.y,TILE,TILE,edge?'#77756d':'#68665f');
  rect(q.x+3,q.y+3,TILE-6,TILE-6,edge?'#989182':'#827b70');
  if(y===cy-1)rect(q.x+3,q.y+3,TILE-6,4,'#c5bba5');
  if(y===cy+1)rect(q.x+3,q.y+TILE-7,TILE-6,4,'#514f4a');
  if(x===cx-1)rect(q.x+3,q.y+3,4,TILE-6,'#b2aa98');
  if(x===cx+1)rect(q.x+TILE-7,q.y+3,4,TILE-6,'#5c5b55');
 }
 // A broken stone curb marks the four corners of the central square.
 for(const [x,y] of [[cx-6,cy-6],[cx+6,cy-6],[cx-6,cy+6],[cx+6,cy+6]]){
  const q=p(x,y);
  rect(q.x+3,q.y+6,34,9,'#c0b8a5');
  rect(q.x+3,q.y+15,34,5,'#6b6a60');
  rect(q.x+8,q.y+4,24,3,'#ded2b9');
 }
 // Small patches of growth sit around the outer edge, not on the paths.
 for(const [x,y] of [[cx-5,cy-5],[cx+5,cy-5],[cx-5,cy+5],[cx+5,cy+5],
                     [cx-4,cy-6],[cx+4,cy-6],[cx-4,cy+6],[cx+4,cy+6]]){
  const q=p(x,y);
  rect(q.x+13,q.y+22,14,4,'#4c6740');
  line(q.x+17,q.y+22,q.x+14,q.y+13,'#6d8651');
  line(q.x+21,q.y+22,q.x+25,q.y+12,'#82965e');
  rect(q.x+12,q.y+12,5,5,'#a39b79');
 }
 // Inlaid markers point toward the tree along the four approach roads.
 for(const [x,y] of [[cx,cy-5],[cx,cy+5],[cx-5,cy],[cx+5,cy]]){
  const q=p(x,y),mx=q.x+20,my=q.y+20;
  poly([[mx,my-10],[mx+7,my],[mx,my+10],[mx-7,my]],'#b8b09a');
  poly([[mx,my-6],[mx+4,my],[mx,my+6],[mx-4,my]],'#77786d');
 }
}
function rootheartPetrifiedTree(){
 const cx=camera.x+(ROOTHEART.centerX+.5)*TILE;
 const cy=camera.y+(ROOTHEART.centerY+.5)*TILE;
 // Static world landmark: a petrified trunk, exposed roots and branching crown.
 // Keep the ground and existing movement systems untouched.
 ctx.save();
 ctx.fillStyle='rgba(25,28,25,0.32)';
 ctx.beginPath();ctx.ellipse(cx+10,cy+20,122,46,0,0,Math.PI*2);ctx.fill();
 const roots=[
  [[cx-17,cy+8],[cx-110,cy+34],[cx-78,cy+17],[cx-20,cy-9]],
  [[cx+16,cy+7],[cx+108,cy+28],[cx+75,cy+6],[cx+15,cy-14]],
  [[cx-13,cy+9],[cx-54,cy+88],[cx-27,cy+54],[cx+4,cy+9]],
  [[cx+13,cy+8],[cx+56,cy+83],[cx+26,cy+50],[cx-3,cy+6]]
 ];
 for(const points of roots){
  poly(points,'#625e59');
  line(points[0][0],points[0][1],points[1][0],points[1][1],'#9e998b');
 }
 poly([[cx-37,cy+10],[cx-29,cy-85],[cx-21,cy-151],[cx-40,cy-197],[cx-16,cy-179],[cx-7,cy-132],[cx+8,cy-145],[cx+31,cy-203],[cx+48,cy-208],[cx+23,cy-129],[cx+35,cy-75],[cx+30,cy+10]],'#625f5a');
 poly([[cx-26,cy+6],[cx-20,cy-91],[cx-10,cy-145],[cx-2,cy-124],[cx-7,cy-60],[cx-4,cy+8]],'#a19b8c');
 poly([[cx+16,cy-12],[cx+18,cy-91],[cx+36,cy-181],[cx+29,cy-120],[cx+28,cy-21]],'#444745');
 for(let i=0;i<8;i++){
  const yy=cy-17-i*19;
  line(cx-14+(i%3)*3,yy,cx-6+(i%3)*3,yy-13,'#77786f');
  line(cx+10,yy+4,cx+16,yy-9,'#b0a999');
 }
 // The split crown is deliberately leafless: this is fossilized wood.
 poly([[cx-15,cy-150],[cx-59,cy-218],[cx-84,cy-230],[cx-48,cy-205],[cx-3,cy-159]],'#706b63');
 poly([[cx+11,cy-157],[cx+57,cy-229],[cx+83,cy-236],[cx+48,cy-208],[cx+3,cy-145]],'#777269');
 line(cx-59,cy-218,cx-84,cy-230,'#aaa395');
 line(cx+57,cy-229,cx+83,cy-236,'#aaa395');
 ctx.restore();
}
