setInterval(()=>{if(stepMovement())paint();},WORLD_CONFIG.stepMilliseconds);

if(typeof requestAnimationFrame==='function'){
 const frame=now=>{const moved=ratTick(now);if(movementVisual||moved||now-rat.movedAt<240)paint();requestAnimationFrame(frame);};
 requestAnimationFrame(frame);
}
addEventListener('resize',paint);
addEventListener('blur',()=>{path=[];});
paint();
