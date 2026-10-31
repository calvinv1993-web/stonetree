// One Rat spawn. Monster logic is independent of player pathfinding.
const RAT_SPAWN={x:6,y:7,z:0,radius:2};
const rat={x:RAT_SPAWN.x,y:RAT_SPAWN.y,z:0,fromX:RAT_SPAWN.x,fromY:RAT_SPAWN.y,movedAt:0};
let ratNextMove=0;
let ratMode='wander';
let ratSelected=false;
let ratHP=20;
let playerNextAttack=0;
let ratRespawnAt=0;
const ratCorpses=[];
let nextCorpseId=1;
function createRatCorpse(){
 ratCorpses.push({id:nextCorpseId++,x:rat.x,y:rat.y,z:0,items:[{name:'Gold coin',amount:1+Math.floor(Math.random()*3)}]});
}
function drawRatCorpses(){
 if(player.z!==0)return;
 for(const corpse of ratCorpses){
  const p=worldToScreen(corpse.x+.5,corpse.y+.5,0);
  rect(p.x-12,p.y-6,24,14,'#403529');rect(p.x-9,p.y-3,18,8,'#796b51');
  rect(p.x-4,p.y-1,8,4,'#aa9570');
 }
}
function openRatCorpse(corpse){
 if(player.z!==0||Math.abs(player.x-corpse.x)+Math.abs(player.y-corpse.y)>1)return false;
 const panel=document.getElementById('lootPanel');
 panel.hidden=false;
 document.getElementById('lootContents').textContent=corpse.items.length?corpse.items.map(item=>item.amount+' '+item.name).join(', '):'Empty';
 return true;
}

