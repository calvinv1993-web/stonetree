// Corpse contents and inventory state. Loaded before monster combat.
const ratCorpses=[];
let nextCorpseId=1;
const inventory={gold:0};
let openedCorpseId=null;
function refreshInventory(){
 document.getElementById('inventoryContents').textContent='Gold coins: '+inventory.gold;
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

