// Stonetree: src/rendering/building.js
function facade(b,x,baseY,level,door){
 // One authoritative facade per physical storey, shared by interior and exterior views.
 const top=baseY-HEIGHT;
 rect(x,top,b.width*TILE,HEIGHT,'#aaa89a');
 for(let i=1;i<4;i++)line(x,top+i*HEIGHT/4,x+b.width*TILE,top+i*HEIGHT/4,'#89897e');
 rect(x,top,b.width*TILE,5,'#d9d4bf');
 if(door){
  const dx=x+b.door.col*TILE;
  // The doorway occupies one tile and has one shared interactive state.
  if(doorIsOpen(b)){
   // Cut out the wall visually: show the actual floor tiles behind the
   // opening, rather than filling it with an opaque dark rectangle.
   ctx.save();
   ctx.beginPath();
   ctx.rect(dx+4,top+4,TILE-8,HEIGHT-9);
   ctx.clip();
   const floorY=baseY-b.height*TILE;
   for(let row=b.height-2;row<b.height;row++)floorTile(b,x,floorY,b.door.col,row,0);
   ctx.restore();
   rect(dx,top,4,HEIGHT,'#62513e');
   rect(dx+TILE-4,top,4,HEIGHT,'#62513e');
   rect(dx+4,top,7,HEIGHT-5,'#8c6843');
   rect(dx+10,top+HEIGHT/2,3,3,'#d9c48a');
  }else{
   rect(dx,top,TILE,HEIGHT,'#62513e');
   rect(dx+5,top+4,TILE-10,HEIGHT-9,'#4b382c');
   rect(dx+8,top+8,TILE-16,HEIGHT-15,'#6d5035');
   rect(dx+28,top+32,4,4,'#e1c77d');
  }
  rect(dx+4,baseY-5,TILE-8,5,'#d6bd85');
 }else for(const col of b.floors[level].windows)
  windowAt(x+col*TILE+6,top+17);
 rect(x,baseY-5,b.width*TILE,5,'#77786e');
}
function exterior(b,x,y){
 if(b.terrace)return terraceExterior(b,x,y);
 return exteriorShell(b,x,y);
}
function exteriorShell(b,x,y){
 const size=b.width*TILE,depth=b.height*TILE,base=y+depth,roofY=y-b.floors.length*HEIGHT;
 // The roof covers the same complete footprint as both storeys.
 rect(x-SIDE,roofY,SIDE,depth+b.floors.length*HEIGHT,'#656e65');
 rect(x+size,roofY,SIDE,depth+b.floors.length*HEIGHT,'#6f786c');
 for(let level=0;level<b.floors.length;level++)facade(b,x,base-level*HEIGHT,level,level===0);
 rect(x-SIDE,roofY,size+2*SIDE,depth,'#756052');
 for(let row=0;row<b.height;row++)for(let col=0;col<b.width;col++)roofTile(b,x,roofY,col,row);
 rect(x-SIDE,roofY,size+2*SIDE,5,'#b5a48b');
 rect(x-SIDE,base-b.floors.length*HEIGHT-3,size+2*SIDE,5,'#b5a48b');
}
// One physical building: each storey has a fixed world elevation.
// Camera follows the player's z. The geometry does not change between views.

