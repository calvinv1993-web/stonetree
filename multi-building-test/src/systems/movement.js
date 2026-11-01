function stairAction(x,y,z=player.z){
 const b=buildingAt(x,y);if(!b)return null;
 const tile=localTile(b,x,y);
 return Object.entries(stairsAt(b,z)).find(([,s])=>sameTile(s,tile))?.[0]||null;
}
// Solid furnishings use the same local tile positions as the rendering layer.
// Decorative rugs, floor patterns and wall inscriptions remain walkable.
const ROOTHEART_SOLID_FURNITURE={
 'rootheart-home':{0:[[3,0],[2,1],[0,1],[4,2]],1:[[3,1],[4,1],[0,1]]},
 'rootheart-temple':{0:[[3,0],[1,2],[5,2],[1,3],[5,3],[1,0],[5,0]]},
 'rootheart-shop':{0:[[1,0],[2,0],[4,0],[0,2],[3,2],[5,1],[1,3]]},
 'rootheart-smithy':{0:[[4,0],[2,1],[4,2],[0,1]]},
 'rootheart-inn':{0:[[2,1],[4,2],[2,2],[4,3],[5,1]],1:[[2,1],[4,1],[5,3],[3,3]]}
};
function furnitureBlocks(b,x,y,z){
 const tiles=ROOTHEART_SOLID_FURNITURE[b.id]?.[z];
 if(!tiles)return false;
 const local=localTile(b,x,y);
 return tiles.some(([col,row])=>col===local.x&&row===local.y);
}
function walkable(x,y,z=player.z){
 if(![x,y,z].every(Number.isSafeInteger))return false;
 const b=buildingAt(x,y);
 if(!b){
  const area=WORLD_CONFIG.bounds;
  if(z!==0||x<area.left||x>area.right||y<area.top||y>area.bottom)return false;
  // The petrified trunk occupies a 3x3 footprint; paths route around it.
  if(x>=ROOTHEART.centerX-1&&x<=ROOTHEART.centerX+1&&
     y>=ROOTHEART.centerY-1&&y<=ROOTHEART.centerY+1)return false;
  return true;
 }
 if(!b.floors[z])return false;
 const t=localTile(b,x,y),terrace=terraceAt(b,z);
 if(t.y===b.height-1&&!(z===0&&t.x===b.door.col)&&!(terrace&&t.x>=terrace.startCol))return false;
 if(furnitureBlocks(b,x,y,z))return false;
 return !floorVoids(b,z).has(t.x+','+t.y)||Boolean(stairAction(x,y,z));
}
function connected(cx,cy,nx,ny,z=player.z){
 if(Math.abs(nx-cx)+Math.abs(ny-cy)!==1)return false;
 const a=buildingAt(cx,cy),b=buildingAt(nx,ny);
 if(a===b){
  const terrace=a&&terraceAt(a,z);
  if(terrace){
   const edge=a.position.x+terrace.startCol;
   if(Math.min(cx,nx)===edge-1&&Math.max(cx,nx)===edge){
    const door=doorFor(a,'terrace');
    return cy===door.a.y&&ny===cy&&Boolean(doorStates[door.id]);
   }
  }
  return z===0||Boolean(a?.floors[z]);
 }
 if(a&&b)return false;
 const building=a||b;if(!building||z!==0)return false;
 const door=doorFor(building);
 return Boolean(doorStates[door.id])&&((sameTile({x:cx,y:cy},door.a)&&sameTile({x:nx,y:ny},door.b))||(sameTile({x:cx,y:cy},door.b)&&sameTile({x:nx,y:ny},door.a)));
}
function adjacentDoor(){return DOORS.find(d=>d.z===player.z&&(sameTile(player,d.a)||sameTile(player,d.b)));}
function toggleDoor(door=adjacentDoor()){
 if(!door||door!==adjacentDoor())return false;
 // Preserve the existing safe exterior landing when closing the entrance.
 if(door.kind==='front'&&doorStates[door.id]&&sameTile(player,door.a))Object.assign(player,door.b);
 doorStates[door.id]=!doorStates[door.id];path=[];paint();return true;
}
function route(tx,ty){
 path=[]; // A blocked/new destination cancels the old walk order.
 if(!walkable(tx,ty))return false;
 const queue=[[player.x,player.y]],seen=new Set([player.x+','+player.y]),prev=new Map();
 for(let head=0;head<queue.length;head++){
  const [cx,cy]=queue[head];if(cx===tx&&cy===ty)break;
  for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
   const nx=cx+dx,ny=cy+dy,k=nx+','+ny;
   if(seen.has(k)||!walkable(nx,ny)||!connected(cx,cy,nx,ny))continue;
   if(stairAction(nx,ny)&&(nx!==tx||ny!==ty))continue;
   seen.add(k);prev.set(k,[cx,cy]);queue.push([nx,ny]);
  }
 }
 let key=tx+','+ty;if(!seen.has(key))return false;
 const steps=[];
 while(key!==player.x+','+player.y){steps.push(key.split(',').map(Number));key=prev.get(key).join(',');}
 path=steps.reverse();return true;
}
function stepMovement(){
 if(!path.length)return false;
 const [x,y]=path.shift();
 const previous={x:player.x,y:player.y,z:player.z};
 if(!walkable(x,y)||!connected(player.x,player.y,x,y)){path=[];return false;}
 const direction=stairAction(x,y);
 if(direction){
  const z=player.z+(direction==='up'?1:-1),landingY=y+(direction==='up'?-1:1),b=buildingAt(x,y);
  if(buildingAt(x,landingY)!==b||!walkable(x,landingY,z)||stairAction(x,landingY,z)){path=[];return false;}
  Object.assign(player,{x,y:landingY,z});movementVisual=null;path=[];
 }else{
  Object.assign(player,{x,y});
  const now=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  movementVisual={x:previous.x,y:previous.y,started:now};
 }
 return true;
}
