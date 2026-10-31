// Stonetree: src/core/bootstrap.js
setInterval(()=>{
 if(!path.length)return;
 const [x,y]=path.shift();player.x=x;player.y=y;
 const stairBuilding=buildingAt(x,y);if(stairBuilding)selectBuilding(stairBuilding);
 const direction=stairAction(x,y);
 if(direction){
  // Stair landings are offset one tile: north when ascending,
  // south when descending. Never leave the player inside the stairs.
  const ascending=direction==='up';
  const landingY=y+(ascending?-1:1);
  const landingZ=player.z+(ascending?1:-1);
  const lx=x-stairBuilding.position.x,ly=landingY-stairBuilding.position.y;
  const validLanding=landingZ>=0&&landingZ<stairBuilding.floors.length&&
   buildingAt(x,landingY)===stairBuilding&&
   (landingZ===0||!VOID_TILES.has(lx+','+ly))&&
   !(ly===stairBuilding.height-1&&(landingZ!==0||lx!==stairBuilding.door.col));
  if(validLanding){
   player.z=landingZ;
   player.y=landingY;
  }
  path=[];
 }
 syncBuilding();paint();
},160);
addEventListener('resize',paint);paint();