const playerProgress={xp:0};
const RAT_SIGHT=5,RAT_LEASH=8;
const ratDistance=(x,y)=>Math.abs(rat.x-x)+Math.abs(rat.y-y);
function ratValid(x,y){
 return !buildingAt(x,y)&&walkable(x,y,0)&&!(player.z===0&&player.x===x&&player.y===y);
}
function ratPath(tx,ty){
 const start=rat.x+','+rat.y,queue=[[rat.x,rat.y]],seen=new Set([start]),prev=new Map();
 for(let head=0;head<queue.length;head++){
  const [x,y]=queue[head];if(x===tx&&y===ty)break;
  for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
   const nx=x+dx,ny=y+dy,k=nx+','+ny;
   if(seen.has(k)||!ratValid(nx,ny)||Math.abs(nx-RAT_SPAWN.x)>RAT_LEASH||Math.abs(ny-RAT_SPAWN.y)>RAT_LEASH)continue;
   seen.add(k);prev.set(k,[x,y]);queue.push([nx,ny]);
  }
 }
 let key=tx+','+ty;if(!seen.has(key)||key===start)return null;
 while(prev.get(key)?.join(',')!==start)key=prev.get(key).join(',');
 return key.split(',').map(Number);
}
function ratTick(now){
 if(ratHP===0){
  if(!ratRespawnAt||now<ratRespawnAt)return false;
  if(player.z===0&&player.x===RAT_SPAWN.x&&player.y===RAT_SPAWN.y)return false;
  Object.assign(rat,{x:RAT_SPAWN.x,y:RAT_SPAWN.y,fromX:RAT_SPAWN.x,fromY:RAT_SPAWN.y,movedAt:now});
  ratHP=20;ratMode='wander';ratSelected=false;ratNextMove=now+650;ratRespawnAt=0;ratNextAttack=0;playerNextAttack=0;
  return true;
 }
 if(now<ratNextMove)return false;
 const distance=player.z===0?ratDistance(player.x,player.y):Infinity;
 const homeDistance=Math.abs(rat.x-RAT_SPAWN.x)+Math.abs(rat.y-RAT_SPAWN.y);
 if(ratMode==='chase'&&(distance>RAT_SIGHT+2||player.z!==0||homeDistance>RAT_LEASH))ratMode='return';
 if(ratMode==='wander'&&distance<=RAT_SIGHT)ratMode='chase';
 if(ratMode==='return'&&rat.x===RAT_SPAWN.x&&rat.y===RAT_SPAWN.y)ratMode='wander';
 if(ratMode==='return'&&distance<=RAT_SIGHT&&homeDistance<RAT_LEASH)ratMode='chase';
 ratNextMove=now+(ratMode==='chase'?430:650);
 let next=null;
 if(ratMode==='chase'){
  if(distance===1)return false; // Adjacent: combat will be added separately.
  const candidates=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>[player.x+dx,player.y+dy])
   .filter(([x,y])=>ratValid(x,y)&&Math.abs(x-RAT_SPAWN.x)<=RAT_LEASH&&Math.abs(y-RAT_SPAWN.y)<=RAT_LEASH)
   .sort((a,b)=>Math.abs(a[0]-rat.x)+Math.abs(a[1]-rat.y)-Math.abs(b[0]-rat.x)-Math.abs(b[1]-rat.y));
  for(const [x,y] of candidates){next=ratPath(x,y);if(next)break;}
 }else if(ratMode==='return')next=ratPath(RAT_SPAWN.x,RAT_SPAWN.y);
 else{
  const choices=[[0,1],[1,0],[0,-1],[-1,0],[0,0]].map(([dx,dy])=>[rat.x+dx,rat.y+dy])
   .filter(([x,y])=>Math.abs(x-RAT_SPAWN.x)<=RAT_SPAWN.radius&&Math.abs(y-RAT_SPAWN.y)<=RAT_SPAWN.radius&&ratValid(x,y));
  if(choices.length)next=choices[Math.floor(Math.random()*choices.length)];
 }
 if(!next||next[0]===rat.x&&next[1]===rat.y)return false;
 rat.fromX=rat.x;rat.fromY=rat.y;rat.x=next[0];rat.y=next[1];rat.movedAt=now;
 return true;
}
function drawRat(now){
 if(player.z!==0||ratHP===0)return;
 const t=Math.max(0,Math.min(1,(now-rat.movedAt)/220));
 const x=rat.fromX+(rat.x-rat.fromX)*t,y=rat.fromY+(rat.y-rat.fromY)*t;
 const p=worldToScreen(x+.5,y+.5,0);
 if(ratSelected){ctx.strokeStyle='#dc3030';ctx.lineWidth=2;ctx.strokeRect(p.x-17,p.y-19,34,38);}
 rect(p.x-15,p.y-24,30,5,'#262626');rect(p.x-14,p.y-23,28*ratHP/20,3,'#bf3030');
 // Temporary recognizable silhouette until dedicated monster textures are supplied.
 rect(p.x-12,p.y+9,24,4,'#29251f');
 rect(p.x-10,p.y-3,20,13,'#655c51');
 rect(p.x-8,p.y-8,6,7,'#74695d');
 rect(p.x+3,p.y-8,6,7,'#74695d');
 rect(p.x+6,p.y,3,3,'#171615');
 rect(p.x-15,p.y+4,6,3,'#9c8075');
}

const playerHealth={current:100,max:100};
let ratNextAttack=0;
function ratAttackTick(now){
 if(ratHP===0)return false;
 const adjacent=player.z===0&&ratDistance(player.x,player.y)===1;
 if(!adjacent||ratMode!=='chase'||playerHealth.current===0){ratNextAttack=0;return false;}
 if(!ratNextAttack){ratNextAttack=now+2000;return false;}
 if(now<ratNextAttack)return false;
 ratNextAttack=now+2000;
 playerHealth.current=Math.max(0,playerHealth.current-5);
 return true;
}

function selectRat(){
 if(player.z!==0||ratHP===0)return false;
 ratSelected=true;playerNextAttack=0;return true;
}
function playerAttackTick(now){
 if(!ratSelected||ratHP===0||playerHealth.current===0||player.z!==0)return false;
 if(ratDistance(player.x,player.y)!==1){playerNextAttack=0;return false;}
 if(!playerNextAttack){playerNextAttack=now+1200;return false;}
 if(now<playerNextAttack)return false;
 playerNextAttack=now+1200;
 ratHP=Math.max(0,ratHP-5);
 if(ratHP===0){ratSelected=false;ratMode='dead';ratNextAttack=0;ratRespawnAt=now+30000;gainExperience(5);createRatCorpse();}
 return true;
}