function floorTile(b,x,y,col,row,level){
 const wood=b.floors[level].material==='wood';
 rect(x+col*TILE,y+row*TILE,TILE,TILE,wood?((col+row)%2?'#947959':'#a48966'):((col+row)%2?'#888f7d':'#979e8c'));
 ctx.strokeStyle='#646b5e';ctx.lineWidth=1;
 ctx.strokeRect(x+col*TILE+.5,y+row*TILE+.5,TILE,TILE);
}
function staircase(b,x,y,level){
 const stairs=Object.values(stairsAt(b,level));
 for(const stair of stairs){
  const sx=x+stair.x*TILE,sy=y+stair.y*TILE;
  rect(sx+4,sy+5,TILE-8,TILE-9,level===0?'#715b37':'#635443');
  for(let i=0;i<4;i++)rect(sx+6,sy+7+i*7,TILE-12,5,i%2?'#c7a467':'#ddbf83');
 }
}
function walls(b,x,y){
 const size=b.width*TILE,depth=b.height*TILE;
 rect(x,y-HEIGHT,size,HEIGHT,'#aaa99c');
 for(let i=1;i<4;i++)line(x,y-HEIGHT+i*HEIGHT/4,x+size,y-HEIGHT+i*HEIGHT/4,'#8b8b80');
 poly([[x,y-HEIGHT],[x+THICK,y-HEIGHT-THICK],[x+size+THICK,y-HEIGHT-THICK],[x+size,y-HEIGHT]],'#e0dac8');
 rect(x-SIDE,y-HEIGHT,SIDE,depth+HEIGHT,'#777d72');
 rect(x+size,y-HEIGHT,SIDE,depth+HEIGHT,'#777d72');
 rect(x-SIDE,y-HEIGHT,SIDE+THICK,THICK,'#d9d7c6');
 rect(x+size,y-HEIGHT,SIDE+THICK,THICK,'#d9d7c6');
}
function renderFloor(b,x,y,level,holes){
 walls(b,x,y);
 for(let row=0;row<b.height;row++)for(let col=0;col<b.width;col++){
  if(holes&&floorVoids(b,level).has(col+','+row))continue;
  floorTile(b,x,y,col,row,level);
 }
 staircase(b,x,y,level);
}
function cutawayFront(b,x,base,level){
 // Fade the foreground facade near the player; retain its physical height.
 ctx.save();ctx.globalAlpha=localTile(b,player.x,player.y).y>=b.height-2?.25:1;
 if(b.terrace&&level===b.terrace.level){
  ctx.beginPath();ctx.rect(x,base-HEIGHT,b.terrace.startCol*TILE,HEIGHT);ctx.clip();
 }
 facade(b,x,base,level,level===0);ctx.restore();
}
// Reveal the selected physical storey from outside without drawing a player.
function exteriorStorey(b,x,y,level){
 drawStorey(b,x,y-level*HEIGHT,level,false);
}
// Partition segments share the doorway projection; collision stays on door.row.
function terracePartition(b,x,y){
 const edge=x+b.terrace.startCol*TILE;
 const open=doorIsOpen(b,'terrace');
 // Vertical dividing wall occupies the boundary, not the roof tiles.
 for(let row=0;row<b.height;row++){
  const top=y+row*TILE-b.terrace.door.visualRise;
  if(row===b.terrace.door.row){
   rect(edge-8,top,16,6,'#6c5b48');
   rect(edge-8,top+TILE-6,16,6,'#6c5b48');
   rect(edge-8,top,4,TILE,'#786956');
   rect(edge+4,top,4,TILE,'#786956');
   if(!open){
    rect(edge-4,top+6,8,TILE-12,'#795b3d');
    rect(edge-3,top+10,6,TILE-20,'#98754d');
    rect(edge-2,top+TILE/2,3,3,'#e4ca83');
   }
  }else{
   rect(edge-8,top,16,TILE,'#a7a497');
   rect(edge-8,top,4,TILE,'#77786e');
   for(let stripe=12;stripe<TILE;stripe+=16)
    line(edge-4,top+stripe,edge+8,top+stripe,'#858478');
  }
 }
}
function roofTile(b,x,y,col,row){
 const px=x+col*TILE,py=y+row*TILE;
 rect(px,py,TILE,TILE,(row+col)%2?'#77604e':'#846c55');
 // Small staggered shingles with restrained highlights and worn edges.
 for(let band=0;band<2;band++){
  const sy=py+band*20,offset=(row+band)%2?10:0;
  line(px,sy+19,px+TILE,sy+19,'#514439');
  for(let i=-1;i<3;i++){
   const sx=px+i*20+offset;
   const left=Math.max(px,sx),right=Math.min(px+TILE,sx+20);
   if(right<=left)continue;
   line(left,sy+2,right,sy+2,'#a18a70');
   if(sx>px&&sx<px+TILE)line(sx,sy+3,sx,sy+18,'#5c4b3e');
  }
 }
}
function terraceFloor(b,x,y,level){
 const edge=b.terrace.startCol*TILE;
 // Only the enclosed part has tall walls.
 ctx.save();ctx.beginPath();ctx.rect(x-SIDE-THICK,y-HEIGHT-THICK,edge+SIDE+THICK,b.height*TILE+HEIGHT+THICK);ctx.clip();
 renderFloor(b,x,y,level,false);
 ctx.restore();
 for(let row=0;row<b.height;row++)for(let col=b.terrace.startCol;col<b.width;col++){
  roofTile(b,x,y,col,row);
  ctx.strokeStyle='#8c8b80';ctx.lineWidth=1;
  ctx.strokeRect(x+col*TILE+.5,y+row*TILE+.5,TILE,TILE);
 }
 terracePartition(b,x,y);
 // Parapets are low and sit on the outside edge of the terrace.
 rect(x+edge,y-10,(b.width-b.terrace.startCol)*TILE,10,'#c5bfaf');
 rect(x+b.width*TILE-9,y,9,b.height*TILE,'#999586');
 rect(x+edge,y+b.height*TILE-10,(b.width-b.terrace.startCol)*TILE,10,'#aaa595');
}
function terraceExterior(b,x,y){
 const size=b.width*TILE,depth=b.height*TILE,roofY=y-(b.terrace.level+1)*HEIGHT,edge=b.terrace.startCol*TILE;
 // Ground-floor facade remains intact, including its original entrance.
 facade(b,x,y+depth,0,true);
 rect(x-SIDE,y-HEIGHT,SIDE,depth+HEIGHT,'#656e65');
 rect(x+size,y-HEIGHT,SIDE,depth+HEIGHT,'#6f786c');
 // Upper-storey facade exists only beneath the enclosed half.
 ctx.save();ctx.beginPath();ctx.rect(x,y+depth-2*HEIGHT,edge,depth+HEIGHT);ctx.clip();
 facade(b,x,y+depth-HEIGHT,1,false);ctx.restore();
 // Roof is restricted to the enclosed room.
 rect(x-SIDE,roofY,edge+SIDE,depth,'#756052');
 for(let row=0;row<b.height;row++)for(let col=0;col<b.terrace.startCol;col++)roofTile(b,x,roofY,col,row);
 rect(x-SIDE,roofY,edge+SIDE,5,'#b5a48b');
 // Terrace is at the true z=1 elevation, not on the roof.
 for(let row=0;row<b.height;row++)for(let col=b.terrace.startCol;col<b.width;col++){
  roofTile(b,x,y-HEIGHT,col,row);
 }
 rect(x+edge,y-HEIGHT-10,(b.width-b.terrace.startCol)*TILE,10,'#c5bfaf');
 rect(x+size-9,y-HEIGHT,9,depth,'#999586');
 rect(x+edge,y-HEIGHT+depth-10,(b.width-b.terrace.startCol)*TILE,10,'#aaa595');
}
function drawSupports(b,x,y,level){
 for(let lower=0;lower<level;lower++){
  const base=y+b.height*TILE+(level-lower)*HEIGHT;
  facade(b,x,base,lower,lower===0);
  rect(x-SIDE,base-HEIGHT,SIDE,HEIGHT,'#656e65');
  rect(x+b.width*TILE,base-HEIGHT,SIDE,HEIGHT,'#6f786c');
 }
}
function drawStairwell(b,x,y,level){
 const holes=floorVoids(b,level);if(!holes.size)return;
 ctx.save();ctx.beginPath();
 for(const key of holes){const [col,row]=key.split(',').map(Number);ctx.rect(x+col*TILE,y+row*TILE,TILE,TILE);}
 ctx.clip();
 // Opaque shaft, then the real projected floor below. No duplicate staircase.
 rect(x,y,b.width*TILE,b.height*TILE,'#363c33');
 for(let row=0;row<b.height;row++)for(let col=0;col<b.width;col++)floorTile(b,x,y+HEIGHT,col,row,level-1);
 ctx.restore();
}
// Project the upper floor as a solid slab with a visible front and side edge.
// This is visual-only: world coordinates, stairs and collision remain unchanged.
function elevatedFloorEdge(b,x,y,level){
 if(level===0)return;
 const width=b.width*TILE,depth=b.height*TILE;
 ctx.save();
 ctx.fillStyle='rgba(0,0,0,0.22)';
 ctx.fillRect(x+SIDE,y+depth+8,width,12);
 rect(x,y+depth-3,width,11,'#5d584c');
 rect(x,y+depth-3,width,3,'#d3c19d');
 rect(x+width-4,y,10,depth+8,'#625e51');
 rect(x+width-4,y,3,depth,'#b3a48b');
 ctx.restore();
}
function drawStorey(b,x,y,level,occupied){
 drawSupports(b,x,y,level);
 if(terraceAt(b,level))terraceFloor(b,x,y,level);
 else{drawStairwell(b,x,y,level);renderFloor(b,x,y,level,level>0);}
 for(const key of floorVoids(b,level)){
  const [col,row]=key.split(',').map(Number);
  if(!floorVoids(b,level).has(col+','+(row-1)))rect(x+col*TILE,y+row*TILE,TILE,4,'#d4bc91');
  if(!floorVoids(b,level).has((col-1)+','+row))rect(x+col*TILE,y+row*TILE,4,TILE,'#665b4b');
 }
 elevatedFloorEdge(b,x,y,level);
 if(occupied)cutawayFront(b,x,y+b.height*TILE,level);
 else{
  ctx.save();ctx.globalAlpha=.18;
  if(terraceAt(b,level)){ctx.beginPath();ctx.rect(x,y+b.height*TILE-HEIGHT,b.terrace.startCol*TILE,HEIGHT);ctx.clip();}
  facade(b,x,y+b.height*TILE,level,level===0);ctx.restore();
 }
 if(occupied){
  const tile=localTile(b,player.x,player.y);
  const visual=visualPlayer();
  playerSprite(x+(visual.x-b.position.x+.5)*TILE,y+(visual.y-b.position.y+.5)*TILE);
  ctx.fillStyle='#f0dfb0';ctx.font='bold 15px system-ui';
  ctx.fillText(b.name+' · '+(level?'Verdieping '+level:'Begane grond'),x,y-HEIGHT-18);
 }
}
function interior(b,x,y,level){drawStorey(b,x,y,level,true);}
