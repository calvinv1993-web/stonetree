// Stonetree: src/rendering/building.js
// Shared masonry pattern for exterior facades and interior rear walls.
function stoneCourses(x,y,width,height){
 rect(x,y,width,height,'#a8a698');
 ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
 for(let row=0;row<Math.ceil(height/16);row++){
  const cy=y+row*16;
  line(x,cy+15,x+width,cy+15,'#797a70');
  line(x,cy+1,x+width,cy+1,'#c8c4b1');
  const offset=row%2?20:0;
  for(let col=-1;col<Math.ceil(width/40)+1;col++){
   const cx=x+col*40+offset;
   line(cx,cy+2,cx,cy+14,'#818277');
   if((col+row)%3===0)rect(cx+8,cy+6,11,2,'#929386');
  }
 }
 ctx.restore();
}
function rootheartFacadeDetail(b,x,top,baseY,level,door){
 if(!b.id.startsWith('rootheart-'))return;
 const width=b.width*TILE;
 // Building-specific stone and timber accents; all doors and windows remain interactive.
 if(b.id==='rootheart-inn'){
  rect(x+5,top+7,width-10,5,'#674b37');
  for(let col=0;col<b.width;col+=2)rect(x+col*TILE+7,top+12,5,HEIGHT-19,'#76553d');
  if(door){rect(x+TILE*2,top-12,TILE*3,11,'#5c4938');rect(x+TILE*2+5,top-9,TILE*3-10,5,'#c5a77a');}
 }else if(b.id==='rootheart-smithy'){
  rect(x+5,top+8,width-10,8,'#555b58');
  for(let col=0;col<b.width;col++)rect(x+col*TILE+9,top+20,12,3,'#747c78');
  if(door){rect(x+TILE*4,top+17,18,27,'#353633');rect(x+TILE*4+4,top+22,10,17,'#b35e32');}
 }else if(b.id==='rootheart-shop'){
  rect(x+4,top+7,width-8,7,'#876f47');
  if(door){rect(x+TILE,top+10,TILE*4,8,'#a67b45');rect(x+TILE+7,top+11,TILE*4-14,4,'#e2c68b');}
 }else if(b.id==='rootheart-temple'){
  for(let col=0;col<b.width;col+=2)rect(x+col*TILE+5,top+8,9,HEIGHT-16,'#d0c8b4');
  rect(x+5,top+6,width-10,5,'#c8bd9e');
  if(door){rect(x+TILE*3+14,top-18,12,12,'#8e988e');rect(x+TILE*3+17,top-15,6,6,'#c9c4a8');}
 }else if(b.id==='rootheart-home'){
  rect(x+4,top+8,width-8,5,'#71563e');
  for(let col=0;col<b.width;col+=2)rect(x+col*TILE+7,top+13,5,HEIGHT-20,'#816347');
 }
}
function facade(b,x,baseY,level,door){
 // One authoritative facade per physical storey, shared by interior and exterior views.
 const top=baseY-HEIGHT;
 stoneCourses(x,top,b.width*TILE,HEIGHT);
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
 }else for(const col of b.floors[level].windows){
  // Open masonry aperture: render the actual room floor through the wall.
  const wx=x+col*TILE+6,wy=top+17;
  rect(wx-4,wy-4,36,37,'#68665c');
  rect(wx-1,wy-1,30,30,'#302f2a');
  ctx.save();
  ctx.beginPath();ctx.rect(wx+2,wy+2,24,24);ctx.clip();
  const floorY=baseY-b.height*TILE;
  for(let row=Math.max(0,b.height-2);row<b.height;row++)
   floorTile(b,x,floorY,col,row,level);
  // Render existing room geometry in the aperture, not a painted window.
  staircase(b,x,floorY,level);
  // The occupied storey already draws the player in drawStorey.
  // Do not draw a second sprite inside the window aperture.
  ctx.restore();
  // Thick stone reveal and sill, without glass or crossbars.
  rect(wx-3,wy-3,4,34,'#bcb6a3');
  rect(wx+27,wy-3,4,34,'#77766b');
  rect(wx-3,wy-3,34,4,'#d0c8b2');
  rect(wx-5,wy+27,38,6,'#c7bda5');
  rect(wx-5,wy+32,38,3,'#777366');
 }
 rootheartFacadeDetail(b,x,top,baseY,level,door);
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
 const px=x+col*TILE,py=y+row*TILE;
 const wood=b.floors[level].material==='wood';
 if(wood){
  rect(px,py,TILE,TILE,(col+row)%3===0?'#967957':'#a18560');
  // Two planks per tile, with staggered end joints and subtle grain.
  for(let plank=0;plank<2;plank++){
   const sy=py+plank*20;
   rect(px,sy+18,TILE,2,'#5e4b39');
   line(px,sy+2,px+TILE,sy+2,'#c1a17a');
   const joint=px+(((row*3+plank+col)%3)+1)*10;
   line(joint,sy+3,joint,sy+17,'#70583e');
   line(px+5,sy+9,px+16,sy+9,'#846a4d');
   line(px+23,sy+13,px+34,sy+13,'#b0926b');
  }
 }else{
  rect(px,py,TILE,TILE,(col+row)%3===0?'#92998a':'#858d80');
  // Offset stone seams, small chipped corners and muted wear.
  rect(px,py+TILE-2,TILE,2,'#5d675d');
  rect(px+TILE-2,py,2,TILE,'#667066');
  line(px+2,py+2,px+TILE-3,py+2,'#b1b7a5');
  line(px+2,py+2,px+2,py+TILE-3,'#a2aa9a');
  if((col+row)%2===0){
   rect(px+6,py+12,10,2,'#7a8378');
   rect(px+26,py+28,6,2,'#a5ac9b');
  }else{
   rect(px+20,py+8,12,2,'#a1a999');
   rect(px+9,py+29,8,2,'#747e72');
  }
 }
}
function staircase(b,x,y,level){
 const stairs=stairsAt(b,level);
 for(const [direction,stair] of Object.entries(stairs)){
  const sx=x+stair.x*TILE,sy=y+stair.y*TILE;
  const ascending=direction==='up';
  // Recessed stair opening; direction controls the step shading.
  rect(sx+3,sy+3,TILE-6,TILE-6,'#403a30');
  rect(sx+5,sy+5,TILE-10,TILE-10,'#66513a');
  for(let i=0;i<5;i++){
   const index=ascending?i:4-i;
   const top=sy+6+i*6;
   rect(sx+7,top,TILE-14,5,index%2?'#a78960':'#bd9b6a');
   line(sx+7,top,sx+TILE-7,top,'#e0bf86');
   line(sx+7,top+5,sx+TILE-7,top+5,'#56442f');
  }
  // Side rails and landing lip give the stairs a clear depth.
  rect(sx+4,sy+4,3,TILE-8,'#8b7655');
  rect(sx+TILE-7,sy+4,3,TILE-8,'#534633');
  rect(sx+4,sy+TILE-6,TILE-8,3,'#d0b083');
 }
}
function walls(b,x,y){
 const size=b.width*TILE,depth=b.height*TILE;
 stoneCourses(x,y-HEIGHT,size,HEIGHT);
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
 rootheartTempleMosaic(b,x,y,level);
 rootheartSmithyFloorDetail(b,x,y,level);
 rootheartShopFloorDetail(b,x,y,level);
 rootheartInnFloorDetail(b,x,y,level);
 rootheartHomeFloorDetail(b,x,y,level);
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
 const palette={
  'rootheart-inn':['#735143','#86604b','#b18c69','#4d392f'],
  'rootheart-smithy':['#525b5a','#646c67','#89918a','#343d3c'],
  'rootheart-shop':['#897246','#9b8253','#c1a36a','#5e5036'],
  'rootheart-temple':['#7c8684','#929b95','#c4c9b8','#555f5d'],
  'rootheart-home':['#75574c','#88675a','#b3977f','#503e37']
 }[b.id]||['#77604e','#846c55','#a18a70','#514439'];
 rect(px,py,TILE,TILE,(row+col)%2?palette[0]:palette[1]);
 // Small staggered shingles with restrained highlights and worn edges.
 for(let band=0;band<2;band++){
  const sy=py+band*20,offset=(row+band)%2?10:0;
  line(px,sy+19,px+TILE,sy+19,palette[3]);
  for(let i=-1;i<3;i++){
   const sx=px+i*20+offset;
   const left=Math.max(px,sx),right=Math.min(px+TILE,sx+20);
   if(right<=left)continue;
   line(left,sy+2,right,sy+2,palette[2]);
   if(sx>px&&sx<px+TILE)line(sx,sy+3,sx,sy+18,palette[3]);
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
function rootheartHomeFloorDetail(b,x,y,level){
 if(b.id!=='rootheart-home')return;
 if(level===0){
  // Hearthside flagstones and a small dining rug, kept away from the stairs.
  for(const [col,row] of [[3,0],[4,0],[3,1]]){
   const px=x+col*TILE,py=y+row*TILE;
   rect(px+3,py+3,TILE-6,TILE-6,'rgba(90,75,62,0.22)');
   line(px+7,py+TILE-8,px+TILE-8,py+TILE-8,'#b3a58e');
  }
  const px=x+2*TILE,py=y+1*TILE;
  rect(px+3,py+3,TILE-6,TILE-6,'rgba(126,82,54,0.18)');
  rect(px+7,py+6,TILE-14,4,'#9c775b');
  rect(px+7,py+TILE-10,TILE-14,4,'#9c775b');
 }else if(level===1){
  // Muted bedside rug and worn wooden plank highlights.
  for(const [col,row] of [[2,1],[3,2],[2,3]]){
   const px=x+col*TILE,py=y+row*TILE;
   rect(px+5,py+5,TILE-10,TILE-10,'rgba(111,78,65,0.27)');
   rect(px+8,py+8,TILE-16,TILE-16,'rgba(169,131,100,0.28)');
   line(px+11,py+TILE-11,px+TILE-11,py+TILE-11,'#b08a6b');
  }
 }
}
function rootheartInnFloorDetail(b,x,y,level){
 if(b.id!=='rootheart-inn')return;
 if(level===0){
  // Warm, worn stone around the dining tables; keep the stair tile unchanged.
  for(const [col,row] of [[2,1],[3,1],[4,1],[2,2],[3,2],[4,2],[2,3],[3,3],[4,3]]){
   const px=x+col*TILE,py=y+row*TILE;
   rect(px+3,py+3,TILE-6,TILE-6,'rgba(121,87,57,0.16)');
   line(px+7,py+TILE-8,px+TILE-8,py+TILE-8,'#a69a81');
   if((col+row)%2===0)rect(px+15,py+13,10,3,'#b8a98a');
  }
 }else if(level===1){
  // A narrow woven hallway runner, avoiding the upstairs stairwell.
  for(const row of [1,2,3,4]){
   const px=x+3*TILE,py=y+row*TILE;
   rect(px+9,py+2,TILE-18,TILE-4,'#765a4b');
   rect(px+12,py+4,TILE-24,TILE-8,'#ad8667');
   line(px+13,py+8,px+TILE-13,py+8,'#c7a788');
   line(px+13,py+TILE-9,px+TILE-13,py+TILE-9,'#674e43');
  }
 }
}
function rootheartShopFloorDetail(b,x,y,level){
 if(b.id!=='rootheart-shop'||level!==0)return;
 // Worn merchant's runner from the south entrance toward the counter.
 // The central aisle stays walkable and all details are visual only.
 for(let row=1;row<b.height;row++){
  const px=x+3*TILE,py=y+row*TILE;
  rect(px+8,py+2,TILE-16,TILE-4,'#77644b');
  rect(px+11,py+3,TILE-22,TILE-6,'#a28a62');
  line(px+13,py+8,px+TILE-13,py+8,'#c2a979');
  line(px+13,py+TILE-9,px+TILE-13,py+TILE-9,'#6e5b44');
  for(let i=0;i<3;i++){
   rect(px+9,py+7+i*12,3,4,'#c0a779');
   rect(px+TILE-12,py+7+i*12,3,4,'#c0a779');
  }
 }
}
function rootheartSmithyFloorDetail(b,x,y,level){
 if(b.id!=='rootheart-smithy'||level!==0)return;
 // Heat-worn masonry beneath the furnace and anvil; visual only.
 for(const [col,row] of [[4,0],[3,0],[4,1],[2,1],[2,2]]){
  const px=x+col*TILE,py=y+row*TILE;
  rect(px+3,py+4,TILE-6,TILE-8,'rgba(49,43,39,0.18)');
  line(px+6,py+TILE-9,px+TILE-7,py+TILE-9,'#69665d');
  if((col+row)%2===0){
   rect(px+12,py+18,5,3,'#a37a52');
   rect(px+26,py+26,4,3,'#6d5a4a');
  }
 }
}
function rootheartTempleMosaic(b,x,y,level){
 if(b.id!=='rootheart-temple'||level!==0)return;
 // A continuous ceremonial aisle, kept clear of the stairs and furnishings.
 for(let row=1;row<b.height;row++){
  const px=x+3*TILE,py=y+row*TILE;
  rect(px+5,py+3,TILE-10,TILE-6,'#aca795');
  rect(px+8,py+6,TILE-16,TILE-12,'#777e76');
  const mx=px+TILE/2,my=py+TILE/2;
  poly([[mx,my-11],[mx+10,my],[mx,my+11],[mx-10,my]],'#d2c5a5');
  poly([[mx,my-6],[mx+5,my],[mx,my+6],[mx-5,my]],'#8b9a8b');
 }
}
function rootheartHomeFurniture(b,x,y,level){
 if(b.id!=='rootheart-home')return;
 const at=(col,row)=>({x:x+col*TILE,y:y+row*TILE});
 if(level===0){
  // Hearth and dining area; keep the south entrance and staircase at (1,2) open.
  let p=at(3,0);
  rect(p.x+4,p.y+5,32,30,'#77766e');
  rect(p.x+9,p.y+13,22,19,'#393b37');
  rect(p.x+13,p.y+19,14,11,'#c66c39');
  rect(p.x+18,p.y+22,6,7,'#edb45e');
  p=at(2,1);
  rect(p.x+6,p.y+25,5,10,'#62462e');
  rect(p.x+29,p.y+25,5,10,'#62462e');
  rect(p.x+4,p.y+12,32,17,'#906b47');
  rect(p.x+7,p.y+12,26,4,'#c39a68');
  p=at(0,1);
  rect(p.x+5,p.y+8,30,27,'#604a36');
  rect(p.x+8,p.y+11,24,5,'#ad8b61');
  rect(p.x+8,p.y+22,24,5,'#ad8b61');
  p=at(4,2);
  rect(p.x+7,p.y+14,26,18,'#796044');
  rect(p.x+10,p.y+10,20,6,'#b49669');
 }else if(level===1){
  // Bed, bedside chest and storage; stair opening remains untouched.
  let p=at(3,1);
  rect(p.x+3,p.y+6,34,30,'#614731');
  rect(p.x+6,p.y+9,28,23,'#b2a58d');
  rect(p.x+7,p.y+10,26,8,'#e1d7bd');
  rect(p.x+7,p.y+20,26,10,'#687b68');
  p=at(4,1);
  rect(p.x+7,p.y+15,26,19,'#76573c');
  rect(p.x+9,p.y+12,22,6,'#ad885c');
  rect(p.x+16,p.y+22,8,4,'#c6ad78');
  p=at(0,1);
  rect(p.x+6,p.y+5,28,30,'#6e543b');
  rect(p.x+9,p.y+8,22,24,'#997653');
  line(p.x+20,p.y+9,p.x+20,p.y+31,'#594532');
 }
}
function rootheartTempleFurniture(b,x,y,level){
 if(b.id!=='rootheart-temple')return;
 const at=(col,row)=>({x:x+col*TILE,y:y+row*TILE});
 if(level===0){
  // Stone altar at the north wall; central aisle and entrance stay open.
  let p=at(3,0);
  rect(p.x+3,p.y+17,34,18,'#a9a697');
  rect(p.x+1,p.y+12,38,8,'#d2cbbb');
  rect(p.x+15,p.y+4,10,9,'#8c998c');
  rect(p.x+18,p.y+1,4,8,'#d8cba4');
  for(const [col,row] of [[1,2],[5,2],[1,3],[5,3]]){
   p=at(col,row);
   rect(p.x+4,p.y+14,32,8,'#806a52');
   rect(p.x+7,p.y+22,5,12,'#554838');
   rect(p.x+28,p.y+22,5,12,'#554838');
   rect(p.x+5,p.y+10,30,5,'#a28b6a');
  }
  for(const col of [1,5]){
   p=at(col,0);
   rect(p.x+15,p.y+15,10,20,'#858579');
   rect(p.x+12,p.y+10,16,7,'#c1b59c');
   rect(p.x+17,p.y+5,6,8,'#e0b66c');
  }
 }else if(level===1){
  // Upstairs reliquary and wall inscriptions; avoid the stair opening at (1,2).
  let p=at(3,1);
  rect(p.x+5,p.y+8,30,27,'#777b73');
  rect(p.x+9,p.y+11,22,20,'#c0b9a5');
  rect(p.x+17,p.y+14,6,14,'#879789');
  rect(p.x+13,p.y+18,14,5,'#879789');
  for(const col of [2,4]){
   p=at(col,3);
   rect(p.x+7,p.y+11,26,23,'#6c6457');
   rect(p.x+10,p.y+13,20,17,'#aba38f');
   line(p.x+14,p.y+18,p.x+26,p.y+18,'#6e7b71');
   line(p.x+14,p.y+24,p.x+24,p.y+24,'#6e7b71');
  }
 }
}
function rootheartShopFurniture(b,x,y,level){
 if(b.id!=='rootheart-shop'||level!==0)return;
 const at=(col,row)=>({x:x+col*TILE,y:y+row*TILE});
 // Shelves along the back and side walls, leaving the entrance aisle open.
 for(const [col,row] of [[1,0],[2,0],[4,0],[0,2]]){
  const p=at(col,row);
  rect(p.x+4,p.y+5,32,30,'#594432');
  for(let i=0;i<3;i++)rect(p.x+6,p.y+11+i*9,28,4,'#a07b4f');
  rect(p.x+9,p.y+7,7,7,'#9a7950');
  rect(p.x+22,p.y+7,8,7,'#71816c');
  rect(p.x+13,p.y+17,8,7,'#b3a06d');
 }
 // Merchant's counter.
 let p=at(3,2);
 rect(p.x+3,p.y+15,34,20,'#694b33');
 rect(p.x+1,p.y+12,38,7,'#b08b5c');
 rect(p.x+9,p.y+22,8,7,'#806444');
 // Crates and a small display of wares.
 p=at(5,1);
 rect(p.x+5,p.y+14,29,21,'#80613e');
 rect(p.x+8,p.y+17,23,15,'#a48455');
 line(p.x+8,p.y+17,p.x+31,p.y+32,'#6b5238');
 p=at(1,3);
 rect(p.x+7,p.y+17,26,15,'#8d6e48');
 rect(p.x+10,p.y+12,7,9,'#b6a36b');
 rect(p.x+22,p.y+13,6,8,'#75896e');
}
function rootheartSmithyFurniture(b,x,y,level){
 if(b.id!=='rootheart-smithy'||level!==0)return;
 const at=(col,row)=>({x:x+col*TILE,y:y+row*TILE});
 // Furnace against the back wall, away from the entrance.
 let p=at(4,0);
 rect(p.x+2,p.y+3,36,34,'#565954');
 rect(p.x+6,p.y+7,28,26,'#85877c');
 rect(p.x+10,p.y+16,20,15,'#302e2b');
 rect(p.x+13,p.y+19,14,11,'#c56a32');
 rect(p.x+17,p.y+22,7,7,'#e8ad55');
 // Anvil and sturdy base.
 p=at(2,1);
 rect(p.x+12,p.y+23,17,13,'#65513c');
 rect(p.x+7,p.y+12,27,12,'#454e50');
 rect(p.x+3,p.y+13,10,5,'#60696b');
 rect(p.x+15,p.y+10,16,4,'#929995');
 // Wooden workbench and simple tools.
 p=at(4,2);
 rect(p.x+5,p.y+12,30,8,'#a07b50');
 rect(p.x+8,p.y+20,5,15,'#5d4430');
 rect(p.x+28,p.y+20,5,15,'#5d4430');
 rect(p.x+12,p.y+9,4,12,'#626967');
 line(p.x+23,p.y+10,p.x+30,p.y+18,'#b3b5a9');
 // Material storage.
 p=at(0,1);
 rect(p.x+5,p.y+7,30,27,'#64503b');
 for(let i=0;i<3;i++)rect(p.x+8,p.y+10+i*8,24,4,'#8b7252');
}
function rootheartInnFurniture(b,x,y,level){
 if(b.id!=='rootheart-inn')return;
 const tile=(col,row)=>({x:x+col*TILE,y:y+row*TILE});
 function table(col,row){
  const p=tile(col,row);
  rect(p.x+6,p.y+27,5,8,'#493528');rect(p.x+29,p.y+27,5,8,'#493528');
  rect(p.x+4,p.y+12,32,17,'#6e4a31');
  rect(p.x+6,p.y+12,28,4,'#b18a5e');
  rect(p.x+13,p.y+18,6,5,'#c5b78b');
 }
 function bench(col,row){
  const p=tile(col,row);
  rect(p.x+6,p.y+13,28,8,'#775338');
  rect(p.x+8,p.y+21,5,11,'#473526');
  rect(p.x+27,p.y+21,5,11,'#473526');
 }
 function bed(col,row){
  const p=tile(col,row);
  rect(p.x+3,p.y+7,34,28,'#674833');
  rect(p.x+6,p.y+9,28,23,'#a59b80');
  rect(p.x+7,p.y+10,26,8,'#ddd3b7');
  rect(p.x+7,p.y+20,26,10,'#6b795d');
 }
 if(level===0){
  // Leave the entrance aisle (col 3) and stair tile (1,2) clear.
  table(2,1);table(4,2);bench(2,2);bench(4,3);
  const p=tile(5,1);
  rect(p.x+5,p.y+5,30,29,'#654b36');
  rect(p.x+7,p.y+7,26,5,'#b08b5c');
  rect(p.x+11,p.y+17,7,12,'#8d6a42');
  rect(p.x+22,p.y+17,7,12,'#8d6a42');
 }else if(level===1){
  bed(2,1);bed(4,1);bed(5,3);
  const p=tile(3,3);
  rect(p.x+8,p.y+10,24,24,'#73563d');
  rect(p.x+10,p.y+10,20,5,'#bd9b6e');
 }
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
 // Clip furnishings to solid floor tiles: never paint across stairwell openings.
 ctx.save();ctx.beginPath();
 const voids=floorVoids(b,level);
 const stairTiles=new Set(Object.values(stairsAt(b,level)).map(stair=>stair.x+','+stair.y));
 for(let row=0;row<b.height;row++)for(let col=0;col<b.width;col++){
  const key=col+','+row;
  if(!voids.has(key)&&!stairTiles.has(key))ctx.rect(x+col*TILE,y+row*TILE,TILE,TILE);
 }
 ctx.clip();
 rootheartInnFurniture(b,x,y,level);
 rootheartSmithyFurniture(b,x,y,level);
 rootheartShopFurniture(b,x,y,level);
 rootheartTempleFurniture(b,x,y,level);
 rootheartHomeFurniture(b,x,y,level);
 ctx.restore();
 elevatedFloorEdge(b,x,y,level);
 if(occupied)cutawayFront(b,x,y+b.height*TILE,level);
 else{
  // Exterior reveal: keep the roof removed, but retain an opaque front wall.
  // The interior is visible above the wall, not through translucent masonry.
  ctx.save();
  if(terraceAt(b,level)){ctx.beginPath();ctx.rect(x,y+b.height*TILE-HEIGHT,b.terrace.startCol*TILE,HEIGHT);ctx.clip();}
  facade(b,x,y+b.height*TILE,level,level===0);
  ctx.restore();
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
