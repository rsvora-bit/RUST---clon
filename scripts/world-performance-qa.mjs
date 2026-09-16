import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const out=process.env.TIDELAND_QA_DIR||'test-results/world-art';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`,'--enable-unsafe-swiftshader']});
const measure=async(url,label)=>{
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),started=Date.now(),errors=[];console.log('START',label,url);
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',label,e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('CONSOLE ERROR',label,m.text())}});
  page.on('requestfailed',r=>console.error('REQUEST FAILED',label,r.url(),r.failure()?.errorText));await page.goto(url);console.log('DOCUMENT',label);await page.waitForFunction(()=>!!window.__TIDELAND,null,{timeout:180000}).catch(async e=>{console.error('BOOT DIAGNOSTIC',label,JSON.stringify(errors),await page.locator('body').innerText());await page.screenshot({path:`${out}/${label}-boot-failure.png`,timeout:10000}).catch(()=>{});throw e;});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000});
  await page.locator('#world-seed').fill('731942');await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});const startupMs=Date.now()-started;console.log('PLAYING',label,startupMs);
  await page.evaluate(()=>{const a=window.__TIDELAND;a.setCapturePaused(true);a.dev('god');a.dev('time',10);const p=a.world().spawn;a.teleport(p);a.lookAt({x:p.x+80,y:p.y+4,z:p.z-80});});await page.waitForTimeout(3000);
  const result=await page.evaluate(async()=>{const a=window.__TIDELAND,samples=[];const timestamps=[];for(let i=0;i<60;i++){timestamps.push(await new Promise(requestAnimationFrame));samples.push(a.stats());}const mean=k=>samples.reduce((n,s)=>n+s[k],0)/samples.length;const actualFrameMs=(timestamps.at(-1)-timestamps[0])/(timestamps.length-1);return {seed:a.snapshot().seed,preset:a.cameraState().settings.quality,world:a.world(),nodes:a.nodes().length,fps:1000/actualFrameMs,frameMs:actualFrameMs,telemetryFps:mean('fps'),drawCalls:mean('drawCalls'),triangles:mean('triangles')};});
  await page.screenshot({path:`${out}/${label}.png`,timeout:60000});
  if(label==='v090'){
    const fixture=await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim(),p=a.world().spawn;a.dev('resources');const built=a.placeAt('foundation',{x:p.x,y:a.height(p.x,p.z),z:p.z}).structure;const station=a.stationPlace('bedroll',{x:p.x+6,y:a.height(p.x+6,p.z),z:p.z});g.state.progression.tech.unlocked.push('efficiencyTooling');g.state.progression.waypoint={x:100,z:100};a.save();return {state:a.snapshot(),nodes:a.nodes(),world:a.world(),storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k.replace('tideland-archive:v0.9.0:',''))])),built,station};});fs.writeFileSync(`${out}/v090-save.json`,JSON.stringify(fixture));
  }
  assert.equal(errors.length,0,errors.join('\n'));await context.close();return {label,url,startupMs,errors,...result};
};
try{
  const baseline=process.env.TIDELAND_BASELINE_FILE?JSON.parse(fs.readFileSync(process.env.TIDELAND_BASELINE_FILE,'utf8')):await measure('https://rsvora-bit.github.io/RUST---clon/versions/v0.9.0/','v090');
  fs.writeFileSync(`${out}/baseline.json`,JSON.stringify(baseline,null,2));
  if(!process.env.TIDELAND_BASELINE_ONLY){const current=await measure(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173','v091');fs.writeFileSync(`${out}/performance.json`,JSON.stringify({baseline,current},null,2));console.log(JSON.stringify({baseline,current},null,2));}
  else console.log(JSON.stringify(baseline,null,2));
}finally{await browser.close();}
