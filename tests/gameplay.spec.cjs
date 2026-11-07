const {test,expect}=require('@playwright/test');
const path=require('node:path');
const url='file://'+path.resolve(__dirname,'..','index.html');
test.beforeEach(async({page})=>{await page.goto(url);});
test('lodge stairs: travel up and down changes world and persists',async({page})=>{
 const result=await page.evaluate(()=>{
  const b=buildings[0],up=buildingStairPortals(b)[0],down=buildingStairPortals(b)[1];
  const first=changeFloor(up),upper=p.floor,upperWorld=world===floors[b.upper],savedUpper=JSON.parse(localStorage.getItem('elderwild-v1')).floor;
  const second=changeFloor(down),lower=p.floor,lowerWorld=world===ground;
  return {first,upper,upperWorld,savedUpper,second,lower,lowerWorld};
 });
 expect(result).toMatchObject({first:true,upper:4,upperWorld:true,savedUpper:4,second:true,lower:0,lowerWorld:true});
});
test('portal triggers when standing on stairs and cannot retrigger immediately',async({page})=>{
 const result=await page.evaluate(()=>{
  const up=buildingStairPortals(buildings[0])[0];
  world.place(p,{x:up.x,y:up.y});portalLatch=null;dest=null;p.step=null;
  checkPortal();const first=p.floor;checkPortal();const second=p.floor;
  return {first,second};
 });
 expect(result).toEqual({first:4,second:4});
});
test('combat damage defeats enemy and awards XP, gold, quest progress',async({page})=>{
 const result=await page.evaluate(()=>{
  const m={hp:10,max:10,boss:false,x:p.x+24,y:p.y-100,kind:'wolf',floor:0};
  const before={xp:p.xp,gold:p.gold,kills:p.kills};
  damage(m,20);
  return {hp:m.hp,xp:p.xp-before.xp,gold:p.gold-before.gold,kills:p.kills-before.kills,spawn:m.spawn>clock};
 });
 expect(result).toEqual({hp:0,xp:20,gold:5,kills:1,spawn:true});
});
test('combat in safe zone does not harm player',async({page})=>{
 const result=await page.evaluate(()=>{
  p.floor=0;p.y=650;p.hp=100;hurtPlayer(20);return {safe:isSafe(p),hp:p.hp};
 });
 expect(result).toEqual({safe:true,hp:100});
});
test('inventory item stacks add, remove and persist',async({page})=>{
 const result=await page.evaluate(()=>{
  p.items={};addItem('amber',3);removeItem('amber');save();
  return {count:p.items.amber,saved:JSON.parse(localStorage.getItem('elderwild-v1')).items.amber};
 });
 expect(result).toEqual({count:2,saved:2});
});
test('quest rewards are granted on fifth monster kill',async({page})=>{
 const result=await page.evaluate(()=>{
  p.kills=4;p.gold=0;p.xp=0;
  const m={hp:1,max:1,boss:false,x:p.x+24,y:p.y-100,kind:'wolf',floor:0};
  damage(m,1);return {kills:p.kills,gold:p.gold,xp:p.xp};
 });
 expect(result).toEqual({kills:5,gold:30,xp:20});
});
test('NPC guide opens interaction panel and offers welcome gift',async({page})=>{
 const result=await page.evaluate(()=>{showTown('mara');return {title:document.getElementById('town-title').textContent,open:document.getElementById('town-panel').open,hasGift:document.getElementById('town-panel').textContent.includes('welcome gift')}});
 expect(result.title).toContain('Mara');expect(result.open).toBe(true);expect(result.hasGift).toBe(true);
});
