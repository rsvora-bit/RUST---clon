import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {grassGeometry,pineGeometry,pineMassGeometry,broadleafGeometry,bushGeometry,palmGeometry,palmTrunkGeometry} from '../src/world/models';

describe('foliage geometry stability',()=>{
  it('has finite, unit-length normals and no degenerate triangles across variants',()=>{
    const geometries=[grassGeometry(),bushGeometry(),palmGeometry(),palmTrunkGeometry(),...[0,1,2].map(variant=>pineGeometry(variant)),...[0,1,2].map(variant=>pineGeometry(variant,true)),...[0,1,2].map(pineMassGeometry),...[0,1].map(variant=>broadleafGeometry(variant))];
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    try {
      for(let geometryIndex=0;geometryIndex<geometries.length;geometryIndex++){
        const geometry=geometries[geometryIndex];
        const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.index;
        expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
        for(let i=0;i<normal.count;i++){a.fromBufferAttribute(normal,i);expect(a.length(),`geometry ${geometryIndex}, normal ${i}`).toBeCloseTo(1,4);}
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
      expect(fuller.boundingBox!.max.y).toBeGreaterThan(.90);
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
        if(blade%4===0)expect(height).toBeGreaterThan(.53);else expect(height).toBeLessThan(.82);
      }
      const anchors=[0,4,8].map(blade=>position.getY(blade*3+2));
      expect(Math.max(...anchors)-Math.min(...anchors)).toBeGreaterThan(.18);
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
  it('preserves the original pine position, normal, UV and index buffers for legacy worlds',async()=>{
    const digests=['f4bf8aa6a9ff604aebe3decaedbdc1c6c8f510f39f0d1747180eb263b6d44cd2','24f79365521bb25c0dcd7cb4e48ccc1a29b5f7952597e85e81b4ed9e86347411','9175815af44eef8d88e87683ae17afdef02d4283ee7549b6d1470974a715fd4c'];
    for(const variant of [0,1,2]){
      const geometry=pineGeometry(variant,false);
      try{
        const arrays=[...['position','normal','uv'].map(name=>geometry.getAttribute(name).array),geometry.index!.array];
        const bytes=new Uint8Array(arrays.reduce((sum,array)=>sum+array.byteLength,0));let offset=0;
        for(const array of arrays){bytes.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),offset);offset+=array.byteLength;}
        const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
        expect(Array.from(hash).map(byte=>byte.toString(16).padStart(2,'0')).join('')).toBe(digests[variant]);
      }finally{geometry.dispose();}
    }
  });
  it('directs revision-6 pine sprays outward on both axes with the existing triangle budget',()=>{
    for(const variant of [0,1,2]){
      const legacy=pineGeometry(variant),geometry=pineGeometry(variant,true),repeat=pineGeometry(variant,true),position=geometry.getAttribute('position');
      try{
        expect(geometry.index!.count).toBe(legacy.index!.count);expect(position.count).toBe(legacy.getAttribute('position').count);
        expect(Array.from(position.array)).toEqual(Array.from(repeat.getAttribute('position').array));
        for(let i=0;i<position.count;i+=6){
          const x=(position.getX(i+4)+position.getX(i+5))/2,z=(position.getZ(i+4)+position.getZ(i+5))/2;if(Math.hypot(x,z)<.01)continue;
          const dx=(position.getX(i)+position.getX(i+1))/2-x,dz=(position.getZ(i)+position.getZ(i+1))/2-z;
          expect((x*dx+z*dz)/(Math.hypot(x,z)*Math.hypot(dx,dz))).toBeGreaterThan(.75);
        }
        geometry.computeBoundingBox();const span=geometry.boundingBox!.getSize(new THREE.Vector3());expect(Math.min(span.x,span.z)/Math.max(span.x,span.z)).toBeGreaterThan(.75);
      }finally{legacy.dispose();geometry.dispose();repeat.dispose();}
    }
  });
  it('builds deterministic low-polygon pine crown volumes for revision 6',()=>{
    for(const variant of [0,1,2]){
      const a=pineMassGeometry(variant),b=pineMassGeometry(variant);
      try{
        a.computeBoundingBox();b.computeBoundingBox();
        expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
        expect((a.index?.count??a.getAttribute('position').count)/3).toBeLessThanOrEqual(600);
        expect(a.getAttribute('color').count).toBe(a.getAttribute('position').count);
        expect(a.getAttribute('color').getY(0)).toBeGreaterThan(a.getAttribute('color').getX(0));
        expect(a.boundingBox!.min.y).toBeGreaterThan(1.5);
        expect(a.boundingBox!.max.y).toBeGreaterThan([12.8,15,10.8][variant]!-1.3);
      }finally{a.dispose();b.dispose();}
    }
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
  it('keeps revision-6 broadleaf sprays smaller than legacy cards with the same triangle budget',()=>{
    const rev6=broadleafGeometry(0,true,'leaves'),legacy=broadleafGeometry(0,false,'leaves');
    try{
      const meanTriangleArea=(geometry:THREE.BufferGeometry)=>{const position=geometry.getAttribute('position'),index=geometry.index!,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let area=0;for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(position,index.getX(i));b.fromBufferAttribute(position,index.getX(i+1));c.fromBufferAttribute(position,index.getX(i+2));area+=b.sub(a).cross(c.sub(a)).length()*.5;}return area/(index.count/3);};
      expect(meanTriangleArea(rev6)).toBeLessThan(meanTriangleArea(legacy)*.9);
      expect(rev6.index!.count).toBe(7*34*6);
    }finally{rev6.dispose();legacy.dispose();}
  });
});
