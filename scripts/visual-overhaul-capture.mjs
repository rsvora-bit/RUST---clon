import {chromium} from 'playwright-core';
import fs from 'node:fs';
const phase=process.argv[2]||'after',dir=`artifacts/visual-overhaul/${phase}`;fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-gl=angle','--use-angle=metal']});
try{const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__TIDELAND);await page.getByRole('button',{name:'01 NEW GAME'}).click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');
const scenes=[['grassland',28,212,28,155,1.5],['ground',28,212,30,209,-1],['coast',30,265,20,330,0],['beach',30,260,35,264,-1],['upland',-54,102,-65,-80,22],['forest',6,203,6,198,8]];
const stats={};for(const [name,x,z,tx,tz,ty] of scenes){await page.evaluate(({x,z,tx,tz,ty})=>{const a=window.__TIDELAND;a.dev('day');a.teleport({x,y:a.height(x,z)+.1,z});a.lookAt({x:tx,y:a.height(x,z)+ty,z:tz})},{x,z,tx,tz,ty});await page.waitForTimeout(1800);await page.screenshot({path:`${dir}/${name}.png`});stats[name]=await page.evaluate(()=>window.__TIDELAND.stats());}
if(phase==='after'){
const shore=await page.evaluate(()=>{const a=window.__TIDELAND;let best={z:240,error:99};for(let z=225;z<285;z+=.5){const error=Math.abs(a.height(30,z)-1.4);if(error<best.error)best={z,error};}return best.z});
const extra=[['coastline-daytime',30,shore-5,10,shore+20,0],['beach-close-up',30,shore,32,shore+2,-1],['ocean-close-up',30,shore,32,shore+15,-1],['ocean-horizon',30,shore-2,30,shore+150,0],['forest-edge',53,190,55,180,4],['tree-close-up',55,184,55,180,7],['rock-close-up',22,209,24,206,.5],['rocky-upland',-32,-54,-5,-83,10],['high-overview',28,212,10,95,5]];
for(const [name,x,z,tx,tz,ty]of extra){await page.evaluate(({x,z,tx,tz,ty})=>{const a=window.__TIDELAND;a.dev('day');a.teleport({x,y:a.height(x,z)+.1,z});a.lookAt({x:tx,y:a.height(x,z)+ty,z:tz})},{x,z,tx,tz,ty});await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/${name}.png`});stats[name]=await page.evaluate(()=>window.__TIDELAND.stats());}
}
fs.writeFileSync(`${dir}/metrics.json`,JSON.stringify({stats,errors},null,2));console.log({phase,stats,errors});if(errors.length)throw Error(errors.join('\n'));}finally{await browser.close()}
