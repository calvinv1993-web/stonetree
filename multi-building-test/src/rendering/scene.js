// Stonetree: src/rendering/scene.js
// Tibia-style exterior cutaway: proximity to ANY outside wall reveals the
// real ground-floor geometry. No separate room or duplicate building is made.
function nearExteriorWall(){
 if(!outside()||player.z!==0)return false;
 const x=localX(player.x),y=localY(player.y);
 return (x>=-1&&x<=N&&y>=-1&&y<=N) &&
  ((x===-1||x===N)&&y>=0&&y<N ||
   (y===-1||y===N)&&x>=0&&x<N);
}
function exteriorCutaway(x,y){
 // Use exactly the same ground floor and objects as the interior.
 renderFloor(x,y,0,false);
 // Foreground wall becomes translucent; roof and upper facade are hidden
 // only while standing directly beside an exterior wall.
 ctx.save();ctx.globalAlpha=.18;
 facade(x,y+N*TILE,0,true);
 ctx.restore();
 playerSprite(x+(localX(player.x)+.5)*TILE,y+(localY(player.y)+.5)*TILE);
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
  }else if(nearExteriorWall()){
   exteriorCutaway(x,y);
  }else{
   exterior(x,y);
  }
 }
 selectBuilding(active);
 if(!current){
  const spriteX=worldX+(player.x+.5)*TILE,spriteY=worldY+(player.y+.5)*TILE;
  // Draw the player after buildings only when standing south of them.
  if(player.y>=active.position.y+active.height)playerSprite(spriteX,spriteY);
  else {
   // For north/side approaches, keep the player visible above the scene.
   playerSprite(spriteX,spriteY);
  }
 }
 const place=!current?'Buiten':player.z===0?'Begane grond':'Bovenverdieping';
 document.getElementById('status').textContent=`${place} · z=${player.z} · deur ${doorOpen?'open':'dicht'} · (${player.x}, ${player.y})`;
 const control=document.getElementById('doorControl');
 control.hidden=!adjacentToDoor();
 if(adjacentToDoor())control.textContent=doorStates[doorBuilding().id]?'Sluit deur':'Open deur';
 canvas.dataset.x=player.x;canvas.dataset.y=player.y;canvas.dataset.z=player.z;
}
