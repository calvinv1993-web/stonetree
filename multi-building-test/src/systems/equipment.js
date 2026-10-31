// Equipment interaction module.
const starterSword = {name: 'Training Sword', attack: 8};
const starterItems=[{id:'sword',name:'Training Sword',slot:'weapon',attack:8,quantity:1},{id:'shield',name:'Wooden Shield',slot:'shield',defense:5,quantity:1},{id:'armor',name:'Cloth Armor',slot:'armor',armor:2,quantity:1}];
function bagItems(){return inventory.gold?[{id:'gold',name:'Gold coin',quantity:inventory.gold},...inventory.items]:inventory.items;}
function equipmentStats(){return Object.values(equipment).reduce((stats,item)=>{if(item)for(const stat of ['attack','defense','armor'])stats[stat]+=item[stat]||0;return stats;},{attack:0,defense:0,armor:0});}
