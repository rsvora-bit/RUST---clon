import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const outputDir='test-results/raiding';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
try{
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173',{waitUntil:'commit',timeout:30000});await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:180000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000});
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});await page.mouse.click(640,360);
  const setup=await page.evaluate(()=>{
    const a=window.__TIDELAND,g=a.sim(),spawn=a.world().spawn;g.state.inventory=Array(30).fill(null);g.state.inventory[0]={itemId:'hammer',count:1};g.addItem('wood',600);g.addItem('stone',200);g.addItem('metal',200);a.setCapturePaused(true);
    const foundationPosition={x:spawn.x+5,y:a.height(spawn.x+5,spawn.z),z:spawn.z},foundationResult=a.placeAt('foundation',foundationPosition),foundation=foundationResult.structure;if(!foundation)throw Error(`Foundation placement failed: ${foundationResult.candidate.reason}`);
    const frameSocket=a.sockets(foundation).find(socket=>socket.accepts.includes('doorway'));if(!frameSocket)throw Error('Foundation has no doorway socket');a.teleport({x:frameSocket.position.x+2.5,y:frameSocket.position.y+.06,z:frameSocket.position.z});
    const frameResult=a.placeAt('doorway',frameSocket.position),frame=frameResult.structure;if(!frame)throw Error(`Doorway placement failed: ${frameResult.candidate.reason}`);
    const doorSocket=a.sockets(frame).find(socket=>socket.accepts.includes('door'));if(!doorSocket)throw Error('Doorway has no door socket');const doorResult=a.placeAt('door',doorSocket.position),door=doorResult.structure;if(!door)throw Error(`Door placement failed: ${doorResult.candidate.reason}`);
    const beacon=a.stationPlace('homesteadCore',{x:door.position.x+9,y:a.height(door.position.x+9,door.position.z),z:door.position.z});if(!beacon)throw Error('Homestead Beacon placement failed');
    if(!g.state.structures.find(entry=>entry.id===door.id)?.locked)throw Error('Homestead Beacon did not secure the test door');
    const raiders=a.wildlife().filter(candidate=>candidate.species==='islandScavenger'),actor=raiders[0],support=raiders[1];if(!actor||!support)throw Error('Two seeded scavengers are required for coordinated raid QA');
    const attacker={x:door.position.x,y:a.height(door.position.x,door.position.z+3)+.05,z:door.position.z+3},defender={x:door.position.x,y:a.height(door.position.x,door.position.z-3)+.05,z:door.position.z-3};
    const helper={x:door.position.x+.8,y:a.height(door.position.x+.8,door.position.z+3)+.05,z:door.position.z+3};
    a.configureWildlifeForTest(actor.id,{position:attacker,yaw:Math.PI,alerted:true,angered:true,awareness:1,canSeePlayer:false,memorySeconds:5,perceptionCooldown:0,attackCooldown:0,state:'investigate'});a.configureWildlifeForTest(support.id,{position:helper,yaw:Math.PI,alerted:false,angered:false,awareness:0,canSeePlayer:false,memorySeconds:0,perceptionCooldown:0,attackCooldown:0,state:'wander'});a.teleport(defender);a.lookAt({x:door.position.x,y:door.position.y+1,z:door.position.z});
    return {door:door.id,doorHealth:door.currentHealth,actor:actor.id,support:support.id,playerHealth:g.state.player.stats.health,doorPosition:door.position,attacker,helper,defender};
  });
  await page.evaluate(()=>window.__TIDELAND.setCapturePaused(false));
  await page.waitForFunction(({id,health})=>{const door=window.__TIDELAND.sim().state.structures.find(s=>s.id===id);return !door||door.currentHealth<health;},{id:setup.door,health:setup.doorHealth},{timeout:30000});
  const result=await page.evaluate(ids=>{const a=window.__TIDELAND,door=a.sim().state.structures.find(s=>s.id===ids.door),actor=a.wildlife().find(entry=>entry.id===ids.actor),support=a.wildlife().find(entry=>entry.id===ids.support);return {doorHealth:door?.currentHealth,playerHealth:a.sim().state.player.stats.health,actorState:actor?.state,actorPosition:actor?.position,supportState:support?.state,supportAlerted:support?.alerted,saveValid:a.save()};},setup);
  pass('Lead scavenger breaches the claimed locked door from the approach side',result.doorHealth<setup.doorHealth&&result.actorState==='raid'&&result.actorPosition.z>setup.doorPosition.z);
  pass('Raid alarm alerts a nearby ally and directs it to the same blocked door',result.supportAlerted&&result.supportState==='raid');
  pass('Scavenger does not damage the player through the locked door',result.playerHealth===setup.playerHealth);
  assert.equal(result.saveValid,true,'raided door should remain save-compatible');await page.reload();await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:180000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:180000});
  const persisted=await page.evaluate(id=>window.__TIDELAND.sim().state.structures.find(s=>s.id===id)?.currentHealth,setup.door);pass('Persistent door damage survives save and reload',persisted===result.doorHealth);
  pass('No browser application or WebGL errors',errors.length===0);await page.screenshot({path:`${outputDir}/door-raid.png`});console.log(JSON.stringify({passed:true,setup,result,persisted,errors}));
}finally{await browser.close();}
