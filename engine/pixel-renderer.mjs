// Original pixel-art-inspired procedural tiles; no external sprites or image requests.
const palette={
 grass:['#426e42','#54824b','#659052'],mud:['#695139','#806044','#98744c'],
 water:['#265a79','#30718d','#3e87a0'],rock:['#515452','#676b66','#82857c'],
 floor:['#817e74','#a19a86','#b2a994'],wall:['#555d5c','#727b76','#929b8e'],
 roof:['#653f39','#89554a','#aa7060'],door:['#493125','#70492f','#a27a4c'],
 window:['#275c71','#4a9cb4','#a2d5d5'],stairs:['#715b37','#b08b4f','#dec082'],
 hole:['#181c1d','#2d3232','#454a48'],void:['#14191a','#14191a','#14191a']
};
function hash(x,y,z=0){let n=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041))>>>0;n=Math.imul(n^(n>>>13),1274126177)>>>0;return n^(n>>>16)}
export function drawTile(ctx,t,x,y,s,wx,wy){
 const colors=palette[t.type]??palette.void,seed=hash(wx,wy,t.z??7);
 ctx.fillStyle=colors[1];ctx.fillRect(x,y,s,s);
 if(t.type==='void')return;
 ctx.fillStyle=colors[0];ctx.fillRect(x,y,s,3);ctx.fillRect(x,y,3,s);
 ctx.fillStyle=colors[2];ctx.fillRect(x+3,y+s-3,s-3,3);ctx.fillRect(x+s-3,y+3,3,s-3);
 if(['grass','mud','rock','water'].includes(t.type)){
  for(let i=0;i<7;i++){const px=(seed>>((i*3)%23)+i*7)%Math.max(1,s-9),py=(seed>>((i*4)%23)+i*11)%Math.max(1,s-9);ctx.fillStyle=colors[i%3];ctx.fillRect(x+4+px,y+4+py,i%2?5:3,i%3?2:4)}
  if(t.type==='water'){ctx.fillStyle='#83b4bf';ctx.fillRect(x+6,y+11,12,2);ctx.fillRect(x+19,y+25,10,2)}
  if(t.type==='rock'){ctx.fillStyle='#a3a59b';ctx.fillRect(x+8,y+7,15,4);ctx.fillStyle='#393e3d';ctx.fillRect(x+10,y+24,18,5)}
 }else if(t.type==='floor'){
  ctx.strokeStyle=colors[0];ctx.lineWidth=1;for(let i=12;i<s;i+=12){ctx.beginPath();ctx.moveTo(x,y+i);ctx.lineTo(x+s,y+i);ctx.stroke()}ctx.fillStyle=colors[2];ctx.fillRect(x+8,y+8,5,3);
 }else if(t.type==='roof'){
  ctx.fillStyle=colors[0];for(let row=0;row<4;row++){const yy=y+row*10;ctx.fillRect(x,yy,s,2);for(let col=0;col<3;col++)ctx.fillRect(x+((col*17+row*9)%s),yy+2,2,8)}
  ctx.fillStyle=colors[2];ctx.fillRect(x+5,y+5,10,2);
 }else if(t.type==='wall'){
  ctx.fillStyle=colors[0];ctx.fillRect(x+4,y+4,s-8,s-8);ctx.fillStyle=colors[2];ctx.fillRect(x+7,y+7,s-14,5);
  ctx.strokeStyle=colors[1];ctx.lineWidth=3;const m=t.mask??0;for(const [bit,ax,ay,bx,by] of [[1,.5,0,.5,.5],[2,.5,.5,1,.5],[4,.5,.5,.5,1],[8,0,.5,.5,.5]])if(m&bit){ctx.beginPath();ctx.moveTo(x+ax*s,y+ay*s);ctx.lineTo(x+bx*s,y+by*s);ctx.stroke()}ctx.lineWidth=1;
 }else if(t.type==='door'){
  ctx.fillStyle=t.open?'#aa8b60':colors[0];ctx.fillRect(x+6,y+3,s-12,s-6);ctx.strokeStyle=colors[2];ctx.strokeRect(x+9,y+6,s-18,s-12);ctx.fillStyle='#d4ba70';ctx.fillRect(x+s-13,y+s/2,3,3);
 }else if(t.type==='window'){
  ctx.fillStyle=colors[0];ctx.fillRect(x+5,y+5,s-10,s-10);ctx.fillStyle=colors[2];ctx.fillRect(x+8,y+8,s-16,s-16);ctx.fillStyle='#d0e6db';ctx.fillRect(x+s/2-2,y+8,4,s-16);ctx.fillRect(x+8,y+s/2-2,s-16,4);
 }else if(t.type==='stairs'){
  ctx.fillStyle=colors[0];ctx.fillRect(x+5,y+5,s-10,s-10);for(let i=0;i<4;i++){ctx.fillStyle=i%2?colors[1]:colors[2];ctx.fillRect(x+8,y+8+i*6,s-16,5)}
 }else if(t.type==='hole'){
  ctx.fillStyle=colors[0];ctx.fillRect(x+5,y+5,s-10,s-10);
  if(t.below){ctx.fillStyle=t.below.material==='wood'?'#70533c':'#676e68';ctx.fillRect(x+9,y+9,s-18,s-18)}
  ctx.strokeStyle=colors[2];ctx.lineWidth=3;ctx.strokeRect(x+5,y+5,s-10,s-10);ctx.lineWidth=1;
 }
}
export function drawPlayer(ctx,x,y,s){ctx.fillStyle='#202326';ctx.fillRect(x+s*.25,y+s*.68,s*.5,s*.24);ctx.fillStyle='#293e65';ctx.fillRect(x+s*.32,y+s*.44,s*.36,s*.31);ctx.fillStyle='#d3b28b';ctx.fillRect(x+s*.35,y+s*.21,s*.3,s*.26);ctx.fillStyle='#503c2d';ctx.fillRect(x+s*.32,y+s*.17,s*.36,s*.09);ctx.fillStyle='#e5d6b4';ctx.fillRect(x+s*.57,y+s*.3,3,3)}
