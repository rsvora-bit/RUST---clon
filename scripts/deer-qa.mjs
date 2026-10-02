import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const outputDir=process.env.TIDELAND_QA_DIR||'test-results/deer';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name);};
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5174');await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const setup=await page.evaluate(()=>{const a=window.__TIDELAND;a.setCapturePaused(true);const deer=a.wildlife().find(actor=>actor.species==='islandDeer');if(!deer)return null;const player={x:deer.position.x-5,y:a.height(deer.position.x-5,deer.position.z)+.06,z:deer.position.z};a.teleport(player);a.lookAt({x:deer.position.x,y:deer.position.y+1,z:deer.position.z});return {id:deer.id,position:{...deer.position},health:deer.health};});
  pass('Gen5 generated a climate-suitable deer with a persistent identity',Boolean(setup));await page.screenshot({path:`${outputDir}/deer-before-flight.png`});
  await page.evaluate(()=>window.__TIDELAND.setCapturePaused(false));await page.waitForTimeout(1000);const fled=await page.evaluate(id=>{const a=window.__TIDELAND;a.setCapturePaused(true);const deer=a.wildlife().find(actor=>actor.id===id);return deer?{position:{...deer.position},state:deer.state,health:deer.health}:null;},setup.id);
  pass('Deer flee from an approaching player without attacking',Boolean(fled&&fled.state==='flee'&&Math.hypot(fled.position.x-setup.position.x,fled.position.z-setup.position.z)>.4&&fled.health===setup.health));
  await page.screenshot({path:`${outputDir}/deer-flee.png`});
  const hunt=await page.evaluate(id=>{const a=window.__TIDELAND,g=a.sim();g.state.inventory[0]={itemId:'docksideCleaver',count:1,condition:135};g.selectSlot(0);let actor=a.wildlife().find(entry=>entry.id===id);for(let i=0;i<4&&actor&&actor.state!=='dead';i++){const x=actor.position.x-1.3,z=actor.position.z;a.teleport({x,y:a.height(x,z)+.06,z});a.lookAt({x:actor.position.x,y:actor.position.y+1,z:actor.position.z});a.strikeWildlife(id);actor=a.wildlife().find(entry=>entry.id===id);}const state=a.snapshot();return {dead:actor?.state==='dead',saved:state.nodeChanges[id],inventory:state.inventory.filter(Boolean).map(stack=>stack.itemId),drops:state.drops.map(drop=>drop.stack.itemId)};},setup.id);
  pass('Deer hunting grants meat/hide and records defeated identity',hunt.dead&&hunt.saved===0&&(hunt.inventory.includes('rawMeat')||hunt.drops.includes('rawMeat'))&&(hunt.inventory.includes('hide')||hunt.drops.includes('hide')));await page.evaluate(()=>window.__TIDELAND.save());await page.reload();await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});pass('Hunted deer stays absent after save/reload',!(await page.evaluate(id=>window.__TIDELAND.wildlife().some(actor=>actor.id===id),setup.id)));
  pass('Browser reports no application or WebGL errors',errors.length===0);fs.writeFileSync(`${outputDir}/results.json`,JSON.stringify({checks,errors,deerId:setup.id,initialPosition:setup.position,fled,loot:hunt},null,2));await page.screenshot({path:`${outputDir}/deer-save-reload.png`});
}finally{await browser.close();}
