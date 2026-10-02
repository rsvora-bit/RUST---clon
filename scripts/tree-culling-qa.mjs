import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const out=process.env.TIDELAND_QA_DIR||'test-results/tree-culling';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`,'--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='menu'&&document.querySelector('.loading-screen')?.hidden===true,null,{timeout:180000});
  await page.locator('#world-seed').fill('731942');await page.locator('[data-action="new"]').click();await page.locator('.save-browser:not([hidden])').waitFor({state:'visible'});await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing',null,{timeout:180000});await page.evaluate(()=>window.__TIDELAND.setCapturePaused(true));await page.waitForTimeout(450);
  const initial=await page.evaluate(()=>window.__TIDELAND.worldArt());
  assert.equal(initial.trees.length,1180,'revision 4 must retain the expected deterministic tree set');
  assert.ok(initial.renderedTrees>0&&initial.renderedTrees<initial.trees.length,'distance culling should trim remote trees');
  assert.equal(initial.renderedTreeInstances,initial.renderedTrees,'InstancedMesh count must match actual visible tree instances');
  console.log(`PASS compact tree instances ${initial.renderedTrees}/${initial.trees.length}`);

  const target=await page.evaluate(()=>{const a=window.__TIDELAND,p=a.world().spawn;return a.nodes().filter(n=>n.kind==='tree').sort((x,y)=>Math.hypot(x.position.x-p.x,x.position.z-p.z)-Math.hypot(y.position.x-p.x,y.position.z-p.z))[0]});
  const ready=await page.evaluate(n=>{const a=window.__TIDELAND,s=a.sim().state;let slot=s.inventory.findIndex(x=>x?.itemId==='rock');if(slot<0){a.sim().addItem('rock',1);slot=s.inventory.findIndex(x=>x?.itemId==='rock');}s.activeSlot=slot;a.teleport({x:n.position.x+.2,y:n.position.y+.1,z:n.position.z+2.4});a.lookAt({x:n.position.x,y:n.position.y+3,z:n.position.z});return {id:n.id,position:n.position,rock:s.inventory[s.activeSlot]?.itemId};},target);
  assert.equal(ready.rock,'rock');await page.waitForTimeout(400);
  const beforeHarvest=await page.evaluate(()=>window.__TIDELAND.worldArt());
  await page.waitForFunction(id=>window.__TIDELAND.worldArt().renderedTreeIds.includes(id),ready.id,{timeout:5000});
  await page.evaluate(id=>{const a=window.__TIDELAND,n=a.nodes().find(n=>n.id===id);a.sim().state.nodeChanges[id]=1;n.remaining=1;a.gather(id);},ready.id);
  await page.waitForFunction(id=>window.__TIDELAND.worldArt().fallingTrees===1&&window.__TIDELAND.snapshot().nodeChanges[id]===0,ready.id,{timeout:10000});
  await page.waitForTimeout(500);
  const falling=await page.evaluate(()=>window.__TIDELAND.worldArt());
  assert.equal(falling.renderedTreeInstances,falling.renderedTrees,'depleted tree must keep its compact instance index during the fall');
  assert.ok(falling.renderedTreeIds.includes(ready.id),'falling tree must remain visible through culling');
  await page.screenshot({path:`${out}/falling-tree.png`});console.log('PASS harvested tree remains instanced throughout fall');

  await page.waitForFunction(()=>window.__TIDELAND.worldArt().fallingTrees===0,null,{timeout:30000});await page.waitForTimeout(350);
  const settled=await page.evaluate(()=>window.__TIDELAND.worldArt());
  assert.ok(!settled.renderedTreeIds.includes(ready.id),'settled depleted tree should leave the visible batch');
  assert.equal(settled.renderedTreeInstances,settled.renderedTrees,'post-fall compaction must preserve instance/node indexing');
  assert.deepEqual(errors,[],'browser console must stay free of application/WebGL errors');
  console.log('PASS depleted instance is removed cleanly after the fall');console.log('PASS no browser or WebGL errors');
}finally{await browser.close();}
