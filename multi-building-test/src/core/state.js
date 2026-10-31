const canvas=document.getElementById('map'),ctx=canvas.getContext('2d');
const TILE=WORLD_CONFIG.tileSize,HEIGHT=WORLD_CONFIG.storeyHeight;
const THICK=WORLD_CONFIG.capThickness,SIDE=WORLD_CONFIG.wallThickness;
const BUILDINGS=BUILDING_CONFIGS;
const player={x:2,y:2,z:0};
let path=[],originX=0,originY=0;
const doorStates=Object.create(null);
const camera={x:0,y:0,width:0,height:0,dpr:1};

// Render-only interpolation; collision and pathfinding remain tile-based.
let movementVisual=null;
function visualPlayer(){
 if(!movementVisual)return player;
 const now=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
 const t=Math.max(0,Math.min(1,(now-movementVisual.started)/WORLD_CONFIG.stepMilliseconds));
 if(t>=1){movementVisual=null;return player;}
 return {x:movementVisual.x+(player.x-movementVisual.x)*t,y:movementVisual.y+(player.y-movementVisual.y)*t,z:player.z};
}
