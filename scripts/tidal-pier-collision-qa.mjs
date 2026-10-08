import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'metal'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(base);await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='menu'&&document.querySelector('.loading-screen')?.hidden===true,null,{timeout:180000});
  await page.locator('#world-seed').fill('731942');await page.locator('[data-action="new"]').click();await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing',null,{timeout:180000});
  const landing=await page.evaluate(()=>{
    const api=window.__TIDELAND,pier=api.world().pois.find(p=>p.kind===6),boxes=api.worldCollisionBoxesForTest();if(!pier)throw Error('Tidal Survey Pier is missing');
    const platformIndex=boxes.findIndex(box=>Math.abs(box.position.x-pier.position.x)<.01&&Math.abs(box.position.y-pier.position.y-.83)<.01&&Math.abs(box.position.z-pier.position.z-.9)<.01&&Math.abs(box.halfExtents.x-3.15)<.01&&Math.abs(box.halfExtents.z-2.1)<.01);if(platformIndex<0)throw Error('Tidal Survey Pier deck collider is missing');
    const platform=boxes[platformIndex],top=platform.position.y+platform.halfExtents.y,candidates=[];
    for(let dx=-2.7;dx<=2.7;dx+=.3)for(let dz=-1.55;dz<=1.55;dz+=.3){const x=platform.position.x+dx,z=platform.position.z+dz,feet=top+.03,head=feet+1.8;
      const clear=boxes.every((box,index)=>{if(index===platformIndex)return true;const overlapsY=box.position.y+box.halfExtents.y>feet&&box.position.y-box.halfExtents.y<head;if(!overlapsY)return true;const hx=Math.abs(x-box.position.x),hz=Math.abs(z-box.position.z);return hx>=box.halfExtents.x+.30||hz>=box.halfExtents.z+.30;});
      if(clear)candidates.push({x,y:top+2.4,z,top,deltaX:dx,deltaZ:dz});
    }
    if(!candidates.length)throw Error('No unobstructed player-sized landing area found on the pier deck');
    candidates.sort((a,b)=>Math.hypot(a.deltaX,a.deltaZ)-Math.hypot(b.deltaX,b.deltaZ));api.setCapturePaused(true);api.dev('god');api.teleport(candidates[0]);
    let grounded=false;for(let i=0;i<36;i++)grounded=api.physicsMoveForTest({x:0,y:-.10,z:0});
    const position=api.physics().position;return{revision:api.world().revision,pier:pier.name,top:candidates[0].top,position,grounded};
  });
  assert.equal(landing.revision,6,'Tidal Survey Pier must be tested in Revision 6');
  assert.equal(landing.pier,'Tidal Survey Pier');
  assert.ok(landing.grounded,`Rapier did not ground the player on the pier deck: ${JSON.stringify(landing)}`);
  assert.ok(landing.position.y>=landing.top-.08&&landing.position.y<=landing.top+.16,`Player did not settle on the pier deck surface: ${JSON.stringify(landing)}`);
  assert.deepEqual(errors,[],'browser console must stay free of application/WebGL errors');
  console.log(`PASS Tidal Survey Pier live deck collision · player grounded at ${landing.position.y.toFixed(3)}m on deck top ${landing.top.toFixed(3)}m · zero browser errors`);
}finally{await browser.close();}
