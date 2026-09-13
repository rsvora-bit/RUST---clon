import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {grassGeometry,pineGeometry,broadleafGeometry,bushGeometry} from '../src/world/models';

describe('foliage geometry stability',()=>{
  it('has finite, unit-length normals and no degenerate triangles across variants',()=>{
    const geometries=[grassGeometry(),bushGeometry(),...[0,1,2].map(pineGeometry),...[0,1].map(broadleafGeometry)];
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
      expect(a.index!.count/3).toBe(21);
    }finally{a.dispose();b.dispose();}
  });
});
