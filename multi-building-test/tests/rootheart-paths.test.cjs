// Run with: node tests/rootheart-paths.test.cjs
// Verify the five Rootheart doors connect to the road without crossing buildings.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=fs.readFileSync(path.join(root,'src/data/buildings.js'),'utf8');
const primitives=fs.readFileSync(path.join(root,'src/rendering/primitives.js'),'utf8');
const context=vm.createContext({});
vm.runInContext(data+'\nconst BUILDINGS=BUILDING_CONFIGS;',context);
vm.runInContext(primitives,context);
const details=vm.runInContext(`({
  buildings:BUILDINGS.filter(b=>b.id.startsWith('rootheart-')),
  root:ROOTHEART,
  approach:(x,y)=>rootheartApproachTile(x,y),
  occupied:(x,y)=>BUILDINGS.some(b=>x>=b.position.x&&x<b.position.x+b.width&&y>=b.position.y&&y<b.position.y+b.height)
})`,context);
const {buildings,root:area,approach,occupied}=details;
assert.equal(buildings.length,5,'Expected five Rootheart buildings');
const onRoad=(x,y)=>Math.abs(x-area.centerX)<=1||Math.abs(y-area.centerY)<=1;
const accessible=(x,y)=>!occupied(x,y)&&(approach(x,y)||onRoad(x,y));
for(const b of buildings){
 const x=b.position.x+b.door.col,y=b.position.y+b.height;
 assert(!occupied(x,y),b.id+': door landing is occupied');
 assert(accessible(x,y),b.id+': door landing is not on an approach');
 const queue=[[x,y]],seen=new Set([x+','+y]);
 let connected=false;
 for(let i=0;i<queue.length;i++){
  const [cx,cy]=queue[i];
  if(onRoad(cx,cy)){connected=true;break;}
  for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const nx=cx+dx,ny=cy+dy,key=nx+','+ny;
   if(nx<area.left||nx>=area.left+area.size||ny<area.top||ny>=area.top+area.size||seen.has(key)||!accessible(nx,ny))continue;
   seen.add(key);queue.push([nx,ny]);
  }
 }
 assert(connected,b.id+': no continuous path to main road');
 console.log('OK',b.id,'door',x,y);
}
