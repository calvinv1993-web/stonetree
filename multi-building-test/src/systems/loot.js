// Corpse contents and inventory state. Loaded before monster combat.
const ratCorpses=[];
let nextCorpseId=1;
const EQUIPMENT_SLOTS=['amulet','helmet','backpack','weapon','armor','shield','ring','legs','ammo'];
const equipment=Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,null]));
const BACKPACK_CAPACITY=20;
const inventory={gold:0,items:[]};
function renderBackpack(){
 const grid=document.getElementById('bagGrid');
 if(!grid||typeof document.createElement!=='function')return;
 grid.replaceChildren();
 const contents=inventory.gold>0?[{id:'gold-coin',name:'Gold coin',quantity:inventory.gold},...inventory.items]:inventory.items;
 for(let i=0;i<BACKPACK_CAPACITY;i++){
  const slot=document.createElement('div');slot.className='bag-slot';
  const item=contents[i];
  if(item){slot.title=item.name;slot.setAttribute('aria-label',item.name+' x'+item.quantity);
   const symbol=document.createElement('span');symbol.className='coin-symbol';symbol.textContent=item.id==='gold-coin'?'●':'◆';slot.appendChild(symbol);
   const count=document.createElement('span');count.className='stack-count';count.textContent=String(item.quantity);slot.appendChild(count);
  }else slot.setAttribute('aria-label','Empty slot '+(i+1));
  grid.appendChild(slot);
 }
 const capacity=document.getElementById('bagCapacity');if(capacity)capacity.textContent=contents.length+' / '+BACKPACK_CAPACITY;
}

let openedCorpseId=null;
function refreshInventory(){
 const legacy=document.getElementById('inventoryContents');
 if(!document.getElementById('bagGrid')&&legacy)legacy.textContent='Gold coins: '+inventory.gold;
 renderBackpack();
}
function takeCorpseLoot(){
 const corpse=ratCorpses.find(c=>c.id===openedCorpseId);
 if(!corpse||player.z!==0||Math.abs(player.x-corpse.x)+Math.abs(player.y-corpse.y)>1)return;
 for(const item of corpse.items)if(item.name==='Gold coin')inventory.gold+=item.amount;
 corpse.items.length=0;
 document.getElementById('lootContents').textContent='Empty';
 document.getElementById('takeLoot').hidden=true;
 refreshInventory();
}

function createRatCorpse(){
 ratCorpses.push({id:nextCorpseId++,x:rat.x,y:rat.y,z:0,items:[{name:'Gold coin',amount:1+Math.floor(Math.random()*3)}]});
}
function openRatCorpse(corpse){
 if(player.z!==0||Math.abs(player.x-corpse.x)+Math.abs(player.y-corpse.y)>1)return false;
 const panel=document.getElementById('lootPanel');
 openedCorpseId=corpse.id;
 panel.hidden=false;
 document.getElementById('takeLoot').hidden=corpse.items.length===0;
 document.getElementById('lootContents').textContent=corpse.items.length?corpse.items.map(item=>item.amount+' '+item.name).join(', '):'Empty';
 return true;
}

