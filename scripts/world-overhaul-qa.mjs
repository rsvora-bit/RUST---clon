import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=process.env.TIDELAND_QA_URL||'http://localhost:5173';
const out=process.env.TIDELAND_QA_DIR||'test-results/world-overhaul';fs.mkdirSync(out,{recursive:true});
const executablePath=process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const pass=(label,value)=>{assert.ok(value,label);results.push(label);console.log('PASS',label)};
const wait=async(fn,arg,ms=150000)=>{await page.waitForFunction(fn,arg,{timeout:ms})};
const shot=async name=>{await page.waitForTimeout(500);await page.screenshot({path:`${out}/${name}.png`,timeout:60000})};
const boot=async()=>{await page.goto(base);await page.evaluate(()=>localStorage.clear());await page.reload();await wait(()=>!!window.__TIDELAND);await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000})};
const continueGame=async()=>{await page.locator('[data-action="continue"]').click();await wait(()=>window.__TIDELAND.getScreen()==='playing')};

try{
  await boot();pass('v0.9.0 build is visible',/v0\.9\.0|EA-09\.0/.test(await page.locator('.menu-footer').innerText()));
  await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await wait(()=>window.__TIDELAND.getScreen()==='playing');
  const world=await page.evaluate(()=>window.__TIDELAND.world());
  pass('New game uses generation 5',world.generation===5);pass('Generation 5 uses 1280m / 384 terrain',world.size===1280&&world.resolution===384);
  pass('Archipelago has deterministic satellite islands',world.satellites.length>=3&&world.satellites.length<=7);pass('World POIs and roads are generated',world.pois.length>=3&&world.trails.length===world.pois.length&&world.trails.every(r=>r.length>20));
  pass('Starter area has resources',await page.evaluate(()=>window.__TIDELAND.nodes().filter(n=>Math.hypot(n.position.x-window.__TIDELAND.world().spawn.x,n.position.z-window.__TIDELAND.world().spawn.z)<30).length>=5));await shot('01-starter-shore');

  await page.keyboard.press('KeyM');await page.locator('.world-map').waitFor({state:'visible'});pass('Topographic map opens as modal UI',await page.locator('.world-map canvas').isVisible());
  pass('Map uses high-resolution cached canvas',await page.locator('.world-map canvas').evaluate(c=>c.width===768&&c.height===768));await shot('02-topographic-map');
  const box=await page.locator('.world-map canvas').boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width*.65,box.y+box.height*.44);pass('Map click creates a bounded waypoint',await page.evaluate(()=>{const w=window.__TIDELAND.snapshot().progression.waypoint;return !!w&&Math.abs(w.x)<=640&&Math.abs(w.z)<=640}));
  await page.mouse.wheel(0,-600);pass('Map wheel zoom remains responsive',await page.locator('.world-map').evaluate(root=>!root.hidden));await shot('03-map-zoom');await page.keyboard.press('KeyM');await wait(()=>window.__TIDELAND.getScreen()==='playing');

  const roadSelection=await page.evaluate(trails=>{const a=window.__TIDELAND;for(const road of trails)for(let i=5;i<road.length-6;i++){const p=road[i],h=a.height(p.x,p.z),s=Math.hypot(a.height(p.x+2,p.z)-a.height(p.x-2,p.z),a.height(p.x,p.z+2)-a.height(p.x,p.z-2))/4;if(h>4&&s<.3&&a.biome(p.x,p.z)!=='COAST')return {p,ahead:road[i+5]};}return {p:trails[0][5],ahead:trails[0][10]};},world.trails),roadPoint=roadSelection.p,roadAhead=roadSelection.ahead;pass('Road samples follow generated terrain',Math.abs(roadPoint.y-(await page.evaluate(p=>window.__TIDELAND.height(p.x,p.z),roadPoint))-.08)<.2);await page.evaluate(({p,ahead})=>{const api=window.__TIDELAND;api.teleport({x:p.x,y:p.y+.15,z:p.z});api.lookAt({x:ahead.x,y:ahead.y+.35,z:ahead.z});},{p:roadPoint,ahead:roadAhead});await shot('04-terrain-road');

  const biomePoints=await page.evaluate(()=>{const a=window.__TIDELAND,out={};for(let z=-500;z<=500;z+=25)for(let x=-500;x<=500;x+=25){const h=a.height(x,z),b=a.biome(x,z);if(h>3&&!out[b])out[b]={x,y:h+.15,z};}return out});
  for(const biome of ['TEMPERATE FOREST','ARID','SNOW / ALPINE','ROCKY MOUNTAIN'])pass(`${biome} region exists`,!!biomePoints[biome]);
  for(const [name,biome] of [['05-temperate-forest','TEMPERATE FOREST'],['06-arid-region','ARID'],['07-alpine-region','SNOW / ALPINE']]){const p=biomePoints[biome];await page.evaluate(p=>{const a=window.__TIDELAND;a.teleport(p);a.lookAt({x:p.x+35,y:p.y+3,z:p.z-18});},p);await page.waitForTimeout(450);await shot(name);}

  await page.evaluate(()=>{const a=window.__TIDELAND,p=a.world().spawn;a.teleport(p);a.command('weather storm')});await wait(()=>window.__TIDELAND.snapshot().progression.weather.blend>.55);pass('Storm transition reaches sky/ocean/fog atmosphere',await page.evaluate(()=>window.__TIDELAND.snapshot().progression.weather.kind==='storm'));await shot('08-storm-atmosphere');await page.evaluate(()=>window.__TIDELAND.command('weather clear'));await wait(()=>window.__TIDELAND.snapshot().progression.weather.blend<.25);await shot('09-clear-horizon');

  await page.evaluate(()=>{const a=window.__TIDELAND,p=a.world().spawn;a.teleport(p);a.dev('heal');a.fallFrom(3)});await wait(()=>window.__TIDELAND.stats().lastLandingSpeed>0);pass('Small controlled fall causes no damage',await page.evaluate(()=>window.__TIDELAND.stats().lastFallDamage===0&&window.__TIDELAND.snapshot().player.stats.health===100));
  await page.evaluate(()=>window.__TIDELAND.fallFrom(13));await wait(()=>window.__TIDELAND.stats().lastFallDamage>0);const landing=await page.evaluate(()=>({stats:window.__TIDELAND.stats(),health:window.__TIDELAND.snapshot().player.stats.health}));pass('Severe controlled fall causes scaled damage',landing.stats.lastLandingSpeed>14&&landing.stats.lastFallDamage>0&&landing.health<100);
  await page.evaluate(()=>{window.__TIDELAND.dev('heal');window.__TIDELAND.dev('god');window.__TIDELAND.fallFrom(13)});await wait(()=>window.__TIDELAND.physics().grounded);pass('God Mode prevents landing damage',await page.evaluate(()=>window.__TIDELAND.snapshot().player.stats.health===100));await page.evaluate(()=>window.__TIDELAND.dev('god'));

  const stable=await page.evaluate(()=>{const a=window.__TIDELAND,w=a.world();return {seed:a.snapshot().seed,spawn:w.spawn,pois:w.pois,trails:w.trails,nodes:a.nodes().slice(0,40).map(n=>({id:n.id,kind:n.kind,position:n.position}))}});await page.evaluate(()=>window.__TIDELAND.save());await page.reload();await wait(()=>!!window.__TIDELAND);await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});await continueGame();const restored=await page.evaluate(()=>{const a=window.__TIDELAND,w=a.world();return {generation:w.generation,seed:a.snapshot().seed,spawn:w.spawn,pois:w.pois,trails:w.trails,nodes:a.nodes().slice(0,40).map(n=>({id:n.id,kind:n.kind,position:n.position}))}});pass('Generation 5 save/reload preserves seed, spawn, POIs, roads and resource IDs',restored.generation===5&&JSON.stringify({...restored,generation:undefined})===JSON.stringify({...stable,generation:undefined}));

  await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim();g.state.worldGeneration=4;g.state.player.position={x:0,y:55,z:0};delete g.state.progression.waypoint;a.save()});await page.reload();await wait(()=>!!window.__TIDELAND);await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});await continueGame();const legacy=await page.evaluate(()=>window.__TIDELAND.world());pass('Generation 4 save reloads without world reset',legacy.generation===4&&legacy.size===720&&legacy.resolution===240);await page.evaluate(p=>window.__TIDELAND.teleport(p),legacy.spawn);await wait(()=>window.__TIDELAND.physics().grounded);await shot('10-legacy-generation-4');
  pass('No application console errors',errors.length===0);fs.writeFileSync(`${out}/results.json`,JSON.stringify({passed:true,results,errors,landing},null,2));
}catch(error){console.error('FAIL',error.message);fs.writeFileSync(`${out}/results.json`,JSON.stringify({passed:false,results,errors,error:error.message},null,2));process.exitCode=1}finally{await browser.close()}
