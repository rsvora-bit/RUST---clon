import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {rockGeometry,surfaceAlignedQuaternion,terrainContactOffset} from '../src/world/models';

describe('procedural rock geometry',()=>{
  it('keeps each seed deterministic while producing distinct faceted silhouettes',()=>{
    const a=rockGeometry(51),again=rockGeometry(51),b=rockGeometry(114);
    const positions=(geometry:ReturnType<typeof rockGeometry>)=>Array.from(geometry.getAttribute('position').array);
    expect(positions(a)).toEqual(positions(again));
    expect(positions(a)).not.toEqual(positions(b));
    for(const geometry of [a,again,b]){
      const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
      expect(position.count).toBeGreaterThan(20);
      for(let i=0;i<position.count;i++){
        expect(Number.isFinite(position.getX(i)+position.getY(i)+position.getZ(i))).toBe(true);
        expect(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))).toBeCloseTo(1,3);
      }
      geometry.dispose();
    }
  });

  it('aligns only the rendered up axis to a slope and preserves yaw around it',()=>{
    const normal=new THREE.Vector3(-.4,1,-.2).normalize();
    const quaternion=surfaceAlignedQuaternion(normal,1.17),up=new THREE.Vector3(0,1,0).applyQuaternion(quaternion);
    expect(up.dot(normal)).toBeCloseTo(1,6);
  });

  it('seats only the rendered rock mesh against a sloped terrain surface',()=>{
    const geometry=new THREE.IcosahedronGeometry(1,1),rotation=surfaceAlignedQuaternion(new THREE.Vector3(-.24,1,.16),.63),matrix=new THREE.Matrix4().compose(new THREE.Vector3(8,5,-11),rotation,new THREE.Vector3(1.7,.9,1.25)),heightAt=(x:number,z:number)=>1.2+.12*x-.08*z,offset=terrainContactOffset(geometry,matrix,heightAt,.035);
    matrix.setPosition(8,5+offset,-11);const position=geometry.getAttribute('position'),point=new THREE.Vector3();let lowest=Infinity;
    for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(matrix);lowest=Math.min(lowest,point.y-heightAt(point.x,point.z));}
    expect(lowest).toBeCloseTo(.035,5);geometry.dispose();
  });

  it('does not pull a resource mesh toward out-of-world fallback heights',()=>{
    const geometry=new THREE.IcosahedronGeometry(1,0);
    expect(terrainContactOffset(geometry,new THREE.Matrix4(),()=>-10)).toBe(0);geometry.dispose();
  });
});
