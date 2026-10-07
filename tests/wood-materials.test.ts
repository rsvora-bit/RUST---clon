import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { addInstanceWindResponse, disposeMaterialTextures, metalMaterial, metalSurfaceMaps, stoneMaterial, treeBarkMaterial, woodSurfaceMaps } from '../src/rendering/materials';

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
  it('shares linear bark grain and roughness maps between legacy and instanced trunk materials',()=>{
    const maps=woodSurfaceMaps(449,64),albedo=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);albedo.colorSpace=THREE.SRGBColorSpace;
    const legacy=treeBarkMaterial(albedo,maps),instanced=treeBarkMaterial(albedo,maps,true);
    try{
      expect(legacy.normalMap).toBe(maps.normal);expect(legacy.roughnessMap).toBe(maps.roughness);expect(legacy.vertexColors).toBe(false);
      expect(instanced.normalMap).toBe(legacy.normalMap);expect(instanced.roughnessMap).toBe(legacy.roughnessMap);expect(instanced.vertexColors).toBe(true);
      expect(instanced.normalScale.x).toBeCloseTo(.12);expect(instanced.roughness).toBeCloseTo(.97);
    }finally{legacy.dispose();instanced.dispose();albedo.dispose();maps.normal.dispose();maps.roughness.dispose();}
  });
});

describe('weathered salvage-metal surface maps',()=>{
  it('keeps brushed normal and scratch roughness detail deterministic and in linear space',()=>{
    const first=metalSurfaceMaps(842,64),repeat=metalSurfaceMaps(842,64),variant=metalSurfaceMaps(843,64);
    try{
      expect(first.color.colorSpace).toBe(THREE.SRGBColorSpace);expect(first.normal.colorSpace).toBe(THREE.NoColorSpace);expect(first.roughness.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.color.image.data).toEqual(repeat.color.image.data);expect(first.normal.image.data).toEqual(repeat.normal.image.data);expect(first.roughness.image.data).toEqual(repeat.roughness.image.data);
      expect(first.color.image.data).not.toEqual(variant.color.image.data);expect(first.normal.image.data).not.toEqual(variant.normal.image.data);
      const color=first.color.image.data as Uint8Array;expect(new Set(Array.from({length:64*64},(_,index)=>`${color[index*4]},${color[index*4+1]},${color[index*4+2]}`)).size).toBeGreaterThan(100);
      const roughness=first.roughness.image.data as Uint8Array;
      expect(Math.min(...Array.from({length:64*64},(_,index)=>roughness[index*4]!))).toBeGreaterThanOrEqual(163);
      expect(Math.max(...Array.from({length:64*64},(_,index)=>roughness[index*4]!))).toBeLessThanOrEqual(248);
    }finally{for(const maps of [first,repeat,variant]){maps.color.dispose();maps.normal.dispose();maps.roughness.dispose();}}
  });
  it('attaches its procedural maps to PBR metal and disposes their GPU resources with the material',()=>{
    const material=metalMaterial(0x64706b,.88,.3,842),textures=material.userData.textures as THREE.Texture[];let disposed=0;
    textures.forEach(texture=>texture.addEventListener('dispose',()=>disposed++));
    expect(material.map?.colorSpace).toBe(THREE.SRGBColorSpace);expect(material.normalScale.x).toBeCloseTo(.085);expect(material.metalness).toBeCloseTo(.3);disposeMaterialTextures(material);expect(disposed).toBe(3);
  });
});

describe('shared built-stone PBR material',()=>{
  it('uses separate deterministic albedo, linear roughness and normal textures',()=>{
    const context={fillStyle:'#000',fillRect:vi.fn()} as unknown as CanvasRenderingContext2D,canvas={width:0,height:0,getContext:()=>context};vi.stubGlobal('document',{createElement:()=>canvas});
    const material=stoneMaterial(),textures=material.userData.textures as THREE.Texture[];let disposed=0;textures.forEach(texture=>texture.addEventListener('dispose',()=>disposed++));
    expect(material.map?.colorSpace).toBe(THREE.SRGBColorSpace);expect(material.normalMap?.colorSpace).toBe(THREE.NoColorSpace);expect(material.roughnessMap?.colorSpace).toBe(THREE.NoColorSpace);expect(material.normalScale.x).toBeCloseTo(.11);expect(material.roughness).toBeCloseTo(.94);expect(textures).toHaveLength(3);
    disposeMaterialTextures(material);expect(disposed).toBe(3);
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
    expect(shader.vertexShader).toContain('float windHash=fract(sin(dot(windOrigin.xz,vec2(127.1,311.7)))*43758.5453)');
    expect(shader.vertexShader).toContain('float windGust=.78+windHash*.44');
    expect(shader.vertexShader).toContain('transformed.x+=windWave*windHeight');
    const before=shader.vertexShader;addInstanceWindResponse(material,time,strength,.095,.34);
    expect(material.onBeforeCompile).toBeDefined();expect(shader.vertexShader).toBe(before);material.dispose();
  });
});
