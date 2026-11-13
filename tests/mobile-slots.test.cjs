const fs=require('fs'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync('js/touch.js','utf8');
let used=0,rendered=0; const node={classList:{remove(){}},textContent:''};
const ctx=vm.createContext({clearTimeout(){},useFav(){used++},renderFavs(){rendered++},touchStorage:{set(){}},favKey:()=> 'test',document:{getElementById:()=>node}});
vm.runInContext("let favHold=null,favPageIndex=0,favItemPage=0,favShown='';"+s.slice(s.indexOf('function endFavPress('),s.indexOf('function openFavPicker(')),ctx);
function release(p,use=true){ctx.p={el:node,slot:0,...p};vm.runInContext(`favHold=p;endFavPress(${use})`,ctx);}
release({});assert.equal(used,1);
release({held:true});assert.equal(used,1);
release({moved:true,dx:-80,dy:2});assert.equal(vm.runInContext('favPageIndex',ctx),1);assert.equal(used,1);
release({slot:3,moved:true,dx:80,dy:2});assert.equal(vm.runInContext('favItemPage',ctx),2);
release({moved:true,dx:2,dy:90});assert.equal(rendered,2);assert.equal(used,1);
release({},false);assert.equal(used,1);
console.log('PASS: tap, hold, independent swipes, vertical drag and cancellation');
