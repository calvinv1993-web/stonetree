// World tiles use x/y; z=0 is ground and z increases upwards.
// Door passage coordinates are gameplay anchors; visualRise is projection only.
const WORLD_CONFIG={tileSize:40,storeyHeight:64,wallThickness:12,capThickness:6,
 stepMilliseconds:260,bounds:{left:-7,right:95,top:-32,bottom:31},revision:'rootheart-ground-v1'};
// Rootheart occupies x=32..95 and y=-32..31; the original test area remains intact.
const ROOTHEART={left:32,top:-32,size:64,centerX:64,centerY:0};
const BUILDING_CONFIGS=[{
 id:'starter-house',name:'Huis 1',position:{x:0,y:0,z:0},width:5,height:5,
 door:{side:'south',col:2},
 floors:[
  {material:'stone',windows:[],stairs:{up:{x:1,y:1}}},
  {material:'wood',windows:[1,3],stairs:{down:{x:1,y:1}},holes:[[1,1],[1,2],[2,1],[2,2]]}
 ]
},{
 id:'east-house',name:'Huis 2',position:{x:9,y:0,z:0},width:5,height:5,
 door:{side:'south',col:3},
 terrace:{level:1,startCol:3,door:{row:3,visualRise:40}},
 floors:[
  {material:'stone',windows:[],stairs:{up:{x:1,y:1}}},
  {material:'wood',windows:[1],stairs:{down:{x:1,y:1}}}
 ]
},{
 id:'tower-house',name:'Huis 3',position:{x:18,y:0,z:0},width:5,height:5,
 door:{side:'south',col:2},
 floors:[
  {material:'stone',windows:[],stairs:{up:{x:1,y:2}}},
  {material:'wood',windows:[1,3],stairs:{down:{x:1,y:2},up:{x:3,y:2}},holes:[[1,2]]},
  {material:'wood',windows:[0,2,4],stairs:{down:{x:3,y:2}},holes:[[3,2]]}
 ]
}];
