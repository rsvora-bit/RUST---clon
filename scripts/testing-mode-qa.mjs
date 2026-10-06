import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const url=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';
const executablePath=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.setDefaultTimeout(45000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const check=(name,value)=>{assert.ok(value,name);console.log('PASS',name);};
const clickControl=async selector=>{const result=await page.evaluate(selector=>{const element=document.querySelector(selector);if(!(element instanceof HTMLElement))return {hit:false,top:'missing'};element.scrollIntoView({block:'center',inline:'nearest'});const rect=element.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,top=document.elementFromPoint(x,y);return top===element?{hit:true,x,y}:{hit:false,top:top?.outerHTML.slice(0,140)??'outside viewport'};},selector);assert.ok(result.hit,`${selector} is not the top hit target after scrolling: ${result.top}`);await page.mouse.click(result.x,result.y);};
try{
  await page.goto(url);await page.waitForFunction(()=>window.__TIDELAND,{timeout:180000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000});
  const savesBefore=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())));
  await page.keyboard.press('F3');await page.locator('[data-action="launchTestWorld"]').click();
  await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing'&&document.querySelector('[data-dev="testing"]')?.getAttribute('aria-pressed')==='true',{timeout:180000});
  check('isolated test world starts with save lock',await page.locator('[data-testing-status]').innerText()==='SAVES LOCKED');
  check('real item catalog and current POI list populate',await page.locator('[data-test-item] option').count()>40&&await page.locator('[data-test-poi] option').count()>=5);
  await page.locator('[data-test-item]').selectOption('fieldShotgun');await clickControl('[data-test-action="weapon-kit"]');
  const weaponState=await page.evaluate(()=>({slot:window.__TIDELAND.sim().state.inventory[0],ammo:window.__TIDELAND.sim().count('shotgunShells')}));check('weapon kit equips real shotgun and supplies ammunition',weaponState.slot?.itemId==='fieldShotgun'&&weaponState.ammo>=32);
  await clickControl('[data-test-action="unlock"]');check('all current research unlocks in test state',await page.evaluate(()=>window.__TIDELAND.sim().state.progression.tech.unlocked.length===10));
  const stationsBefore=await page.evaluate(()=>window.__TIDELAND.sim().state.progression.stations.length);await page.locator('[data-test-station]').selectOption('storage');await clickControl('[data-test-action="station"]');
  check('real storage station spawns through gameplay station renderer',await page.evaluate(n=>window.__TIDELAND.sim().state.progression.stations.length===n+1,stationsBefore));
  await page.locator('[data-test-weather]').selectOption('storm');await clickControl('[data-test-action="weather"]');check('storm preset changes real weather state',await page.evaluate(()=>window.__TIDELAND.sim().state.progression.weather.kind==='storm'));
  const saveResult=await page.evaluate(()=>window.__TIDELAND.save()),savesAfter=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())));
  check('save attempt is rejected and existing browser saves stay byte-for-byte unchanged',saveResult===false&&savesAfter===savesBefore);
  await clickControl('[data-dev="testing"]');check('disabling mode keeps session save lock',await page.locator('[data-testing-status]').innerText()==='SAVES LOCKED'&&await page.evaluate(()=>window.__TIDELAND.save())===false);
  assert.equal(errors.length,0,`browser console/page errors:\n${errors.join('\n')}`);console.log('PASS no browser console or page errors');
} finally {await browser.close();}
