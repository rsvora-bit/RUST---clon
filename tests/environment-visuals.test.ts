import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {fernGeometry,twigGeometry,seaweedGeometry} from '../src/world/models';
import {Atmosphere} from '../src/world/atmosphere';

describe('environment visual building blocks',()=>{
  it('builds non-empty low-cost understory and coast geometry',()=>{
    for(const geometry of [fernGeometry(),twigGeometry(),seaweedGeometry()]){expect(geometry.getAttribute('position').count).toBeGreaterThan(20);geometry.dispose();}
  });

  it('exposes upgraded sky/ocean uniforms and scales shadow quality through ultra',()=>{
    const data=new Uint8Array(4*4*4);const height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat);height.needsUpdate=true;const scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height);
    expect(atmosphere.sky.material.uniforms.weather).toBeTruthy();expect(atmosphere.ocean.material.uniforms.heightMap.value).toBe(height);
    atmosphere.update(0,0,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeLessThan(.1);expect(atmosphere.fill.intensity).toBeGreaterThanOrEqual(1.6);expect(atmosphere.fill.groundColor.r).toBeGreaterThan(.38);expect(atmosphere.sun.position.y).toBeGreaterThan(atmosphere.sun.target.position.y);
    atmosphere.update(0,12,new THREE.Vector3());expect(atmosphere.daylightAmount).toBeGreaterThan(.9);expect(atmosphere.fill.intensity).toBeGreaterThan(1.9);
    atmosphere.setQuality('ultra');expect(atmosphere.sun.castShadow).toBe(true);expect(atmosphere.sun.shadow.mapSize.x).toBe(3072);
    atmosphere.setQuality('low');expect(atmosphere.sun.castShadow).toBe(false);atmosphere.dispose();height.dispose();
  });
});
