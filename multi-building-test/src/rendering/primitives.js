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
