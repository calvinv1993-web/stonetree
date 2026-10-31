import test from 'node:test';import assert from 'node:assert/strict';
import {bounds,tileDelta,chunkKeys,visible} from './viewport.mjs';
test('initial viewport sends exactly 165 tiles',()=>assert.equal(tileDelta(null,bounds(0,0)).length,165));
test('one step east sends only 11 new tiles',()=>assert.equal(tileDelta(bounds(0,0),bounds(1,0)).length,11));
test('one step north sends only 15 new tiles',()=>assert.equal(tileDelta(bounds(0,0),bounds(0,-1)).length,15));
test('same location sends no tiles',()=>assert.equal(tileDelta(bounds(0,0),bounds(0,0)).length,0));
test('teleport sends all new tiles',()=>assert.equal(tileDelta(bounds(0,0),bounds(100,100)).length,165));
test('negative chunk coordinates are supported',()=>assert.ok(chunkKeys(bounds(0,0)).includes('7:-1:-1')));
test('viewport inclusion',()=>{const b=bounds(0,0);assert.equal(visible(b,b.left,b.top),true);assert.equal(visible(b,b.right+1,b.top),false);});
