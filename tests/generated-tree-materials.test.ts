import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {splitTreeAssetMesh} from '../src/rendering/environment';

describe('authored tree material groups',()=>{
  it('keeps bark and foliage geometry separate and bakes each material color',()=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      0,0,0, 1,0,0, 0,1,0,
      0,0,1, 1,0,1, 0,1,1,
    ],3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute([
      0,0,1, 0,0,1, 0,0,1,
      0,0,1, 0,0,1, 0,0,1,
    ],3));
    geometry.addGroup(0,3,0);geometry.addGroup(3,3,1);
    const bark=new THREE.MeshStandardMaterial({color:0x523e2a});bark.name='Tideland furrowed bark';
    const foliage=new THREE.MeshStandardMaterial({color:0x33552d});foliage.name='Tideland shaded leaf';
    const mesh=new THREE.Mesh(geometry,[bark,foliage]);

    const parts=splitTreeAssetMesh(mesh,new THREE.Matrix4());

    expect(parts.trunk).toHaveLength(1);expect(parts.foliage).toHaveLength(1);
    expect(parts.trunk[0]!.getAttribute('position').count).toBe(3);
    expect(parts.foliage[0]!.getAttribute('position').count).toBe(3);
    expect(parts.trunk[0]!.getAttribute('color').getX(0)).toBeGreaterThan(.9);
    expect(parts.foliage[0]!.getAttribute('color').getY(0)).toBeGreaterThan(parts.foliage[0]!.getAttribute('color').getX(0));

    [...parts.trunk,...parts.foliage].forEach(part=>part.dispose());geometry.dispose();bark.dispose();foliage.dispose();
  });

  it('preserves index buffers when extracting material groups',()=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      0,0,0,1,0,0,0,1,0,0,0,1,1,0,1,0,1,1,
    ],3));geometry.setIndex([0,1,2,3,4,5]);geometry.addGroup(0,3,0);geometry.addGroup(3,3,1);
    const bark=new THREE.MeshStandardMaterial();bark.name='bark';const leaf=new THREE.MeshStandardMaterial({color:0x426039});leaf.name='leaf';
    const parts=splitTreeAssetMesh(new THREE.Mesh(geometry,[bark,leaf]),new THREE.Matrix4());
    expect(parts.trunk[0]!.index?.count).toBe(3);expect(parts.foliage[0]!.index?.count).toBe(3);
    [...parts.trunk,...parts.foliage].forEach(part=>part.dispose());geometry.dispose();bark.dispose();leaf.dispose();
  });
});
