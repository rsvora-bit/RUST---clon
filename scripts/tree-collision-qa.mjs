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
    const api=window.__TIDELAND,art=api.worldArt(),trees=api.nodes().filter(node=>node.kind==='tree'),metadata=art.trees??[],obstacles=[...(art.generatedRockColliderBounds??[]),...(art.generatedCliffColliderBounds??[]),...(art.resourceRockColliderBounds??[])],directions=[{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}],selected=[];
    if(api.world().revision<6||!art.generatedTreeModels?.trees)throw Error('Revision-6 authored tree instances are not active');
    const distanceToPath=(point,start,axis)=>{const dx=point.x-start.x,dz=point.z-start.z;return{along:dx*axis.x+dz*axis.z,lateral:Math.abs(dx*axis.z-dz*axis.x)}};
    for(const species of [...new Set(metadata.map(tree=>tree.species))].sort((a,b)=>a-b)){
      const candidates=trees.filter(node=>metadata.some(tree=>tree.id===node.id&&tree.species===species)).sort((a,b)=>Math.hypot(a.position.x-api.world().spawn.x,a.position.z-api.world().spawn.z)-Math.hypot(b.position.x-api.world().spawn.x,b.position.z-api.world().spawn.z));let found;
      for(const node of candidates){const extent=node.scale*((species===5||species===6)?.34:.38),distance=extent+2.1,run=distance+1.15;for(const axis of directions){const start={x:node.position.x-axis.x*distance,z:node.position.z-axis.z*distance};let clear=true;
          for(let sample=0;sample<=16;sample++){const t=sample/16,x=start.x+axis.x*run*t,z=start.z+axis.z*run*t;if(api.slope(x,z)>.16||Math.abs(api.height(x,z)-node.position.y)>.45){clear=false;break;}}
          if(!clear)continue;
          for(const other of trees){if(other.id===node.id)continue;const radius=other.scale*.42+.42,approach=distanceToPath(other.position,start,axis);if(approach.along>-.4&&approach.along<run+.4&&approach.lateral<radius){clear=false;break;}}
          if(!clear)continue;
          for(const obstacle of obstacles){const radius=Math.hypot(obstacle.halfExtents.x,obstacle.halfExtents.z)+.4,approach=distanceToPath(obstacle.position,start,axis);if(approach.along>-.4&&approach.along<run+.4&&approach.lateral<radius){clear=false;break;}}
          if(clear){found={id:node.id,species,center:node.position,extent,start,axis,run};break;}
        }if(found)break;}
      if(found)selected.push(found);
    }
    if(selected.length<3)throw Error(`Only ${selected.length} species have clear near-level trunk approaches`);
    return selected;
  });
  const results=await page.evaluate(plans=>{
    const api=window.__TIDELAND;api.setCapturePaused(true);api.dev('god');
    return plans.map(plan=>{const startY=api.height(plan.start.x,plan.start.z)+.08;api.teleport({x:plan.start.x,y:startY,z:plan.start.z});for(let i=0;i<12;i++)api.physicsMoveForTest({x:0,y:-.04,z:0});for(let i=0;i<Math.ceil(plan.run/.1);i++)api.physicsMoveForTest({x:plan.axis.x*.1,y:0,z:plan.axis.z*.1});const position=api.physics().position,dx=position.x-plan.center.x,dz=position.z-plan.center.z;return{...plan,position,depth:dx*plan.axis.x+dz*plan.axis.z,lateral:Math.abs(dx*plan.axis.z-dz*plan.axis.x)};});
  },plans);
  for(const result of results){assert.ok(result.depth<-(result.extent+.08),`Player passed through tree ${result.id} species ${result.species}: ${JSON.stringify(result)}`);assert.ok(result.depth>-(result.extent+1.25),`Player stopped too far from tree ${result.id}: ${JSON.stringify(result)}`);assert.ok(result.lateral<result.extent+.5,`Player moved beyond the tested trunk side ${result.id}: ${JSON.stringify(result)}`);}
  assert.deepEqual(errors,[],'browser console must stay free of application/WebGL errors');
  console.log(`PASS live tree trunk collision · ${results.length} authored species · ${results.map(result=>result.species).join(', ')} · zero browser errors`);
}finally{await browser.close();}
