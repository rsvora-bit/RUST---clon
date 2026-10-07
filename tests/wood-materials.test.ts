import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { woodSurfaceMaps } from '../src/rendering/materials';

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
