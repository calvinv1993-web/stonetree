// Stonetree: src/rendering/primitives.js
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function line(x,y,X,Y,c){ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke();}
function poly(p,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(...p[0]);for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);ctx.closePath();ctx.fill();}
function windowAt(wx,wy){
 rect(wx-3,wy-3,34,37,'#514d43');rect(wx,wy,28,28,'#37677b');
 rect(wx+12,wy,3,28,'#8fb2b8');rect(wx,wy+12,28,3,'#8fb2b8');
 rect(wx-4,wy+29,36,5,'#d6c8a8');
 rect(wx+3,wy+3,7,5,'#5c8791');rect(wx+19,wy+17,5,7,'#294e60');
 rect(wx-3,wy-3,34,3,'#817967');rect(wx-4,wy+33,36,2,'#81735d');
}
function playerSprite(x,y){
 rect(x-9,y+11,18,5,'#30352e');rect(x-9,y-2,18,15,'#384f76');
 rect(x-7,y-13,14,13,'#d8b38c');rect(x-8,y-15,16,5,'#493a2c');
 rect(x-8,y+11,6,6,'#292c32');rect(x+2,y+11,6,6,'#292c32');
 rect(x-7,y+1,4,9,'#57749a');rect(x+3,y+1,4,9,'#253a58');
 rect(x-4,y-9,3,3,'#4a3429');rect(x+3,y-9,3,3,'#4a3429');
}
function grass(x,y,w,h){
 for(let gy=Math.floor(-y/TILE)-1;gy<=Math.ceil((h-y)/TILE)+1;gy++)
 for(let gx=Math.floor(-x/TILE)-1;gx<=Math.ceil((w-x)/TILE)+1;gx++){
  const n=((gx*73856093)^(gy*19349663))>>>0,xx=x+gx*TILE,yy=y+gy*TILE;
  rect(xx,yy,TILE,TILE,['#4f7b42','#578548','#608b4d'][n%3]);
  rect(xx+8+n%18,yy+9+(n>>>5)%19,4,3,'#719b58');
  if((n&7)===0){
   rect(xx+4+(n>>>8)%26,yy+5+(n>>>13)%26,3,7,'#3e6939');
   rect(xx+7+(n>>>8)%26,yy+7+(n>>>13)%26,3,4,'#83a85c');
  }
  if((n&31)===9){
   const px=xx+12+(n>>>11)%19,py=yy+14+(n>>>17)%17;
   rect(px,py,5,4,'#9a997b');rect(px+1,py,3,2,'#c1bca0');
  }
 }
}
