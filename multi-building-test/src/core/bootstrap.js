setInterval(()=>{if(stepMovement())paint();},WORLD_CONFIG.stepMilliseconds);

if(typeof requestAnimationFrame==='function'){
 const frame=now=>{const moved=ratTick(now);const hit=ratAttackTick(now);if(movementVisual||moved||hit||now-rat.movedAt<240)paint();requestAnimationFrame(frame);};
 requestAnimationFrame(frame);
}
addEventListener('resize',paint);
addEventListener('blur',()=>{path=[];});
paint();
