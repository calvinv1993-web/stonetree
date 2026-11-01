import {WIDTH, HEIGHT, TILE_SIZE, GROUND_Z, CHUNK_SIZE, isWalkable, takeTopItem, activateChunks, getActiveChunks} from "./map.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", {alpha:false});
const player = {x:8,y:12,z:GROUND_Z,inventory:[]};
const inventoryLabel = document.querySelector("#inventory");
const camera = {x:0,y:0};
let viewWidth=1, viewHeight=1;

// All assets are requested before startup. A failed file stays null.
class AssetManager {
  constructor() {
    this.images = new Map();
    this.paths = {
      player:"./assets/player.png", grass:"./assets/grass.png",
      wall:"./assets/wall.png", roof:"./assets/roof.png",
      stairs_up:"./assets/stairs_up.png",
      stairs_down:"./assets/stairs_down.png",
      gold_coin:"./assets/gold_coin.png", sword:"./assets/sword.png"
    };
  }
  async load() {
    await Promise.all(Object.entries(this.paths).map(([key,path]) =>
      new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          this.images.set(key, img.naturalWidth && img.naturalHeight ? img : null);
          resolve();
        };
        img.onerror = () => { this.images.set(key,null); resolve(); };
        img.src = path;
      })
    ));
  }
  get(key) { return this.images.get(key) ?? null; }
}
const assets = new AssetManager();

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(rect.width*dpr));
  canvas.height = Math.max(1, Math.round(rect.height*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled = false;
  viewWidth = rect.width;
  viewHeight = rect.height;
  render();
}
function drawTile(assetKey, color, px, py) {
  const img = assets.get(assetKey);
  if(img) {
    ctx.drawImage(img,px,py,TILE_SIZE,TILE_SIZE);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE);
  }
}
function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#202b29";
  ctx.fillRect(0,0,viewWidth,viewHeight);
  camera.x = Math.round(viewWidth/2 - (player.x+0.5)*TILE_SIZE);
  camera.y = Math.round(viewHeight/2 - (player.y+0.5)*TILE_SIZE);
  const minX=Math.max(0,Math.floor(-camera.x/TILE_SIZE)-1);
  const minY=Math.max(0,Math.floor(-camera.y/TILE_SIZE)-1);
  const maxX=Math.min(WIDTH-1,Math.ceil((viewWidth-camera.x)/TILE_SIZE));
  const maxY=Math.min(HEIGHT-1,Math.ceil((viewHeight-camera.y)/TILE_SIZE));
  activateChunks(minX,minY,maxX,maxY);
  for(const chunk of getActiveChunks()) {
    const x0=Math.max(minX,chunk.cx*CHUNK_SIZE),x1=Math.min(maxX,(chunk.cx+1)*CHUNK_SIZE-1);
    const y0=Math.max(minY,chunk.cy*CHUNK_SIZE),y1=Math.min(maxY,(chunk.cy+1)*CHUNK_SIZE-1);
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
      const stack=chunk.tiles[x%CHUNK_SIZE][y%CHUNK_SIZE][player.z];
      const px=camera.x+x*TILE_SIZE,py=camera.y+y*TILE_SIZE;
      for(const obj of stack) {
        if(!["ground","floor","wall","roof","stairs_up","stairs_down","item"].includes(obj.type)) continue;
        if(obj.type==="item") {
          const img=assets.get(obj.sprite??obj.id);
          if(img) ctx.drawImage(img,px,py,TILE_SIZE,TILE_SIZE);
          else {
            ctx.fillStyle=obj.color??"#f3cb43";
            ctx.fillRect(px+9,py+9,14,14);
            ctx.strokeStyle="#493b20";
            ctx.strokeRect(px+9.5,py+9.5,13,13);
          }
          continue;
        }
        const sprite=obj.sprite??({ground:"grass",floor:"grass",wall:"wall",roof:"roof",stairs_up:"stairs_up",stairs_down:"stairs_down"}[obj.type]);
        drawTile(sprite,obj.color??"#777",px,py);
        if(obj.type==="wall"&&!assets.get(sprite)) {
          ctx.fillStyle="#736f6a";
          ctx.fillRect(px,py+TILE_SIZE-5,TILE_SIZE,5);
        }
      }
    }
  }
  const px=camera.x+player.x*TILE_SIZE, py=camera.y+player.y*TILE_SIZE;
  if(assets.get("player")) {
    drawTile("player","#1d354c",px,py);
  } else {
    ctx.fillStyle="#1d354c";
    ctx.fillRect(px+8,py+12,16,17);
    ctx.fillStyle="#eac5a0";
    ctx.fillRect(px+10,py+5,12,12);
  }
}
function updateInventory() {
  inventoryLabel.textContent = player.inventory.length
    ? player.inventory.map(item=>item.id).join(", ")
    : "Empty";
}
function pickUp() {
  const item=takeTopItem(player.x,player.y,player.z);
  if(!item) return;
  player.inventory.push(item);
  updateInventory();
  render();
}
document.querySelector("#pickup").addEventListener("click",pickUp);
updateInventory();


