import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {fernGeometry,forestShrubGeometry,twigGeometry,fallenLogGeometry,seaweedGeometry,reedGeometry,marshPoolGeometry} from '../src/world/models';
import {Atmosphere} from '../src/world/atmosphere';
import {Weather,rainStreakLength,stormLightningRoll} from '../src/survival/Weather';
import {mountainLayer} from '../src/world/horizon';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {ensureProgression} from '../src/survival/progression';

describe('environment visual building blocks',()=>{
  it('builds non-empty low-cost understory and coast geometry',()=>{
    for(const geometry of [fernGeometry(),twigGeometry(),seaweedGeometry(),reedGeometry()]){expect(geometry.getAttribute('position').count).toBeGreaterThan(20);expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);geometry.dispose();}
  });

  it('keeps the shared marsh reed tuft low-poly while retaining its tall clustered silhouette',()=>{
    const reeds=reedGeometry();
    try{reeds.computeBoundingBox();expect(reeds.index!.count/3).toBeLessThanOrEqual(180);expect(reeds.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(1.25);expect(reeds.boundingBox!.getSize(new THREE.Vector3()).x).toBeGreaterThan(.55);}
    finally{reeds.dispose();}
  });

  it('keeps fuller revision-6 ferns broad while removing redundant leaf tessellation',()=>{
    const legacy=fernGeometry(),fuller=fernGeometry(true);
    try{legacy.computeBoundingBox();fuller.computeBoundingBox();const legacySize=legacy.boundingBox!.getSize(new THREE.Vector3()),fullerSize=fuller.boundingBox!.getSize(new THREE.Vector3());expect(Math.hypot(fullerSize.x,fullerSize.z)).toBeGreaterThan(Math.hypot(legacySize.x,legacySize.z)*1.1);expect(fullerSize.y).toBeGreaterThan(legacySize.y*1.1);expect(fuller.index!.count).toBe(legacy.index!.count*.25);expect(Array.from(fuller.getAttribute('position').array).every(Number.isFinite)).toBe(true);}
    finally{legacy.dispose();fuller.dispose();}
  });

  it('builds a solid shared shrub silhouette within a small triangle budget',()=>{
    const shrub=forestShrubGeometry();
    try{
      const positions=shrub.getAttribute('position');
      expect(positions.count/3).toBeLessThanOrEqual(147);
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      shrub.computeBoundingBox();
      expect(shrub.boundingBox!.min.y).toBeGreaterThan(.04);
      expect(shrub.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(.35);
      expect(shrub.boundingBox!.getSize(new THREE.Vector3()).x).toBeGreaterThan(.65);
    }finally{shrub.dispose();}
  });

  it('builds a stable low-cost fallen log with broken branch stubs',()=>{
    const log=fallenLogGeometry();
    try{
      const positions=log.getAttribute('position');log.computeBoundingBox();
      expect(log.index!.count/3).toBeLessThanOrEqual(180);
      expect(log.boundingBox!.getSize(new THREE.Vector3()).z).toBeGreaterThan(2.3);
      expect(log.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(.4);
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(log.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    }finally{log.dispose();}
  });

  it('builds a deterministic shallow marsh bowl with a silty vertex-color edge',()=>{
    const a=marshPoolGeometry(88217),b=marshPoolGeometry(88217),other=marshPoolGeometry(88218);
    try{
      const positions=a.getAttribute('position'),colors=a.getAttribute('color'),normals=a.getAttribute('normal');
      expect(a.index!.count/3).toBe(600);expect(positions.count).toBe(321);expect(colors.count).toBe(positions.count);
      expect(Array.from(positions.array)).toEqual(Array.from(b.getAttribute('position').array));expect(Array.from(colors.array)).toEqual(Array.from(b.getAttribute('color').array));
      expect(Array.from(positions.array)).not.toEqual(Array.from(other.getAttribute('position').array));
      expect(colors.getX(0)+colors.getY(0)+colors.getZ(0)).toBeGreaterThan(.35);
      expect(Array.from(positions.array).every(Number.isFinite)&&Array.from(normals.array).every(Number.isFinite)).toBe(true);
      expect(Math.min(...Array.from({length:positions.count},(_,i)=>positions.getY(i)))).toBeCloseTo(-.029,3);
      expect(Math.max(...Array.from({length:positions.count},(_,i)=>positions.getY(i)))).toBeLessThanOrEqual(.002);
      expect(colors.getX(0)).not.toBeCloseTo(colors.getX(positions.count-1),2);
      const ringColor=(ring:number)=>{const start=1+ring*40,mean=[0,0,0];for(let i=0;i<40;i++)for(let channel=0;channel<3;channel++)mean[channel]!+=colors.getComponent(start+i,channel)/40;return new THREE.Color().setRGB(mean[0]!,mean[1]!,mean[2]!);};
      for(let ring=0;ring<7;ring++){const current=ringColor(ring),next=ringColor(ring+1);expect(Math.hypot(current.r-next.r,current.g-next.g,current.b-next.b)).toBeLessThan(.18);}
    }finally{a.dispose();b.dispose();other.dispose();}
  });

  it('keeps distant mountain silhouettes deterministic, irregular and low-cost',()=>{
    const a=mountainLayer(731942,1,true),b=mountainLayer(731942,1,true),c=mountainLayer(731943,1,true),rev4=mountainLayer(731942,1,true,4),rev5=mountainLayer(731942,1,true,5),rev6=mountainLayer(731942,1,true,6),rev6b=mountainLayer(731942,1,true,6);
    try {
      expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
      expect(Array.from(a.getAttribute('position').array)).not.toEqual(Array.from(c.getAttribute('position').array));
      expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(rev4.getAttribute('position').array));expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(rev5.getAttribute('position').array));
      expect(Array.from(a.getAttribute('color').array)).toEqual(Array.from(rev5.getAttribute('color').array));
      expect(a.index!.count/3).toBe(5184);expect(a.boundingBox).toBeNull();a.computeBoundingBox();
      expect(a.boundingBox!.max.y).toBeGreaterThan(260);expect(a.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(260);expect(a.boundingSphere!.radius).toBeLessThan(1800);
      expect(rev6.index!.count).toBe(a.index!.count);expect(Array.from(rev6.getAttribute('position').array)).toEqual(Array.from(rev6b.getAttribute('position').array));expect(Array.from(rev6.getAttribute('position').array)).not.toEqual(Array.from(a.getAttribute('position').array));rev6.computeBoundingBox();rev6.computeBoundingSphere();expect(rev6.boundingBox!.max.y).toBeGreaterThan(a.boundingBox!.max.y*1.08);expect(rev6.boundingSphere!.radius).toBeLessThan(1800);const ridgeColor=rev6.getAttribute('color');expect(Array.from({length:ridgeColor.count},(_,index)=>ridgeColor.getY(index)>ridgeColor.getX(index)*1.02&&ridgeColor.getZ(index)>ridgeColor.getX(index)*1.04).some(Boolean)).toBe(true);
      const rowSize=73,groupSize=rowSize*7,ridges=Array.from({length:6},(_,group)=>Array.from({length:rowSize},(_,i)=>a.getAttribute('position').getY(group*groupSize+rowSize*3+i)));
      const peakCounts=ridges.map(profile=>profile.slice(1,-1).filter((height,index)=>height>profile[index]&&height>=profile[index+2]).length);
      expect(peakCounts.some(count=>count>=3)).toBe(true);
      const steepestRidgeStep=Math.max(...ridges.flatMap(profile=>profile.slice(1).map((height,index)=>Math.abs(height-profile[index]))));expect(steepestRidgeStep).toBeLessThan(90);
      const rev6Ridges=Array.from({length:6},(_,group)=>Array.from({length:rowSize},(_,i)=>rev6.getAttribute('position').getY(group*groupSize+rowSize*3+i))),rev6PeakCounts=rev6Ridges.map(profile=>profile.slice(1,-1).filter((height,index)=>height>profile[index]&&height>=profile[index+2]).length);expect(rev6PeakCounts.some(count=>count>=2)).toBe(true);expect(rev6PeakCounts.reduce((sum,count)=>sum+count,0)).toBeGreaterThanOrEqual(6);const rev6SteepestStep=Math.max(...rev6Ridges.flatMap(profile=>profile.slice(1).map((height,index)=>Math.abs(height-profile[index]))));expect(rev6SteepestStep).toBeLessThan(90);
      const angularSpan=(geometry:THREE.BufferGeometry,group:number)=>{const positions=geometry.getAttribute('position'),angles=Array.from({length:rowSize},(_,i)=>Math.atan2(positions.getZ(group*groupSize+rowSize*3+i),positions.getX(group*groupSize+rowSize*3+i))),anchor=angles[0]!,unwrapped=angles.map(angle=>{let delta=angle-anchor;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;return delta;});return Math.max(...unwrapped)-Math.min(...unwrapped);};expect(Math.min(...Array.from({length:6},(_,group)=>angularSpan(rev6,group)))).toBeGreaterThan(.4);
      const widestAngularGap=(geometry:THREE.BufferGeometry)=>{const positions=geometry.getAttribute('position'),angles=Array.from({length:6},(_,group)=>{const i=group*groupSize+rowSize*3+36;return (Math.atan2(positions.getZ(i),positions.getX(i))+Math.PI*2)%(Math.PI*2);}).sort((x,y)=>x-y);return Math.max(...angles.map((angle,index)=>((angles[(index+1)%angles.length]!+(index===angles.length-1?Math.PI*2:0))-angle)));};expect(widestAngularGap(rev6)).toBeGreaterThan(widestAngularGap(a)+.25);
      const tonalRange=(geometry:THREE.BufferGeometry)=>{const color=geometry.getAttribute('color'),values=Array.from({length:color.count},(_,index)=>color.getX(index)*.2126+color.getY(index)*.7152+color.getZ(index)*.0722);return Math.max(...values)-Math.min(...values);};expect(tonalRange(rev6)).toBeGreaterThan(tonalRange(rev5)*1.4);
      for(let group=0;group<6;group++)for(let row=0;row<7;row++){expect(a.getAttribute('position').getY(group*groupSize+row*rowSize)).toBeLessThan(-50);expect(a.getAttribute('position').getY(group*groupSize+row*rowSize+rowSize-1)).toBeLessThan(-50);}
    }finally{a.dispose();b.dispose();c.dispose();rev4.dispose();rev5.dispose();rev6.dispose();rev6b.dispose();}
  });

  it('exposes upgraded sky/ocean uniforms and scales shadow quality through ultra',()=>{
    const data=new Uint8Array(4*4*4);const height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat);height.needsUpdate=true;const scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height);
    expect(atmosphere.sky.material.uniforms.weather).toBeTruthy();expect(atmosphere.sky.material.uniforms.storm.value).toBe(0);expect(atmosphere.ocean.material.uniforms.storm.value).toBe(0);expect(atmosphere.ocean.material.uniforms.heightMap.value).toBe(height);expect(atmosphere.ocean.material.vertexShader).toContain('storm*sin(p.x*.014-p.z*.021');expect(atmosphere.ocean.material.fragmentShader).toContain('stormCrest=smoothstep');
    atmosphere.update(0,0,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeLessThan(.1);const nightFill=atmosphere.fill.intensity;expect(nightFill).toBeGreaterThan(1.35);expect(atmosphere.fill.groundColor.r).toBeGreaterThan(.4);expect(atmosphere.sun.position.y).toBeGreaterThan(atmosphere.sun.target.position.y);
    atmosphere.sky.material.uniforms.storm.value=.8;atmosphere.update(0,12,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeGreaterThan(.9);expect(atmosphere.fill.intensity).toBeGreaterThan(1.9);expect(atmosphere.fill.intensity).toBeGreaterThan(nightFill);expect(atmosphere.ocean.material.uniforms.storm.value).toBeCloseTo(.8);
    atmosphere.setQuality('ultra');expect(atmosphere.sun.castShadow).toBe(true);expect(atmosphere.sun.shadow.mapSize.x).toBe(3072);
    atmosphere.setQuality('low');expect(atmosphere.sun.castShadow).toBe(false);atmosphere.dispose();height.dispose();
  });

  it('enables long ocean swells only for Revision 6 without changing legacy water',()=>{
    const data=new Uint8Array(64),legacy=new Atmosphere(new THREE.Scene(),new THREE.DataTexture(data,4,4,THREE.RGBAFormat),1280,731942,5),rev6=new Atmosphere(new THREE.Scene(),new THREE.DataTexture(data,4,4,THREE.RGBAFormat),1280,731942,6);
    try{
      expect(legacy.ocean.material.uniforms.revision6.value).toBe(0);
      expect(rev6.ocean.material.uniforms.revision6.value).toBe(1);
      expect(rev6.ocean.material.vertexShader).toContain('revision6*(sin(p.x*.024');
      expect(rev6.ocean.material.vertexShader).toContain('sin(p.x*.032+p.z*.009+clock*.18)*.55');
      expect(rev6.ocean.material.fragmentShader).toContain('if(revision6>.5)');
      expect(rev6.ocean.material.fragmentShader).toContain('swellNormal=vec2(');
      expect(rev6.ocean.material.fragmentShader).toContain('return choppy+revision6*(sin(p.x*.032+p.y*.009+clock*.18)*.55');
    }finally{legacy.dispose();rev6.dispose();}
  });

  it('builds taller layered horizon geometry for Rev6 while preserving legacy layers and draw topology',()=>{
    const pixels=new Uint8Array(64),legacyHeight=new THREE.DataTexture(pixels,4,4,THREE.RGBAFormat),rev6Height=new THREE.DataTexture(pixels,4,4,THREE.RGBAFormat),legacy=new Atmosphere(new THREE.Scene(),legacyHeight,1280,731942,5),rev6=new Atmosphere(new THREE.Scene(),rev6Height,1280,731942,6);
    try{
      const legacyRidge=(legacy.horizon.children[1] as THREE.Mesh).geometry,rev6Ridge=(rev6.horizon.children[1] as THREE.Mesh).geometry;
      expect((legacy.horizon.children[1] as THREE.Mesh).material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect((rev6.horizon.children[1] as THREE.Mesh).material).toBeInstanceOf(THREE.MeshLambertMaterial);
      const litRidge=(rev6.horizon.children[1] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshLambertMaterial>).material;
      rev6.update(0,12,new THREE.Vector3());const daytimeHorizonFill=litRidge.emissiveIntensity;
      rev6.update(0,0,new THREE.Vector3());expect(litRidge.emissiveIntensity).toBeGreaterThan(daytimeHorizonFill);expect(litRidge.emissiveIntensity).toBeLessThan(1);
      legacyRidge.computeBoundingBox();rev6Ridge.computeBoundingBox();
      expect(legacyRidge.index!.count).toBe(rev6Ridge.index!.count);
      expect(rev6Ridge.boundingBox!.max.y).toBeGreaterThan(legacyRidge.boundingBox!.max.y*1.08);
      expect(rev6.horizon.children).toHaveLength(legacy.horizon.children.length);
    }finally{legacy.dispose();rev6.dispose();legacyHeight.dispose();rev6Height.dispose();}
  });

  it('keeps rain/fog from tinting distant mountains as a storm',()=>{
    const height=new THREE.DataTexture(new Uint8Array(64),4,4,THREE.RGBAFormat),scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height),camera=new THREE.Vector3();
    try{
      atmosphere.update(0,10,camera);const clearFog=atmosphere.fog.color.clone(),clearMountain=(atmosphere.horizon.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>).material.color.clone(),clearDensity=atmosphere.fog.density;
      atmosphere.sky.material.uniforms.weather.value=1;atmosphere.sky.material.uniforms.storm.value=0;atmosphere.update(0,10,camera);const rainMountain=(atmosphere.horizon.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>).material.color.clone();
      expect(rainMountain.equals(clearMountain)).toBe(true);expect(atmosphere.fog.color.equals(clearFog)).toBe(true);expect(atmosphere.fog.density).toBeGreaterThan(clearDensity);
      atmosphere.sky.material.uniforms.storm.value=1;atmosphere.update(0,10,camera);const stormMountain=(atmosphere.horizon.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>).material.color;
      expect(stormMountain.equals(clearMountain)).toBe(false);expect(stormMountain.r+stormMountain.g+stormMountain.b).toBeLessThan(clearMountain.r+clearMountain.g+clearMountain.b);expect(atmosphere.fog.color.equals(clearFog)).toBe(false);
    }finally{atmosphere.dispose();height.dispose();}
  });

  it('adds broad storm cloud cover and shortens rain streaks under gusts',()=>{
    const data=new Uint8Array(64),height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat),scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height);
    try{
      expect(atmosphere.sky.material.fragmentShader).toContain('stormCover*.88*storm');
      const clear=Array.from({length:11},(_,index)=>rainStreakLength(index,0)),gust=Array.from({length:11},(_,index)=>rainStreakLength(index,1));
      expect(Math.min(...clear)).toBeCloseTo(.34);expect(Math.max(...clear)).toBeCloseTo(.59);expect(Math.min(...gust)).toBeCloseTo(.50);expect(Math.max(...gust)).toBeCloseTo(.75);
    }finally{atmosphere.dispose();height.dispose();}
  });

  it('adds deterministic, brief lightning flashes only during storms',()=>{
    const seed=731942,bucket=Array.from({length:2000},(_,index)=>index).find(index=>stormLightningRoll(seed,index)>.88)!;
    expect(bucket).toBeDefined();expect(stormLightningRoll(seed,bucket)).toBe(stormLightningRoll(seed,bucket));expect(stormLightningRoll(seed,bucket)).toBeGreaterThanOrEqual(0);expect(stormLightningRoll(seed,bucket)).toBeLessThan(1);
    const state=new GameSimulation(seed,{x:0,y:4,z:0}).state,weatherState=ensureProgression(state).weather;weatherState.kind='storm';weatherState.remaining=3600;weatherState.blend=1;weatherState.rain=1;weatherState.storm=1;state.elapsed=bucket*11;
    const data=new Uint8Array(64),height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat),scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height),weather=new Weather(scene),camera=new THREE.Vector3();let peak=0;
    try{for(let frame=0;frame<20;frame++){atmosphere.update(1/60,10,camera);const output=weather.update(1/60,state,atmosphere,camera,'high');peak=Math.max(peak,output.lightning);state.elapsed+=1/60;}expect(peak).toBeGreaterThan(.35);expect(atmosphere.sky.material.uniforms.lightning.value).toBeGreaterThanOrEqual(0);expect(atmosphere.sky.material.uniforms.storm.value).toBe(weatherState.storm);expect(weatherState.storm).toBeGreaterThan(0);weatherState.kind='clear';expect(weather.update(1/60,state,atmosphere,camera,'high').lightning).toBe(0);}
    finally{weather.dispose();atmosphere.dispose();height.dispose();}
  });
});
