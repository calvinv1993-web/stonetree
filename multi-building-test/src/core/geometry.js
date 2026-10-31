function contains(b,x,y){return x>=b.position.x&&x<b.position.x+b.width&&y>=b.position.y&&y<b.position.y+b.height;}
function buildingAt(x,y){return BUILDINGS.find(b=>contains(b,x,y));}
function localTile(b,x,y){return {x:x-b.position.x,y:y-b.position.y};}
function floorVoids(b,level){return new Set((b.floors[level]?.holes||[]).map(([x,y])=>x+','+y));}
function stairsAt(b,level){return b.floors[level]?.stairs||{};}
function terraceAt(b,level){return b.terrace?.level===level?b.terrace:null;}
function worldToScreen(x,y,z=0){return {x:camera.x+x*TILE,y:camera.y+y*TILE-z*HEIGHT};}
function screenToTile(x,y,z=player.z){return {x:Math.floor((x-camera.x)/TILE),y:Math.floor((y-camera.y+z*HEIGHT)/TILE)};}
function doorDefinitions(b){
 const x=b.position.x+b.door.col,y=b.position.y+b.height-1;
 const result=[{id:b.id+':front',building:b,kind:'front',z:0,a:{x,y},b:{x,y:y+1}}];
 if(b.terrace){
  const x=b.position.x+b.terrace.startCol,y=b.position.y+b.terrace.door.row;
  result.push({id:b.id+':terrace',building:b,kind:'terrace',z:b.terrace.level,a:{x:x-1,y},b:{x,y}});
 }
 return result;
}
const DOORS=BUILDINGS.flatMap(doorDefinitions);
const sameTile=(a,b)=>a.x===b.x&&a.y===b.y;
function doorFor(b,kind='front'){return DOORS.find(d=>d.building===b&&d.kind===kind);}
function doorIsOpen(b,kind='front'){return Boolean(doorStates[doorFor(b,kind)?.id]);}
function doorHitBox(d){
 const b=d.building;
 if(d.kind==='terrace'){
  const p=worldToScreen(d.b.x,d.b.y,d.z);
  return {x:p.x-14,y:p.y-b.terrace.door.visualRise-10,width:28,height:TILE+20};
 }
 const p=worldToScreen(d.a.x,d.b.y,d.z);
 return {x:p.x,y:p.y-HEIGHT,width:TILE,height:HEIGHT};
}
function validateBuildings(buildings){
 const ids=new Set();
 for(const b of buildings){
  const integers=[b.width,b.height,b.position.x,b.position.y,b.position.z,b.door.col];
  if(integers.some(n=>!Number.isSafeInteger(n))||b.width<3||b.height<4||b.position.z!==0||b.door.side!=='south'||b.door.col<0||b.door.col>=b.width||!b.floors.length||ids.has(b.id))throw Error('Invalid building: '+b.id);
  ids.add(b.id);
  for(let z=0;z<b.floors.length;z++){
   for(const [direction,s] of Object.entries(stairsAt(b,z))){
    const target=z+(direction==='up'?1:-1),landing=s.y+(direction==='up'?-1:1);
    if(!['up','down'].includes(direction)||![s.x,s.y].every(Number.isSafeInteger)||s.x<0||s.x>=b.width||s.y<1||s.y>=b.height-1||target<0||target>=b.floors.length||landing<0||landing>=b.height-1||floorVoids(b,target).has(s.x+','+landing))throw Error('Invalid stair landing: '+b.id);
   }
   for(const [x,y] of b.floors[z].holes||[])if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||x>=b.width||y<0||y>=b.height||z===0)throw Error('Invalid stairwell: '+b.id);
  }
  if(b.terrace){const t=b.terrace;if(![t.level,t.startCol,t.door.row,t.door.visualRise].every(Number.isSafeInteger)||t.level<1||t.level>=b.floors.length||t.startCol<1||t.startCol>=b.width||t.door.row<0||t.door.row>=b.height-1||t.door.visualRise<0)throw Error('Invalid terrace: '+b.id);}
 }
 for(let i=0;i<buildings.length;i++)for(let j=i+1;j<buildings.length;j++){
  const a=buildings[i],b=buildings[j];
  if(a.position.x<b.position.x+b.width&&a.position.x+a.width>b.position.x&&a.position.y<b.position.y+b.height&&a.position.y+a.height>b.position.y)throw Error('Overlapping buildings');
 }
}
validateBuildings(BUILDINGS);
