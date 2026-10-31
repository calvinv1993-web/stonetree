const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
function game(){
 const events={},calls=[];let interval;
 const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>o[k]??((...a)=>calls.push([k,...a])),set:(o,k,v)=>(o[k]=v,true)});
 const status={textContent:''},button={hidden:true,addEventListener:(k,f)=>events['door:'+k]=f};
 const canvas={dataset:{},width:0,height:0,getContext:()=>ctx,addEventListener:(k,f)=>events[k]=f,focus(){},getBoundingClientRect:()=>({left:0,top:0,width:sandbox.innerWidth,height:sandbox.innerHeight})};
 const sandbox={document:{getElementById:id=>({map:canvas,status,doorControl:button})[id]},innerWidth:1363,innerHeight:936,devicePixelRatio:1,addEventListener:(k,f)=>events[k]=f,setInterval:f=>interval=f};
 vm.createContext(sandbox);
 const html=readFileSync(join(__dirname,'index.html'),'utf8');
 for(const [,src] of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(readFileSync(join(__dirname,src.split('?')[0]),'utf8'),sandbox,{filename:src});
 const run=s=>vm.runInContext(s,sandbox),json=s=>JSON.parse(run(`JSON.stringify(${s})`));
 const state=()=>json('player');
 const place=(x,y,z=0)=>run(`Object.assign(player,{x:${x},y:${y},z:${z}});path=[];paint()`);
 const go=(x,y)=>{run(`route(${x},${y})`);for(let i=0;i<200;i++)interval();return state();};
 const key=k=>{events.keydown({key:k,preventDefault(){}});interval();return state();};
 return {run,json,state,place,go,key,events,canvas,button,status,sandbox,calls,tick:()=>interval()};
}
for(const [id,bx,door,stairY] of [['starter-house',0,2,1],['east-house',9,3,1],['tower-house',18,2,2]]){
 test(id+': closed/open door, entrance, exit and independent state',()=>{
  const g=game();g.place(bx+door,5);assert.equal(g.run('toggleDoor()'),true);
  assert.deepEqual(g.go(bx+2,2),{x:bx+2,y:2,z:0});
  g.go(bx+door,4);g.run('toggleDoor()');assert.deepEqual(g.state(),{x:bx+door,y:5,z:0});
  assert.deepEqual(g.key('ArrowUp'),{x:bx+door,y:5,z:0});
  assert.equal(g.run('Object.values(doorStates).filter(Boolean).length'),0);
 });
 test(id+': stair round trip and safe landings',()=>{
  const g=game();g.place(bx+2,2);g.go(bx+1,stairY);assert.deepEqual(g.state(),{x:bx+1,y:stairY-1,z:1});
  g.go(bx+1,stairY);assert.deepEqual(g.state(),{x:bx+1,y:stairY+1,z:0});
 });
 test(id+': every external wall blocks direct crossing on every floor',()=>{
  const g=game();const b=g.json(`BUILDINGS.find(b=>b.id==='${id}')`);
  for(let z=0;z<b.floors.length;z++)for(let i=0;i<5;i++){
   assert.equal(g.run(`connected(${bx+i},0,${bx+i},-1,${z})`),false);
   assert.equal(g.run(`connected(${bx},${i},${bx-1},${i},${z})`),false);
   assert.equal(g.run(`connected(${bx+4},${i},${bx+5},${i},${z})`),false);
   assert.equal(g.run(`connected(${bx+i},4,${bx+i},5,${z})`),false);
  }
 });
}
test('tower: z=0 → 1 → 2 → 1 → 0 without stair bounce',()=>{
 const g=game();g.place(20,2);g.go(19,2);g.go(21,2);assert.deepEqual(g.state(),{x:21,y:1,z:2});
 g.tick();assert.equal(g.state().z,2);g.go(21,2);assert.deepEqual(g.state(),{x:21,y:3,z:1});
 g.go(19,2);assert.deepEqual(g.state(),{x:19,y:3,z:0});
});
test('terrace: preserve passage (11,3)↔(12,3) and original projected door',()=>{
 const g=game();g.place(11,3,1);
 const d=g.json("doorFor(BUILDINGS[1],'terrace')");assert.deepEqual(d.a,{x:11,y:3});assert.deepEqual(d.b,{x:12,y:3});
 assert.equal(g.run("doorHitBox(doorFor(BUILDINGS[1],'terrace')).y"),g.run('originY+2*TILE-10'));
 assert.deepEqual(g.key('ArrowRight'),{x:11,y:3,z:1});g.run('toggleDoor()');
 assert.deepEqual(g.key('ArrowRight'),{x:12,y:3,z:1});g.run('toggleDoor()');
 assert.deepEqual(g.key('ArrowLeft'),{x:12,y:3,z:1});g.run('toggleDoor()');
 for(let y=0;y<5;y++)assert.equal(g.run(`connected(11,${y},12,${y},1)`),y===3);
 g.go(13,4);assert.deepEqual(g.state(),{x:13,y:4,z:1});assert.equal(g.key('ArrowDown').y,4);
 g.go(11,3);g.run('toggleDoor()');g.go(10,1);assert.deepEqual(g.state(),{x:10,y:2,z:0});
});
test('all solid upper tiles reachable; ordinary routes never trigger stairs',()=>{
 const g=game();
 for(const [i,bx] of [[0,0],[1,9],[2,18]]){
  const b=g.json(`BUILDINGS[${i}]`);
  for(let z=1;z<b.floors.length;z++){
   g.place(bx,0,z);g.run("doorStates['east-house:terrace']=true");
   for(let y=0;y<5;y++)for(let x=0;x<5;x++){
    if(!g.run(`walkable(${bx+x},${y})`)||g.run(`stairAction(${bx+x},${y})`))continue;
    assert.deepEqual(g.go(bx+x,y),{x:bx+x,y,z},`${b.id} ${x},${y},${z}`);
   }
  }
 }
});
test('upper stairwell holes block walking and cancelled routes clear queued steps',()=>{
 const g=game();g.place(0,0,1);g.run('route(4,3)');assert.ok(g.run('path.length')>0);g.run('route(2,2)');assert.equal(g.run('path.length'),0);
 for(const [x,y] of [[1,2],[2,1],[2,2]])assert.equal(g.run(`walkable(${x},${y})`),false);
});
test('queued steps recheck collision and doors',()=>{
 const g=game();g.place(11,3,1);g.run("doorStates['east-house:terrace']=true;route(13,3);doorStates['east-house:terrace']=false");g.tick();assert.deepEqual(g.state(),{x:11,y:3,z:1});assert.equal(g.run('path.length'),0);
});
test('invalid stair landing cannot partially move the player',()=>{
 const g=game();g.place(19,1,0);g.run('BUILDINGS[2].floors[1].holes.push([1,1])');g.key('ArrowDown');assert.deepEqual(g.state(),{x:19,y:1,z:0});
});
test('projection round trips and pointer movement at desktop/phone sizes and z=0/1/2',()=>{
 const g=game();
 for(const [w,h,d] of [[1363,936,1],[390,844,3],[844,390,2]])for(const z of [0,1,2]){
  Object.assign(g.sandbox,{innerWidth:w,innerHeight:h,devicePixelRatio:d});g.place(20,0,z);
  const p=g.json('worldToScreen(20.5,.5,player.z)');assert.ok(Math.abs(p.x-w/2)<=.5);assert.ok(Math.abs(p.y-h/2)<=.5);
  assert.deepEqual(g.json('screenToTile(worldToScreen(20.5,.5,player.z).x,worldToScreen(20.5,.5,player.z).y)'),{x:20,y:0});
  g.events.pointerdown({clientX:p.x+40,clientY:p.y,button:0,isPrimary:true});g.tick();assert.deepEqual(g.state(),{x:21,y:0,z});
 }
});
test('secondary pointer is ignored; button and projected door tap share state',()=>{
 const g=game();g.place(11,3,1);
 const r=g.json("doorHitBox(doorFor(BUILDINGS[1],'terrace'))");
 g.events.pointerdown({clientX:r.x+14,clientY:r.y+25,isPrimary:false});assert.equal(g.run("doorIsOpen(BUILDINGS[1],'terrace')"),false);
 g.events.pointerdown({clientX:r.x+14,clientY:r.y+25,isPrimary:true});assert.equal(g.run("doorIsOpen(BUILDINGS[1],'terrace')"),true);
 g.events['door:click']();assert.equal(g.run("doorIsOpen(BUILDINGS[1],'terrace')"),false);assert.match(g.status.textContent,/terrasdeur dicht/);
});
test('distance visibility reveals 0/1/2 and roof at the configured distances',()=>{
 const g=game();for(let b=0;b<3;b++){
  const building=g.json(`BUILDINGS[${b}]`);
  for(let distance=1;distance<=building.floors.length+1;distance++){
   g.place(building.position.x+2,4+distance);assert.equal(g.run(`visibleExteriorStorey(BUILDINGS[${b}])`),distance<=building.floors.length?distance-1:null);
  }
 }
 g.place(20,1,1);assert.equal(g.run('visibleExteriorStorey(BUILDINGS[0])'),null);
});
test('rendering preserves game state, stairwell backing is opaque, all views render',()=>{
 const g=game();for(let i=0;i<3;i++){
  const b=g.json(`BUILDINGS[${i}]`);
  for(let z=0;z<b.floors.length;z++){
   g.place(b.position.x+2,0,z);const before=g.json('[player,doorStates,path]');
   g.run('paint()');assert.deepEqual(g.json('[player,doorStates,path]'),before);
   g.run(`drawStorey(BUILDINGS[${i}],0,0,${z},false)`);
  }
 }
 assert.ok(g.calls.every(call=>call.slice(1).filter(v=>typeof v==='number').every(Number.isFinite)));
 assert.equal(g.run("ctx.fillStyle='#sentinel';drawStairwell(BUILDINGS[2],0,0,2);ctx.fillStyle==='#sentinel'"),false);
});
test('rectangular configuration renders; overlap and invalid landings rejected',()=>{
 const g=game();g.run("var sample=JSON.parse(JSON.stringify(BUILDINGS[0]));sample.id='rect';sample.width=6;sample.height=7;validateBuildings([sample]);exterior(sample,0,0);drawStorey(sample,0,0,1,false)");
 assert.throws(()=>g.run('validateBuildings([sample,sample])'));
 assert.throws(()=>g.run('sample.floors[0].stairs.up.y=0;validateBuildings([sample])'));
});
