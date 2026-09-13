import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// Identical seed, viewport and viewpoints for before/after captures. Outputs stay untracked.
const label=process.env.TIDELAND_QA_LABEL||'after';
const output=process.env.TIDELAND_QA_DIR||`.npm-cache/graphics-v080/${label}`;
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-gl=angle','--use-angle=metal']});
const errors=[],warnings=[],samples=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  await page.goto(process.env.TIDELAND_URL||'http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__TIDELAND,{},{timeout:90000});
  await page.locator('[data-action="new"]').click();
  await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',{},{timeout:90000});
  await page.evaluate(()=>{window.__TIDELAND.setCapturePaused(true);});
  const views=await page.evaluate(()=>{
    const a=window.__TIDELAND,trees=a.nodes().filter(n=>n.kind==='tree');
    const dense=trees.reduce((best,t)=>{const count=trees.filter(n=>Math.hypot(t.position.x-n.position.x,t.position.z-n.position.z)<23).length;return count>best.count?{count,x:t.position.x,z:t.position.z}:best;},{count:0,x:0,z:0});
    const coast=(x,target)=>{let best=220,error=Infinity;for(let z=220;z<295;z+=.5){const e=Math.abs(a.height(x,z)-target);if(e<error){error=e;best=z;}}return best;};
    const beachZ=coast(30,1.8),shoreZ=coast(58,.8);
    return [{name:'field',x:28,z:212,tx:28,tz:155},{name:'grassland',x:-54,z:102,tx:-80,tz:75},{name:'beach',x:30,z:beachZ,tx:20,tz:beachZ+35},{name:'forest-edge',x:9,z:204,tx:6,tz:190},{name:'dense-forest',x:dense.x+3,z:dense.z+5,tx:dense.x,tz:dense.z-20},{name:'rocky',x:66,z:190,tx:68,tz:180},{name:'shoreline',x:58,z:shoreZ,tx:5,tz:shoreZ+4},{name:'horizon',x:28,z:212,tx:-35,tz:30}];
  });
  const setPreset=async preset=>{
    await page.keyboard.press('Escape');
    await page.locator('.pause-screen [data-action="settings"]').click();
    await page.locator('[data-settings-tab="graphics"]').click();
    await page.locator(`[data-preset="${preset}"]`).click();
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  };
  const capture=async(view,preset='high',time=10,weather='clear',suffix='')=>{
    await page.evaluate(({view,time,weather})=>{const a=window.__TIDELAND;a.dev('time',time);const w=a.sim().state.progression.weather;Object.assign(w,{kind:weather,remaining:3600,blend:weather==='clear'?0:1,rain:weather==='rain'||weather==='storm'?1:0,mist:weather==='fog'?1:0,storm:weather==='storm'?1:0});a.teleport({x:view.x,y:a.height(view.x,view.z)+.15,z:view.z});a.lookAt({x:view.tx,y:a.height(view.x,view.z)+1.5,z:view.tz});},{view,time,weather});
    await page.waitForTimeout(2200);
    const frames=await page.evaluate(async()=>{const out=[];for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);out.push(window.__TIDELAND.stats());}return out;});
    const mean=key=>frames.reduce((n,f)=>n+f[key],0)/frames.length;
    const name=`${preset}-${view.name}-${time}-${weather}${suffix}`;
    const sample={name,preset,view,time,weather,fps:mean('fps'),frameMs:1000/mean('fps'),drawCalls:mean('drawCalls'),triangles:mean('triangles'),postFX:frames.at(-1).postFX};samples.push(sample);console.log(JSON.stringify(sample));
    await page.screenshot({path:`${output}/${name}.png`});
  };
  await setPreset('high');
  for(const view of views)await capture(view);
  for(const [time,weather] of [[17.5,'clear'],[0,'clear'],[10,'rain'],[10,'fog'],[10,'storm']])await capture(views[0],'high',time,weather);
  await page.keyboard.press('F3');await page.screenshot({path:`${output}/telemetry.png`});await page.keyboard.press('F3');
  // A/B diagnosis: same High view with only ambient occlusion disabled.
  await page.keyboard.press('Escape');await page.locator('.pause-screen [data-action="settings"]').click();await page.locator('[data-settings-tab="graphics"]').click();
  await page.locator('[data-toggle="ambientOcclusion"][data-value="false"]').click();
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await capture(views[0],'high',10,'clear','-no-ao');
  for(const preset of ['low','medium','ultra']){await setPreset(preset);await capture(views[0],preset);}
  assert.equal(errors.length,0,errors.join('\n'));
} finally {
  fs.writeFileSync(`${output}/report.json`,JSON.stringify({label,viewport:[1280,720],seed:731942,samples,errors,warnings},null,2));
  await browser.close();
}
