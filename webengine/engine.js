import {map, WIDTH, HEIGHT, TILE_SIZE, GROUND_Z, isWalkable} from "./map.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", {alpha:false});
const player = {x:8,y:12,z:GROUND_Z};
const camera = {x:0,y:0};
let viewWidth = 1, viewHeight = 1;

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
function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#202b29";
  ctx.fillRect(0,0,viewWidth,viewHeight);
  // Integer camera offsets preserve crisp 32x32 tile edges.
  camera.x = Math.round(viewWidth/2 - (player.x+0.5)*TILE_SIZE);
  camera.y = Math.round(viewHeight/2 - (player.y+0.5)*TILE_SIZE);
  for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
    const stack = map[x][y][player.z]; // explicit Z-floor filtering
    const px = camera.x+x*TILE_SIZE, py = camera.y+y*TILE_SIZE;
    if(px+TILE_SIZE<0 || py+TILE_SIZE<0 || px>viewWidth || py>viewHeight) continue;
    for(const obj of stack) {
      if(!["ground","floor","wall"].includes(obj.type)) continue;
      ctx.fillStyle=obj.color;
      ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE);
      if(obj.type==="wall") {
        ctx.fillStyle="#736f6a";
        ctx.fillRect(px,py+TILE_SIZE-5,TILE_SIZE,5);
      }
    }
  }
  const px=camera.x+player.x*TILE_SIZE, py=camera.y+player.y*TILE_SIZE;
  ctx.fillStyle="#1d354c";
  ctx.fillRect(px+8,py+12,16,17);
  ctx.fillStyle="#eac5a0";
  ctx.fillRect(px+10,py+5,12,12);
}
function move(dx,dy) {
  const nx=player.x+dx, ny=player.y+dy;
  if(!isWalkable(nx,ny,player.z)) return;
  player.x=nx;player.y=ny;
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
