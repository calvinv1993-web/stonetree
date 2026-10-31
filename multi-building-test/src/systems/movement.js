// Stonetree: src/systems/movement.js
function isStair(x,y){return localX(x)===BUILDING.stairs.x&&localY(y)===BUILDING.stairs.y;}
function walkable(x,y){
 if(inside(x,y)){
  // South wall occupies the front row except for the actual doorway.
  // Never let the player stand in the facade to either side of the door.
  // Every storey has solid exterior walls. Only the ground-floor door
  // is a traversable opening; upper floors have no exterior doorway.
  if(localY(y)===N-1&&(player.z!==0||localX(x)!==BUILDING.door.col))return false;
  return player.z===0||!VOID_TILES.has(localX(x)+','+localY(y))||isStair(x,y);
 }
 return player.z===0&&x>=BUILDING.position.x-7&&x<BUILDING.position.x+N+8&&y>=BUILDING.position.y-7&&y<=BUILDING.position.y+N+5;
}
function connected(cx,cy,nx,ny){
 if(inside(cx,cy)===inside(nx,ny))return true;
 return doorOpen&&localX(cx)===BUILDING.door.col&&localX(nx)===BUILDING.door.col&&
  ((localY(cy)===N-1&&localY(ny)===N)||(localY(cy)===N&&localY(ny)===N-1));
}
function adjacentToDoor(){
 return player.z===0&&localX(player.x)===BUILDING.door.col&&
  (localY(player.y)===N-1||localY(player.y)===N);
}
function toggleDoor(){
 if(!adjacentToDoor())return false;
 // Closing the door while standing in its tile moves the player
 // onto the free exterior tile before the door becomes solid.
 if(doorOpen&&localX(player.x)===BUILDING.door.col&&localY(player.y)===N-1){
  player.y=BUILDING.position.y+N;
 }
 doorOpen=!doorOpen;
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
