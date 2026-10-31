function exteriorDistance(b){
 return Math.max(b.position.x-player.x,player.x-(b.position.x+b.width-1),b.position.y-player.y,player.y-(b.position.y+b.height-1),0);
}
function visibleExteriorStorey(b){
 if(player.z!==0||buildingAt(player.x,player.y))return null;
 const distance=exteriorDistance(b);
 return distance>=1&&distance<=b.floors.length?distance-1:null;
}
function paint(){
 const d=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
 const visual=visualPlayer();
 if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){
  canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
 }
 ctx.setTransform(d,0,0,d,0,0);ctx.imageSmoothingEnabled=false;
 Object.assign(camera,{x:Math.round(w/2-(visual.x+.5)*TILE),y:Math.round(h/2-(visual.y+.5)*TILE+player.z*HEIGHT),width:w,height:h,dpr:d});
 originX=camera.x;originY=camera.y-player.z*HEIGHT;
 grass(camera.x,camera.y,w,h);
 rootheartGround();
 rootheartApproaches();
 rootheartPlazaDetails();
 const current=buildingAt(player.x,player.y);
 const drawPlayer=()=>{const p=worldToScreen(visual.x+.5,visual.y+.5,player.z);playerSprite(p.x,p.y);};
 let drawn=Boolean(current);
 for(const b of [...BUILDINGS].sort((a,b)=>(a.position.y+a.height)-(b.position.y+b.height))){
  if(!drawn&&player.y<b.position.y+b.height){drawPlayer();drawn=true;}
  const p=worldToScreen(b.position.x,b.position.y,0);
  if(b===current)interior(b,p.x,p.y-player.z*HEIGHT,player.z);
  else{const level=visibleExteriorStorey(b);if(level===null)exterior(b,p.x,p.y);else exteriorStorey(b,p.x,p.y,level);}
 }
 if(!drawn)drawPlayer();
 rootheartPetrifiedTree();
 drawRatCorpses();
 drawRat(typeof performance!=='undefined'&&performance.now?performance.now():Date.now());
 if(typeof playerHealth!=='undefined'){
  ctx.fillStyle='#252525';ctx.fillRect(12,48,124,20);
  ctx.fillStyle='#a63232';ctx.fillRect(14,50,120*playerHealth.current/playerHealth.max,16);
  ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText('HP '+playerHealth.current+'/'+playerHealth.max,19,62);
  if(typeof playerProgress!=='undefined'){
   ctx.fillStyle='#252525';ctx.fillRect(12,72,124,20);
   ctx.fillStyle='#fff';ctx.fillText('Lv '+playerLevel+' · XP '+playerProgress.xp+'/'+experienceForLevel(playerLevel+1),19,86);
  }
 }
 const door=adjacentDoor(),control=document.getElementById('doorControl');
 const place=current?current.name+' · '+(player.z?'Verdieping '+player.z:'Begane grond'):'Buiten';
 const doorText=door?' · '+(door.kind==='terrace'?'terrasdeur':'deur')+' '+(doorStates[door.id]?'open':'dicht'):'';
 document.getElementById('status').textContent=`${place} · z=${player.z}${doorText} · (${player.x}, ${player.y})`;
 control.hidden=!door;control.textContent=door&&doorStates[door.id]?'Sluit deur':'Open deur';
 canvas.dataset.x=player.x;canvas.dataset.y=player.y;canvas.dataset.z=player.z;canvas.dataset.revision=WORLD_CONFIG.revision;
}
