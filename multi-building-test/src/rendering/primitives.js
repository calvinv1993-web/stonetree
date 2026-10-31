// Stonetree: src/rendering/primitives.js
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function line(x,y,X,Y,c){ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke();}
function poly(p,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(...p[0]);for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);ctx.closePath();ctx.fill();}
function windowAt(wx,wy){
 rect(wx-3,wy-3,34,37,'#514d43');rect(wx,wy,28,28,'#37677b');
 rect(wx+12,wy,3,28,'#8fb2b8');rect(wx,wy+12,28,3,'#8fb2b8');
 rect(wx-4,wy+29,36,5,'#d6c8a8');
}
function playerSprite(x,y){
 rect(x-9,y+11,18,5,'#30352e');rect(x-9,y-2,18,15,'#384f76');
 rect(x-7,y-13,14,13,'#d8b38c');rect(x-8,y-15,16,5,'#493a2c');
 rect(x-8,y+11,6,6,'#292c32');rect(x+2,y+11,6,6,'#292c32');
}
function grass(x,y,w,h){
 for(let gy=Math.floor(-y/TILE)-1;gy<=Math.ceil((h-y)/TILE)+1;gy++)
 for(let gx=Math.floor(-x/TILE)-1;gx<=Math.ceil((w-x)/TILE)+1;gx++){
  const n=((gx*73856093)^(gy*19349663))>>>0,xx=x+gx*TILE,yy=y+gy*TILE;
  rect(xx,yy,TILE,TILE,['#4f7b42','#578548','#608b4d'][n%3]);
  rect(xx+8+n%18,yy+9+(n>>>5)%19,4,3,'#719b58');
 }
}

function rootheartGround(){
 const area=ROOTHEART;
 const left=Math.max(area.left,Math.floor(-camera.x/TILE)-1);
 const right=Math.min(area.left+area.size-1,Math.ceil((camera.width-camera.x)/TILE)+1);
 const top=Math.max(area.top,Math.floor(-camera.y/TILE)-1);
 const bottom=Math.min(area.top+area.size-1,Math.ceil((camera.height-camera.y)/TILE)+1);
 for(let gy=top;gy<=bottom;gy++)for(let gx=left;gx<=right;gx++){
  const px=camera.x+gx*TILE,py=camera.y+gy*TILE;
  const dx=Math.abs(gx-area.centerX),dy=Math.abs(gy-area.centerY);
  const plaza=dx<=6&&dy<=6;
  const road=(dx<=1||dy<=1);
  const seed=((gx*73856093)^(gy*19349663))>>>0;
  if(plaza||road){
   rect(px,py,TILE,TILE,plaza?(seed%3?'#999486':'#a49c8b'):(seed%3?'#817f73':'#8c8879'));
   rect(px,py+TILE-2,TILE,2,'#69695f');
   rect(px+TILE-2,py,2,TILE,'#6c6b62');
   if(seed%5===0)rect(px+9,py+12,13,2,'#aaa394');
  }else{
   rect(px,py,TILE,TILE,['#456d3e','#4b7542','#527a45'][seed%3]);
   rect(px+6+(seed%22),py+7+((seed>>>5)%22),5,3,'#648d4d');
   if(seed%11===0)rect(px+22,py+18,8,5,'#777668');
  }
 }
}
