const canvas=document.getElementById('map'),ctx=canvas.getContext('2d');
const TILE=WORLD_CONFIG.tileSize,HEIGHT=WORLD_CONFIG.storeyHeight;
const THICK=WORLD_CONFIG.capThickness,SIDE=WORLD_CONFIG.wallThickness;
const BUILDINGS=BUILDING_CONFIGS;
const player={x:2,y:2,z:0};
let path=[],originX=0,originY=0;
const doorStates=Object.create(null);
const camera={x:0,y:0,width:0,height:0,dpr:1};
