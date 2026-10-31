// Stonetree: src/input/controls.js
document.getElementById('doorControl').addEventListener('click',toggleDoor);
canvas.addEventListener('pointerdown',e=>{
 canvas.focus();
 const box=canvas.getBoundingClientRect();
 const px=e.clientX-box.left,py=e.clientY-box.top;
 // A tap on the visible door operates it only from an adjacent tile.
 const doorLeft=originX+BUILDING.door.col*TILE;
 const doorTop=originY+N*TILE-HEIGHT;
 if(player.z===0&&px>=doorLeft&&px<doorLeft+TILE&&
    py>=doorTop&&py<doorTop+HEIGHT){
  // From a distance, tapping the doorway walks to the reachable tile
  // immediately in front of it; only an adjacent player operates it.
  if(adjacentToDoor())toggleDoor();
  else if(inside(player.x,player.y))route(BUILDING.door.col,N-1);
  else route(BUILDING.door.col,N);
  return;
 }
 route(Math.floor((px-originX)/TILE),Math.floor((py-originY)/TILE));
});
addEventListener('keydown',e=>{
 const delta={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key];
 if(delta){e.preventDefault();const x=player.x+delta[0],y=player.y+delta[1];
  path=walkable(x,y)&&connected(player.x,player.y,x,y)?[[x,y]]:[];}
});
