// Stonetree world core v1. Independent of rendering and gameplay.
export const GROUND_Z=7;
export const MIN_Z=0;
export const MAX_Z=15;
export const CHUNK_SIZE=32;
export const MAX_MOVABLE=100;
const integer=n=>Number.isSafeInteger(n);
export function position(x,y,z=GROUND_Z){
 if(!integer(x)||!integer(y)||!integer(z)||z<MIN_Z||z>MAX_Z)throw new RangeError('Invalid world coordinate');
 return {x,y,z};
}
export function chunkAddress(x,y,z=GROUND_Z){
 position(x,y,z);
 return {cx:Math.floor(x/CHUNK_SIZE),cy:Math.floor(y/CHUNK_SIZE),z};
}
const flags=o=>({blockWalking:!!o.blockWalking,blockProjectiles:!!o.blockProjectiles,blockSight:!!o.blockSight});
export class Tile {
 constructor(x,y,z,ground){
  this.position=position(x,y,z);
  if(!ground||typeof ground!=='object')throw new TypeError('Tile requires one ground item');
  this.ground={...ground,...flags(ground)};
  this.staticItems=[];this.moveableItems=[];this.creature=null;this.effects=[];
 }
 addStatic(item){if(!item||typeof item!=='object')throw new TypeError('Invalid item');this.staticItems.push({...item,...flags(item)});}
 pushItem(item){
  if(!item||typeof item!=='object')throw new TypeError('Invalid item');
  if(this.moveableItems.length>=MAX_MOVABLE)return false;
  this.moveableItems.push({...item,...flags(item)});return true;
 }
 popItem(){return this.moveableItems.pop()??null;}
 setCreature(creature){if(creature&&this.creature&&this.creature!==creature)return false;this.creature=creature;return true;}
 addEffect(effect){this.effects.push(effect);}
 get stack(){return [this.ground,...this.staticItems,...this.moveableItems,...(this.creature?[this.creature]:[]),...this.effects];}
 get walkable(){return !this.creature&&![this.ground,...this.staticItems,...this.moveableItems].some(o=>o.blockWalking);}
 get projectilesPass(){return ![this.ground,...this.staticItems,...this.moveableItems].some(o=>o.blockProjectiles);}
 get sightPass(){return ![this.ground,...this.staticItems,...this.moveableItems].some(o=>o.blockSight);}
}
export class World {
 constructor(){this.chunks=new Map();}
 key(cx,cy,z){return z+':'+cx+':'+cy;}
 getTile(x,y,z=GROUND_Z){
  const a=chunkAddress(x,y,z),chunk=this.chunks.get(this.key(a.cx,a.cy,z));
  return chunk?.get(x+':'+y)??null;
 }
 setTile(x,y,z,ground){
  const a=chunkAddress(x,y,z),key=this.key(a.cx,a.cy,z);
  let chunk=this.chunks.get(key);
  if(!chunk){chunk=new Map();this.chunks.set(key,chunk);}
  const tile=new Tile(x,y,z,ground);chunk.set(x+':'+y,tile);return tile;
 }
 canWalk(x,y,z=GROUND_Z){return this.getTile(x,y,z)?.walkable??false;}
 canShoot(x,y,z=GROUND_Z){return this.getTile(x,y,z)?.projectilesPass??false;}
 moveCreature(creature,from,to){
  const source=this.getTile(from.x,from.y,from.z),target=this.getTile(to.x,to.y,to.z);
  if(!source||!target||source.creature!==creature||!target.walkable)return false;
  source.creature=null;target.creature=creature;return true;
 }
}
