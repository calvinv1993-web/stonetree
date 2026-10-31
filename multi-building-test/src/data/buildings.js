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

const BUILDING_CONFIGS=[BUILDING_CONFIG,{
 id:'east-house',position:{x:9,y:0,z:0},width:5,height:5,
 door:{side:'south',col:3},stairs:{x:1,y:1},terrace:{level:1,startCol:3},
 floors:[{material:'stone',windows:[]},{material:'wood',windows:[1,3]}]
},{
 id:'tower-house',position:{x:18,y:0,z:0},width:5,height:5,
 door:{side:'south',col:2},stairs:{x:1,y:2},
 stairLevels:[{up:{x:1,y:2}},{down:{x:1,y:2},up:{x:3,y:2}},{down:{x:3,y:2}}],
 floors:[{material:'stone',windows:[]},{material:'wood',windows:[1,3]},{material:'wood',windows:[0,2,4]}]
}];
