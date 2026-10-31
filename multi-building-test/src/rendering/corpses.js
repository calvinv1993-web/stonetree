// World rendering for corpses.
function drawRatCorpses(){
 if(player.z!==0)return;
 for(const corpse of ratCorpses){
  const p=worldToScreen(corpse.x+.5,corpse.y+.5,0);
  rect(p.x-12,p.y-6,24,14,'#403529');rect(p.x-9,p.y-3,18,8,'#796b51');
  rect(p.x-4,p.y-1,8,4,'#aa9570');
 }
}
