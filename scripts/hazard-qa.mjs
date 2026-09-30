import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const outputDir=process.env.TIDELAND_QA_DIR||'test-results/hazard';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});await page.mouse.click(640,360);
  const before=await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim(),relay=a.world().pois.find(p=>p.kind===1);if(!relay)throw Error('No deterministic relay POI');g.state.player.equipment={head:'protectiveHood'};const x=relay.position.x+7,z=relay.position.z;a.teleport({x,y:a.height(x,z)+.06,z});a.lookAt({x:relay.position.x,y:relay.position.y+2,z:relay.position.z});a.setCapturePaused(false);return g.state.player.stats.health;});
  await page.waitForFunction(()=>/Contaminated battery runoff/i.test(document.querySelector('.notifications')?.textContent??''),null,{timeout:5000});
  await page.waitForFunction(health=>window.__TIDELAND.snapshot().player.stats.health<health,before,{timeout:30000});
  const result=await page.evaluate(()=>{const a=window.__TIDELAND,health=a.snapshot().player.stats.health,position=a.snapshot().player.position,notice=document.querySelector('.notifications')?.textContent??'';a.setCapturePaused(true);return {health,position,notice,screen:a.getScreen()};});
  assert.ok(result.health<before,'toxic area must damage player during active exposure');assert.equal(result.screen,'playing');assert.equal(errors.length,0,errors.join('\n'));
  const alpine=await page.evaluate(()=>{const a=window.__TIDELAND,s=a.sim().state;s.timeOfDay=2;s.progression.weather.kind='storm';s.progression.weather.remaining=300;let target=null;for(let z=-600;z<=600;z+=24)for(let x=-600;x<=600;x+=24){if(a.biome(x,z)!=='SNOW / ALPINE')continue;const y=a.height(x,z);if(y>12&&(!target||y>target.y))target={x,y,z};}if(!target)throw Error('No alpine terrain sample found');a.teleport({x:target.x,y:target.y+.06,z:target.z});a.setCapturePaused(false);return {target,health:s.player.stats.health};});
  await page.waitForFunction(()=>/Severe alpine cold/i.test(document.querySelector('.notifications')?.textContent??''),null,{timeout:10000});await page.waitForFunction(health=>window.__TIDELAND.snapshot().player.stats.health<health,alpine.health,{timeout:15000});
  const cold=await page.evaluate(()=>{const a=window.__TIDELAND,s=a.snapshot();a.setCapturePaused(true);return {health:s.player.stats.health,position:s.player.position,screen:a.getScreen()};});assert.ok(cold.health<alpine.health,'alpine storm exposure must damage player through cold mitigation');assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:`${outputDir}/relay-and-alpine-hazards.png`});fs.writeFileSync(`${outputDir}/results.json`,JSON.stringify({before,...result,alpine,cold,errors},null,2));console.log('PASS Toxic relay and alpine storm exposure cause damage, display warnings and render without browser errors');
}finally{await browser.close();}