const STEP_MS=140;
const pathDirections=[[0,-1],[1,0],[0,1],[-1,0]];
let walkingTimer=null;
let walkingPath=[];

function stopPath() {
  if(walkingTimer!==null) clearInterval(walkingTimer);
  walkingTimer=null;
  walkingPath=[];
}
// A*: four directions, Manhattan heuristic, optimal shortest path in steps.
function findPath(startX,startY,targetX,targetY,z) {
  if(!isWalkable(targetX,targetY,z)) return [];
  const index=(x,y)=>y*WIDTH+x;
  const start=index(startX,startY), goal=index(targetX,targetY);
  if(start===goal) return [];
  const count=WIDTH*HEIGHT;
  const g=new Float64Array(count).fill(Infinity);
  const previous=new Int32Array(count).fill(-1);
  const closed=new Uint8Array(count);
  const open=[{id:start,f:Math.abs(targetX-startX)+Math.abs(targetY-startY)}];
  g[start]=0;
  while(open.length) {
    let best=0;
    for(let i=1;i<open.length;i++) if(open[i].f<open[best].f) best=i;
    const current=open.splice(best,1)[0].id;
    if(closed[current]) continue;
    if(current===goal) {
      const result=[];
      let cursor=goal;
      while(cursor!==start) {
        result.push({x:cursor%WIDTH,y:Math.floor(cursor/WIDTH)});
        cursor=previous[cursor];
      }
      return result.reverse();
    }
    closed[current]=1;
    const x=current%WIDTH,y=Math.floor(current/WIDTH);
    for(const [dx,dy] of pathDirections) {
      const nx=x+dx,ny=y+dy;
      if(!isWalkable(nx,ny,z)) continue;
      const next=index(nx,ny);
      if(closed[next]) continue;
      const cost=g[current]+1;
      if(cost>=g[next]) continue;
      g[next]=cost;
      previous[next]=current;
      open.push({id:next,f:cost+Math.abs(targetX-nx)+Math.abs(targetY-ny)});
    }
  }
  return [];
}
function startPath(x,y) {
  stopPath();
  walkingPath=findPath(player.x,player.y,x,y,player.z);
  if(!walkingPath.length) return;
  walkingTimer=setInterval(()=>{
    const next=walkingPath.shift();
    if(!next||!isWalkable(next.x,next.y,player.z)) {
      stopPath();
      return;
    }
    player.x=next.x;player.y=next.y;
    render();
    if(!walkingPath.length) stopPath();
  },STEP_MS);
}
// Pointer events handle both mouse taps and mobile touch without double-firing.
canvas.addEventListener("pointerdown",event=>{
  if(event.pointerType==="mouse"&&event.button!==0) return;
  event.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const x=Math.floor((event.clientX-rect.left-camera.x)/TILE_SIZE);
  const y=Math.floor((event.clientY-rect.top-camera.y)/TILE_SIZE);
  if(x<0||y<0||x>=WIDTH||y>=HEIGHT) return;
  startPath(x,y);
});

function move(dx,dy) {
  stopPath();
  const nx=player.x+dx, ny=player.y+dy;
  if(!isWalkable(nx,ny,player.z)) return;
  player.x=nx; player.y=ny;
  render();
}
const directions={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
let repeat=null;
function stop() {if(repeat!==null) clearInterval(repeat);repeat=null;}
for(const button of document.querySelectorAll("[data-dir]")) {
  button.addEventListener("pointerdown",event=>{
    event.preventDefault();stop();
    const [dx,dy]=directions[button.dataset.dir];
    move(dx,dy);
    repeat=setInterval(()=>move(dx,dy),140);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup",stop);
  button.addEventListener("pointercancel",stop);
  button.addEventListener("lostpointercapture",stop);
}
window.addEventListener("blur",stop);
window.addEventListener("resize",resize);
new ResizeObserver(resize).observe(canvas);
resize();
await assets.load();
render();
