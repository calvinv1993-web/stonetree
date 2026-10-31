const { test, expect } = require('@playwright/test');
const path = require('node:path');
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
test.beforeEach(async ({ page }) => { await page.goto(url); });
test('loads without uncaught errors and draws the game', async ({ page }) => {
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.reload(); await page.waitForTimeout(1000);
 await expect(page.locator('canvas')).toBeVisible();
 const result=await page.locator('canvas').evaluate(c=>{const {width:w,height:h}=c;const d=c.getContext('2d').getImageData(0,0,w,h).data;let drawn=0;for(let i=3;i<d.length;i+=4)if(d[i])drawn++;return {w,h,drawn}});
 expect(result.w).toBeGreaterThan(0);expect(result.h).toBeGreaterThan(0);expect(result.drawn).toBeGreaterThan(100);
 expect(errors).toEqual([]);
});
test('player state survives reload', async ({ page }) => {
 await page.evaluate(()=>{localStorage.setItem('elderwild-v1',JSON.stringify({x:320,y:650,hp:73,xp:120,gold:42,kills:2,vocation:'Ranger',floor:0}));window.__testSave=localStorage.getItem('elderwild-v1')});
 await page.reload();await page.waitForTimeout(300);
 const state=await page.evaluate(()=>({hp:p.hp,gold:p.gold,kills:p.kills}));
 expect(state.gold).toBe(42);expect(state.kills).toBe(2);expect(state.hp).toBeGreaterThanOrEqual(73);
});
test('world pathfinding and collision enforce blocked cells', async ({ page }) => {
 const state=await page.evaluate(()=>{
  const start=ground.cell(p),path=ground.route(p,(_,t)=>ground.key(t)===ground.key(start));
  const blocked=[...ground.blocked][0],parts=blocked.split(',').map(Number);
  return {path,blocked:ground.free({c:parts[0],r:parts[1]},p),valid:ground.valid(start)};
 });
 expect(state.valid).toBe(true);expect(state.path).not.toBeNull();expect(state.blocked).toBe(false);
});
test('building stair portals connect valid upper floors',async({page})=>{
 const result=await page.evaluate(()=>buildings.map(b=>({floor:!!floors[b.upper],portals:buildingStairPortals(b).map(q=>({from:q.floor,to:q.to,valid:!!floors[q.to]}))})));
 expect(result.length).toBeGreaterThan(0);
 for(const b of result){expect(b.floor).toBe(true);expect(b.portals).toHaveLength(2);expect(b.portals.every(p=>p.valid)).toBe(true)}
});
test('tap input does not throw',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const canvas=page.locator('canvas');await canvas.click({position:{x:30,y:30},force:true});await page.waitForTimeout(250);expect(errors).toEqual([]);
});
