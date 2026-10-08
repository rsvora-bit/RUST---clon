import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const base=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`,'--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(base);await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='menu'&&document.querySelector('.loading-screen')?.hidden===true,null,{timeout:180000});
  await page.keyboard.press('F3');await page.locator('[data-action="launchTestWorld"]').click();await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing'&&document.querySelector('[data-dev="testing"]')?.getAttribute('aria-pressed')==='true',null,{timeout:240000});
  const plans=await page.evaluate(()=>{
    const api=window.__TIDELAND,poi=api.landmarks().find(item=>item.kind===5),boxes=api.worldCollisionBoxesForTest();if(!poi)throw Error('Revision-6 Breakwater is missing');
    const target=boxes.map((box,index)=>({box,index})).filter(({box})=>Math.abs(box.position.x-poi.position.x)<1&&Math.abs(box.position.z-poi.position.z)<1.5&&box.position.y-poi.position.y<.9&&box.halfExtents.x>2.5&&box.halfExtents.z>.5).sort((a,b)=>b.box.halfExtents.x-a.box.halfExtents.x)[0];if(!target)throw Error('Breakwater lower hull/deck collision proxy is missing');
    const box=target.box,yaw=box.rotation??0,axes=[{x:Math.cos(yaw),z:-Math.sin(yaw),extent:box.halfExtents.x},{x:Math.sin(yaw),z:Math.cos(yaw),extent:box.halfExtents.z}],plans=[];
    for(let axisIndex=0;axisIndex<axes.length;axisIndex++)for(const sign of [-1,1]){const raw=axes[axisIndex],axis={x:raw.x*sign,z:raw.z*sign},extent=raw.extent,distance=extent+2.1,run=distance+1.1,start={x:box.position.x-axis.x*distance,z:box.position.z-axis.z*distance},baseHeight=api.height(start.x,start.z);let clear=true;
      for(let sample=0;sample<=16;sample++){const t=sample/16,x=start.x+axis.x*run*t,z=start.z+axis.z*run*t;if(api.slope(x,z)>.18||Math.abs(api.height(x,z)-baseHeight)>.35){clear=false;break;}}
      if(clear)plans.push({index:target.index,center:box.position,extent,start,axis,run,baseHeight});
    }
    if(plans.length<2)throw Error(`Only ${plans.length} near-level approach paths reached the lower Breakwater proxy`);
    return{poi:{id:poi.id,position:poi.position},assets:plans};
  });
  const results=await page.evaluate(plans=>{const api=window.__TIDELAND;api.setCapturePaused(true);api.dev('god');return plans.map(plan=>{api.teleport({x:plan.start.x,y:api.height(plan.start.x,plan.start.z)+.08,z:plan.start.z});for(let i=0;i<12;i++)api.physicsMoveForTest({x:0,y:-.04,z:0});for(let i=0;i<Math.ceil(plan.run/.1);i++)api.physicsMoveForTest({x:plan.axis.x*.1,y:0,z:plan.axis.z*.1});const p=api.physics().position,dx=p.x-plan.center.x,dz=p.z-plan.center.z;return{...plan,position:p,depth:dx*plan.axis.x+dz*plan.axis.z,lateral:Math.abs(dx*plan.axis.z-dz*plan.axis.x)};});},plans.assets);
  for(const result of results){assert.ok(result.depth<-(result.extent+.08),`Player entered Breakwater hull proxy: ${JSON.stringify(result)}`);assert.ok(result.depth>-(result.extent+1.25),`Player stopped too far from Breakwater hull: ${JSON.stringify(result)}`);}
  assert.deepEqual(errors,[],'browser console must stay free of application/WebGL errors');
  console.log(`PASS live Breakwater lower hull collision · ${results.length} clear approaches · zero browser errors`);
}finally{await browser.close();}
