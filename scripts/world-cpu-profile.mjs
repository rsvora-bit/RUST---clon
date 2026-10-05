import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Local, opt-in diagnostics. Method wrappers exist only inside this QA browser.
const out=process.env.TIDELAND_QA_DIR||'test-results/world-cpu-profile';
const seed=Number(process.env.TIDELAND_QA_SEED||731942);
const preset=process.env.TIDELAND_QA_PRESET||'high';
const duration=Number(process.env.TIDELAND_QA_PROFILE_MS||6000);
const captureScreenshots=process.env.TIDELAND_QA_SCREENSHOTS!=='0';
const bootTimeout=Number(process.env.TIDELAND_QA_BOOT_MS||180000);
const width=Number(process.env.TIDELAND_QA_WIDTH||1280),height=Number(process.env.TIDELAND_QA_HEIGHT||720);
// Match the complete UI profiles; a quality label alone leaves HIGH shadows on.
const profiles={
  low:{renderScale:.7,shadows:false,shadowQuality:'low',shadowDistance:45,foliageDensity:.38,postProcessing:false,ambientOcclusion:false,bloom:false,motionBlur:false},
  medium:{renderScale:.85,shadows:true,shadowQuality:'low',shadowDistance:58,foliageDensity:.55,postProcessing:false,ambientOcclusion:false,bloom:false,motionBlur:false},
  high:{renderScale:1,shadows:true,shadowQuality:'medium',shadowDistance:72,foliageDensity:.72,postProcessing:true,ambientOcclusion:true,bloom:true,motionBlur:false},
  ultra:{renderScale:1,shadows:true,shadowQuality:'high',shadowDistance:92,foliageDensity:.88,postProcessing:true,ambientOcclusion:true,bloom:true,motionBlur:true},
};
assert.ok(Object.hasOwn(profiles,preset),'Unknown graphics preset');
const renderScale=Number(process.env.TIDELAND_QA_RENDER_SCALE||profiles[preset].renderScale);
assert.ok(Number.isFinite(seed)&&Number.isFinite(duration)&&duration>=1000&&duration<=60000);
assert.ok(Number.isFinite(renderScale)&&renderScale>=.5&&renderScale<=1.5);
assert.ok(Number.isFinite(bootTimeout)&&bootTimeout>=30000&&bootTimeout<=900000);
assert.ok(Number.isInteger(width)&&width>=320&&width<=3840&&Number.isInteger(height)&&height>=180&&height<=2160);
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:[
  '--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`,'--enable-unsafe-swiftshader',
]});
const report={seed,preset,duration,renderScale,viewport:{width,height},bootTimeout,errors:[],samples:[]};
let page;
try {
  page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(settings=>localStorage.setItem('tideland:settings:v1',JSON.stringify(settings)),{quality:preset,...profiles[preset],renderScale});
  console.log('BOOT',JSON.stringify({seed,preset,renderScale}));
  await page.goto(process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173');
  await page.waitForFunction(()=>!!window.__TIDELAND,null,{timeout:bootTimeout});
  await page.locator('.loading-screen').waitFor({state:'hidden',timeout:bootTimeout});
  console.log('MENU READY');
  await page.locator('#world-seed').fill(String(seed));
  await page.locator('[data-action="new"]').click();
  await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',null,{timeout:bootTimeout});
  console.log('PLAYING');
  await page.evaluate(()=>window.__TIDELAND.setCapturePaused(true));
  const target=await page.evaluate(()=>{
    const a=window.__TIDELAND,p=a.world().spawn;
    const node=a.nodes().filter(n=>n.remaining>0&&n.kind==='tree').sort((a,b)=>(a.position.x-p.x)**2+(a.position.z-p.z)**2-((b.position.x-p.x)**2+(b.position.z-p.z)**2))[0];
    if(!node)throw Error('No live tree for interaction QA');
    const n=node.position;a.teleport({x:n.x+1.5,y:n.y+.1,z:n.z+1.5});a.lookAt({x:n.x,y:n.y+1.2,z:n.z});return node;
  });
  await page.waitForFunction(()=>!!window.__TIDELAND.interaction(),null,{timeout:60000});
  report.interaction={nodeId:target.id,info:await page.evaluate(()=>window.__TIDELAND.interaction())};
  assert.equal(report.interaction.info.title,'Tree');
  if(captureScreenshots)await page.screenshot({path:`${out}/interaction-target.png`,timeout:60000});
  await page.evaluate(()=>{const a=window.__TIDELAND,p=a.cameraState().world.position;a.lookAt({x:p[0]+100,y:p[1]+100,z:p[2]+100});});
  await page.waitForFunction(()=>window.__TIDELAND.interaction()===null,null,{timeout:60000});
  report.interaction.clearedWhenLookingAway=true;
  report.browser=browser.version();
  report.renderer=await page.evaluate(()=>{
    const gl=document.querySelector('canvas')?.getContext('webgl2');
    const ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
  });
  await page.evaluate(()=>{
    const a=window.__TIDELAND,p=a.world().spawn;a.dev('god');a.dev('day');a.teleport(p);a.lookAt({x:p.x+80,y:p.y+4,z:p.z-80});
  });
  // Use a dev server for named TS modules and useful Chrome CPU source locations.
  await page.evaluate(async()=>{
    const entries=[
      ['/src/rendering/environment.ts','Environment','update'],
      ['/src/world/atmosphere.ts','Atmosphere','update'],
      ['/src/survival/Weather.ts','Weather','update'],
      ['/src/survival/StationRenderer.ts','StationRenderer','update'],
      ['/src/entities/InteractionSystem.ts','InteractionSystem','update'],
      ['/src/rendering/WorldPostFX.ts','WorldPostFX','render'],
      ['/src/combat/wildlife.ts','WildlifeSystem','update'],
    ];
    window.__CPU_TIMINGS={};
    for(const [path,name,method] of entries){
      const urls=[...new Set(performance.getEntriesByType('resource').map(entry=>entry.name).filter(url=>new URL(url).pathname===path))];
      if(urls.length!==1)throw Error(`Expected one loaded module for ${path}; found ${urls.length}`);
      const type=(await import(urls[0]))[name],original=type.prototype[method],key=`${name}.${method}`;
      assertMethod(original,key);
      type.prototype[method]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{
        const row=window.__CPU_TIMINGS[key]??={calls:0,totalMs:0,maxMs:0};const ms=performance.now()-start;row.calls++;row.totalMs+=ms;row.maxMs=Math.max(row.maxMs,ms);
      }};
    }
    function assertMethod(value,key){if(typeof value!=='function')throw Error(`Missing QA method ${key}`);}
  });
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval',{interval:1000});
  for(const paused of [true,false,true]){
    const label=`${paused?'paused':'live'}-${report.samples.length+1}`;
    await page.evaluate(paused=>{window.__TIDELAND.setCapturePaused(paused);window.__CPU_TIMINGS={};},paused);
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{window.__CPU_TIMINGS={};});
    await cdp.send('Profiler.start');
    await page.waitForTimeout(duration);
    const {profile}=await cdp.send('Profiler.stop');
    fs.writeFileSync(`${out}/${label}.cpuprofile`,JSON.stringify(profile));
    const sample=await page.evaluate(()=>({stats:window.__TIDELAND.stats(),settings:window.__TIDELAND.cameraState().settings,world:window.__TIDELAND.world(),timings:window.__CPU_TIMINGS}));
    sample.label=label;sample.measuredDurationMs=(profile.endTime-profile.startTime)/1000;
    report.samples.push(sample);
    assert.ok(sample.timings['InteractionSystem.update']?.calls>0,'No interaction updates sampled');
    assert.equal(sample.world.revision,6,'Expected the current Rev6 world');
    sample.timings=Object.fromEntries(Object.entries(sample.timings).map(([key,row])=>[key,{...row,meanMs:row.totalMs/row.calls}]));
    sample.hotspots=profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,20).map(n=>({function:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,hits:n.hitCount}));
    if(captureScreenshots)await page.screenshot({path:`${out}/${label}.png`,timeout:60000});
    console.log(JSON.stringify({label,renderer:report.renderer,stats:sample.stats,timings:sample.timings,hotspots:sample.hotspots},null,2));
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  report.passed=true;
} catch(error){
  report.passed=false;report.error=error.message;
  if(page){report.boot=await page.evaluate(()=>({loading:document.querySelector('.loading-screen')?.innerText,screen:window.__TIDELAND?.getScreen?.()})).catch(()=>null);if(captureScreenshots)await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});}
  throw error;
}
finally {fs.writeFileSync(`${out}/profile.json`,JSON.stringify(report,null,2));await browser.close();}
