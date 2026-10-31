// Reusable building wall and opening model. Coordinates are world tiles.
export class Building {
 constructor({x,y,width,height,z=7,material='stone',doors=[],windows=[]}){
  if(![x,y,width,height,z].every(Number.isSafeInteger)||width<3||height<3)throw new RangeError('Invalid building');
  this.x=x;this.y=y;this.width=width;this.height=height;this.z=z;this.material=material;
  this.doors=new Map();this.windows=new Map();
  for(const d of doors)this.addOpening('door',d);
  for(const w of windows)this.addOpening('window',w);
 }
 key(x,y){return x+','+y;}
 contains(x,y){return x>=this.x&&x<this.x+this.width&&y>=this.y&&y<this.y+this.height;}
 boundary(x,y){return this.contains(x,y)&&(x===this.x||x===this.x+this.width-1||y===this.y||y===this.y+this.height-1);}
 addOpening(type,{x,y,open=false}){
  if(!this.boundary(x,y))throw new RangeError('Opening must be on outer wall');
  const key=this.key(x,y);
  if(this.doors.has(key)||this.windows.has(key))throw new Error('Duplicate opening');
  (type==='door'?this.doors:this.windows).set(key,{x,y,open:!!open});
 }
 wallEdges(x,y){return [y===this.y?'north':null,x===this.x+this.width-1?'east':null,y===this.y+this.height-1?'south':null,x===this.x?'west':null].filter(Boolean)}
 at(x,y){
  const key=this.key(x,y);
  if(this.doors.has(key))return {type:'door',...this.doors.get(key),material:this.material};
  if(this.windows.has(key))return {type:'window',...this.windows.get(key),material:this.material};
  if(this.boundary(x,y))return {type:'wall',material:this.material,mask:this.wallMask(x,y),edges:this.wallEdges(x,y)};
  if(this.contains(x,y))return {type:'floor',material:this.material};
  return null;
 }
 wallMask(x,y){
  if(!this.boundary(x,y))return 0;
  let mask=0;
  for(const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])
   if(this.boundary(x+dx,y+dy))mask|=bit;
  return mask;
 }
 blocked(x,y){
  const t=this.at(x,y);
  return t?.type==='wall'||t?.type==='window'||(t?.type==='door'&&!t.open);
 }
 toggleDoor(x,y,player){
  const d=this.doors.get(this.key(x,y));
  if(!d)return false;
  if(player.z!==this.z||Math.abs(player.x-x)+Math.abs(player.y-y)!==1)return false;
  d.open=!d.open;return true;
 }
}
