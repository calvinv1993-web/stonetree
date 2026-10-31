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
  ctx.fillStyle=t.material==='wood'?'#6c5138':'#8c897d';ctx.fillRect(x+2,y+2,s-4,s-4);
  if(t.material==='wood'){for(let i=7;i<s;i+=9){ctx.fillStyle=i%2?'#a58560':'#927452';ctx.fillRect(x+3,y+i,s-6,2)}ctx.fillStyle='#57442f';ctx.fillRect(x+7,y+3,2,s-6)}
  else{ctx.fillStyle='#b8b1a0';ctx.fillRect(x+4,y+4,s-8,s-9);ctx.fillStyle='#918e80';ctx.fillRect(x+4,y+s-7,s-8,3);ctx.fillRect(x+s-8,y+4,3,s-8);ctx.fillStyle='#c8c0ae';ctx.fillRect(x+6,y+6,10,2)}
  ctx.fillStyle='#605c51';ctx.fillRect(x+2,y+2,2,s-4);
 }else if(t.type==='roof'){
  const wood=t.material==='wood';ctx.fillStyle=wood?'#463d32':'#503934';ctx.fillRect(x,y,s,s);
  // Offset roof rows create a readable overlapping shingle silhouette.
  for(let row=0;row<5;row++){const yy=y+row*8,shift=(row%2)*9;ctx.fillStyle=wood?'#805e40':'#985c50';ctx.fillRect(x,yy,s,7);ctx.fillStyle=wood?'#b18a59':'#c3836b';ctx.fillRect(x,yy,s,2);ctx.fillStyle=wood?'#503c2b':'#613f3b';ctx.fillRect(x,yy+6,s,2);for(let col=-1;col<4;col++){const xx=x+col*17+shift;if(xx>=x&&xx<x+s){ctx.fillStyle=wood?'#644b34':'#754a43';ctx.fillRect(xx,yy+2,2,4)}}}
  ctx.fillStyle='#e0b49a';ctx.fillRect(x+5,y+4,11,2);ctx.fillStyle='#3b2928';ctx.fillRect(x+2,y+s-4,s-4,4);
 }else if(t.type==='wall'){
  // Wall is a narrow static object drawn over a floor, not a solid tile.
  const wood=t.material==='wood',edges=t.edges??[];
  ctx.fillStyle=wood?'#8d7153':'#b4b3a7';ctx.fillRect(x,y,s,s);
  ctx.fillStyle=wood?'#aa8a65':'#c7c4b6';ctx.fillRect(x+2,y+2,s-4,s-4);
  const thick=8,base=wood?'#634833':'#596561',light=wood?'#b08a5e':'#a5aaa0',shadow=wood?'#382c22':'#343f3e';
  function wallRect(px,py,w,h,horizontal){
   ctx.fillStyle=shadow;ctx.fillRect(px,py,w,h);
   ctx.fillStyle=base;ctx.fillRect(px+1,py+1,w-2,h-2);
   ctx.fillStyle=light;
   if(horizontal)ctx.fillRect(px+1,py+1,w-2,2);
   else ctx.fillRect(px+1,py+1,2,h-2);
  }
  if(edges.includes('north'))wallRect(x,y,s,thick,true);
  if(edges.includes('south'))wallRect(x,y+s-thick,s,thick,true);
  if(edges.includes('west'))wallRect(x,y,thick,s,false);
  if(edges.includes('east'))wallRect(x+s-thick,y,thick,s,false);
 }else if(t.type==='door'||t.type==='window'){
  const wood=t.material==='wood',edge=(t.edges??[])[0]??'west',thick=8;
  ctx.fillStyle=wood?'#8d7153':'#b4b3a7';ctx.fillRect(x,y,s,s);
  ctx.fillStyle=wood?'#aa8a65':'#c7c4b6';ctx.fillRect(x+2,y+2,s-4,s-4);
  const horizontal=edge==='north'||edge==='south';
  const px=edge==='east'?x+s-thick:x,py=edge==='south'?y+s-thick:y;
  const w=horizontal?s:thick,h=horizontal?thick:s;
  if(t.type==='door'&&t.open){
   ctx.fillStyle='#a88450';
   if(horizontal){ctx.fillRect(px,py,4,h);ctx.fillRect(px+s-4,py,4,h)}
   else{ctx.fillRect(px,py,w,4);ctx.fillRect(px,py+s-4,w,4)}
  }else{
   ctx.fillStyle=t.type==='door'?'#503525':'#315f74';ctx.fillRect(px,py,w,h);
   ctx.fillStyle=t.type==='door'?'#a17b4d':'#a6d6dc';
   if(horizontal)ctx.fillRect(px+3,py+2,s-6,h-4);
   else ctx.fillRect(px+2,py+3,w-4,s-6);
  }
 }else if(t.type==='stairs'){
  ctx.fillStyle='#3a3023';ctx.fillRect(x+4,y+3,s-8,s-6);for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#b99b62':'#e0c78d';ctx.fillRect(x+7,y+5+i*7,s-14,6);ctx.fillStyle='#66512f';ctx.fillRect(x+7,y+10+i*7,s-14,2)}ctx.fillStyle='#e9d39c';ctx.fillRect(x+7,y+5,s-14,2);
 }else if(t.type==='hole'){
  ctx.fillStyle='#080c0d';ctx.fillRect(x+3,y+3,s-6,s-6);ctx.fillStyle='#252b2a';ctx.fillRect(x+6,y+6,s-12,s-12);
  if(t.below){ctx.fillStyle=t.below.material==='wood'?'#70533c':'#676e68';ctx.fillRect(x+9,y+9,s-18,s-18)}
  ctx.strokeStyle=colors[2];ctx.lineWidth=3;ctx.strokeRect(x+5,y+5,s-10,s-10);ctx.lineWidth=1;
 }
}
export function drawPlayer(ctx,x,y,s){ctx.fillStyle='#202326';ctx.fillRect(x+s*.25,y+s*.68,s*.5,s*.24);ctx.fillStyle='#293e65';ctx.fillRect(x+s*.32,y+s*.44,s*.36,s*.31);ctx.fillStyle='#d3b28b';ctx.fillRect(x+s*.35,y+s*.21,s*.3,s*.26);ctx.fillStyle='#503c2d';ctx.fillRect(x+s*.32,y+s*.17,s*.36,s*.09);ctx.fillStyle='#e5d6b4';ctx.fillRect(x+s*.57,y+s*.3,3,3)}
