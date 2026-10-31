export const VIEW_WIDTH=15, VIEW_HEIGHT=11;
export function bounds(x,y,width=VIEW_WIDTH,height=VIEW_HEIGHT){
 if(![x,y,width,height].every(Number.isSafeInteger)||width<1||height<1)throw new RangeError('Invalid viewport');
 const left=x-Math.floor(width/2),top=y-Math.floor(height/2);
 return {left,top,right:left+width-1,bottom:top+height-1};
}
export function visible(b,x,y){return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;}
export function tileDelta(previous,next){
 const tiles=[];
 for(let y=next.top;y<=next.bottom;y++)for(let x=next.left;x<=next.right;x++)if(!previous||!visible(previous,x,y))tiles.push({x,y});
 return tiles;
}
export function chunkKeys(b,size=32,z=7){
 const keys=[];
 for(let cy=Math.floor(b.top/size);cy<=Math.floor(b.bottom/size);cy++)for(let cx=Math.floor(b.left/size);cx<=Math.floor(b.right/size);cx++)keys.push(`${z}:${cx}:${cy}`);
 return keys;
}
