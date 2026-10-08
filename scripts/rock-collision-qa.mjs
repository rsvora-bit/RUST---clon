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
  // The menu already owns a prepared Revision-6 preview world. Launch it in
  // temporary Testing Mode instead of generating a second random world; this
  // exercises the live authored collider batches without touching a save slot.
  await page.keyboard.press('F3');
  await page.locator('[data-action="launchTestWorld"]').click();
  await page.waitForFunction(()=>window.__TIDELAND?.getScreen()==='playing'&&document.querySelector('[data-dev="testing"]')?.getAttribute('aria-pressed')==='true');
  await page.evaluate(()=>window.__TIDELAND.dev('day'));

  const approach=await page.evaluate(()=>{
    const api=window.__TIDELAND,art=api.worldArt(),boxes=art.generatedRockColliderBounds??[],cliffs=art.cliffInstances??[],cliffBoxes=art.generatedCliffColliderBounds??[],trees=api.nodes().filter(n=>n.kind==='tree').map(n=>n.position);
    if(api.world().revision<6||art.generatedRockModels?.assets?.join(',')!=='large_boulder_a,large_boulder_b,large_boulder_c'||!boxes.length)throw Error('Revision-6 authored boulders or live colliders are missing');
    if(art.generatedCliffModels?.assets?.join(',')!=='cliff_slab_a,cliff_slab_b'||art.generatedCliffModels.batches!==2||cliffs.length<8||cliffBoxes.length!==cliffs.length)throw Error('Revision-6 authored cliff slabs or live colliders are missing');
    for(const cliff of cliffs){if(api.height(cliff.position.x,cliff.position.z)<22||api.slope(cliff.position.x,cliff.position.z)<.45)throw Error(`Cliff slab is outside its intended rocky slope band: ${JSON.stringify(cliff)}`);if(cliff.up.y<.999)throw Error(`Cliff slab leans with the terrain instead of keeping its ledge face upright: ${JSON.stringify(cliff)}`);}
    if(cliffs.some(cliff=>cliffs.filter(other=>Math.hypot(other.position.x-cliff.position.x,other.position.z-cliff.position.z)<7.5).length<3))throw Error('Cliff slabs are not grouped into readable outcrops');
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
    const cliffPlans=[];
    cliffBoxes.forEach((box,index)=>{const yaw=box.rotation??0,axes=[{x:Math.cos(yaw),z:-Math.sin(yaw),extent:box.halfExtents.x,lateralExtent:box.halfExtents.z},{x:Math.sin(yaw),z:Math.cos(yaw),extent:box.halfExtents.z,lateralExtent:box.halfExtents.x}];
      for(let axisIndex=0;axisIndex<2;axisIndex++)for(const sign of [-1,1]){const axis=axes[axisIndex],direction={x:axis.x*sign,z:axis.z*sign},distance=3,start={x:box.position.x-direction.x*(axis.extent+distance),z:box.position.z-direction.z*(axis.extent+distance)};let valid=true;
        for(let sample=0;sample<=8;sample++){const t=distance*sample/8,x=start.x+t*direction.x,z=start.z+t*direction.z,grade=Math.hypot(api.height(x+.5,z)-api.height(x-.5,z),api.height(x,z+.5)-api.height(x,z-.5));if(api.height(x,z)<1||grade>.95){valid=false;break;}}
        if(!valid)continue;
        for(const obstacle of [...boxes,...cliffBoxes.filter((_,other)=>other!==index),...(art.resourceRockColliderBounds??[])]){const radius=Math.hypot(obstacle.halfExtents.x,obstacle.halfExtents.z)+.5,approach=distanceToSegment(obstacle.position,start,direction,distance);if(approach.along>-radius&&approach.along<distance+radius&&approach.lateral<radius){valid=false;break;}}
        if(!valid)continue;
        for(const tree of trees){const approach=distanceToSegment(tree,start,direction,distance);if(approach.along>-.5&&approach.along<distance+.5&&approach.lateral<1){valid=false;break;}}
        if(valid)cliffPlans.push({asset:box.asset,index,center:box.position,extent:axis.extent,lateralExtent:axis.lateralExtent,start,direction});
      }
    });
    if(!cliffPlans.length)throw Error('No clear, walkable approach to any authored cliff slab collider');
    const resourceBoxes=art.resourceRockColliderBounds??[],resourcePlans=[];
    for(const kind of ['stone','metal','sulfur','hqmetal']){
      let found;
      for(const box of resourceBoxes.filter(candidate=>candidate.asset===kind)){
        const yaw=box.rotation??0,axes=[{x:Math.cos(yaw),z:-Math.sin(yaw),extent:box.halfExtents.x,lateralExtent:box.halfExtents.z},{x:Math.sin(yaw),z:Math.cos(yaw),extent:box.halfExtents.z,lateralExtent:box.halfExtents.x}];
        for(let axisIndex=0;axisIndex<2&&!found;axisIndex++)for(const sign of [-1,1]){const axis=axes[axisIndex],direction={x:axis.x*sign,z:axis.z*sign},distance=2.2,start={x:box.position.x-direction.x*(axis.extent+distance),z:box.position.z-direction.z*(axis.extent+distance)};let valid=true;
          for(let sample=0;sample<=8;sample++){const t=distance*sample/8,x=start.x+t*direction.x,z=start.z+t*direction.z,grade=Math.hypot(api.height(x+.5,z)-api.height(x-.5,z),api.height(x,z+.5)-api.height(x,z-.5));if(api.height(x,z)<1||grade>.55){valid=false;break;}}
          if(!valid)continue;
          for(const obstacle of [...boxes,...cliffBoxes,...resourceBoxes.filter(other=>other.nodeId!==box.nodeId)]){const radius=Math.hypot(obstacle.halfExtents.x,obstacle.halfExtents.z)+.35,approach=distanceToSegment(obstacle.position,start,direction,distance);if(approach.along>-radius&&approach.along<distance+radius&&approach.lateral<radius){valid=false;break;}}
          if(!valid)continue;
          for(const tree of trees){const approach=distanceToSegment(tree,start,direction,distance);if(approach.along>-.4&&approach.along<distance+.4&&approach.lateral<.9){valid=false;break;}}
          if(valid)found={asset:kind,nodeId:box.nodeId,center:box.position,extent:axis.extent,lateralExtent:axis.lateralExtent,start,direction};
        }
        if(found)break;
      }
      if(!found)throw Error(`No clear walkable collision approach found for ${kind} resource nodes`);
      resourcePlans.push(found);
    }
    const plan=selected[0],y=api.height(plan.start.x,plan.start.z);
    api.dev('testing');api.dev('god');api.teleport({x:plan.start.x,y:y+.08,z:plan.start.z});api.lookAt({x:plan.start.x+plan.axis.x,y:y+1.72,z:plan.start.z+plan.axis.z});api.setCapturePaused(false);
    return{plans:selected.map(({index,asset,side,axis,distance,start,extent,lateralExtent,box})=>({index,asset,side,axis,distance,start,extent,lateralExtent,center:box.position})),cliffPlan:cliffPlans[0],resourcePlans,assets:art.generatedRockModels.assets,cliffs,cliffBoxes};
  });
  console.log(`PASS ${approach.cliffs.length} authored cliff slabs on rocky high slopes with ${approach.cliffBoxes.length} stable collider bounds`);
  const results=await page.evaluate(({plans})=>{const api=window.__TIDELAND;return plans.map(plan=>{const y=api.height(plan.start.x,plan.start.z);api.teleport({x:plan.start.x,y:y+.08,z:plan.start.z});for(let i=0;i<10;i++)api.physicsMoveForTest({x:0,y:-.04,z:0});for(let i=0;i<100;i++)api.physicsMoveForTest({x:plan.axis.x*.12,y:0,z:plan.axis.z*.12});const p=api.physics().position,dx=p.x-plan.center.x,dz=p.z-plan.center.z,depth=dx*plan.axis.x+dz*plan.axis.z,lateral=Math.abs(dx*plan.axis.z-dz*plan.axis.x);return{asset:plan.asset,side:plan.side,position:p,depth,lateral,extent:plan.extent,lateralExtent:plan.lateralExtent};});},approach);
  for(const result of results){
    assert.ok(result.depth<-(result.extent+.10),`Player did not remain outside ${result.asset} ${result.side}: ${JSON.stringify(result)}`);
    assert.ok(result.depth>-(result.extent+1.35),`Player did not stop near ${result.asset} ${result.side}: ${JSON.stringify(result)}`);
    assert.ok(result.lateral<result.lateralExtent+.45,`Player moved beyond the tested collider face on ${result.asset} ${result.side}: ${JSON.stringify(result)}`);
  }
  const cliffResult=await page.evaluate(plan=>{const api=window.__TIDELAND,step=.12,groundOffset=.08;let position={x:plan.start.x,y:api.height(plan.start.x,plan.start.z)+groundOffset,z:plan.start.z};api.teleport(position);for(let i=1;i<=100;i++){const next={x:plan.start.x+plan.direction.x*step*i,z:plan.start.z+plan.direction.z*step*i};const targetY=api.height(next.x,next.z)+groundOffset;api.physicsMoveForTest({x:next.x-position.x,y:targetY-position.y,z:next.z-position.z});position=api.physics().position;}const dx=position.x-plan.center.x,dz=position.z-plan.center.z;return{asset:plan.asset,position,center:plan.center,start:plan.start,direction:plan.direction,depth:dx*plan.direction.x+dz*plan.direction.z,lateral:Math.abs(dx*plan.direction.z-dz*plan.direction.x),extent:plan.extent,lateralExtent:plan.lateralExtent};},approach.cliffPlan);
  assert.ok(cliffResult.depth<-(cliffResult.extent+.1),`Player passed into authored ${cliffResult.asset} collider: ${JSON.stringify(cliffResult)}`);
  assert.ok(cliffResult.depth>-(cliffResult.extent+1.35),`Player stopped too far from authored ${cliffResult.asset} collider: ${JSON.stringify(cliffResult)}`);
  assert.ok(cliffResult.lateral<cliffResult.lateralExtent+.45,`Player moved beyond tested authored ${cliffResult.asset} collider face: ${JSON.stringify(cliffResult)}`);
  console.log(`PASS live player movement is blocked by an authored ${cliffResult.asset} cliff slab`);
  const resourceResults=await page.evaluate(plans=>plans.map(plan=>{const api=window.__TIDELAND,y=api.height(plan.start.x,plan.start.z);api.teleport({x:plan.start.x,y:y+.08,z:plan.start.z});for(let i=0;i<12;i++)api.physicsMoveForTest({x:0,y:-.04,z:0});for(let i=0;i<100;i++)api.physicsMoveForTest({x:plan.direction.x*.10,y:0,z:plan.direction.z*.10});const position=api.physics().position,dx=position.x-plan.center.x,dz=position.z-plan.center.z;return{asset:plan.asset,nodeId:plan.nodeId,position,depth:dx*plan.direction.x+dz*plan.direction.z,lateral:Math.abs(dx*plan.direction.z-dz*plan.direction.x),extent:plan.extent,lateralExtent:plan.lateralExtent};}),approach.resourcePlans);
  for(const result of resourceResults){assert.ok(result.depth<-(result.extent+.06),`Player passed into ${result.asset} resource node collider: ${JSON.stringify(result)}`);assert.ok(result.depth>-(result.extent+1.25),`Player stopped too far from ${result.asset} resource node: ${JSON.stringify(result)}`);assert.ok(result.lateral<result.lateralExtent+.45,`Player moved outside the tested ${result.asset} resource collider face: ${JSON.stringify(result)}`);}
  console.log(`PASS live player collision for rock resource nodes · ${resourceResults.map(result=>result.asset).join(', ')}`);
  const lods=await page.evaluate(()=>{const api=window.__TIDELAND,previous=api.cameraState().settings.quality,result={};for(const preset of ['low','medium','high','ultra']){api.settingsForTest({quality:preset});const art=api.worldArt();result[preset]={models:art.generatedCliffModels,colliders:art.generatedCliffColliderBounds};}api.settingsForTest({quality:previous});return result;});
  assert.deepEqual(lods.low.models.assets,['cliff_slab_a','cliff_slab_b']);assert.deepEqual([lods.low.models.lod,lods.medium.models.lod,lods.high.models.lod,lods.ultra.models.lod],[2,1,0,0]);
  for(const preset of ['medium','high','ultra'])assert.deepEqual(lods[preset].colliders,approach.cliffBoxes,`cliff colliders must stay fixed at ${preset.toUpperCase()}`);
  console.log(`PASS cliff slab quality LODs · ${Math.round(lods.high.models.triangles).toLocaleString()} HIGH / ${Math.round(lods.ultra.models.triangles).toLocaleString()} ULTRA triangles`);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS live player movement is blocked on all four sides of all authored Revision-6 boulder variants');
  console.log(JSON.stringify({assets:approach.assets,checkedSides:results.length,results:results.map(({asset,side,depth,extent,lateral})=>({asset,side,depth,extent,lateral})),applicationErrors:errors.length},null,2));
}finally{await browser.close();}
