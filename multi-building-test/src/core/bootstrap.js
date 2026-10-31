setInterval(()=>{if(stepMovement())paint();},WORLD_CONFIG.stepMilliseconds);
addEventListener('resize',paint);
addEventListener('blur',()=>{path=[];});
paint();
