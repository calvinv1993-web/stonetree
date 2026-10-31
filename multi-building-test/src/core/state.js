// Stonetree: src/core/state.js
const canvas=document.getElementById('map'),ctx=canvas.getContext('2d');
const TILE=40,HEIGHT=64,THICK=6,SIDE=12;
const BUILDING=BUILDING_CONFIG;
if(!Number.isInteger(BUILDING.width)||BUILDING.width<3||
   BUILDING.width!==BUILDING.height||
   !Number.isInteger(BUILDING.position.x)||!Number.isInteger(BUILDING.position.y)||
   BUILDING.position.z!==0||
   BUILDING.door.side!=='south'||
   BUILDING.door.col<0||BUILDING.door.col>=BUILDING.width||
   BUILDING.stairs.x<0||BUILDING.stairs.x>=BUILDING.width||
   BUILDING.stairs.y<0||BUILDING.stairs.y>=BUILDING.height){
 throw new Error('Unsupported building configuration');
}
const N=BUILDING.width;
const player={x:2,y:2,z:0};let path=[],originX=0,originY=0,screenY=0;
let doorOpen=false;
const inside=(x,y)=>x>=0&&x<N&&y>=0&&y<N;
const outside=()=>!inside(player.x,player.y);
