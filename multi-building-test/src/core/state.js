// Stonetree: src/core/state.js
const canvas=document.getElementById('map'),ctx=canvas.getContext('2d');
const TILE=40,N=5,HEIGHT=64,THICK=6,SIDE=12;
const BUILDING={width:N,height:N,door:{side:'south',col:2},stairs:{x:1,y:1},floors:[{material:'stone',windows:[]},{material:'wood',windows:[1,3]}]};
const player={x:2,y:2,z:0};let path=[],originX=0,originY=0,screenY=0;
let doorOpen=false;
const inside=(x,y)=>x>=0&&x<N&&y>=0&&y<N;
const outside=()=>!inside(player.x,player.y);
