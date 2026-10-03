import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {fernGeometry,twigGeometry,seaweedGeometry,reedGeometry} from '../src/world/models';
import {Atmosphere} from '../src/world/atmosphere';
import {Weather,stormLightningRoll} from '../src/survival/Weather';
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

  it('keeps distant mountain silhouettes deterministic, irregular and low-cost',()=>{
    const a=mountainLayer(731942,1,true),b=mountainLayer(731942,1,true),c=mountainLayer(731943,1,true);
    try {
      expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
      expect(Array.from(a.getAttribute('position').array)).not.toEqual(Array.from(c.getAttribute('position').array));
      expect(a.index!.count/3).toBe(1728);expect(a.boundingBox).toBeNull();a.computeBoundingBox();
      expect(a.boundingBox!.max.y).toBeGreaterThan(260);expect(a.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(260);
    }finally{a.dispose();b.dispose();c.dispose();}
  });

  it('exposes upgraded sky/ocean uniforms and scales shadow quality through ultra',()=>{
    const data=new Uint8Array(4*4*4);const height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat);height.needsUpdate=true;const scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height);
    expect(atmosphere.sky.material.uniforms.weather).toBeTruthy();expect(atmosphere.ocean.material.uniforms.heightMap.value).toBe(height);
    atmosphere.update(0,0,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeLessThan(.1);const nightFill=atmosphere.fill.intensity;expect(nightFill).toBeGreaterThan(1.35);expect(atmosphere.fill.groundColor.r).toBeGreaterThan(.4);expect(atmosphere.sun.position.y).toBeGreaterThan(atmosphere.sun.target.position.y);
    atmosphere.update(0,12,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeGreaterThan(.9);expect(atmosphere.fill.intensity).toBeGreaterThan(1.9);expect(atmosphere.fill.intensity).toBeGreaterThan(nightFill);
    atmosphere.setQuality('ultra');expect(atmosphere.sun.castShadow).toBe(true);expect(atmosphere.sun.shadow.mapSize.x).toBe(3072);
    atmosphere.setQuality('low');expect(atmosphere.sun.castShadow).toBe(false);atmosphere.dispose();height.dispose();
  });

  it('adds deterministic, brief lightning flashes only during storms',()=>{
    const seed=731942,bucket=Array.from({length:2000},(_,index)=>index).find(index=>stormLightningRoll(seed,index)>.88)!;
    expect(bucket).toBeDefined();expect(stormLightningRoll(seed,bucket)).toBe(stormLightningRoll(seed,bucket));expect(stormLightningRoll(seed,bucket)).toBeGreaterThanOrEqual(0);expect(stormLightningRoll(seed,bucket)).toBeLessThan(1);
    const state=new GameSimulation(seed,{x:0,y:4,z:0}).state,weatherState=ensureProgression(state).weather;weatherState.kind='storm';weatherState.remaining=3600;weatherState.blend=1;weatherState.rain=1;weatherState.storm=1;state.elapsed=bucket*11;
    const data=new Uint8Array(64),height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat),scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height),weather=new Weather(scene),camera=new THREE.Vector3();let peak=0;
    try{for(let frame=0;frame<20;frame++){atmosphere.update(1/60,10,camera);const output=weather.update(1/60,state,atmosphere,camera,'high');peak=Math.max(peak,output.lightning);state.elapsed+=1/60;}expect(peak).toBeGreaterThan(.35);expect(atmosphere.sky.material.uniforms.lightning.value).toBeGreaterThanOrEqual(0);weatherState.kind='clear';expect(weather.update(1/60,state,atmosphere,camera,'high').lightning).toBe(0);}
    finally{weather.dispose();atmosphere.dispose();height.dispose();}
  });
});
