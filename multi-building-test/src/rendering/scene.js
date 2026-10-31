// Stonetree: src/rendering/scene.js
// Tibia-style exterior cutaway: proximity to ANY outside wall reveals the
// real ground-floor geometry. No separate room or duplicate building is made.
function nearExteriorWall(){
 if(!outside()||player.z!==0)return false;
 const x=player.x,y=player.y;
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
 playerSprite(x+(player.x+.5)*TILE,y+(player.y+.5)*TILE);
}
function paint(){
 const d=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
 canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
 ctx.setTransform(d,0,0,d,0,0);ctx.imageSmoothingEnabled=false;
 const x=Math.round(w/2-(player.x+.5)*TILE);
 const y=Math.round(h/2-(player.y+.5)*TILE+player.z*HEIGHT);
 originX=x;originY=y-player.z*HEIGHT;
 grass(x,y,w,h);
 if(outside()){
  if(nearExteriorWall())exteriorCutaway(x,y);
  else{
   const drawPlayer=()=>playerSprite(x+(player.x+.5)*TILE,y+(player.y+.5)*TILE);
   if(player.y<N)drawPlayer();
   exterior(x,y);
   if(player.y>=N)drawPlayer();
  }
 }
 else interior(x,y-player.z*HEIGHT,player.z);
 const place=outside()?'Buiten':player.z===0?'Begane grond':'Bovenverdieping';
 document.getElementById('status').textContent=`${place} · z=${player.z} · deur ${doorOpen?'open':'dicht'} · (${player.x}, ${player.y})`;
 const control=document.getElementById('doorControl');
 control.hidden=!adjacentToDoor();
 control.textContent=doorOpen?'Sluit deur':'Open deur';
 canvas.dataset.x=player.x;canvas.dataset.y=player.y;canvas.dataset.z=player.z;
}
