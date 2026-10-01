import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

fs.mkdirSync('test-results/base-security',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173',{waitUntil:'commit'});await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:180000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const setup=await page.evaluate(()=>{const a=window.__TIDELAND,spawn=a.world().spawn,at=(x,z)=>({x,y:a.height(x,z)+.04,z});a.setCapturePaused(true);const generator=a.stationPlace('generator',at(spawn.x+10,spawn.z+10)),switcher=a.stationPlace('powerSwitch',at(spawn.x+18,spawn.z+10)),beacon=a.stationPlace('homesteadCore',at(spawn.x+26,spawn.z+10));if(!generator||!switcher||!beacon)throw Error('Could not place powered Homestead setup');Object.assign(generator,{active:true,job:{recipe:'power',remaining:80}});switcher.active=true;const actor=a.wildlife().find(candidate=>candidate.species==='islandScavenger');if(!actor)throw Error('No seeded scavenger');a.configureWildlifeForTest(actor.id,{position:{x:beacon.position.x+1,y:beacon.position.y,z:beacon.position.z},alerted:true,angered:true,state:'investigate',memorySeconds:3});return {beacon:beacon.id,actor:actor.id};});
  await page.evaluate(()=>window.__TIDELAND.setCapturePaused(false));await page.waitForFunction(()=>/HOMESTEAD ALARM/.test(document.querySelector('.notifications')?.textContent||''),null,{timeout:10000});pass('A hostile scavenger entering a powered claim raises a runtime alarm',true);
  const beaconState=await page.evaluate(id=>window.__TIDELAND.stationBeaconForTest(id),setup.beacon);pass('Alarm switches the beacon to red emissive light',beaconState?.color==='ff3222');
  await page.evaluate(id=>window.__TIDELAND.stationOpen(id),setup.beacon);await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='station');pass('Beacon panel explains whether base security is powered',await page.locator('.survival-panel:not(.world-map)').innerText().then(text=>text.includes('SECURITY ARMED · POWERED')));
  await page.screenshot({path:'test-results/base-security/alarm.png'});pass('No browser application or WebGL console errors',errors.length===0);console.log(JSON.stringify({passed:true,setup,beaconState,errors}));
}finally{await browser.close();}
