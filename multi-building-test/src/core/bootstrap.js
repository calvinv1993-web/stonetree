let movementTimer;
function refreshMovementTimer(){
 if(movementTimer!==undefined)clearInterval(movementTimer);
 movementTimer=setInterval(()=>{if(stepMovement())paint();},playerStepMilliseconds());
}
refreshMovementTimer();
refreshInventory();

if(typeof requestAnimationFrame==='function'){
 const frame=now=>{const moved=ratTick(now);const hit=ratAttackTick(now),outgoing=playerAttackTick(now);if(movementVisual||moved||hit||outgoing||now-rat.movedAt<240)paint();requestAnimationFrame(frame);};
 requestAnimationFrame(frame);
}
addEventListener('resize',paint);
addEventListener('blur',()=>{path=[];});
paint();
