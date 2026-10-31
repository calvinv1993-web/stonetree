setInterval(()=>{if(stepMovement()&&typeof requestAnimationFrame!=='function')paint();},WORLD_CONFIG.stepMilliseconds);
if(typeof requestAnimationFrame==='function'){
 const frame=()=>{paint();requestAnimationFrame(frame);};
 requestAnimationFrame(frame);
}
addEventListener('resize',paint);
addEventListener('blur',()=>{path=[];});
paint();
