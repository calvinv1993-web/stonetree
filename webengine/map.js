export const TILE_SIZE=32;
export const GROUND_Z=7;
export const WIDTH=128;
export const HEIGHT=128;
export const CHUNK_SIZE=32;
export const FLOOR_COUNT=16;

const chunks=new Map();
let activeChunks=new Set();
const key=(cx,cy)=>cx+","+cy;
const valid=(x,y,z)=>Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(z)&&x>=0&&x<WIDTH&&y>=0&&y<HEIGHT&&z>=0&&z<FLOOR_COUNT;

function buildChunk(cx,cy) {
  const tiles=Array.from({length:CHUNK_SIZE},()=>Array.from({length:CHUNK_SIZE},()=>Array.from({length:FLOOR_COUNT},()=>[])));
  for(let lx=0;lx<CHUNK_SIZE;lx++) for(let ly=0;ly<CHUNK_SIZE;ly++) {
    const x=cx*CHUNK_SIZE+lx,y=cy*CHUNK_SIZE+ly;
    if(x>=WIDTH||y>=HEIGHT) continue;
    const stack=tiles[lx][ly][GROUND_Z];
    stack.push({type:"ground",color:(x+y)%2?"#658b56":"#6d945d"});
    if(x>=6&&x<=12&&y>=5&&y<=10) {
      const perimeter=x===6||x===12||y===5||y===10;
      if(perimeter&&!(x===8&&y===5)) stack.push({type:"wall",solid:true,color:"#a5a09a"});
      else if(!perimeter) stack.push({type:"floor",color:"#bdad89"});
    }
    if(x===8&&y===7) stack.push({type:"item",id:"gold_coin",pickupable:true,color:"#f3cb43"});
    if(x===9&&y===8) stack.push({type:"item",id:"sword",pickupable:true,color:"#c5e2ee"});
    // Demo access points outside the original house; original walls/items remain unchanged.
    if(x===14&&y===12) stack.push({type:"stairs_up",dx:0,dy:-1,color:"#a9c3e5"});
    if(x===18&&y===12) stack.push({type:"hole",dx:0,dy:1,color:"#27212b"});
    if(x>=12&&x<=17&&y>=9&&y<=15) {
      const upper=tiles[lx][ly][GROUND_Z-1];
      upper.push({type:"floor",color:"#b8a989"});
      if(x===14&&y===11) upper.push({type:"stairs_down",dx:0,dy:1,color:"#c8b58b"});
      if(x===13&&y===10) upper.push({type:"roof",color:"#943b38"});
    }
    if(x>=17&&x<=21&&y>=11&&y<=16) {
      const basement=tiles[lx][ly][GROUND_Z+1];
      basement.push({type:"floor",color:"#706d65"});
      if(x===18&&y===13) basement.push({type:"stairs_up",dx:0,dy:-1,color:"#a9c3e5"});
    }
  }
  return tiles;
}
function chunkAt(cx,cy) {
  const k=key(cx,cy);
  if(!chunks.has(k)) chunks.set(k,buildChunk(cx,cy));
  return chunks.get(k);
}
export function getObjects(x,y,z) {
  if(!valid(x,y,z)) return null;
  return chunkAt(Math.floor(x/CHUNK_SIZE),Math.floor(y/CHUNK_SIZE))[x%CHUNK_SIZE][y%CHUNK_SIZE][z];
}
// Canonical indexing is preserved: map[x][y][z] returns an object array.
// Proxies provide a lazy view; the actual backing storage is chunked.
export const map=new Proxy({},{
  get(_target,x) {
    const ix=Number(x);
    if(!Number.isInteger(ix)||ix<0||ix>=WIDTH) return undefined;
    return new Proxy({},{
      get(_row,y) {
        const iy=Number(y);
        if(!Number.isInteger(iy)||iy<0||iy>=HEIGHT) return undefined;
        return Array.from({length:FLOOR_COUNT},(_,z)=>getObjects(ix,iy,z));
      }
    });
  }
});
export function addObject(x,y,z,object) {
  const stack=getObjects(x,y,z);
  if(!stack) throw new RangeError("Invalid map coordinate");
  stack.push({...object});
}
export function isWalkable(x,y,z) {
  const stack=getObjects(x,y,z);
  return stack!==null&&stack.some(o=>o.type==="ground"||o.type==="floor")&&!stack.some(o=>o.solid===true||o.blocking===true);
}
// Resolve a floor transition on entry. Never transition again on arrival.
export function getTransition(x,y,z) {
  const stack=getObjects(x,y,z);
  if(!stack) return null;
  const stair=stack.find(o=>["stairs_up","stairs_down","hole"].includes(o.type));
  if(!stair) return null;
  const dz=stair.type==="stairs_up"?-1:1;
  const nx=x+(stair.dx??0),ny=y+(stair.dy??0),nz=z+dz;
  if(!isWalkable(nx,ny,nz)) return null;
  return {x:nx,y:ny,z:nz};
}
export function takeTopItem(x,y,z) {
  const stack=getObjects(x,y,z);
  if(!stack) return null;
  for(let i=stack.length-1;i>=0;i--) if(stack[i].type==="item"&&stack[i].pickupable===true) return stack.splice(i,1)[0];
  return null;
}
// Activate viewport chunks and their immediate 1-chunk neighbors as a movement buffer.
// Rendering still clips to visible tiles, avoiding unnecessary draw calls.
export function activateChunks(minX,minY,maxX,maxY) {
  const next=new Set();
  const left=Math.max(0,Math.floor(minX/CHUNK_SIZE)-1);
  const right=Math.min(Math.ceil(WIDTH/CHUNK_SIZE)-1,Math.floor(maxX/CHUNK_SIZE)+1);
  const top=Math.max(0,Math.floor(minY/CHUNK_SIZE)-1);
  const bottom=Math.min(Math.ceil(HEIGHT/CHUNK_SIZE)-1,Math.floor(maxY/CHUNK_SIZE)+1);
  for(let cy=top;cy<=bottom;cy++) for(let cx=left;cx<=right;cx++) {
    next.add(key(cx,cy));chunkAt(cx,cy);
  }
  activeChunks=next;
}
export function getActiveChunks() {
  return [...activeChunks].map(k=>{
    const [cx,cy]=k.split(",").map(Number);
    return {cx,cy,tiles:chunkAt(cx,cy)};
  });
}
