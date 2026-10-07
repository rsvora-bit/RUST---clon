import { beforeAll,describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { collisionBoundsFromBox, collisionBoundsFromGeometry, collisionBoundsFromObject, longHullSideCollisions, treeTrunkCollision } from '../src/physics/collisionBounds';
import {initPhysics,PhysicsWorld} from '../src/physics/PhysicsWorld';

describe('visual collision bounds', () => {
  beforeAll(async()=>{await initPhysics();});
  it('contains every vertex after instance rotation, slope alignment and non-uniform scale', () => {
    const scene = new THREE.Group();
    const root = new THREE.Group();
    root.position.set(14, 3, -9);
    root.rotation.set(.12, 1.1, -.08);
    root.scale.set(2.4, 1.65, 2.1);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1));
    rock.position.y = -.2;
    rock.scale.set(1.3, .8, 1.1);
    root.add(rock);
    scene.add(root);

    const proxy = collisionBoundsFromObject(root, .08);
    const position = rock.geometry.getAttribute('position');
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(rock.matrixWorld);
      expect(Math.abs(point.x - proxy.position.x)).toBeLessThanOrEqual(proxy.halfExtents.x);
      expect(Math.abs(point.y - proxy.position.y)).toBeLessThanOrEqual(proxy.halfExtents.y);
      expect(Math.abs(point.z - proxy.position.z)).toBeLessThanOrEqual(proxy.halfExtents.z);
    }
    expect(proxy.halfExtents.x).toBeGreaterThan(2.4 * .7);
    rock.geometry.dispose();
  });

  it('adds a small safety margin and keeps degenerate bounds usable', () => {
    const proxy = collisionBoundsFromBox(new THREE.Box3(new THREE.Vector3(2, 3, 4), new THREE.Vector3(2, 3, 4)), .08);
    expect(proxy).toEqual({ position: { x: 2, y: 3, z: 4 }, halfExtents: { x: .08, y: .08, z: .08 } });
  });

  it('keeps species-specific trunk proxies centered and scaled to their authored heights', () => {
    expect(treeTrunkCollision({ x: 4, y: 2, z: -3 }, 1.2, 0)).toEqual({
      position: { x: 4, y: 8.96, z: -3 },
      halfExtents: { x: .54, y: 6.96, z: .54 },
    });
    expect(treeTrunkCollision({ x: 4, y: 2, z: -3 }, 1, 5).halfExtents.y).toBe(3.9);
    expect(treeTrunkCollision({ x: 4, y: 2, z: -3 }, 1, 4).halfExtents.y).toBe(4.25);
  });

  it('derives an instance proxy from the authored trunk geometry instead of foliage extents',()=>{
    const trunk=new THREE.CylinderGeometry(.35,.48,8,8);trunk.computeBoundingBox();
    const transform=new THREE.Matrix4().compose(new THREE.Vector3(12,7,-4),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.7),new THREE.Vector3(1.2,1.1,.9));
    const proxy=collisionBoundsFromGeometry(trunk,transform,.08),visual=new THREE.Box3().copy(trunk.boundingBox!).applyMatrix4(transform);
    expect(proxy.position.x).toBeCloseTo(visual.getCenter(new THREE.Vector3()).x);
    expect(proxy.position.y).toBeCloseTo(visual.getCenter(new THREE.Vector3()).y);
    expect(proxy.halfExtents.x).toBeCloseTo(.48*1.2+.08);
    expect(proxy.halfExtents.y).toBeCloseTo(4*1.1+.08);
    expect(proxy.rotation).toBeCloseTo(.7);
    trunk.dispose();
  });

  it('keeps a sloped rotated rock enclosed without an inflated world-axis footprint',()=>{
    const rock=new THREE.BoxGeometry(4,2,1),yaw=new THREE.Quaternion().setFromEuler(new THREE.Euler(.13,.72,-.09)),transform=new THREE.Matrix4().compose(new THREE.Vector3(7,3,-11),yaw,new THREE.Vector3(1.1,.9,1.25));rock.computeBoundingBox();
    const proxy=collisionBoundsFromGeometry(rock,transform,.08),worldBounds=new THREE.Box3().copy(rock.boundingBox!).applyMatrix4(transform),position=rock.getAttribute('position'),point=new THREE.Vector3(),c=Math.cos(proxy.rotation??0),s=Math.sin(proxy.rotation??0);
    for(let i=0;i<position.count;i++){
      point.fromBufferAttribute(position,i).applyMatrix4(transform);const dx=point.x-proxy.position.x,dz=point.z-proxy.position.z;
      expect(Math.abs(dx*c-dz*s)).toBeLessThanOrEqual(proxy.halfExtents.x+1e-5);
      expect(Math.abs(dx*s+dz*c)).toBeLessThanOrEqual(proxy.halfExtents.z+1e-5);
      expect(Math.abs(point.y-proxy.position.y)).toBeLessThanOrEqual(proxy.halfExtents.y+1e-5);
    }
    expect(proxy.halfExtents.x*proxy.halfExtents.z).toBeLessThan((worldBounds.max.x-worldBounds.min.x)*(worldBounds.max.z-worldBounds.min.z)*.72);
    rock.dispose();
  });

  it('blocks the player when approaching the rotated rock proxy from its side',()=>{
    const terrain=new THREE.PlaneGeometry(40,40,1,1);terrain.rotateX(-Math.PI/2);const yaw=Math.PI/4,rock=new THREE.BoxGeometry(4,2,1),transform=new THREE.Matrix4().compose(new THREE.Vector3(0,1.1,0),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1.1,.9,1.25));rock.computeBoundingBox();const proxy=collisionBoundsFromGeometry(rock,transform,.08),physics=new PhysicsWorld(terrain,[proxy],{x:-Math.sin(yaw)*4,y:0,z:-Math.cos(yaw)*4});
    try{for(let i=0;i<32;i++)physics.move({x:Math.sin(yaw)*.25,y:0,z:Math.cos(yaw)*.25});const player=physics.position(),localX=Math.cos(yaw)*player.x-Math.sin(yaw)*player.z,localZ=Math.sin(yaw)*player.x+Math.cos(yaw)*player.z;expect(Math.abs(localX)).toBeLessThan(.9);expect(localZ).toBeGreaterThan(-1.7);expect(localZ).toBeLessThan(-.85);}
    finally{physics.dispose();terrain.dispose();rock.dispose();}
  });

  it('places narrow hull side proxies on both authored visual edges',()=>{
    const sides=longHullSideCollisions(new THREE.Box3(new THREE.Vector3(-4,-.7,.02),new THREE.Vector3(4,.7,1.58)));
    expect(sides).toHaveLength(2);
    expect(sides[0]?.position.x).toBe(0);expect(sides[0]?.position.y).toBe(0);expect(sides[0]?.position.z).toBeCloseTo(.14);
    expect(sides[1]?.position.x).toBe(0);expect(sides[1]?.position.y).toBe(0);expect(sides[1]?.position.z).toBeCloseTo(1.46);
    expect(sides[0]?.halfExtents.x).toBeCloseTo(3.9);
    expect(sides[0]?.halfExtents.z).toBe(.12);
  });

  it('blocks the player at both sides of a long hull instead of allowing passage through the shell',()=>{
    const terrain=new THREE.PlaneGeometry(40,40,1,1);terrain.rotateX(-Math.PI/2);const sides=longHullSideCollisions(new THREE.Box3(new THREE.Vector3(-4,0,-.78),new THREE.Vector3(4,1.4,.78)));
    for(const side of [1,-1]){const physics=new PhysicsWorld(terrain,sides,{x:0,y:0,z:side*2.5});try{for(let step=0;step<32;step++)physics.move({x:0,y:0,z:-side*.15});const player=physics.position();expect(player.z*side).toBeGreaterThan(.80);expect(player.z*side).toBeLessThan(1.45);}finally{physics.dispose();}}
    terrain.dispose();
  });
});
