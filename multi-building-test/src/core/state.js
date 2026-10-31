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
let playerLevel=1;
function experienceForLevel(level){return Math.round((50*level**3-150*level**2+400*level)/3-200);}
function playerStepMilliseconds(){return Math.max(110,WORLD_CONFIG.stepMilliseconds-3*(playerLevel-1));}
function gainExperience(amount){
 playerProgress.xp+=amount;
 let changed=false;
 while(playerProgress.xp>=experienceForLevel(playerLevel+1)){playerLevel++;changed=true;}
 if(changed&&typeof refreshMovementTimer==='function')refreshMovementTimer();
}

function visualPlayer(){
 if(!movementVisual)return player;
 const now=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
 const t=Math.max(0,Math.min(1,(now-movementVisual.started)/playerStepMilliseconds()));
 if(t>=1){movementVisual=null;return player;}
 return {x:movementVisual.x+(player.x-movementVisual.x)*t,y:movementVisual.y+(player.y-movementVisual.y)*t,z:player.z};
}
