// Stonetree: src/core/state.js
const canvas=document.getElementById('map'),ctx=canvas.getContext('2d');
const TILE=40,HEIGHT=64,THICK=6,SIDE=12;
let BUILDING=BUILDING_CONFIG;
const BUILDINGS=BUILDING_CONFIGS;
const doorStates=Object.fromEntries(BUILDINGS.map(b=>[b.id,false]));
for(const b of BUILDINGS){
 if(!Number.isInteger(b.width)||b.width!==5||b.height!==5||
    !Number.isInteger(b.position.x)||!Number.isInteger(b.position.y)||b.position.z!==0||
    b.door.side!=='south'||!Number.isInteger(b.door.col)||b.door.col<0||b.door.col>=b.width||
    !Number.isInteger(b.stairs.x)||!Number.isInteger(b.stairs.y)||
    b.stairs.x<0||b.stairs.x>=b.width||b.stairs.y<1||b.stairs.y>=b.height-2||
    (b.stairs.x===b.door.col&&b.stairs.y===b.height-1)){
  throw new Error('Unsupported building configuration: '+b.id);
 }
}
const N=BUILDING.width;
const player={x:2,y:2,z:0};let path=[],originX=0,originY=0,screenY=0;
let doorOpen=false;
function selectBuilding(b){BUILDING=b;doorOpen=doorStates[b.id];}
function buildingAt(x,y){return BUILDINGS.find(b=>x>=b.position.x&&x<b.position.x+b.width&&y>=b.position.y&&y<b.position.y+b.height);}
function playerBuilding(){return buildingAt(player.x,player.y)||BUILDINGS.find(b=>player.x>=b.position.x-1&&player.x<=b.position.x+b.width&&player.y>=b.position.y-1&&player.y<=b.position.y+b.height)||BUILDINGS[0];}
function syncBuilding(){selectBuilding(playerBuilding());}
const inside=(x,y)=>x>=BUILDING.position.x&&x<BUILDING.position.x+N&&y>=BUILDING.position.y&&y<BUILDING.position.y+N;
const localX=x=>x-BUILDING.position.x;
const localY=y=>y-BUILDING.position.y;
const outside=()=>!inside(player.x,player.y);
