setInterval(()=>{if(stepMovement())paint();},WORLD_CONFIG.stepMilliseconds);
if(typeof requestAnimationFrame==='function'){
 const frame=()=>{if(movementVisual)paint();requestAnimationFrame(frame);};
 requestAnimationFrame(frame);
}
addEventListener('resize',paint);
addEventListener('blur',()=>{path=[];});
paint();
