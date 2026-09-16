import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out=process.env.TIDELAND_QA_DIR||'test-results/world-art',base=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';fs.mkdirSync(out,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(`${out}/v090-save.json`,'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
let page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const pass=(name,ok)=>{assert.ok(ok,name);results.push(name);console.log('PASS',name)};
const boot=async()=>{await page.waitForFunction(()=>window.__TIDELAND,null,{timeout:180000});await page.locator('.loading-screen').waitFor({state:'hidden',timeout:180000})};
const play=async()=>{await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing',null,{timeout:180000})};
const shot=async(name,p,target)=>{await page.evaluate(({p,target})=>{const a=window.__TIDELAND;a.teleport(p);a.lookAt(target||{x:p.x+45,y:p.y+3,z:p.z-40});},{p,target});await page.waitForTimeout(600);await page.screenshot({path:`${out}/${name}.png`,timeout:60000})};
try{
 await page.goto(base);await boot();
 await page.evaluate(storage=>{localStorage.clear();for(const [key,value] of Object.entries(storage))localStorage.setItem(key.replace('tideland-archive:v0.9.0:',''),value);},fixture.storage);await page.reload();await boot();await play();
 const restored=await page.evaluate(()=>{const a=window.__TIDELAND;a.setCapturePaused(true);return {state:a.snapshot(),world:a.world(),nodes:a.nodes()}});
 pass('Real archived v0.9.0 gen5 save loads with revision 1',restored.state.worldGeneration===5&&restored.world.revision===1&&restored.state.worldRevision===undefined);
 pass('All archived resource IDs and positions remain identical',JSON.stringify(restored.nodes)===JSON.stringify(fixture.nodes));
 pass('Archived POIs and roads remain identical',JSON.stringify(restored.world.pois)===JSON.stringify(fixture.world.pois)&&JSON.stringify(restored.world.trails)===JSON.stringify(fixture.world.trails));
 for(const key of ['inventory','structures','nodeChanges','drops','craftQueue'])pass(`Archived ${key} retained`,JSON.stringify(restored.state[key])===JSON.stringify(fixture.state[key]));
 pass('Archived stations and Tech Tree retained',JSON.stringify(restored.state.progression.stations)===JSON.stringify(fixture.state.progression.stations)&&JSON.stringify(restored.state.progression.tech)===JSON.stringify(fixture.state.progression.tech));
 pass('Archived player position not reset',Math.hypot(restored.state.player.position.x-fixture.state.player.position.x,restored.state.player.position.z-fixture.state.player.position.z)<.05);
 pass('Archived building has collider after load',await page.evaluate(id=>window.__TIDELAND.hasStructureCollider(id),fixture.built.id));
 await shot('legacy-v090-save',restored.world.spawn);
 // New revision is explicit, never assigned on loading an old snapshot.
 await page.close();page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto(base);await boot();await page.locator('#world-seed').fill('731942');await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing',null,{timeout:180000});
 const world=await page.evaluate(()=>{const a=window.__TIDELAND;a.setCapturePaused(true);a.dev('god');a.dev('fly');a.dev('time',10);return a.world()});
 pass('New gen5 world explicitly uses revision 2',world.revision===2&&(await page.evaluate(()=>window.__TIDELAND.snapshot().worldRevision))===2);
 const art=await page.evaluate(()=>window.__TIDELAND.worldArt());pass('Three cheap nonphysical horizon layers exist',art.horizonLayers===3&&art.horizonTriangles===1344);
 const palms=art.trees.filter(t=>t.species===5);pass('Palm canopies have climate-correct placement',palms.length>0&&palms.every(t=>t.climate.temperature>.53&&t.position.y<26));
 const roads=world.trails.flat();pass('No routed road sample is deep underwater',await page.evaluate(points=>points.every(p=>window.__TIDELAND.height(p.x,p.z)>=1.15),roads));
 pass('Trees leave road corridor clear',art.trees.every(t=>roads.every(p=>Math.hypot(t.position.x-p.x,t.position.z-p.z)>4.4)));
 const road=world.trails[0],mid=Math.floor(road.length*.45);await shot('road-new',road[mid],{...road[Math.min(road.length-1,mid+15)],y:road[Math.min(road.length-1,mid+15)].y+1});
 await shot('palm-warm-coast',{x:palms[0].position.x+7,y:palms[0].position.y+1,z:palms[0].position.z+8},{...palms[0].position,y:palms[0].position.y+6});
 const views=await page.evaluate(()=>{const a=window.__TIDELAND,out={};for(let z=-480;z<=480;z+=20)for(let x=-480;x<=480;x+=20){const h=a.height(x,z),b=a.biome(x,z);if(h>3&&!out[b])out[b]={x,y:h+3,z};}return out});
 for(const biome of ['TEMPERATE FOREST','TEMPERATE GRASSLAND','ARID','SNOW / ALPINE','ROCKY MOUNTAIN'])await shot(`biome-${biome.replaceAll(/[^A-Z]/g,'-')}`,views[biome]);
 for(const [name,hour,weather] of [['horizon-day',10,'clear'],['horizon-evening',18,'clear'],['horizon-night',0,'clear'],['horizon-storm',10,'storm']]){await page.evaluate(({hour,weather})=>{const a=window.__TIDELAND;a.dev('time',hour);const w=a.sim().state.progression.weather;Object.assign(w,{kind:weather,remaining:3600,blend:weather==='storm'?1:0,storm:weather==='storm'?1:0,rain:weather==='storm'?1:0,mist:0})},{hour,weather});await shot(name,{x:world.spawn.x,y:10,z:world.spawn.z},{x:world.spawn.x-150,y:20,z:world.spawn.z+130});}
 // Fast camera sweep uses the actual render loop and covers both sides of foliage.
 for(let i=0;i<16;i++){await page.evaluate(({p,i})=>window.__TIDELAND.lookAt({x:p.x+Math.cos(i/16*Math.PI*2)*80,y:p.y+6,z:p.z+Math.sin(i/16*Math.PI*2)*80}),{p:palms[0].position,i});await page.waitForTimeout(80)}
 pass('Camera sweep produces no WebGL/application errors',errors.length===0);
 await page.evaluate(()=>window.__TIDELAND.save());const stable=await page.evaluate(()=>window.__TIDELAND.world());await page.reload();await boot();await play();const reload=await page.evaluate(()=>window.__TIDELAND.world());pass('Revision 2 save/reload keeps roads, POIs and node count',JSON.stringify(stable)===JSON.stringify(reload));
 fs.writeFileSync(`${out}/world-art-results.json`,JSON.stringify({passed:true,results,errors,palms:palms.length},null,2));
}catch(e){fs.writeFileSync(`${out}/world-art-results.json`,JSON.stringify({passed:false,results,errors,error:e.message},null,2));throw e}finally{await browser.close()}
