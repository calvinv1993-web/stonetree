import {position} from './world-core.mjs';

// Movement is orthogonal and stays on one floor. Stair transitions are separate actions.
const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
const key=({x,y})=>`${x},${y}`;
export function tileCost(tile){
 if(!tile) return Infinity;
 const cost=tile.ground.moveCost??1;
 if(!Number.isFinite(cost)||cost<1) throw new RangeError('moveCost must be finite and >= 1');
 return cost;
}
export function findPath(world,start,goal,{maxVisited=10000}={}){
 position(start.x,start.y,start.z);position(goal.x,goal.y,goal.z);
 if(start.z!==goal.z) return null;
 if(!Number.isSafeInteger(maxVisited)||maxVisited<1)throw new RangeError('Invalid search limit');
 const origin=world.getTile(start.x,start.y,start.z);
 if(!origin||!world.canWalk(goal.x,goal.y,goal.z))return null;
 if(start.x===goal.x&&start.y===goal.y)return [];
 const frontier=[{x:start.x,y:start.y,g:0}];
 const best=new Map([[key(start),0]]),previous=new Map();
 let visited=0;
 while(frontier.length&&visited<maxVisited){
  frontier.sort((a,b)=>(a.g+Math.abs(a.x-goal.x)+Math.abs(a.y-goal.y))-(b.g+Math.abs(b.x-goal.x)+Math.abs(b.y-goal.y)));
  const current=frontier.shift();
  if(current.g!==best.get(key(current)))continue;
  visited++;
  if(current.x===goal.x&&current.y===goal.y){
   const result=[];let cursor=key(goal);
   while(cursor!==key(start)){const [x,y]=cursor.split(',').map(Number);result.unshift({x,y,z:start.z});cursor=previous.get(cursor);}
   return result;
  }
  for(const [dx,dy] of DIRECTIONS){
   const x=current.x+dx,y=current.y+dy;
   if(!world.canWalk(x,y,start.z))continue;
   const cost=current.g+tileCost(world.getTile(x,y,start.z)),k=`${x},${y}`;
   if(cost>=(best.get(k)??Infinity))continue;
   best.set(k,cost);previous.set(k,key(current));frontier.push({x,y,g:cost});
  }
 }
 return null;
}
export function stepCreature(world,creature,from,to,{baseMilliseconds=200}={}){
 position(from.x,from.y,from.z);position(to.x,to.y,to.z);
 if(!Number.isFinite(baseMilliseconds)||baseMilliseconds<=0)throw new RangeError('Invalid base duration');
 if(from.z!==to.z||Math.abs(from.x-to.x)+Math.abs(from.y-to.y)!==1)return null;
 const tile=world.getTile(to.x,to.y,to.z);
 if(!tile||!world.moveCreature(creature,from,to))return null;
 return {position:{...to},durationMilliseconds:baseMilliseconds*tileCost(tile)};
}
