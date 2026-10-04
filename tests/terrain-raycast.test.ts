import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createTerrainRaycastMesh} from '../src/terrain/raycast';

function field(size:number,segments:number){
  const geometry=new THREE.PlaneGeometry(size,size,segments,segments);geometry.rotateX(-Math.PI/2);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)positions.setY(i,Math.sin(positions.getX(i)*.08)*5+Math.cos(positions.getZ(i)*.1)*4);
  geometry.computeVertexNormals();return geometry;
}
const details=(hits:THREE.Intersection[])=>hits.map(({distance,point,face,faceIndex,uv,normal})=>({distance,point:point.toArray(),face,faceIndex,uv:uv?.toArray(),normal:normal?.toArray()}));
function compare(source:THREE.PlaneGeometry,origins:THREE.Vector3[],directions:THREE.Vector3[],ranges:[number,number][],transformed=false){
  const reference=new THREE.Mesh(source,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),proxy=createTerrainRaycastMesh(source);
  for(const mesh of [reference,proxy]){if(transformed){mesh.position.set(11,-3,9);mesh.rotation.set(.1,.7,0);mesh.scale.set(1.2,.8,1.4);}mesh.updateMatrixWorld();}
  let hits=0;
  for(let i=0;i<origins.length;i++){
    const [near,far]=ranges[i%ranges.length],ray=new THREE.Raycaster(origins[i],directions[i%directions.length].clone().normalize(),near,far);
    const expected=details(ray.intersectObject(reference)),actual=details(ray.intersectObject(proxy));expect(actual).toEqual(expected);hits+=actual.length;
    expect(proxy.geometry.drawRange).toEqual(source.drawRange);
  }
  return hits;
}

describe('exact terrain grid raycasting',()=>{
  it.each([[720,240],[1664,500]])('matches legacy-sized and Rev6-sized triangle results (%im / %i cells)',(size,segments)=>{
    const source=field(size,segments),half=size/2;
    const origins=[new THREE.Vector3(0,30,0),new THREE.Vector3(1,15,2),new THREE.Vector3(half-1,30,half-1),new THREE.Vector3(-half-30,30,-half-30),new THREE.Vector3(0,30,0),new THREE.Vector3(20,15,20)];
    const directions=[new THREE.Vector3(0,-1,0),new THREE.Vector3(.1,-1,.2),new THREE.Vector3(.1,-1,.1),new THREE.Vector3(1,-.01,1),new THREE.Vector3(0,1,0),new THREE.Vector3(1,-.5,1)];
    expect(compare(source,origins,directions,[[0,60],[0,30],[0,60],[0,2000],[0,30],[0,3]])).toBeGreaterThan(0);
    expect(compare(source,[origins[0],origins[0],origins[0]],[directions[0]],[[0,Infinity],[0,3],[25,60]])).toBeGreaterThan(0);
  });
  it('matches deterministic oblique rays through translated, rotated and scaled heightfields',()=>{
    const source=field(72,24),origins:THREE.Vector3[]=[],directions:THREE.Vector3[]=[];
    let state=731942;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let i=0;i<100;i++){origins.push(new THREE.Vector3((random()-.5)*90,random()*40-10,(random()-.5)*90));directions.push(new THREE.Vector3(random()-.5,random()*2-1,random()-.5));}
    expect(compare(source,origins,directions,[[0,3],[0,20],[5,100],[0,Infinity]],true)).toBeGreaterThan(0);
  });
  it('shares buffers while keeping the render draw range and a restricted proxy range intact',()=>{
    const source=field(72,24);source.setDrawRange(0,36);const proxy=createTerrainRaycastMesh(source);
    expect(proxy.geometry.index).toBe(source.index);expect(proxy.geometry.getAttribute('position')).toBe(source.getAttribute('position'));expect(proxy.geometry.drawRange).not.toBe(source.drawRange);
    expect(compare(source,[new THREE.Vector3(-34,30,-34),new THREE.Vector3(0,30,0)],[new THREE.Vector3(0,-1,0)],[[0,60]])).toBeGreaterThan(0);
    expect(source.drawRange).toEqual({start:0,count:36});
  });
  it('limits a 3m ray to nearby cells instead of all 500000 terrain triangles',()=>{
    const source=field(1664,500),exact=THREE.Mesh.prototype.raycast,counts:number[]=[];
    const spy=vi.spyOn(THREE.Mesh.prototype,'raycast').mockImplementation(function(this:THREE.Mesh,ray,hits){counts.push(this.geometry.drawRange.count/3);exact.call(this,ray,hits);});
    try{
      const proxy=createTerrainRaycastMesh(source);proxy.updateMatrixWorld();
      const ray=new THREE.Raycaster(new THREE.Vector3(0,5,0),new THREE.Vector3(.2,-1,.2).normalize(),0,3);ray.intersectObject(proxy);
      expect(counts.length).toBeGreaterThan(0);expect(counts.reduce((sum,count)=>sum+count,0)).toBeLessThan(200);expect(source.drawRange.count).toBe(Infinity);expect(proxy.geometry.drawRange.count).toBe(Infinity);
    }finally{spy.mockRestore();}
  });
});
