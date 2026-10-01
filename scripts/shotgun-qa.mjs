import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const outputDir=process.env.TIDELAND_QA_DIR||'test-results/shotgun';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const target=await page.evaluate(()=>{const a=window.__TIDELAND,game=a.sim(),actor=a.wildlife().find(entry=>entry.state!=='dead');if(!actor)throw Error('No living wildlife spawned');a.setCapturePaused(true);a.dev('god');game.state.inventory[0]={itemId:'fieldShotgun',count:1,condition:145,loadedAmmo:4};game.state.inventory[1]={itemId:'shotgunShells',count:10};a.selectSlot(0);const p={x:actor.position.x,y:a.height(actor.position.x,actor.position.z+2.5)+.06,z:actor.position.z+2.5};a.teleport(p);a.lookAt({x:actor.position.x,y:actor.position.y+(actor.species==='islandScavenger'?.95:.68),z:actor.position.z});return {id:actor.id,species:actor.species,health:actor.health};});
  await page.waitForFunction(()=>window.__TIDELAND.cameraState().viewmodel.active==='fieldShotgun',null,{timeout:3000});pass('Tiered shotgun fixture equips the new first-person model',true);
  await page.screenshot({path:`${outputDir}/equipped.png`});await page.evaluate(()=>window.__TIDELAND.fireFirearm());
  const fired=await page.evaluate(id=>({actor:window.__TIDELAND.wildlife().find(entry=>entry.id===id),state:window.__TIDELAND.snapshot(),weapon:window.__TIDELAND.firearm()}),target.id);
  pass('One shell fires a deterministic multi-pellet close-range spread',fired.actor.health<target.health&&fired.weapon.loaded===3&&fired.weapon.reserve===10);
  pass('Pellet damage is accumulated once and shotgun durability wears per shell',fired.actor.health>=1&&fired.actor.health<=target.health-18&&fired.state.inventory[0].condition===143);
  await page.evaluate(()=>{window.__TIDELAND.setCapturePaused(false);window.__TIDELAND.reloadFirearm();});await page.waitForFunction(()=>{const p=window.__TIDELAND.cameraState().viewmodel.reloadProgress;return p>.05&&p<1;},null,{timeout:2000});
  const pose=await page.evaluate(()=>window.__TIDELAND.cameraState().viewmodel.reloadProgress);pass('Break-action reload has a visible viewmodel animation',pose>.05&&pose<1);
  await page.waitForFunction(()=>{const firearm=window.__TIDELAND.firearm();return firearm.loaded===4&&!firearm.reloading;},null,{timeout:12000});
  const reloaded=await page.evaluate(()=>window.__TIDELAND.firearm());pass('Reload consumes one matching shell from the reserve',reloaded.loaded===4&&reloaded.reserve===9);
  await page.evaluate(()=>window.__TIDELAND.save());await page.reload();await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const restored=await page.evaluate(id=>({state:window.__TIDELAND.snapshot(),actor:window.__TIDELAND.wildlife().find(entry=>entry.id===id)}),target.id);
  pass('Shotgun condition, magazine and target damage survive save/reload',restored.state.inventory[0]?.condition===143&&restored.state.inventory[0]?.loadedAmmo===4&&restored.state.inventory[1]?.count===9&&restored.actor?.health===fired.actor.health);
  pass('No application or WebGL console errors',errors.length===0);await page.screenshot({path:`${outputDir}/after-reload.png`});fs.writeFileSync(`${outputDir}/results.json`,JSON.stringify({checks,errors,target:{id:target.id,species:target.species,initialHealth:target.health},firedHealth:fired.actor.health,reloaded},null,2));
}finally{await browser.close();}
