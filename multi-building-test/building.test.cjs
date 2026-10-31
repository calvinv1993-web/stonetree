const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const events={},status={},calls=[];
const ctx=new Proxy({}, {get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
const canvas={dataset:{},getContext:()=>ctx,addEventListener:(k,f)=>events[k]=f,focus(){},getBoundingClientRect:()=>({left:0,top:0})};
let tick;
const sandbox={document:{getElementById:id=>id==='map'?canvas:status},devicePixelRatio:1,innerWidth:390,innerHeight:844,addEventListener:(k,f)=>events[k]=f,setInterval:f=>tick=f};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const run=s=>vm.runInContext(s,sandbox);
const state=()=>JSON.parse(run('JSON.stringify(player)'));
function go(x,y){run(`route(${x},${y})`);for(let i=0;i<100;i++)tick();}
function key(k){events.keydown({key:k,preventDefault(){}});tick();}
assert.deepEqual(state(),{x:2,y:2,z:0});
go(2,6);assert.deepEqual(state(),{x:2,y:6,z:0});
go(-1,-1);assert.deepEqual(state(),{x:-1,y:-1,z:0});
// Side wall blocks a direct step, but routing finds the actual south entrance.
run('player.x=-1;player.y=2;paint()');key('ArrowRight');assert.equal(state().x,-1);
go(2,2);assert.deepEqual(state(),{x:2,y:2,z:0});
go(1,1);assert.equal(state().z,1);
// Camera and input agree at both elevations; the player remains centred.
assert.equal(run('originY+(player.y+.5)*TILE'),422);
assert.equal(run('originX+(player.x+.5)*TILE'),195);
for(const [x,y] of [[2,1],[1,2],[2,2]]){go(x,y);assert.deepEqual(state(),{x:1,y:1,z:1});}
key('ArrowRight');assert.deepEqual(state(),{x:1,y:1,z:1});
key('ArrowLeft');assert.deepEqual(state(),{x:0,y:1,z:1});
go(4,4);assert.deepEqual(state(),{x:4,y:4,z:1});
go(2,5);assert.equal(state().z,1);assert.equal(state().y,4);
// An ordinary route cannot accidentally use the stairs.
go(0,0);assert.equal(state().z,1);
go(1,1);assert.equal(state().z,0);
key('ArrowLeft');key('ArrowRight');assert.equal(state().z,1);
key('ArrowLeft');key('ArrowRight');assert.equal(state().z,0);
// A pointer tap uses the rendered grid origin, including on the upper floor.
key('ArrowLeft');key('ArrowRight');key('ArrowLeft');
events.pointerdown({clientX:run('originX+20'),clientY:run('originY+20')});for(let i=0;i<10;i++)tick();assert.deepEqual(state(),{x:0,y:0,z:1});
// Every upstairs solid tile is reachable without traversing the void.
for(let y=0;y<5;y++)for(let x=0;x<5;x++){
 if([[1,1],[2,1],[1,2],[2,2]].some(p=>p[0]===x&&p[1]===y))continue;
 go(x,y);assert.deepEqual(state(),{x,y,z:1});
}
go(1,1);assert.equal(state().z,0);go(2,6);assert.equal(state().z,0);
assert.match(status.textContent,/Buiten/);
// Render all views at narrow phone and desktop sizes.
for(const [w,h] of [[390,844],[1363,936]])for(const z of [0,1]){
 sandbox.innerWidth=w;sandbox.innerHeight=h;run(`player.x=3;player.y=3;player.z=${z};paint()`);
 assert.equal(run('originY+(player.y+.5)*TILE'),h/2);
}
console.log('PASS: entrance, exterior perimeter, walls, stair round trips, void collision, floor boundaries, pointer projection, reachable tiles and phone/desktop elevation.');
