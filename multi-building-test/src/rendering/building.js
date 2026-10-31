// Stonetree: src/rendering/building.js
function facade(x,baseY,level,door){
 // One authoritative facade per physical storey, shared by interior and exterior views.
 const top=baseY-HEIGHT;
 rect(x,top,N*TILE,HEIGHT,'#aaa89a');
 for(let i=1;i<4;i++)line(x,top+i*HEIGHT/4,x+N*TILE,top+i*HEIGHT/4,'#89897e');
 rect(x,top,N*TILE,5,'#d9d4bf');
 if(door){
  const dx=x+BUILDING.door.col*TILE;
  // The doorway occupies one tile and has one shared interactive state.
  if(doorOpen){
   // Cut out the wall visually: show the actual floor tiles behind the
   // opening, rather than filling it with an opaque dark rectangle.
   ctx.save();
   ctx.beginPath();
   ctx.rect(dx+4,top+4,TILE-8,HEIGHT-9);
   ctx.clip();
   const floorY=baseY-N*TILE;
   for(let row=N-2;row<N;row++)floorTile(x,floorY,BUILDING.door.col,row,0);
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
 }else for(const col of BUILDING.floors[level].windows)
  windowAt(x+col*TILE+6,top+17);
 rect(x,baseY-5,N*TILE,5,'#77786e');
}
function exterior(x,y){
 if(BUILDING.terrace)return terraceExterior(x,y);
 return exteriorShell(x,y);
}
function exteriorShell(x,y){
 const size=N*TILE,base=y+size,roofY=y-BUILDING.floors.length*HEIGHT;
 // The roof covers the same complete footprint as both storeys.
 rect(x-SIDE,roofY,SIDE,size+BUILDING.floors.length*HEIGHT,'#656e65');
 rect(x+size,roofY,SIDE,size+2*HEIGHT,'#6f786c');
 for(let level=0;level<BUILDING.floors.length;level++)facade(x,base-level*HEIGHT,level,level===0);
 rect(x-SIDE,roofY,size+2*SIDE,size,'#756052');
 for(let row=0;row<size;row+=16)line(x-SIDE,roofY+row,x+size+SIDE,roofY+row,'#594c44');
 rect(x-SIDE,roofY,size+2*SIDE,5,'#b5a48b');
 rect(x-SIDE,base-BUILDING.floors.length*HEIGHT-3,size+2*SIDE,5,'#b5a48b');
}
// One physical building: each storey has a fixed world elevation.
// Camera follows the player's z. The geometry does not change between views.
const VOID_TILES=new Set(['1,1','1,2','2,1','2,2']);
function floorTile(x,y,col,row,level){
 const wood=BUILDING.floors[level].material==='wood';
 rect(x+col*TILE,y+row*TILE,TILE,TILE,wood?((col+row)%2?'#947959':'#a48966'):((col+row)%2?'#888f7d':'#979e8c'));
 ctx.strokeStyle='#646b5e';ctx.lineWidth=1;
 ctx.strokeRect(x+col*TILE+.5,y+row*TILE+.5,TILE,TILE);
}
function staircase(x,y,level){
 const stairs=BUILDING.stairLevels?Object.values(BUILDING.stairLevels[level]||{}):[BUILDING.stairs];
 for(const stair of stairs){
  const sx=x+stair.x*TILE,sy=y+stair.y*TILE;
  rect(sx+4,sy+5,TILE-8,TILE-9,level===0?'#715b37':'#635443');
  for(let i=0;i<4;i++)rect(sx+6,sy+7+i*7,TILE-12,5,i%2?'#c7a467':'#ddbf83');
 }
}
function walls(x,y){
 const size=N*TILE;
 rect(x,y-HEIGHT,size,HEIGHT,'#aaa99c');
 for(let i=1;i<4;i++)line(x,y-HEIGHT+i*HEIGHT/4,x+size,y-HEIGHT+i*HEIGHT/4,'#8b8b80');
 poly([[x,y-HEIGHT],[x+THICK,y-HEIGHT-THICK],[x+size+THICK,y-HEIGHT-THICK],[x+size,y-HEIGHT]],'#e0dac8');
 rect(x-SIDE,y-HEIGHT,SIDE,size+HEIGHT,'#777d72');
 rect(x+size,y-HEIGHT,SIDE,size+HEIGHT,'#777d72');
 rect(x-SIDE,y-HEIGHT,SIDE+THICK,THICK,'#d9d7c6');
 rect(x+size,y-HEIGHT,SIDE+THICK,THICK,'#d9d7c6');
}
function floorVoids(level){
 if(!BUILDING.stairLevels)return VOID_TILES;
 const stair=BUILDING.stairLevels[level]?.down;
 if(!stair)return new Set();
 return new Set([stair.x+','+stair.y]);
}
function renderFloor(x,y,level,holes){
 walls(x,y);
 for(let row=0;row<N;row++)for(let col=0;col<N;col++){
  if(holes&&floorVoids(level).has(col+','+row))continue;
  floorTile(x,y,col,row,level);
 }
 staircase(x,y,level);
}
function cutawayFront(x,base,level){
 // Fade the foreground facade near the player; retain its physical height.
 ctx.save();ctx.globalAlpha=localY(player.y)>=N-2?.25:1;
 facade(x,base,level,level===0);ctx.restore();
}
// Reveal the selected physical storey from outside without drawing a player.
function exteriorStorey(x,y,level){
 const size=N*TILE,upperY=y-level*HEIGHT;
 for(let lower=0;lower<level;lower++){
  const base=y+size-lower*HEIGHT;
  facade(x,base,lower,lower===0);
  rect(x-SIDE,base-HEIGHT,SIDE,HEIGHT,'#656e65');
  rect(x+size,base-HEIGHT,SIDE,HEIGHT,'#6f786c');
 }
 if(BUILDING.terrace&&level===BUILDING.terrace.level)terraceFloor(x,upperY,level);
 else renderFloor(x,upperY,level,level>0);
 ctx.save();ctx.globalAlpha=.18;
 facade(x,upperY+size,level,level===0);
 ctx.restore();
}
function terraceFloor(x,y,level){
 const edge=BUILDING.terrace.startCol*TILE;
 // Left-hand room retains the upper floor; the right is open stone.
 renderFloor(x,y,level,true);
 for(let row=0;row<N;row++)for(let col=BUILDING.terrace.startCol;col<N;col++){
  rect(x+col*TILE,y+row*TILE,TILE,TILE,(row+col)%2?'#a9a697':'#bcb8a7');
  ctx.strokeStyle='#8c8b80';ctx.lineWidth=1;
  ctx.strokeRect(x+col*TILE+.5,y+row*TILE+.5,TILE,TILE);
 }
 // Low parapet on the outer edges; an open passage connects room and terrace.
 rect(x+edge,y,5,TILE,'#b4ac9a');
 rect(x+edge,y+3*TILE,5,TILE,'#b4ac9a');
 rect(x+edge,y+4*TILE,5,TILE,'#b4ac9a');
 rect(x+edge,y-12,(N-BUILDING.terrace.startCol)*TILE,12,'#b7b09e');
 rect(x+N*TILE-10,y,10,N*TILE,'#999586');
 rect(x+edge,y+(N-1)*TILE-10,(N-BUILDING.terrace.startCol)*TILE,10,'#aaa595');
}
function terraceExterior(x,y){
 const roofY=y-2*HEIGHT,edge=BUILDING.terrace.startCol*TILE;
 // The roof only covers the enclosed left section.
 exteriorShell(x,y);
 rect(x+edge-SIDE,roofY,(N-BUILDING.terrace.startCol)*TILE+2*SIDE,N*TILE+8,'#8c8170');
 for(let row=0;row<N;row++)for(let col=BUILDING.terrace.startCol;col<N;col++){
  rect(x+col*TILE,y-HEIGHT+row*TILE,TILE,TILE,(row+col)%2?'#a9a697':'#bcb8a7');
 }
 rect(x+edge,y-HEIGHT-12,(N-BUILDING.terrace.startCol)*TILE,12,'#b7b09e');
 rect(x+N*TILE-10,y-HEIGHT,10,N*TILE,'#999586');
 rect(x+edge,y-HEIGHT+(N-1)*TILE-10,(N-BUILDING.terrace.startCol)*TILE,10,'#aaa595');
}
function towerInterior(x,upperY,level){
 const size=N*TILE;
 for(let lower=0;lower<level;lower++){
  const lowerY=upperY+(level-lower)*HEIGHT;
  facade(x,lowerY+size,lower,lower===0);
  rect(x-SIDE,lowerY+size-HEIGHT,SIDE,HEIGHT,'#656e65');
  rect(x+size,lowerY+size-HEIGHT,SIDE,HEIGHT,'#6f786c');
 }
 renderFloor(x,upperY,level,level>0);
 cutawayFront(x,upperY+size,level);
 playerSprite(x+(localX(player.x)+.5)*TILE,upperY+(localY(player.y)+.5)*TILE);
 ctx.fillStyle='#f0dfb0';ctx.font='bold 15px system-ui';
 ctx.fillText('Verdieping '+level+' · z='+level,x,upperY-HEIGHT-18);
}
function interior(x,upperY,level){
 if(BUILDING.stairLevels){towerInterior(x,upperY,level);return;}
 const size=N*TILE;
 if(level===0){
  renderFloor(x,upperY,0,false);
  cutawayFront(x,upperY+size,0);
  playerSprite(x+(localX(player.x)+.5)*TILE,upperY+(localY(player.y)+.5)*TILE);
  return;
 }
 // The downstairs room remains at its own world elevation.
 // Clip it to the actual upper-floor stairwell; never paint a fake
 // duplicate of its floor onto the upstairs floor.
 const lowerY=upperY+HEIGHT;
 // The ground-storey facade sits BELOW the upper room, not inside it.
 // This visible support keeps the elevation readable against the grass.
 rect(x-SIDE,upperY+size,SIDE,HEIGHT,'#656e65');
 rect(x+size,upperY+size,SIDE,HEIGHT,'#6f786c');
 facade(x,lowerY+size,0,true);
 ctx.save();ctx.beginPath();
 for(const key of VOID_TILES){
  const [col,row]=key.split(',').map(Number);
  ctx.rect(x+col*TILE,upperY+row*TILE,TILE,TILE);
 }
 ctx.clip();
 // Show the actual lower storey at its projected depth through the void.
 // Its walls, stairs and floor are drawn from the same geometry functions.
 renderFloor(x,lowerY,0,false);
 ctx.restore();
 // The upper floor is a real slab with an open stairwell.
 if(BUILDING.terrace)terraceFloor(x,upperY,1);
 else renderFloor(x,upperY,1,true);
 // Show slab thickness at the edges of the void.
 for(const key of VOID_TILES){
  const [col,row]=key.split(',').map(Number);
  if(!VOID_TILES.has(col+','+(row-1)))rect(x+col*TILE,upperY+row*TILE,TILE,5,'#d4bc91');
  if(!VOID_TILES.has((col-1)+','+row))rect(x+col*TILE,upperY+row*TILE,5,TILE,'#665b4b');
 }
 // Only the current storey's south wall is visible in cutaway mode.
 // Never draw the downstairs EXTERIOR facade inside the upstairs room.
 // The same level-1 window definitions are used by the outside facade.
 cutawayFront(x,upperY+size,1);
 playerSprite(x+(localX(player.x)+.5)*TILE,upperY+(localY(player.y)+.5)*TILE);
 ctx.fillStyle='#f0dfb0';ctx.font='bold 15px system-ui';
 ctx.fillText('Bovenverdieping · z=1',x,upperY-HEIGHT-18);
}
