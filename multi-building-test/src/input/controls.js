// Stonetree: src/input/controls.js
document.getElementById('doorControl').addEventListener('click',toggleDoor);
canvas.addEventListener('pointerdown',e=>{
 canvas.focus();
 const box=canvas.getBoundingClientRect();
 const px=e.clientX-box.left,py=e.clientY-box.top;
 // A tap on the visible door operates it only from an adjacent tile.
 for(const building of BUILDINGS){
  const doorLeft=originX+(building.position.x+building.door.col)*TILE;
  const doorTop=originY+(building.position.y+building.height)*TILE-HEIGHT;
  if(player.z===0&&px>=doorLeft&&px<doorLeft+TILE&&py>=doorTop&&py<doorTop+HEIGHT){
   if(doorBuilding()?.id===building.id)toggleDoor();
   else if(buildingAt(player.x,player.y)?.id===building.id)route(building.position.x+building.door.col,building.position.y+building.height-1);
   else route(building.position.x+building.door.col,building.position.y+building.height);
   return;
  }
 }
 route(Math.floor((px-originX)/TILE),Math.floor((py-originY)/TILE));
});
addEventListener('keydown',e=>{
 const delta={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key];
 if(delta){e.preventDefault();const x=player.x+delta[0],y=player.y+delta[1];
  path=walkable(x,y)&&connected(player.x,player.y,x,y)?[[x,y]]:[];}
});
