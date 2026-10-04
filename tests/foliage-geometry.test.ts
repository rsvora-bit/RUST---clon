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
  it('groups the same revision-6 grass blade budget into three loose sprays',()=>{
    const geometry=grassGeometry(true),position=geometry.getAttribute('position');
    try{
      for(let cluster=0;cluster<3;cluster++)for(let blade=cluster*4;blade<cluster*4+4;blade++){
        const a=new THREE.Vector3().fromBufferAttribute(position,blade*3),b=new THREE.Vector3().fromBufferAttribute(position,blade*3+1),angle=Math.atan2((a.z+b.z)*.5,(a.x+b.x)*.5),center=cluster*Math.PI*2/3;
        const difference=Math.atan2(Math.sin(angle-center),Math.cos(angle-center));
        expect(Math.abs(difference)).toBeLessThan(.44);
        const height=position.getY(blade*3+2);
        if(blade%4===0)expect(height).toBeGreaterThan(.9);else expect(height).toBeLessThan(.82);
      }
      expect(geometry.index!.count/3).toBe(12);
    }finally{geometry.dispose();}
  });
  it('varies deterministic revision-6 grass silhouettes by chunk while preserving legacy geometry',()=>{
    const legacy=grassGeometry(false,0),legacyOtherVariant=grassGeometry(false,3),a=grassGeometry(true,0),b=grassGeometry(true,1),repeat=grassGeometry(true,0);
    try{
      expect(Array.from(legacy.getAttribute('position').array)).toEqual(Array.from(legacyOtherVariant.getAttribute('position').array));
      expect(Array.from(a.getAttribute('position').array)).not.toEqual(Array.from(b.getAttribute('position').array));
      expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(repeat.getAttribute('position').array));
      expect(a.index!.count).toBe(b.index!.count);expect(a.getAttribute('position').count).toBe(b.getAttribute('position').count);
    }finally{legacy.dispose();legacyOtherVariant.dispose();a.dispose();b.dispose();repeat.dispose();}
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
