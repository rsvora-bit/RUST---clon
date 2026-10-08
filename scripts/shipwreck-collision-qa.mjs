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
    const mast=boxes.find(candidate=>candidate.position.y-poi.position.y>8&&candidate.halfExtents.y>8&&candidate.halfExtents.x<.2&&candidate.halfExtents.z<.2&&Math.abs(candidate.rotationZ??0)>.05);if(!mast)throw Error('Breakwater derrick mast proxy is missing');
    const bodyCenterY=poi.position.y+4.9,mastCenter={x:mast.position.x-Math.sin(mast.rotationZ??0)*(bodyCenterY-mast.position.y),z:mast.position.z},axis={x:1,z:0},distance=1.65,run=2.45,start={x:mastCenter.x-distance,z:mastCenter.z};
    for(const obstacle of boxes){if(obstacle===mast)continue;const obstacleBottom=obstacle.position.y-obstacle.halfExtents.y,obstacleTop=obstacle.position.y+obstacle.halfExtents.y;if(obstacleBottom>bodyCenterY+.9||obstacleTop<bodyCenterY-.9)continue;const closestX=Math.max(start.x,Math.min(start.x+run,mastCenter.x)),closestZ=Math.max(start.z-.45,Math.min(start.z+.45,obstacle.position.z));if(Math.hypot(closestX-obstacle.position.x,closestZ-obstacle.position.z)<Math.hypot(obstacle.halfExtents.x,obstacle.halfExtents.z)+.5)throw Error('A second Breakwater collider overlaps the clear upper-mast test path');}
    return{poi:{id:poi.id,position:poi.position},assets:plans,mast:{center:mastCenter,extent:.15,start,axis,run,bodyCenterY,rotationZ:mast.rotationZ??0}};
  });
  const results=await page.evaluate(({assets,mast})=>{const api=window.__TIDELAND;api.setCapturePaused(true);api.dev('god');const movementPlan=(plan,settle)=>{api.teleport({x:plan.start.x,y:settle?api.height(plan.start.x,plan.start.z)+.08:plan.bodyCenterY-.9,z:plan.start.z});if(settle)for(let i=0;i<12;i++)api.physicsMoveForTest({x:0,y:-.04,z:0});for(let i=0;i<Math.ceil(plan.run/.1);i++)api.physicsMoveForTest({x:plan.axis.x*.1,y:0,z:plan.axis.z*.1});const p=api.physics().position,dx=p.x-plan.center.x,dz=p.z-plan.center.z;return{...plan,position:p,depth:dx*plan.axis.x+dz*plan.axis.z,lateral:Math.abs(dx*plan.axis.z-dz*plan.axis.x)};};return{lower:assets.map(plan=>movementPlan(plan,true)),mast:movementPlan(mast,false)};},{assets:plans.assets,mast:plans.mast});
  for(const result of results.lower){assert.ok(result.depth<-(result.extent+.08),`Player entered Breakwater hull proxy: ${JSON.stringify(result)}`);assert.ok(result.depth>-(result.extent+1.25),`Player stopped too far from Breakwater hull: ${JSON.stringify(result)}`);}
  assert.ok(results.mast.depth<-.05&&results.mast.depth>-.95,`Player entered the Breakwater upper derrick mast proxy or stopped too early: ${JSON.stringify(results.mast)}`);
  assert.deepEqual(errors,[],'browser console must stay free of application/WebGL errors');
  console.log(`PASS live Breakwater collision · lower hull ${results.lower.length} clear approaches · upper derrick mast blocked · zero browser errors`);
}finally{await browser.close();}
