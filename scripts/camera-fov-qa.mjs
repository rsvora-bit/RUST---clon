import {chromium} from 'playwright-core';import fs from 'node:fs';import assert from 'node:assert/strict';
const dir='artifacts/camera-fov/after';fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=metal']});
const records=[],checks=[],errors=[];const vertical=h=>2*Math.atan(Math.tan(h*Math.PI/360)/(16/9))*180/Math.PI;const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
try{const p=await browser.newPage({viewport:{width:1920,height:1080}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const state=()=>p.evaluate(()=>window.__TIDELAND.cameraState());const shot=name=>p.screenshot({path:`${dir}/${name}.png`});
const settings=async()=>{const screen=await p.evaluate(()=>window.__TIDELAND.getScreen());if(screen==='settings')return;if(screen==='playing')await p.keyboard.press('Escape');await p.getByRole('button',{name:/SETTINGS/}).filter({visible:true}).click();};
const fov=async value=>{await settings();const old=await state();const now=await p.locator('[data-setting="fov"]').evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));return window.__TIDELAND.cameraState()},value);near(now.world.fov,vertical(value));if(old.settings.fov!==value)assert.notDeepEqual(now.world.projection,old.world.projection);checks.push(`Immediate real projection ${value}`);};
const resume=async()=>{await p.keyboard.press('Escape');if(await p.evaluate(()=>window.__TIDELAND.getScreen())==='pause')await p.keyboard.press('Escape');await p.waitForTimeout(400);};
await p.goto('http://localhost:5173');await p.waitForFunction(()=>window.__TIDELAND);await fov(75);await resume();await p.getByRole('button',{name:'01 NEW GAME'}).click();await p.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');near((await state()).world.fov,vertical(75));checks.push('New Game applies menu FOV');
await p.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:28,y:4.2,z:212});a.lookAt({x:28,y:5.75,z:150});a.dev('day')});await p.waitForTimeout(1700);await p.keyboard.press('Digit2');await p.waitForTimeout(400);
await p.evaluate(()=>window.__TIDELAND.setCapturePaused(true));
const pose=(await state()).world;
for(const [w,h]of [[1920,1080],[1440,900],[2560,1080]]){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(400);let model;
 for(const value of [60,70,75,80,90,100]){await fov(value);if(value===100&&w===1920)await shot('live-settings');await resume();const s=await state();near(s.world.fov,vertical(value));near(s.world.aspect,w/h);for(let i=0;i<3;i++){near(s.world.position[i],pose.position[i]);near(s.world.rotation[i],pose.rotation[i]);}
 if(model){assert.deepEqual(s.viewmodel.projection,model.projection);assert.deepEqual(s.viewmodel.handMatrix,model.handMatrix);}model=s.viewmodel;assert.equal(s.viewmodel.fov,50);assert.equal(s.viewmodel.transparentDepthWrites,0);assert.ok(s.viewmodel.nearestDepth>.01);assert.ok(s.viewmodel.anchor[0]>.2&&s.viewmodel.anchor[0]<.7);
 records.push({resolution:[w,h],configured:value,...s});await shot(`${w}x${h}-fov-${value}`);
 }
 checks.push(`${w}x${h}: fixed pose, independent viewmodel, correct aspect`);
}
await p.setViewportSize({width:1920,height:1080});
for(const item of ['rock','hatchet','plan']){await p.evaluate(item=>{window.__TIDELAND.sim().state.inventory[0]={itemId:item,count:1}},item);await p.keyboard.press('Digit1');await p.waitForTimeout(450);
 for(const value of [60,75,90,100]){await fov(value);await resume();await shot(`${item}-fov-${value}`);near((await state()).world.fov,vertical(value));}
}
await p.evaluate(()=>window.__TIDELAND.setCapturePaused(false));
await fov(90);await resume();
for(const key of ['Tab','Tab','Escape','Escape','Digit2','KeyB','KeyB']){await p.keyboard.press(key);await p.waitForTimeout(150);near((await state()).world.fov,vertical(90));}checks.push('Inventory / pause / hotbar / building retain baseline');
await p.keyboard.down('c');await p.waitForTimeout(450);near((await state()).world.fov,vertical(90));await p.keyboard.up('c');await p.keyboard.press('Space');await p.waitForTimeout(700);near((await state()).world.fov,vertical(90));checks.push('Crouch and jump do not reset FOV');
await p.keyboard.down('Shift');await p.keyboard.down('w');await p.waitForTimeout(450);const sprint=await state();assert.ok(sprint.sprinting);assert.ok(sprint.world.fov>vertical(90)&&sprint.world.fov<=vertical(92)+.001);await p.keyboard.up('w');await p.keyboard.up('Shift');await p.waitForTimeout(1100);near((await state()).world.fov,vertical(90));checks.push('Subtle sprint offset returns to user baseline');
await p.evaluate(()=>{const a=window.__TIDELAND,n=a.nodes().find(n=>n.kind==='stone'&&n.position.x===24);a.sim().state.inventory[0]={itemId:'rock',count:1};a.teleport({x:n.position.x,y:n.position.y+.1,z:n.position.z+2.3});a.lookAt({x:n.position.x,y:n.position.y+.55,z:n.position.z})});await p.keyboard.press('Digit1');await p.waitForTimeout(350);await p.mouse.click(960,540);await p.waitForTimeout(300);near((await state()).world.fov,vertical(90));await shot('interaction');checks.push('Interaction animation retains FOV');
await fov(75);await resume();await p.evaluate(()=>window.__TIDELAND.save());await p.reload();await p.waitForFunction(()=>window.__TIDELAND);near((await state()).settings.fov,75);near((await state()).world.fov,vertical(75));await p.getByRole('button',{name:/02 CONTINUE/}).click();await p.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');near((await state()).world.fov,vertical(75));await p.setViewportSize({width:2560,height:1080});near((await state()).world.fov,vertical(75));checks.push('Save / reload / Continue / resize restore configured FOV');await shot('continue-ultrawide');
await p.keyboard.press('Escape');await p.getByRole('button',{name:/MAIN MENU/}).filter({visible:true}).click();await p.getByRole('button',{name:/02 CONTINUE/}).click();await p.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');near((await state()).world.fov,vertical(75));checks.push('Main menu / Continue does not overwrite FOV');
assert.deepEqual(errors,[]);fs.writeFileSync(`${dir}/results.json`,JSON.stringify({checks,records,errors,sprint},null,2));console.log({checks:checks.length,comparisons:records.length,errors});
}finally{await browser.close()}
