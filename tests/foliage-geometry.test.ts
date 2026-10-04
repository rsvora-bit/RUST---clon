import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {grassGeometry,pineGeometry,broadleafGeometry,bushGeometry,palmGeometry,palmTrunkGeometry} from '../src/world/models';

describe('foliage geometry stability',()=>{
  it('has finite, unit-length normals and no degenerate triangles across variants',()=>{
    const geometries=[grassGeometry(),bushGeometry(),palmGeometry(),palmTrunkGeometry(),...[0,1,2].map(pineGeometry),...[0,1].map(variant=>broadleafGeometry(variant))];
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    try {
      for(const geometry of geometries){
        const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.index;
        expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
        for(let i=0;i<normal.count;i++){a.fromBufferAttribute(normal,i);expect(a.length()).toBeCloseTo(1,4);}
        const count=index?index.count:position.count;
        for(let i=0;i<count;i+=3){
          a.fromBufferAttribute(position,index?index.getX(i):i);b.fromBufferAttribute(position,index?index.getX(i+1):i+1);c.fromBufferAttribute(position,index?index.getX(i+2):i+2);
          expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-12);
        }
      }
    }finally{geometries.forEach(g=>g.dispose());}
  });
  it('keeps grass deterministic and within a small world-space footprint',()=>{
    const a=grassGeometry(),b=grassGeometry();
    try {
      expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
      a.computeBoundingBox();expect(a.boundingBox!.min.y).toBe(0);expect(a.boundingBox!.max.y).toBeLessThan(1);
      expect(a.boundingBox!.getSize(new THREE.Vector3()).x).toBeLessThan(1);
      expect(a.index!.count/3).toBe(36);
    }finally{a.dispose();b.dispose();}
  });
  it('fills revision-6 grass tufts while simplifying each blade mesh',()=>{
    const legacy=grassGeometry(),fuller=grassGeometry(true);
    try {
      legacy.computeBoundingBox();fuller.computeBoundingBox();
      expect(Math.hypot(fuller.boundingBox!.getSize(new THREE.Vector3()).x,fuller.boundingBox!.getSize(new THREE.Vector3()).z)).toBeGreaterThan(Math.hypot(legacy.boundingBox!.getSize(new THREE.Vector3()).x,legacy.boundingBox!.getSize(new THREE.Vector3()).z)*1.15);
      expect(fuller.boundingBox!.max.y).toBeGreaterThan(legacy.boundingBox!.max.y*1.08);
      expect(fuller.index!.count).toBe(legacy.index!.count/3);
      expect(fuller.index!.count/3).toBe(12);
    }finally{legacy.dispose();fuller.dispose();}
  });
  it('keeps revision-6 broadleaf cards close to the branches without collapsing the crown',()=>{
    const legacy=broadleafGeometry(0),rev6=broadleafGeometry(0,true),repeat=broadleafGeometry(0,true);
    try{
      legacy.computeBoundingBox();rev6.computeBoundingBox();
      expect(rev6.index!.count).toBeLessThanOrEqual(legacy.index!.count*1.1);
      expect(Array.from(rev6.getAttribute('position').array)).toEqual(Array.from(repeat.getAttribute('position').array));
      const legacySpan=Math.hypot(legacy.boundingBox!.getSize(new THREE.Vector3()).x,legacy.boundingBox!.getSize(new THREE.Vector3()).z),rev6Span=Math.hypot(rev6.boundingBox!.getSize(new THREE.Vector3()).x,rev6.boundingBox!.getSize(new THREE.Vector3()).z);
      expect(rev6Span).toBeLessThan(legacySpan*.85);expect(rev6Span).toBeGreaterThan(legacySpan*.7);
      expect(rev6.boundingBox!.max.y).toBeGreaterThan(legacy.boundingBox!.max.y*.93);
    }finally{legacy.dispose();rev6.dispose();repeat.dispose();}
  });
  it('separates revision-6 solid crown masses from alpha-cutout leaf cards',()=>{
    const whole=broadleafGeometry(0,true),masses=broadleafGeometry(0,true,'masses'),leaves=broadleafGeometry(0,true,'leaves');
    try{
      expect(masses.index!.count+leaves.index!.count).toBe(whole.index!.count);
      expect(masses.index!.count).toBeGreaterThan(0);
      expect(leaves.index!.count).toBeGreaterThan(0);
      masses.computeBoundingBox();leaves.computeBoundingBox();
      expect(masses.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(2.7);
      expect(leaves.boundingBox!.getSize(new THREE.Vector3()).y).toBeGreaterThan(4.5);
    }finally{whole.dispose();masses.dispose();leaves.dispose();}
  });
  it('gives revision-6 broadleaf crowns a wider low-cost leaf silhouette around the solid core',()=>{
    const whole=broadleafGeometry(0,true),masses=broadleafGeometry(0,true,'masses'),leaves=broadleafGeometry(0,true,'leaves'),legacy=broadleafGeometry(0);
    try{
      whole.computeBoundingBox();masses.computeBoundingBox();leaves.computeBoundingBox();
      const width=(geometry:THREE.BufferGeometry)=>Math.hypot(geometry.boundingBox!.getSize(new THREE.Vector3()).x,geometry.boundingBox!.getSize(new THREE.Vector3()).z);
      expect(width(leaves)).toBeGreaterThan(width(masses)*1.08);
      expect(whole.index!.count/3).toBeLessThanOrEqual(legacy.index!.count/3*1.1);
    }finally{whole.dispose();masses.dispose();leaves.dispose();legacy.dispose();}
  });
});
