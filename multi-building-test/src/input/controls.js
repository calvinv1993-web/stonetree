document.getElementById('doorControl').addEventListener('click',()=>toggleDoor());
document.getElementById('closeLoot').addEventListener('click',()=>{document.getElementById('lootPanel').hidden=true;});
canvas.addEventListener('pointerdown',e=>{
 if(e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
 canvas.focus({preventScroll:true});
 const box=canvas.getBoundingClientRect();
 const px=(e.clientX-box.left)*camera.width/box.width,py=(e.clientY-box.top)*camera.height/box.height;
 if(typeof ratCorpses!=='undefined'&&player.z===0){
  for(let i=ratCorpses.length-1;i>=0;i--){
   const corpse=ratCorpses[i],cp=worldToScreen(corpse.x+.5,corpse.y+.5,0);
   if(Math.abs(px-cp.x)<=TILE/2&&Math.abs(py-cp.y)<=TILE/2){openRatCorpse(corpse);return;}
  }
 }
 if(typeof rat!=='undefined'&&ratHP>0&&player.z===0){
  const rp=worldToScreen(rat.x+.5,rat.y+.5,0);
  if(Math.abs(px-rp.x)<=TILE/2&&Math.abs(py-rp.y)<=TILE/2){selectRat();paint();return;}
 }
 for(const door of DOORS){
  if(door.z!==player.z)continue;
  const r=doorHitBox(door);
  if(px<r.x||px>=r.x+r.width||py<r.y||py>=r.y+r.height)continue;
  if(adjacentDoor()===door)toggleDoor(door);
  else{const target=door.kind==='front'&&buildingAt(player.x,player.y)!==door.building?door.b:door.a;route(target.x,target.y);}
  return;
 }
 const target=screenToTile(px,py);route(target.x,target.y);
});
addEventListener('keydown',e=>{
 const delta={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key];
 if(delta){e.preventDefault();const x=player.x+delta[0],y=player.y+delta[1];path=walkable(x,y)&&connected(player.x,player.y,x,y)?[[x,y]]:[];}
});
