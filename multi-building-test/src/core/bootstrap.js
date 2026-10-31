// Stonetree: src/core/bootstrap.js
setInterval(()=>{
 if(!path.length)return;
 const [x,y]=path.shift();player.x=x;player.y=y;
 const stairBuilding=buildingAt(x,y);if(stairBuilding)selectBuilding(stairBuilding);
 if(isStair(x,y)){
  // Stair landings are offset one tile: north when ascending,
  // south when descending. Never leave the player inside the stairs.
  const ascending=player.z===0;
  const landingY=y+(ascending?-1:1);
  const landingZ=ascending?1:0;
  const validLanding=inside(x,landingY)&&
   (landingZ===0||!VOID_TILES.has(localX(x)+','+localY(landingY)))&&
   !(localY(landingY)===N-1&&(landingZ!==0||localX(x)!==BUILDING.door.col));
  if(validLanding){
   player.z=landingZ;
   player.y=landingY;
  }
  path=[];
 }
 syncBuilding();paint();
},160);
addEventListener('resize',paint);paint();
