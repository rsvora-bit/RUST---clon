import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { addInstanceWindResponse, woodSurfaceMaps } from '../src/rendering/materials';

afterEach(()=>vi.unstubAllGlobals());

describe('procedural wood surface maps',()=>{
  it('creates repeatable linear roughness and tangent normal detail',()=>{
    const first=woodSurfaceMaps(318,64),repeat=woodSurfaceMaps(318,64),variant=woodSurfaceMaps(319,64);
    try{
      expect(first.normal.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.roughness.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.normal.wrapS).toBe(THREE.RepeatWrapping);
      expect(first.normal.image.data).toEqual(repeat.normal.image.data);
      expect(first.roughness.image.data).toEqual(repeat.roughness.image.data);
      expect(first.normal.image.data).not.toEqual(variant.normal.image.data);
      const normals=first.normal.image.data as Uint8Array,roughness=first.roughness.image.data as Uint8Array;
      expect(new Set(Array.from({length:64*64},(_,index)=>normals[index*4]+','+normals[index*4+1])).size).toBeGreaterThan(100);
      expect(Math.min(...Array.from({length:64*64},(_,index)=>roughness[index*4]!))).toBeGreaterThanOrEqual(142);
      expect(Math.max(...Array.from({length:64*64},(_,index)=>roughness[index*4]!))).toBeLessThanOrEqual(240);
    }finally{for(const maps of [first,repeat,variant]){maps.normal.dispose();maps.roughness.dispose();}}
  });
});

describe('instanced vegetation wind',()=>{
  it('injects per-instance phase and upper-canopy vertex motion once',()=>{
    const material=new THREE.MeshStandardMaterial(),time={value:2},strength={value:.2};
    addInstanceWindResponse(material,time,strength,.095,.34);
    const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <common>\n#include <begin_vertex>'};
    material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
    expect(shader.uniforms.tidelandWindTime?.value).toBe(time.value);
    expect(shader.uniforms.tidelandWindStrength?.value).toBe(strength.value);
    expect(shader.vertexShader).toContain('#ifdef USE_INSTANCING');
    expect(shader.vertexShader).toContain('dot(windOrigin.xz,vec2(.031,.027))');
    expect(shader.vertexShader).toContain('transformed.x+=windWave*windHeight');
    const before=shader.vertexShader;addInstanceWindResponse(material,time,strength,.095,.34);
    expect(material.onBeforeCompile).toBeDefined();expect(shader.vertexShader).toBe(before);material.dispose();
  });
});
