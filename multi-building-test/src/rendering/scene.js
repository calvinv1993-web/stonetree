// Stonetree: src/rendering/scene.js
// Tibia-style exterior cutaway: proximity to ANY outside wall reveals the
// real ground-floor geometry. No separate room or duplicate building is made.
// Distance in tiles to the building footprint (0 means inside).
function exteriorDistance(building){
 const left=building.position.x,right=left+building.width-1;
 const top=building.position.y,bottom=top+building.height-1;
 const dx=Math.max(left-player.x,0,player.x-right);
 const dy=Math.max(top-player.y,0,player.y-bottom);
 return Math.max(dx,dy);
}
function visibleExteriorStorey(building){
 if(player.z!==0||buildingAt(player.x,player.y))return null;
 const distance=exteriorDistance(building);
 return distance>=1&&distance<=building.floors.length?distance-1:null;
}
function paint(){
 syncBuilding();
 const active=BUILDING;
 const d=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
 canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
 ctx.setTransform(d,0,0,d,0,0);ctx.imageSmoothingEnabled=false;
 const worldX=Math.round(w/2-(player.x+.5)*TILE);
 const worldY=Math.round(h/2-(player.y+.5)*TILE+player.z*HEIGHT);
 originX=worldX;originY=worldY-player.z*HEIGHT;
 grass(worldX+active.position.x*TILE,worldY+active.position.y*TILE,w,h);
 const current=buildingAt(player.x,player.y);
 for(const b of BUILDINGS){
  selectBuilding(b);
  const x=worldX+b.position.x*TILE,y=worldY+b.position.y*TILE;
  if(current?.id===b.id){
   interior(x,y-player.z*HEIGHT,player.z);
  }else{
   const visibleLevel=visibleExteriorStorey(b);
   if(visibleLevel!==null)exteriorStorey(x,y,visibleLevel);
   else exterior(x,y);
  }

 }
 selectBuilding(active);
 if(!current){
  // Outside player is drawn exactly once, independent of nearby houses.
  playerSprite(worldX+(player.x+.5)*TILE,worldY+(player.y+.5)*TILE);
 }
 const place=!current?'Buiten':player.z===0?'Begane grond':'Bovenverdieping';
 document.getElementById('status').textContent=`${place} · z=${player.z} · deur ${doorOpen?'open':'dicht'} · (${player.x}, ${player.y})`;
 const control=document.getElementById('doorControl');
 control.hidden=!adjacentToDoor();
 if(terraceDoorBuilding())control.textContent=terraceDoorStates[terraceDoorBuilding().id]?'Sluit deur':'Open deur';
 else if(doorBuilding())control.textContent=doorStates[doorBuilding().id]?'Sluit deur':'Open deur';
 canvas.dataset.x=player.x;canvas.dataset.y=player.y;canvas.dataset.z=player.z;
}
