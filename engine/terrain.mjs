// Deterministic terrain, independent of viewport and player position.
export function terrainAt(x,y){
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))throw new RangeError('Invalid terrain coordinates');
 // Pond east of the two test buildings, with a traversable bank.
 if(x>=21&&x<=26&&y>=-4&&y<=2&&((x-23.5)**2/9+(y+1)**2/12)<=1)return {type:'water',moveCost:Infinity,blocked:true};
 // Sparse rocks and mud; the central approach to both doors stays clear.
 const approach=(y>=-3&&y<=1&&x>=-5&&x<=20);
 const hash=(Math.imul(x,374761393)^Math.imul(y,668265263))>>>0;
 const n=(Math.imul(hash^(hash>>>13),1274126177)>>>0)%100;
 if(!approach&&n<5)return {type:'rock',moveCost:Infinity,blocked:true};
 if(n<24)return {type:'mud',moveCost:3,blocked:false};
 return {type:'grass',moveCost:1,blocked:false};
}
