import test from 'node:test';
import assert from 'node:assert/strict';
import {Tile,World,chunkAddress,position,MAX_MOVABLE} from './world-core.mjs';
test('16 floors, ground at 7 and coordinate validation',()=>{
 assert.equal(position(32000,32000).z,7);
 assert.equal(position(0,0,15).z,15);
 assert.throws(()=>position(0,0,16),RangeError);
 assert.throws(()=>position(1.5,0,7),RangeError);
});
test('chunks work at positive and negative boundaries',()=>{
 assert.deepEqual(chunkAddress(32,-1,7),{cx:1,cy:-1,z:7});
});
test('tile stack has ground, static, movable, creature, effects in order',()=>{
 const t=new Tile(0,0,7,{id:'grass'});t.addStatic({id:'tree'});
 t.pushItem({id:'bag'});t.setCreature({id:'player'});t.addEffect({id:'spark'});
 assert.deepEqual(t.stack.map(x=>x.id),['grass','tree','bag','player','spark']);
});
test('walking, projectile and sight blocking are separate',()=>{
 const t=new Tile(0,0,7,{id:'stone'});
 t.addStatic({id:'glass',blockWalking:true});
 assert.equal(t.walkable,false);assert.equal(t.projectilesPass,true);
 t.addStatic({id:'wall',blockProjectiles:true,blockSight:true});
 assert.equal(t.projectilesPass,false);assert.equal(t.sightPass,false);
});
test('movable item capacity is bounded without silently deleting loot',()=>{
 const t=new Tile(0,0,7,{id:'floor'});
 for(let i=0;i<MAX_MOVABLE;i++)assert.equal(t.pushItem({id:i}),true);
 assert.equal(t.pushItem({id:'extra'}),false);
 assert.equal(t.moveableItems.length,MAX_MOVABLE);
 assert.equal(t.popItem().id,MAX_MOVABLE-1);
});
test('creature occupancy and atomic movement',()=>{
 const w=new World(),a={id:'player'},b={id:'npc'};
 const origin=w.setTile(0,0,7,{id:'grass'}),destination=w.setTile(1,0,7,{id:'grass'});
 assert.equal(origin.setCreature(a),true);
 assert.equal(origin.setCreature(b),false);
 assert.equal(w.moveCreature(a,{x:0,y:0,z:7},{x:1,y:0,z:7}),true);
 assert.equal(origin.creature,null);assert.equal(destination.creature,a);
 assert.equal(w.moveCreature(b,{x:0,y:0,z:7},{x:1,y:0,z:7}),false);
 assert.equal(w.canWalk(2,0,7),false);
});
