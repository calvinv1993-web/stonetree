// Stonetree building data: geometry is still square in this prototype.
// The next updates will remove the square-only rendering assumption.
const BUILDING_CONFIG={
 id:'starter-house',
 position:{x:0,y:0,z:0},
 width:5,
 height:5,
 door:{side:'south',col:2},
 stairs:{x:1,y:1},
 floors:[{material:'stone',windows:[]},{material:'wood',windows:[1,3]}]
};
