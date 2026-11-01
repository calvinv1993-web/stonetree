import {map, WIDTH, HEIGHT, TILE_SIZE, GROUND_Z, isWalkable} from "./map.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", {alpha:false});
const player = {x:8,y:12,z:GROUND_Z};
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
      stairs_down:"./assets/stairs_down.png"
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
  for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
    const stack = map[x][y][player.z]; // preserve explicit Z filtering
    const px=camera.x+x*TILE_SIZE, py=camera.y+y*TILE_SIZE;
    if(px+TILE_SIZE<0 || py+TILE_SIZE<0 || px>viewWidth || py>viewHeight) continue;
    for(const obj of stack) {
      if(!["ground","floor","wall","roof","stairs_up","stairs_down"].includes(obj.type)) continue;
      const sprite = obj.sprite ?? ({ground:"grass",floor:"grass",wall:"wall",roof:"roof",stairs_up:"stairs_up",stairs_down:"stairs_down"}[obj.type]);
      drawTile(sprite,obj.color ?? "#777",px,py);
      if(obj.type==="wall" && !assets.get(sprite)) {
        ctx.fillStyle="#736f6a";
        ctx.fillRect(px,py+TILE_SIZE-5,TILE_SIZE,5);
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
function move(dx,dy) {
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
