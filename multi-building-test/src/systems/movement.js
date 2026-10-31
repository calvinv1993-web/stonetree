// Stonetree: src/systems/movement.js
function stairAction(x,y,z=player.z){
 const b=buildingAt(x,y);if(!b)return null;
 const lx=x-b.position.x,ly=y-b.position.y;
 if(b.stairLevels){
  const level=b.stairLevels[z];if(!level)return null;
  for(const direction of ['down','up']){
   const stair=level[direction];
   if(stair&&stair.x===lx&&stair.y===ly)return direction;
  }
  return null;
 }
 return lx===b.stairs.x&&ly===b.stairs.y?(z===0?'up':z===1?'down':null):null;
}
function isStair(x,y){return stairAction(x,y)!==null;}
function walkable(x,y){
 const b=buildingAt(x,y);
 if(b){
  const lx=x-b.position.x,ly=y-b.position.y;
  // South wall occupies the front row except for the actual doorway.
  // Never let the player stand in the facade to either side of the door.
  // Every storey has solid exterior walls. Only the ground-floor door
  // is a traversable opening; upper floors have no exterior doorway.
  if(ly===b.height-1&&(player.z!==0||lx!==b.door.col))return false;
  return player.z===0||(buildingAt(player.x,player.y)===b&&(!(b.stairLevels?Boolean(b.stairLevels[player.z]?.down&&lx===b.stairLevels[player.z].down.x&&ly===b.stairLevels[player.z].down.y):VOID_TILES.has(lx+','+ly))||isStair(x,y)));
 }
 return player.z===0&&x>=-7&&x<=30&&y>=-7&&y<=10;
}
function connected(cx,cy,nx,ny){
 const a=buildingAt(cx,cy),b=buildingAt(nx,ny);
 if(a===b){
  if(a&&a.terrace&&player.z===a.terrace.level){
   const boundary=a.position.x+a.terrace.startCol;
   if((cx===boundary-1&&nx===boundary)||(cx===boundary&&nx===boundary-1)){
    const row=cy-a.position.y;
    return row===2&&ny===cy&&Boolean(terraceDoorStates[a.id]);
   }
  }
  return player.z===0||Boolean(a);
 }
 const building=a||b;
 if(!building||!doorStates[building.id]||player.z!==0)return false;
 const dx=building.position.x+building.door.col,front=building.position.y+building.height-1;
 return cx===dx&&nx===dx&&((cy===front&&ny===front+1)||(cy===front+1&&ny===front));
}
function doorBuilding(){
 return BUILDINGS.find(b=>player.z===0&&player.x===b.position.x+b.door.col&&
 (player.y===b.position.y+b.height-1||player.y===b.position.y+b.height));
}
function terraceDoorBuilding(){
 return BUILDINGS.find(b=>b.terrace&&player.z===b.terrace.level&&
  Math.abs(player.y-(b.position.y+2))<=1&&
  (player.x===b.position.x+b.terrace.startCol-1||player.x===b.position.x+b.terrace.startCol));
}
function adjacentToDoor(){return !!doorBuilding()||!!terraceDoorBuilding();}
function toggleDoor(){
 const terrace=terraceDoorBuilding();
 if(terrace){
  terraceDoorStates[terrace.id]=!terraceDoorStates[terrace.id];
  path=[];paint();return true;
 }
 const b=doorBuilding();if(!b)return false;
 selectBuilding(b);
 // Closing the door while standing in its tile moves the player
 // onto the free exterior tile before the door becomes solid.
 if(doorStates[b.id]&&player.x===b.position.x+b.door.col&&player.y===b.position.y+b.height-1){
  player.y=b.position.y+b.height;
 }
 doorStates[b.id]=!doorStates[b.id];
 doorOpen=doorStates[b.id];
 path=[];paint();return true;
}
function route(tx,ty){
 if(!walkable(tx,ty))return;
 const queue=[[player.x,player.y]],seen=new Set([player.x+','+player.y]),prev=new Map();
 while(queue.length){
  const [cx,cy]=queue.shift();if(cx===tx&&cy===ty)break;
  for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
   const nx=cx+dx,ny=cy+dy,k=nx+','+ny;
   if(!walkable(nx,ny)||seen.has(k))continue;
   if(!connected(cx,cy,nx,ny))continue;
   // Do not change floor while routing to an unrelated destination.
   if(isStair(nx,ny)&&!isStair(tx,ty))continue;
   seen.add(k);prev.set(k,[cx,cy]);queue.push([nx,ny]);
  }
 }
 let k=tx+','+ty;if(!seen.has(k))return;
 const steps=[];
 while(k!==player.x+','+player.y){
  const [cx,cy]=k.split(',').map(Number);steps.unshift([cx,cy]);
  const p=prev.get(k);k=p[0]+','+p[1];
 }
 path=steps;
}
