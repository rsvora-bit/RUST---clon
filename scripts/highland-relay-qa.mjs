import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173',out=process.env.TIDELAND_QA_DIR||'test-results/highland-relay',executablePath=process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/chromium');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const pass=(name,value)=>{assert.ok(value,name);results.push(name);console.log('PASS',name)};
try{
  await page.goto(base);await page.waitForFunction(()=>!!window.__TIDELAND,null,{timeout:600000});
  await page.locator('.loading-screen').waitFor({state:'hidden',timeout:600000});
  await page.locator('#world-seed').fill('731942');await page.locator('[data-action="new"]').click();
  await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing',null,{timeout:600000});
  const cache=await page.evaluate(()=>{
    const a=window.__TIDELAND,poi=a.world().pois.find(p=>p.kind===7),state=a.snapshot(),station=state.progression.stations.find(s=>s.id===`secure-cache-${poi?.id}`);
    return {revision:a.world().revision,poi,station,registered:station? a.hasInteraction(station.id):false};
  });
  pass('Highland Relay is present in Revision 6',cache.revision===6&&cache.poi?.name==='Highland Relay');
  pass('Relay has a generated locked cache with salvage',cache.station?.kind==='secureCache'&&cache.station.locked===true&&cache.station.inventory.some(Boolean));
  pass('Relay cache is registered as a live station interaction',cache.registered===true);
  await page.evaluate(({position})=>{
    const a=window.__TIDELAND,p={x:position.x,y:a.height(position.x,position.z+2.6)+.05,z:position.z+2.6};
    a.teleport(p);a.lookAt({x:position.x,y:position.y+.38,z:position.z});
  },{position:cache.station.position});
  await page.waitForFunction(()=>window.__TIDELAND.interaction()?.action==='LOCKED',null,{timeout:15000});
  const prompt=await page.evaluate(()=>window.__TIDELAND.interaction());
  pass('Player receives the locked-cache interaction prompt',prompt.title==='Sealed salvage case'&&prompt.action==='LOCKED');
  await page.evaluate(()=>window.__TIDELAND.sim().addItem('relayAccessCard',1));await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='station',null,{timeout:15000});
  const opened=await page.evaluate(id=>{
    const a=window.__TIDELAND,s=a.snapshot().progression.stations.find(entry=>entry.id===id);
    return {locked:s?.locked,cards:a.sim().count('relayAccessCard'),screen:a.getScreen()};
  },cache.station.id);
  pass('Relay access card unlocks and opens the cache',opened.screen==='station'&&opened.locked===false&&opened.cards===0);
  pass('No browser or application errors',errors.length===0);
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({passed:true,results,errors,cache:cache.station.id},null,2));
}catch(error){
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({passed:false,results,errors,error:error.message},null,2));throw error;
}finally{await browser.close()}
