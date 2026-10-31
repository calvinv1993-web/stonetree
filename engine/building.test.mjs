import test from 'node:test';import assert from 'node:assert/strict';import {Building} from './building.mjs';
const b=()=>new Building({x:0,y:0,width:7,height:7,doors:[{x:0,y:3},{x:6,y:3}],windows:[{x:3,y:0},{x:3,y:6}]});
test('walls and corners connect automatically',()=>{const a=b();assert.equal(a.at(0,0).mask,6);assert.equal(a.at(3,0).type,'window');assert.equal(a.at(1,0).mask,10);});
test('two doors have independent state',()=>{const a=b();assert.equal(a.blocked(0,3),true);assert.equal(a.toggleDoor(0,3,{x:-1,y:3,z:7}),true);assert.equal(a.blocked(0,3),false);assert.equal(a.blocked(6,3),true);});
test('doors require orthogonal adjacency on same floor',()=>{const a=b();assert.equal(a.toggleDoor(0,3,{x:-2,y:3,z:7}),false);assert.equal(a.toggleDoor(0,3,{x:-1,y:3,z:6}),false);assert.equal(a.toggleDoor(0,3,{x:-1,y:2,z:7}),false);});
test('windows always block movement',()=>{const a=b();assert.equal(a.at(3,0).type,'window');assert.equal(a.blocked(3,0),true);});
test('different building material and location',()=>{const a=new Building({x:100,y:-50,width:4,height:5,material:'wood',doors:[{x:100,y:-48}]});assert.equal(a.at(100,-48).material,'wood');assert.equal(a.at(0,0),null);});
test('openings outside boundary are rejected',()=>assert.throws(()=>new Building({x:0,y:0,width:5,height:5,doors:[{x:2,y:2}]}),RangeError));
