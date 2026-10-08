import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const outputDir=process.env.TIDELAND_QA_DIR||'test-results/tidal-pier',captureScreenshots=process.env.TIDELAND_QA_SCREENSHOTS!=='0';
const appUrl=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';
fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];
page.setDefaultTimeout(150000);
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
const pass=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name)};
try{
  await page.goto(appUrl);await page.waitForFunction(()=>window.__TIDELAND,{timeout:150000});
  await page.locator('.loading-screen').waitFor({state:'hidden',timeout:150000});
  await page.locator('#world-seed').fill('731942');await page.locator('[data-action="new"]').click();
  await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing',{timeout:150000});
  const pier=await page.evaluate(()=>{const a=window.__TIDELAND,p=a.world().pois.find(site=>site.kind===6);if(!p)throw new Error('Tidal Survey Pier is missing');a.setCapturePaused(true);a.dev('god');a.dev('fly');a.dev('time',10);a.teleport({x:p.position.x-1.8,y:p.position.y+2.7,z:p.position.z+2.7});a.lookAt({x:p.position.x+.78,y:p.position.y+1.22,z:p.position.z+.23});return {name:p.name,revision:a.world().revision,position:p.position};});
  pass('Seeded Generation 5 Revision 6 includes Tidal Survey Pier',pier.name==='Tidal Survey Pier'&&pier.revision===6);
  await page.waitForTimeout(300);if(captureScreenshots)await page.screenshot({path:`${outputDir}/tidal-survey-pier-detail.png`,timeout:60000});
  pass('Browser capture has no application or WebGL errors',errors.length===0);
  fs.writeFileSync(`${outputDir}/results.json`,JSON.stringify({passed:true,pier,checks,errors},null,2));
}catch(error){fs.writeFileSync(`${outputDir}/results.json`,JSON.stringify({passed:false,checks,errors,error:error.message},null,2));throw error}
finally{await browser.close()}
