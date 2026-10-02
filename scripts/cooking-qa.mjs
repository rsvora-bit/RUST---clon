import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const pass=(name,ok)=>{assert.ok(ok,name);console.log('PASS',name);};
const drag=async(from,to)=>{const a=await from.boundingBox(),b=await to.boundingBox();assert.ok(a&&b,'Campfire transfer slots are visible');await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();};
try{
 const url=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';await page.goto(url);await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:150000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});
 await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:150000});
 const fire=await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim(),p=g.state.player.position,s=a.stationPlace('campfire',{x:p.x+3,y:a.height(p.x+3,p.z),z:p.z});g.state.inventory=Array(30).fill(null);g.state.inventory[0]={itemId:'wood',count:1};g.state.inventory[1]={itemId:'rawMeat',count:1};a.stationOpen(s.id);return s;});
 const panel=page.locator('.survival-panel:not(.world-map)');await panel.waitFor({state:'visible'});
 pass('Campfire UI explains fuel, raw meat and cooked output',/RAW MEAT/.test(await panel.innerText())&&/COOKED/.test(await panel.innerText()));
 const player=panel.locator('.station-columns section:nth-child(1) [data-container="player"]'),slots=panel.locator('.station-columns section:nth-child(2) [data-container="station"]');await drag(player.nth(0),slots.nth(0));await drag(player.nth(1),slots.nth(1));
 pass('Wood and raw meat enter their dedicated campfire slots',await page.evaluate(id=>{const s=window.__TIDELAND.snapshot().progression.stations.find(x=>x.id===id);return s.inventory[0]?.itemId==='wood'&&s.inventory[1]?.itemId==='rawMeat';},fire.id));
 await panel.locator('[data-action="toggle"]').click();await page.waitForFunction(id=>window.__TIDELAND.snapshot().progression.stations.find(x=>x.id===id)?.job?.recipe==='cook',fire.id);pass('Starting the campfire reserves one raw meat and one wood',true);
 await page.evaluate(()=>window.__TIDELAND.sim().tick(12,false));await page.keyboard.press('Escape');await page.evaluate(id=>window.__TIDELAND.stationOpen(id),fire.id);await panel.waitFor({state:'visible'});
 pass('Campfire completes exactly one cooked meat into OUTPUT',await page.evaluate(id=>{const s=window.__TIDELAND.snapshot().progression.stations.find(x=>x.id===id);return s.inventory[2]?.itemId==='cookedMeat'&&s.inventory[2].count===1&&s.job===null;},fire.id));
 await panel.locator('[data-action="take"]').click();const eaten=await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim(),slot=g.state.inventory.findIndex(s=>s?.itemId==='cookedMeat');g.state.player.stats.hunger=30;return {slot,eaten:g.consume(slot),hunger:g.state.player.stats.hunger};});pass('Extracted cooked meat is edible and restores 24 food',eaten.slot>=0&&eaten.eaten&&eaten.hunger===54);
 pass('Browser has no application or WebGL errors',errors.length===0);
}finally{await browser.close();}
