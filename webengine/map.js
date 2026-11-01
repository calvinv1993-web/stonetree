export const TILE_SIZE = 32;
export const GROUND_Z = 7;
export const WIDTH = 20;
export const HEIGHT = 16;

// Canonical structure: map[x][y][z] is always an array of objects.
export const map = Array.from({length: WIDTH}, () =>
  Array.from({length: HEIGHT}, () =>
    Array.from({length: 16}, () => [])
  )
);

export function addObject(x, y, z, object) {
  if (!map[x]?.[y]?.[z]) throw new RangeError("Invalid map coordinate");
  map[x][y][z].push({...object});
}
export function getObjects(x, y, z) {
  return map[x]?.[y]?.[z] ?? null;
}
export function isWalkable(x, y, z) {
  const stack = getObjects(x, y, z);
  return stack !== null && stack.some(o => o.type === "ground") &&
    !stack.some(o => o.solid === true);
}
for (let x = 0; x < WIDTH; x++) {
  for (let y = 0; y < HEIGHT; y++) {
    addObject(x, y, GROUND_Z, {type:"ground", color:(x+y)%2 ? "#658b56":"#6d945d"});
  }
}
// One compact building, open doorway at (8, 5), interior on ground level.
for (let x = 6; x <= 12; x++) {
  for (let y = 5; y <= 10; y++) {
    const perimeter = x===6 || x===12 || y===5 || y===10;
    if (perimeter && !(x===8 && y===5)) {
      addObject(x,y,GROUND_Z,{type:"wall",solid:true,color:"#a5a09a"});
    } else if (!perimeter) {
      addObject(x,y,GROUND_Z,{type:"floor",color:"#bdad89"});
    }
  }
}

 // Dynamic objects are appended after terrain and walls (top of stack).
export function takeTopItem(x,y,z) {
  const stack = getObjects(x,y,z);
  if (!stack) return null;
  for (let i=stack.length-1; i>=0; i--) {
    if (stack[i].type === "item" && stack[i].pickupable === true) {
      return stack.splice(i,1)[0];
    }
  }
  return null;
}
addObject(8,7,GROUND_Z,{type:"item",id:"gold_coin",pickupable:true,color:"#f3cb43"});
addObject(9,8,GROUND_Z,{type:"item",id:"sword",pickupable:true,color:"#c5e2ee"});
