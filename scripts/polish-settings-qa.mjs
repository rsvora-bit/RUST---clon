import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const outputDir=process.env.TIDELAND_QA_DIR||'artifacts/polish';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__TIDELAND);await page.getByRole('button',{name:'03 SETTINGS'}).click();
 const expected={fov:90,sensitivity:1.4,masterVolume:.35,effectsVolume:.45};
 for(const [name,value]of Object.entries(expected))await page.locator(`[data-setting="${name}"]`).evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}))},value);
 await page.getByRole('button',{name:'MEDIUM',exact:true}).click();await page.reload();await page.waitForFunction(()=>window.__TIDELAND);await page.getByRole('button',{name:'03 SETTINGS'}).click();
 for(const [name,value]of Object.entries(expected))assert.equal(Number(await page.locator(`[data-setting="${name}"]`).inputValue()),value);
 assert.ok(await page.getByRole('button',{name:'MEDIUM',exact:true}).evaluate(e=>e.classList.contains('active')));
 await page.getByRole('button',{name:'HIGH',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'01 NEW GAME'}).click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');await page.waitForTimeout(500);
 await page.keyboard.press('Digit2');
 const scene=await page.evaluate(()=>{const a=window.__TIDELAND,trees=a.nodes().filter(n=>n.kind==='tree');let best=trees[0],density=0;for(const n of trees){const count=trees.filter(m=>Math.hypot(m.position.x-n.position.x,m.position.z-n.position.z)<32).length;if(count>density){best=n;density=count}}const p={x:best.position.x+4,y:a.height(best.position.x+4,best.position.z+6)+.2,z:best.position.z+6};a.teleport(p);a.lookAt({x:best.position.x-8,y:p.y+1.5,z:best.position.z-18});a.dev('time',16);return {position:p,nearbyTrees:density}});
 await page.waitForTimeout(1800);await page.screenshot({path:`${outputDir}/dense-forest.png`});const stats=await page.evaluate(()=>window.__TIDELAND.stats());
 // Browser UI must report capacity blocking even with sufficient ingredients.
 await page.evaluate(()=>{const g=window.__TIDELAND.sim();g.state.inventory=Array.from({length:30},()=>({itemId:'wood',count:1000}));g.state.inventory[0]={itemId:'stone',count:1000};g.state.inventory[1]={itemId:'fiber',count:1000};});await page.keyboard.press('Tab');await page.waitForTimeout(200);await page.locator('[data-recipe="hatchet"]:visible').click();const craft=page.locator('[data-action="craft"]:visible');assert.ok(await craft.isDisabled());assert.match(await craft.textContent(),/MAKE ROOM/);
 assert.deepEqual(errors,[]);fs.writeFileSync(`${outputDir}/settings-profile.json`,JSON.stringify({settingsPersisted:expected,presetPersisted:'medium',fullInventoryButtonVerified:true,scene,stats,errors},null,2));console.log({settings:'PASS',capacityButton:'PASS',scene,stats});
}finally{await browser.close()}
