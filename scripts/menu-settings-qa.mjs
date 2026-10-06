import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const url=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';
const executablePath=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.setDefaultTimeout(180000);
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const pass=(label,condition)=>{assert.ok(condition,label);console.log('PASS',label);};
const waitForMenu=async()=>{await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='menu'&&document.querySelector('.tide-ui')?.dataset.screen==='menu');};
const menuRenderState=()=>page.evaluate(()=>{const canvas=document.querySelector('#game-canvas'),rect=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);return{screen:window.__TIDELAND.getScreen(),uiScreen:document.querySelector('.tide-ui').dataset.screen,width:canvas.width,height:canvas.height,rect:[rect.width,rect.height],display:style.display,visibility:style.visibility,opacity:Number(style.opacity),drawCalls:window.__TIDELAND.stats().drawCalls,triangles:window.__TIDELAND.stats().triangles};});
try{
  await page.goto(url);await page.waitForFunction(()=>window.__TIDELAND);await page.locator('.loading-screen').waitFor({state:'hidden'});await waitForMenu();
  await page.waitForFunction(()=>window.__TIDELAND.stats().drawCalls>0&&window.__TIDELAND.stats().triangles>0);
  const startup=await menuRenderState();
  pass('Startup main menu has a visible, live rendered world',startup.screen==='menu'&&startup.uiScreen==='menu'&&startup.width>0&&startup.height>0&&startup.rect[0]>0&&startup.rect[1]>0&&startup.display!=='none'&&startup.visibility==='visible'&&startup.opacity>0&&startup.drawCalls>0&&startup.triangles>0);

  await page.locator('[data-action="settings"]').filter({visible:true}).click();await page.locator('[data-settings-tab="gameplay"]').waitFor();
  const readToggleLabels=()=>page.locator('.settings-page.active .toggle-options button').evaluateAll(buttons=>buttons.map(button=>({name:button.dataset.toggle,value:button.dataset.value,text:button.innerText.trim(),visible:!!(button.offsetWidth||button.offsetHeight||button.getClientRects().length)})));
  const english=await readToggleLabels();
  pass('English Settings visibly label both ON and OFF for every gameplay toggle',english.length>0&&english.every(button=>button.visible&&['ON','OFF'].includes(button.text)));
  await page.locator('[data-language="cs"]').click();
  const czech=await readToggleLabels();
  pass('Czech Settings visibly label both states for every gameplay toggle',czech.length===english.length&&czech.every(button=>button.visible&&['ZAPNUTO','VYPNUTO'].includes(button.text)));

  const compassOff=page.locator('[data-toggle="showCompass"][data-value="false"]');
  await compassOff.click();
  pass('Toggle state and settings persistence update immediately',await compassOff.getAttribute('aria-pressed')==='true'&&await page.evaluate(()=>JSON.parse(localStorage.getItem('tideland:settings:v1'))?.showCompass===false));
  await page.locator('[data-action="settingsBack"]').click();await waitForMenu();
  pass('Returning from Settings restores the live menu environment',(await menuRenderState()).drawCalls>0);

  await page.setViewportSize({width:1600,height:900});
  await page.waitForFunction(()=>{const canvas=document.querySelector('#game-canvas');return canvas.width===1600&&canvas.height===900;});
  pass('Menu world remains rendered after resize',(await menuRenderState()).drawCalls>0);

  await page.locator('[data-action="new"]').click();await page.locator('.save-browser:not([hidden])').waitFor({state:'visible'});
  await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');
  await page.keyboard.press('Escape');await page.locator('.pause-nav [data-action="menu"]').click();await waitForMenu();
  pass('Returning to Main Menu from gameplay retains a rendered world',(await menuRenderState()).drawCalls>0);

  await page.reload();await page.waitForFunction(()=>window.__TIDELAND);await page.locator('.loading-screen').waitFor({state:'hidden'});await waitForMenu();
  const persisted=await page.evaluate(()=>({language:document.documentElement.lang,compass:window.__TIDELAND.cameraState().settings.showCompass}));
  pass('Language and boolean Settings survive reload',persisted.language==='cs'&&persisted.compass===false);
  assert.deepEqual(errors,[],`Browser console/page errors:\n${errors.join('\n')}`);console.log('PASS no browser console or page errors');
}finally{await context.close();await browser.close();}
