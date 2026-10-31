import test from 'node:test';import assert from 'node:assert/strict';import {terrainAt} from './terrain.mjs';
test('terrain is deterministic',()=>assert.deepEqual(terrainAt(100,-27),terrainAt(100,-27)));
test('water blocks movement',()=>{const t=terrainAt(23,-1);assert.equal(t.type,'water');assert.equal(t.blocked,true)});
test('building approaches stay passable',()=>{for(let x=-5;x<=20;x++)for(let y=-3;y<=1;y++)assert.equal(terrainAt(x,y).blocked,false)});
test('mud is slower than grass',()=>{assert.equal(terrainAt(0,0).moveCost>=1,true);assert.equal(terrainAt(0,0).blocked,false)});
test('invalid coordinates are rejected',()=>assert.throws(()=>terrainAt(1.5,0),RangeError));
