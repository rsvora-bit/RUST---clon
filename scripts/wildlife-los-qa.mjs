import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const captureScreenshots=process.env.TIDELAND_QA_SCREENSHOTS!=='0';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(label,condition)=>{assert.ok(condition,label);console.log('PASS',label);};
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const blocked=await page.evaluate(()=>{const a=window.__TIDELAND;a.setCapturePaused(true);const wolves=a.wildlife().filter(actor=>actor.species==='islandWolf'),trees=a.nodes().filter(node=>node.kind==='tree').sort((x,y)=>Math.hypot(x.position.x,x.position.z)-Math.hypot(y.position.x,y.position.z));if(!wolves.length||!trees.length)throw Error('Seed did not produce wolves and trees');const wolf=wolves[0];let setup=null;for(const tree of trees.slice(0,100)){for(const axis of [{x:1,z:0},{x:0,z:1},{x:Math.SQRT1_2,z:Math.SQRT1_2},{x:Math.SQRT1_2,z:-Math.SQRT1_2}]){const player={x:tree.position.x-axis.x*5,y:0,z:tree.position.z-axis.z*5},enemy={x:tree.position.x+axis.x*5,y:0,z:tree.position.z+axis.z*5};player.y=a.height(player.x,player.z)+.06;enemy.y=a.height(enemy.x,enemy.z)+.05;a.configureWildlifeForTest(wolf.id,{position:enemy,angered:true,alerted:false,canSeePlayer:false,attackCooldown:0,perceptionCooldown:0});a.teleport(player);if(!a.scavengerLineOfSightForTest(wolf.id)){setup={id:wolf.id,tree:tree.position,player,enemy,health:a.snapshot().player.stats.health};break;}}if(setup)break;}if(!setup)throw Error('Could not find a tree trunk that blocks the wildlife sight ray');return setup;});
  pass('Runtime ray test finds a tree between the player and a hostile wolf',Boolean(blocked.id));
  await page.evaluate(()=>window.__TIDELAND.setCapturePaused(false));await page.waitForTimeout(500);
  const occluded=await page.evaluate(id=>{const a=window.__TIDELAND,actor=a.wildlife().find(entry=>entry.id===id);return {state:actor?.state,canSee:actor?.canSeePlayer,health:a.snapshot().player.stats.health};},blocked.id);
  pass('An occluded wolf does not enter attack state or damage the player',occluded.state!=='attack'&&occluded.canSee===false&&occluded.health===blocked.health);
  await page.evaluate(({id,enemy})=>{const a=window.__TIDELAND,player={x:enemy.x+4,y:a.height(enemy.x+4,enemy.z)+.06,z:enemy.z};a.setCapturePaused(true);a.configureWildlifeForTest(id,{position:enemy,angered:true,attackCooldown:0,perceptionCooldown:0,canSeePlayer:false});a.teleport(player);a.setCapturePaused(false);},blocked);
  await page.waitForFunction(id=>{const actor=window.__TIDELAND.wildlife().find(entry=>entry.id===id);return actor?.canSeePlayer===true&&actor.state!=='wander';},blocked.id,{timeout:5000});
  pass('The wolf resumes pursuit after it regains clear line of sight',await page.evaluate(id=>{const actor=window.__TIDELAND.wildlife().find(entry=>entry.id===id);return actor?.canSeePlayer&&['chase','attack'].includes(actor.state);},blocked.id));
  pass('No browser application or WebGL console errors',errors.length===0);
}finally{await browser.close();}
