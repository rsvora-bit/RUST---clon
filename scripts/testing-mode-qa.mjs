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
  await page.keyboard.press('F3');
  const groups=await page.locator('.testing-control-group').evaluateAll(nodes=>nodes.map(node=>({id:node.getAttribute('data-testing-group'),title:node.querySelector('h4')?.textContent,actions:[...node.querySelectorAll('[data-test-action]')].map(button=>button.getAttribute('data-test-action'))})));
  check('F3 test controls are organized into readable developer groups',groups.map(group=>group.id).join(',')==='items,player,building,world'&&groups[0].title==='INVENTORY / PROGRESSION'&&groups[1].actions.includes('health')&&groups[2].actions.includes('build-toggle')&&groups[3].actions.includes('teleport'));
  await page.locator('[data-action="launchTestWorld"]').click();
  await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing'&&document.querySelector('[data-dev="testing"]')?.getAttribute('aria-pressed')==='true',{timeout:180000});
  if(await page.locator('.diagnostics').isHidden())await page.keyboard.press('F3');
  await page.mouse.move(1,1);
  await page.waitForFunction(()=>document.querySelector('[data-telemetry-body="world"]')?.textContent?.includes('WORLD ASSET LOD'),{timeout:15000});
  const assetLod=await page.locator('[data-telemetry-body="world"]').innerText();check('F3 world telemetry identifies active tree, rock, shoreline LOD and nearest asset ID',/TREES LOD[012]/.test(assetLod)&&/ROCKS LOD[012]/.test(assetLod)&&/SHORE LOD[012]/.test(assetLod)&&/NEARBY ASSET [\w_-]+ \([\d]+m\)/.test(assetLod));
  await clickControl('[data-dev="collisions"]');await page.waitForFunction(()=>window.__TIDELAND.debugForTest().collisions);check('F3 renders the live Rapier collider wireframe',await page.evaluate(()=>window.__TIDELAND.debugForTest().collisions));await clickControl('[data-dev="collisions"]');
  await clickControl('[data-dev="worldBounds"]');await page.waitForFunction(()=>window.__TIDELAND.debugForTest().worldBounds);const proxyDebug=await page.evaluate(()=>window.__TIDELAND.debugForTest());check('F3 renders tree, rock, landmark, station and building proxy bounds',proxyDebug.worldBounds&&proxyDebug.worldBoundsBoxCount>proxyDebug.environmentColliderCount);await clickControl('[data-dev="worldBounds"]');
  await clickControl('[data-dev="grounding"]');await page.waitForFunction(()=>window.__TIDELAND.debugForTest().grounding);check('F3 exposes a working terrain grounding overlay',await page.evaluate(()=>window.__TIDELAND.debugForTest().grounding));await clickControl('[data-dev="grounding"]');check('terrain grounding overlay can be disabled after inspection',await page.locator('[data-dev="grounding"]').getAttribute('aria-pressed')==='false');
  check('isolated test world starts with save lock',await page.locator('[data-testing-status]').innerText()==='SAVES LOCKED');
  check('real item catalog and current POI list populate',await page.locator('[data-test-item] option').count()>40&&await page.locator('[data-test-poi] option').count()>=5);
  check('Testing Mode exposes representative tree, rock and shipwreck targets',await page.locator('[data-test-poi] option[value="asset:tree"]').count()===1&&await page.locator('[data-test-poi] option[value="asset:rock"]').count()===1&&await page.locator('[data-test-poi] option[value="asset:shipwreck"]').count()===1);
  for(const [asset,target] of [['tree',()=>page.evaluate(()=>window.__TIDELAND.nodes().find(node=>node.kind==='tree')?.position)],['rock',()=>page.evaluate(()=>window.__TIDELAND.worldArt().outcropInstances[0]?.position)],['shipwreck',()=>page.evaluate(()=>window.__TIDELAND.landmarks().find(poi=>poi.kind===5)?.position)]]){
    const position=await target();assert.ok(position,`${asset} sample exists`);await page.locator('[data-test-poi]').selectOption(`asset:${asset}`);await clickControl('[data-test-action="teleport"]');
    const player=await page.evaluate(()=>window.__TIDELAND.sim().state.player.position),distance=Math.hypot(player.x-position.x,player.z-position.z);
    const maxDistance=asset==='shipwreck'?9.5:7.5;
    check(`asset teleport places the player beside the representative ${asset}`,distance>2.5&&distance<maxDistance&&Math.abs(player.y)<100);
  }
  await page.locator('[data-test-item]').selectOption('fieldShotgun');await clickControl('[data-test-action="weapon-kit"]');
  const weaponState=await page.evaluate(()=>({slot:window.__TIDELAND.sim().state.inventory[0],ammo:window.__TIDELAND.sim().count('shotgunShells')}));check('weapon kit equips real shotgun and supplies ammunition',weaponState.slot?.itemId==='fieldShotgun'&&weaponState.ammo>=32);
  await clickControl('[data-test-action="unlock"]');check('all current research unlocks in test state',await page.evaluate(()=>window.__TIDELAND.sim().state.progression.tech.unlocked.length===10));
  const stationsBefore=await page.evaluate(()=>window.__TIDELAND.sim().state.progression.stations.length);await page.locator('[data-test-station]').selectOption('storage');await clickControl('[data-test-action="station"]');
  check('real storage station spawns through gameplay station renderer',await page.evaluate(n=>window.__TIDELAND.sim().state.progression.stations.length===n+1,stationsBefore));
  await page.locator('[data-test-weather]').selectOption('storm');await clickControl('[data-test-action="weather"]');check('storm preset changes real weather state',await page.evaluate(()=>window.__TIDELAND.sim().state.progression.weather.kind==='storm'));await page.waitForFunction(()=>{const pill=document.querySelector('.status-pill.wet');return pill&&!pill.hidden&&Number(pill.querySelector('.status-value')?.textContent?.replace('%',''))>20;},{timeout:15000});check('rain exposure intensity appears in the live survival HUD',true);
  const toxicPoi=await page.evaluate(()=>window.__TIDELAND.landmarks().find(poi=>poi.kind===1)?.id??null);check('existing contaminated POI is available for hazard QA',Boolean(toxicPoi));if(toxicPoi){await page.locator('[data-test-poi]').selectOption(toxicPoi);await clickControl('[data-test-action="teleport"]');await page.waitForFunction(()=>{const pill=document.querySelector('.status-pill.toxic');return pill&&!pill.hidden;},{timeout:5000});check('toxic relay exposure appears in the live survival HUD',true);}
  const saveResult=await page.evaluate(()=>window.__TIDELAND.save()),savesAfter=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())));
  check('save attempt is rejected and existing browser saves stay byte-for-byte unchanged',saveResult===false&&savesAfter===savesBefore);
  await clickControl('[data-dev="testing"]');check('disabling mode keeps session save lock',await page.locator('[data-testing-status]').innerText()==='SAVES LOCKED'&&await page.evaluate(()=>window.__TIDELAND.save())===false);
  assert.equal(errors.length,0,`browser console/page errors:\n${errors.join('\n')}`);console.log('PASS no browser console or page errors');
} catch(error){console.error('BROWSER QA ERRORS',errors);throw error;} finally {await browser.close();}
