import {Building} from './building.mjs';

// Z decreases upwards: ground=7, first floor=6, roof above highest floor.
export class BuildingWorld {
 constructor(buildings=[]){this.buildings=[];for(const b of buildings)this.add(b)}
 add(config){
  const floors=config.floors??2;
  const groundZ=config.z??7;
  if(!Number.isSafeInteger(floors)||floors<1||groundZ-floors<0||groundZ>15)throw new RangeError('Invalid floor count');
  const base=config instanceof Building?config:new Building(config);
  const record={base,floors,groundZ,roofZ:groundZ-floors,stairs:config.stairs??null,holes:config.holes??[]};
  for(const other of this.buildings){
   const a=base,b=other.base;
   if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)throw new Error('Overlapping buildings');
  }
  this.buildings.push(record);return record;
 }
 find(x,y){return this.buildings.find(b=>b.base.contains(x,y))??null}
 tile(x,y,z){
  const b=this.find(x,y);if(!b)return null;
  if(z===b.roofZ){
   // The upper wall ring occupies the boundary tiles; roof tiles fill
   // only the interior. Both belong to the same real Z layer.
   if(b.base.boundary(x,y))return {type:'wall',z,material:b.base.material,mask:b.base.wallMask(x,y)};
   return {type:'roof',z,material:b.base.material};
  }
  if(z>b.groundZ||z<b.roofZ)return null;
  const level=b.groundZ-z;
  if(b.holes.some(h=>h.x===x&&h.y===y&&h.z===z))return {type:'hole',z};
  if(b.stairs&&b.stairs.x===x&&b.stairs.y===y&&level<b.floors)return {type:'stairs',z};
  if(level===0)return {...b.base.at(x,y),z};
  return b.base.boundary(x,y)?{type:'wall',z,material:b.base.material,mask:b.base.wallMask(x,y)}:{type:'floor',z,material:b.base.material};
 }
 blocked(x,y,z){
  const t=this.tile(x,y,z);
  return t===null||t.type==='roof'||t.type==='wall'||t.type==='window'||t.type==='hole'||(t.type==='door'&&!t.open);
 }
 // Render selection never mutates the underlying Z layers.
 visibleTile(x,y,viewer,{revealDistance=2}={}){
  const b=this.find(x,y);
  if(!b)return null;
  const dx=Math.max(b.base.x-viewer.x,0,viewer.x-(b.base.x+b.base.width-1));
  const dy=Math.max(b.base.y-viewer.y,0,viewer.y-(b.base.y+b.base.height-1));
  const close=Math.max(dx,dy)<=revealDistance;
  const viewerInside=b.base.contains(viewer.x,viewer.y);
  if(viewer.z===b.groundZ&&!viewerInside&&!close)return this.tile(x,y,b.roofZ);
  // A player on a floor sees that floor, not the roof above it.
  const t=this.tile(x,y,viewer.z);
  if(t?.type==='hole')return {type:'hole',z:viewer.z,below:this.tile(x,y,viewer.z+1)};
  return t;
 }
}
