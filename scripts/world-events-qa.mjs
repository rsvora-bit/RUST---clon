import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const outputDir=process.env.TIDELAND_QA_DIR||'test-results/world-events';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5174',{waitUntil:'commit',timeout:30000});await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:180000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});await page.mouse.click(640,360);
  await page.evaluate(()=>window.__TIDELAND.command('weather storm'));await page.waitForFunction(()=>window.__TIDELAND.snapshot().progression.weather.kind==='storm',null,{timeout:5000});await page.waitForTimeout(350);await page.evaluate(()=>window.__TIDELAND.command('weather clear'));
  await page.waitForFunction(()=>window.__TIDELAND.snapshot().progression.washedAshore?.position, null,{timeout:60000});
  const first=await page.evaluate(()=>{const a=window.__TIDELAND,s=a.snapshot(),e=s.progression.washedAshore,c=s.progression.stations.find(x=>x.id==='event-washed-ashore');return {event:e,cache:c,terrain:{height:a.height(e.position.x,e.position.z),biome:a.biome(e.position.x,e.position.z)},notice:document.querySelector('.notifications')?.textContent??''};});
  pass('A cleared storm creates one persisted high-value salvage cache',first.event.stormSeen&&!first.event.resolved&&first.cache?.kind==='loot'&&first.cache.inventory.some(Boolean));
  pass('Event cache lands on low-slope Gen5 coast terrain',first.terrain.biome==='COAST'&&first.terrain.height>=.5&&first.terrain.height<=5.5);
  await page.keyboard.press('m');await page.waitForFunction(()=>!document.querySelector('.world-map')?.hidden,null,{timeout:5000});
  const mapMarker=await page.evaluate(()=>{const a=window.__TIDELAND,e=a.snapshot().progression.washedAshore.position,canvas=document.querySelector('.world-map canvas'),ctx=canvas.getContext('2d'),size=a.stats().worldSize,x=Math.round((e.x+size/2)/size*canvas.width),y=Math.round((e.z+size/2)/size*canvas.height),pixel=[...ctx.getImageData(x,y,1,1).data];return {pixel,x,y};});
  pass('World map shows the event marker at its saved coastal coordinates',mapMarker.pixel[0]>205&&mapMarker.pixel[1]>130&&mapMarker.pixel[2]<150);await page.screenshot({path:`${outputDir}/washed-ashore-map.png`});await page.keyboard.press('m');
  await page.evaluate(()=>{const a=window.__TIDELAND,p=a.snapshot().progression.washedAshore.position;a.teleport({x:p.x,y:p.y+1.2,z:p.z+2});a.lookAt({x:p.x,y:p.y+.4,z:p.z});});
  await page.waitForFunction(()=>window.__TIDELAND.interaction()?.title==='Washed-ashore cargo',null,{timeout:10000});pass('Event cargo exposes a recover interaction',await page.evaluate(()=>window.__TIDELAND.interaction()?.action==='RECOVER'));
  await page.evaluate(()=>window.__TIDELAND.save());await page.reload();await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:180000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const restored=await page.evaluate(()=>{const p=window.__TIDELAND.snapshot().progression;return {event:p.washedAshore,cache:p.stations.find(s=>s.id==='event-washed-ashore')};});
  pass('Event location and unclaimed cache survive a save/reload without duplication',restored.event?.position?.x===first.event.position.x&&restored.event?.position?.z===first.event.position.z&&restored.cache?.inventory.some(Boolean)&&restored.cache.inventory.length===first.cache.inventory.length);
  pass('No browser or WebGL console errors',errors.length===0);
}finally{await browser.close();}
