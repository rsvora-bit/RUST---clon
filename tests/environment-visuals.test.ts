import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {fernGeometry,forestShrubGeometry,twigGeometry,seaweedGeometry,reedGeometry,marshPoolGeometry} from '../src/world/models';
import {Atmosphere} from '../src/world/atmosphere';
import {Weather,rainStreakLength,stormLightningRoll} from '../src/survival/Weather';
import {mountainLayer} from '../src/world/horizon';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {ensureProgression} from '../src/survival/progression';

describe('environment visual building blocks',()=>{
  it('builds non-empty low-cost understory and coast geometry',()=>{
    for(const geometry of [fernGeometry(),twigGeometry(),seaweedGeometry(),reedGeometry()]){expect(geometry.getAttribute('position').count).toBeGreaterThan(20);expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);geometry.dispose();}
  });

  it('keeps fuller revision-6 ferns broader without increasing their triangle count',()=>{
    const legacy=fernGeometry(),fuller=fernGeometry(true);
    try{legacy.computeBoundingBox();fuller.computeBoundingBox();const legacySize=legacy.boundingBox!.getSize(new THREE.Vector3()),fullerSize=fuller.boundingBox!.getSize(new THREE.Vector3());expect(Math.hypot(fullerSize.x,fullerSize.z)).toBeGreaterThan(Math.hypot(legacySize.x,legacySize.z)*1.1);expect(fullerSize.y).toBeGreaterThan(legacySize.y*1.1);expect(fuller.index!.count).toBe(legacy.index!.count);}
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

  it('builds a deterministic shallow marsh bowl with a silty vertex-color edge',()=>{
    const a=marshPoolGeometry(88217),b=marshPoolGeometry(88217),other=marshPoolGeometry(88218);
    try{
      const positions=a.getAttribute('position'),colors=a.getAttribute('color'),normals=a.getAttribute('normal');
      expect(a.index!.count/3).toBe(160);expect(positions.count).toBe(97);expect(colors.count).toBe(positions.count);
      expect(Array.from(positions.array)).toEqual(Array.from(b.getAttribute('position').array));expect(Array.from(colors.array)).toEqual(Array.from(b.getAttribute('color').array));
      expect(Array.from(positions.array)).not.toEqual(Array.from(other.getAttribute('position').array));
      expect(Array.from(positions.array).every(Number.isFinite)&&Array.from(normals.array).every(Number.isFinite)).toBe(true);
      expect(Math.min(...Array.from({length:positions.count},(_,i)=>positions.getY(i)))).toBeCloseTo(-.035,4);
      expect(Math.max(...Array.from({length:positions.count},(_,i)=>positions.getY(i)))).toBeCloseTo(0,4);
      expect(colors.getX(0)).not.toBeCloseTo(colors.getX(positions.count-1),2);
    }finally{a.dispose();b.dispose();other.dispose();}
  });

  it('keeps distant mountain silhouettes deterministic, irregular and low-cost',()=>{
    const a=mountainLayer(731942,1,true),b=mountainLayer(731942,1,true),c=mountainLayer(731943,1,true);
    try {
      expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
      expect(Array.from(a.getAttribute('position').array)).not.toEqual(Array.from(c.getAttribute('position').array));
      expect(a.index!.count/3).toBe(5184);expect(a.boundingBox).toBeNull();a.computeBoundingBox();
      expect(a.boundingBox!.max.y).toBeGreaterThan(260);expect(a.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(260);expect(a.boundingSphere!.radius).toBeLessThan(1800);
      const rowSize=73,groupSize=rowSize*7,ridges=Array.from({length:6},(_,group)=>Array.from({length:rowSize},(_,i)=>a.getAttribute('position').getY(group*groupSize+rowSize*3+i)));
      const peakCounts=ridges.map(profile=>profile.slice(1,-1).filter((height,index)=>height>profile[index]&&height>=profile[index+2]).length);
      expect(peakCounts.some(count=>count>=3)).toBe(true);
      for(let group=0;group<6;group++)for(let row=0;row<7;row++){expect(a.getAttribute('position').getY(group*groupSize+row*rowSize)).toBeLessThan(-50);expect(a.getAttribute('position').getY(group*groupSize+row*rowSize+rowSize-1)).toBeLessThan(-50);}
    }finally{a.dispose();b.dispose();c.dispose();}
  });

  it('exposes upgraded sky/ocean uniforms and scales shadow quality through ultra',()=>{
    const data=new Uint8Array(4*4*4);const height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat);height.needsUpdate=true;const scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height);
    expect(atmosphere.sky.material.uniforms.weather).toBeTruthy();expect(atmosphere.sky.material.uniforms.storm.value).toBe(0);expect(atmosphere.ocean.material.uniforms.heightMap.value).toBe(height);
    atmosphere.update(0,0,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeLessThan(.1);const nightFill=atmosphere.fill.intensity;expect(nightFill).toBeGreaterThan(1.35);expect(atmosphere.fill.groundColor.r).toBeGreaterThan(.4);expect(atmosphere.sun.position.y).toBeGreaterThan(atmosphere.sun.target.position.y);
    atmosphere.update(0,12,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeGreaterThan(.9);expect(atmosphere.fill.intensity).toBeGreaterThan(1.9);expect(atmosphere.fill.intensity).toBeGreaterThan(nightFill);
    atmosphere.setQuality('ultra');expect(atmosphere.sun.castShadow).toBe(true);expect(atmosphere.sun.shadow.mapSize.x).toBe(3072);
    atmosphere.setQuality('low');expect(atmosphere.sun.castShadow).toBe(false);atmosphere.dispose();height.dispose();
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
