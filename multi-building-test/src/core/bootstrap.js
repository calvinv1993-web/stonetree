// Stonetree: src/core/bootstrap.js
setInterval(()=>{
 if(!path.length)return;
 const [x,y]=path.shift();player.x=x;player.y=y;
 if(isStair(x,y)){player.z=1-player.z;path=[];}
 paint();
},160);
addEventListener('resize',paint);paint();
