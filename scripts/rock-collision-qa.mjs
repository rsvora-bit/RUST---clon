import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base=process.env.TIDELAND_QA_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--enable-webgl','--use-gl=angle',`--use-angle=${process.env.TIDELAND_QA_ANGLE||'swiftshader'}`]});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.setDefaultTimeout(180000);
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(base);
  await page.waitForFunction(()=>window.__TIDELAND);
  await page.locator('.loading-screen').waitFor({state:'hidden'});
  await page.locator('[data-action="new"]').click();
  await page.locator('[data-save-action="new"][data-save-slot="1"]').click();
  if(await page.locator('.new-game-confirm').isVisible())await page.locator('[data-action="confirmNew"]').click();
  await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing');
  await page.evaluate(()=>window.__TIDELAND.dev('day'));

  const approach=await page.evaluate(()=>{
    const api=window.__TIDELAND,art=api.worldArt(),boxes=art.generatedRockColliderBounds??[],trees=api.nodes().filter(n=>n.kind==='tree').map(n=>n.position);
    if(api.world().revision<6||art.generatedRockModels?.assets?.join(',')!=='large_boulder_a,large_boulder_b,large_boulder_c'||!boxes.length)throw Error('Revision-6 authored boulders or live colliders are missing');
    const distanceToSegment=(p,start,direction,length)=>{const along=(p.x-start.x)*direction.x+(p.z-start.z)*direction.z,t=Math.max(0,Math.min(length,along));return{along,lateral:Math.hypot(p.x-start.x-direction.x*t,p.z-start.z-direction.z*t)};};
    const plans=new Map();
    boxes.forEach((box,index)=>{
      const yaw=box.rotation??0,axes=[{x:Math.cos(yaw),z:-Math.sin(yaw),extent:box.halfExtents.x},{x:Math.sin(yaw),z:Math.cos(yaw),extent:box.halfExtents.z}];
      for(let axisIndex=0;axisIndex<2;axisIndex++)for(const sign of [-1,1]){
        const axis=axes[axisIndex],toward={x:axis.x*sign,z:axis.z*sign},distance=4.5,start={x:box.position.x-axis.x*sign*(axis.extent+distance),z:box.position.z-axis.z*sign*(axis.extent+distance)};let valid=true;
        for(let sample=0;sample<=8;sample++){const t=distance*sample/8,x=start.x+t*toward.x,z=start.z+t*toward.z,grade=Math.hypot(api.height(x+.5,z)-api.height(x-.5,z),api.height(x,z+.5)-api.height(x,z-.5));if(api.height(x,z)<.5||grade>.32){valid=false;break;}}
        if(!valid)continue;
        for(const tree of trees){const d=distanceToSegment(tree,start,toward,distance);if(d.along>-.4&&d.along<distance+.4&&d.lateral<.9){valid=false;break;}}
        if(!valid)continue;
        for(let other=0;other<boxes.length;other++)if(other!==index){const blocker=boxes[other],radius=Math.hypot(blocker.halfExtents.x,blocker.halfExtents.z)+.5,d=distanceToSegment(blocker.position,start,toward,distance);if(d.along>-radius&&d.along<distance+radius&&d.lateral<radius){valid=false;break;}}
        if(valid){const side=`${axisIndex}:${sign}`,key=`${box.asset}:${side}`,candidate={box,index,asset:box.asset,side,axis:toward,distance,start,extent:axis.extent,lateralExtent:axisIndex===0?box.halfExtents.z:box.halfExtents.x};if(!plans.has(key)||plans.get(key).extent<candidate.extent)plans.set(key,candidate);}
      }
    });
    const selected=[...plans.values()];if(selected.length!==12)throw Error(`Expected a clear dry approach to each side of all 3 authored rock variants; found ${selected.length}/12`);
    const plan=selected[0],y=api.height(plan.start.x,plan.start.z);
    api.dev('testing');api.dev('god');api.teleport({x:plan.start.x,y:y+.08,z:plan.start.z});api.lookAt({x:plan.start.x+plan.axis.x,y:y+1.72,z:plan.start.z+plan.axis.z});api.setCapturePaused(false);
    return{plans:selected.map(({index,asset,side,axis,distance,start,extent,lateralExtent,box})=>({index,asset,side,axis,distance,start,extent,lateralExtent,center:box.position})),assets:art.generatedRockModels.assets};
  });
  const results=await page.evaluate(({plans})=>{const api=window.__TIDELAND;return plans.map(plan=>{const y=api.height(plan.start.x,plan.start.z);api.teleport({x:plan.start.x,y:y+.08,z:plan.start.z});for(let i=0;i<10;i++)api.physicsMoveForTest({x:0,y:-.04,z:0});for(let i=0;i<100;i++)api.physicsMoveForTest({x:plan.axis.x*.12,y:0,z:plan.axis.z*.12});const p=api.physics().position,dx=p.x-plan.center.x,dz=p.z-plan.center.z,depth=dx*plan.axis.x+dz*plan.axis.z,lateral=Math.abs(dx*plan.axis.z-dz*plan.axis.x);return{asset:plan.asset,side:plan.side,position:p,depth,lateral,extent:plan.extent,lateralExtent:plan.lateralExtent};});},approach);
  for(const result of results){
    assert.ok(result.depth<-(result.extent+.10),`Player did not remain outside ${result.asset} ${result.side}: ${JSON.stringify(result)}`);
    assert.ok(result.depth>-(result.extent+1.35),`Player did not stop near ${result.asset} ${result.side}: ${JSON.stringify(result)}`);
    assert.ok(result.lateral<result.lateralExtent+.45,`Player moved beyond the tested collider face on ${result.asset} ${result.side}: ${JSON.stringify(result)}`);
  }
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS live player movement is blocked on all four sides of all authored Revision-6 boulder variants');
  console.log(JSON.stringify({assets:approach.assets,checkedSides:results.length,results:results.map(({asset,side,depth,extent,lateral})=>({asset,side,depth,extent,lateral})),applicationErrors:errors.length},null,2));
}finally{await browser.close();}
