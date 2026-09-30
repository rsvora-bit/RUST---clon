import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const outputDir=process.env.TIDELAND_QA_DIR||'test-results/ranged';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const shot=await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim(),actor=a.wildlife().find(x=>x.state!=='dead');if(!actor)throw Error('No wildlife target available');g.state.inventory[0]={itemId:'bow',count:1};g.state.inventory[1]={itemId:'arrow',count:5};g.selectSlot(0);const x=actor.position.x-4,z=actor.position.z,p={x,y:a.height(x,z)+.06,z};a.teleport(p);a.lookAt({x:actor.position.x,y:actor.position.y+.62,z:actor.position.z});a.setCapturePaused(false);return {actor,arrows:g.count('arrow')};});
  pass('Crafted bow and arrow ammo available to player',shot.arrows===5);await page.waitForTimeout(200);await page.evaluate(()=>{window.__TIDELAND.drawBow();window.__TIDELAND.releaseBow();});
  const released=await page.evaluate(()=>({count:window.__TIDELAND.sim().count('arrow'),projectiles:window.__TIDELAND.projectileCount(),bow:window.__TIDELAND.bowState()}));
  pass(`Bow release consumes exactly one arrow and spawns a projectile ${JSON.stringify(released)}`,released.count===4&&released.projectiles===1);
  await page.waitForFunction(id=>{const a=window.__TIDELAND;return a.wildlife().find(actor=>actor.id===id)?.health<78;},shot.actor.id,{timeout:10000});
  const impact=await page.evaluate(id=>{const a=window.__TIDELAND,actor=a.wildlife().find(x=>x.id===id),state=a.snapshot();return {health:actor?.health,arrowDrops:state.drops.filter(drop=>drop.stack.itemId==='arrow').length,projectiles:a.projectileCount(),nodeHealth:state.nodeChanges[id]};},shot.actor.id);
  pass('Ballistic hit damages wildlife and leaves a recoverable arrow',impact.health<78&&impact.arrowDrops===1&&impact.projectiles===0&&impact.nodeHealth===impact.health);
  pass('Save accepts recoverable arrow and projectile damage state',await page.evaluate(()=>window.__TIDELAND.save()));
  const repairSetup=await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim(),p=g.state.player.position;g.state.inventory[0]={itemId:'hatchet',count:1,condition:20};g.state.inventory[1]={itemId:'stone',count:24};g.state.inventory[2]={itemId:'wood',count:12};g.state.progression??={version:1,stations:[],weather:{kind:'clear',blend:0,remaining:240},lootGenerated:false};g.state.progression.stations.push({id:'qa-repair-bench',kind:'workbench1',position:{...p},rotation:0,inventory:[],active:false,job:null});g.selectSlot(0);return {stone:g.count('stone'),wood:g.count('wood')};});
  await page.keyboard.press('Tab');await page.locator('.inventory-belt [data-slot="0"]').click();await page.locator('[data-action="repairTool"]').click();
  const repaired=await page.evaluate(()=>({stack:window.__TIDELAND.snapshot().inventory[0],stone:window.__TIDELAND.sim().count('stone'),wood:window.__TIDELAND.sim().count('wood'),saved:window.__TIDELAND.save()}));
  pass(`Inventory repair action spends materials and restores tool condition ${JSON.stringify(repaired)}`,repaired.stack?.condition===65&&repaired.stone===repairSetup.stone-12&&repaired.wood===repairSetup.wood-6&&repaired.saved);
  await page.reload();await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  pass('Repaired tool condition and workbench state survive save/reload',await page.evaluate(()=>window.__TIDELAND.snapshot().inventory[0]?.condition===65));
  pass('No browser application or WebGL console errors',errors.length===0);await page.screenshot({path:`${outputDir}/bow-impact.png`});fs.writeFileSync(`${outputDir}/results.json`,JSON.stringify({checks,errors,actorId:shot.actor.id,impact},null,2));
}finally{await browser.close();}
