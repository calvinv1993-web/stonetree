// One Rat spawn. Monster logic is independent of player pathfinding.
const RAT_SPAWN={x:6,y:7,z:0,radius:2};
const rat={x:RAT_SPAWN.x,y:RAT_SPAWN.y,z:0,fromX:RAT_SPAWN.x,fromY:RAT_SPAWN.y,movedAt:0};
let ratNextMove=0;
function ratTick(now){
 if(now<ratNextMove)return false;
 ratNextMove=now+500;
 const options=[[0,1],[1,0],[0,-1],[-1,0],[0,0]].filter(([dx,dy])=>{
  const x=rat.x+dx,y=rat.y+dy;
  return Math.abs(x-RAT_SPAWN.x)<=RAT_SPAWN.radius&&Math.abs(y-RAT_SPAWN.y)<=RAT_SPAWN.radius&&
   !buildingAt(x,y)&&walkable(x,y,0)&&!(player.z===0&&player.x===x&&player.y===y);
 });
 if(!options.length)return false;
 const [dx,dy]=options[Math.floor(Math.random()*options.length)];
 if(!dx&&!dy)return false;
 rat.fromX=rat.x;rat.fromY=rat.y;rat.x+=dx;rat.y+=dy;rat.movedAt=now;
 return true;
}
function drawRat(now){
 if(player.z!==0)return;
 const t=Math.max(0,Math.min(1,(now-rat.movedAt)/220));
 const x=rat.fromX+(rat.x-rat.fromX)*t,y=rat.fromY+(rat.y-rat.fromY)*t;
 const p=worldToScreen(x+.5,y+.5,0);
 // Temporary recognizable silhouette until dedicated monster textures are supplied.
 rect(p.x-12,p.y+9,24,4,'#29251f');
 rect(p.x-10,p.y-3,20,13,'#655c51');
 rect(p.x-8,p.y-8,6,7,'#74695d');
 rect(p.x+3,p.y-8,6,7,'#74695d');
 rect(p.x+6,p.y,3,3,'#171615');
 rect(p.x-15,p.y+4,6,3,'#9c8075');
}
