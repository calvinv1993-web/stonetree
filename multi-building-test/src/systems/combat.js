// Player and monster combat, damage and XP rewards.
const playerHealth={current:100,max:100};
let ratNextAttack=0;
function ratAttackTick(now){
 if(ratHP===0)return false;
 const adjacent=player.z===0&&ratDistance(player.x,player.y)===1;
 if(!adjacent||ratMode!=='chase'||playerHealth.current===0){ratNextAttack=0;return false;}
 if(!ratNextAttack){ratNextAttack=now+2000;return false;}
 if(now<ratNextAttack)return false;
 ratNextAttack=now+2000;
 playerHealth.current=Math.max(0,playerHealth.current-5);
 return true;
}

function selectRat(){
 if(player.z!==0||ratHP===0)return false;
 ratSelected=true;playerNextAttack=0;return true;
}
function playerAttackTick(now){
 if(!ratSelected||ratHP===0||playerHealth.current===0||player.z!==0)return false;
 if(ratDistance(player.x,player.y)!==1){playerNextAttack=0;return false;}
 if(!playerNextAttack){playerNextAttack=now+1200;return false;}
 if(now<playerNextAttack)return false;
 playerNextAttack=now+1200;
 ratHP=Math.max(0,ratHP-5);
 if(ratHP===0){ratSelected=false;ratMode='dead';ratNextAttack=0;ratRespawnAt=now+30000;gainExperience(5);createRatCorpse();}
 return true;
}
