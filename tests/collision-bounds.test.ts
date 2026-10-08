import { beforeAll,describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { collisionBoundsFromBox, collisionBoundsFromGeometries, collisionBoundsFromGeometry, collisionBoundsFromLodObjects, collisionBoundsFromObject, longHullSideCollisions, longHullSideCollisionsFromLods, treeAssetCollision, treeTrunkCollision } from '../src/physics/collisionBounds';
import {initPhysics,PhysicsWorld} from '../src/physics/PhysicsWorld';
import {rockGeometry} from '../src/world/models';

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

  it('uses compact authored revision-6 trunk proxies instead of broad branch extents',()=>{
    expect(treeAssetCollision({x:4,y:2,z:-3},1,1)).toEqual({
      position:{x:4,y:6.65,z:-3},
      halfExtents:{x:.38,y:4.27,z:.38},
      shape:'capsule',
    });
    const palm=treeAssetCollision({x:4,y:2,z:-3},1.2,5);
    expect(palm.halfExtents.x).toBeCloseTo(.408,8);expect(palm.halfExtents.y).toBeCloseTo(5.352,8);expect(palm.halfExtents.z).toBeCloseTo(.408,8);
    expect(treeAssetCollision({x:4,y:2,z:-3},1,99)).toEqual(treeTrunkCollision({x:4,y:2,z:-3},1,99));
  });

  it('uses the authored rounded trunk profile in Rapier and keeps its base grounded',()=>{
    const floor=new THREE.PlaneGeometry(30,30,1,1);floor.rotateX(-Math.PI/2);
    const tree=treeAssetCollision({x:0,y:0,z:0},1,1),physics=new PhysicsWorld(floor,[tree],{x:0,y:0,z:3});
    try{
      for(let step=0;step<40;step++)physics.move({x:0,y:0,z:-.1});
      const player=physics.position();expect(tree.shape).toBe('capsule');expect(player.z).toBeGreaterThan(.55);expect(player.z).toBeLessThan(1.05);
    }finally{physics.dispose();floor.dispose();}
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

  it('unions all world-transformed LOD objects into one collision envelope',()=>{
    const root=new THREE.Group();root.position.set(12,3,-8);const near=new THREE.Group(),far=new THREE.Group(),nearMesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2)),farMesh=new THREE.Mesh(new THREE.BoxGeometry(4,2,3));far.position.set(1.5,0,.5);near.add(nearMesh);far.add(farMesh);root.add(near,far);
    const bounds=collisionBoundsFromLodObjects([near,far],.1)!;
    expect(bounds.position).toEqual({x:13.25,y:3,z:-7.5});expect(bounds.halfExtents).toEqual({x:2.35,y:1.1,z:1.6});
    nearMesh.geometry.dispose();farMesh.geometry.dispose();
  });

  it('blocks the player at the protruding face of the farthest visual LOD',()=>{
    const floor=new THREE.PlaneGeometry(40,40,1,1);floor.rotateX(-Math.PI/2);const root=new THREE.Group();root.position.y=1.1;const levels=[new THREE.Group(),new THREE.Group(),new THREE.Group()];
    const meshes=[new THREE.Mesh(new THREE.BoxGeometry(2,2,2)),new THREE.Mesh(new THREE.BoxGeometry(2,2,2.4)),new THREE.Mesh(new THREE.BoxGeometry(2,2,3.4))];levels[1]!.position.z=.1;levels[2]!.position.z=.45;levels.forEach((level,index)=>{level.add(meshes[index]!);root.add(level);});
    const bounds=collisionBoundsFromLodObjects(levels)!,physics=new PhysicsWorld(floor,[bounds],{x:0,y:0,z:bounds.position.z+bounds.halfExtents.z+3});
    try{for(let step=0;step<50;step++)physics.move({x:0,y:0,z:-.12});const player=physics.position();expect(player.z).toBeGreaterThan(bounds.position.z+bounds.halfExtents.z-.42);expect(player.z).toBeLessThan(bounds.position.z+bounds.halfExtents.z+.46);}
    finally{physics.dispose();floor.dispose();meshes.forEach(mesh=>mesh.geometry.dispose());}
  });

  it('blocks the player when approaching the rotated rock proxy from its side',()=>{
    const terrain=new THREE.PlaneGeometry(40,40,1,1);terrain.rotateX(-Math.PI/2);const yaw=Math.PI/4,rock=new THREE.BoxGeometry(4,2,1),transform=new THREE.Matrix4().compose(new THREE.Vector3(0,1.1,0),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1.1,.9,1.25));rock.computeBoundingBox();const proxy=collisionBoundsFromGeometry(rock,transform,.08),physics=new PhysicsWorld(terrain,[proxy],{x:-Math.sin(yaw)*4,y:0,z:-Math.cos(yaw)*4});
    try{for(let i=0;i<32;i++)physics.move({x:Math.sin(yaw)*.25,y:0,z:Math.cos(yaw)*.25});const player=physics.position(),localX=Math.cos(yaw)*player.x-Math.sin(yaw)*player.z,localZ=Math.sin(yaw)*player.x+Math.cos(yaw)*player.z;expect(Math.abs(localX)).toBeLessThan(.9);expect(localZ).toBeGreaterThan(-1.7);expect(localZ).toBeLessThan(-.85);}
    finally{physics.dispose();terrain.dispose();rock.dispose();}
  });

  it('blocks all four sides of the three production rock silhouettes after rotation and scale',()=>{
    const floor=new THREE.PlaneGeometry(80,80,1,1);floor.rotateX(-Math.PI/2);
    try{for(const seed of [51,114,221])for(const yaw of [0,Math.PI/4])for(const side of [0,1,2,3]){
      const geometry=rockGeometry(seed,true,true),transform=new THREE.Matrix4().compose(new THREE.Vector3(0,1.12,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(.06,yaw,-.04)),new THREE.Vector3(2.8,2.4,3.1));
      const proxy=collisionBoundsFromGeometry(geometry,transform,.08),angle=proxy.rotation??0,axes=[{x:Math.cos(angle),z:-Math.sin(angle)},{x:Math.sin(angle),z:Math.cos(angle)}],axis=axes[side<2?0:1]!,sign=side%2===0?-1:1,extent=side<2?proxy.halfExtents.x:proxy.halfExtents.z,startDistance=extent+2.2,physics=new PhysicsWorld(floor,[proxy],{x:axis.x*sign*startDistance,y:0,z:axis.z*sign*startDistance});
      try{const delta={x:axis.x*-sign*.14,y:0,z:axis.z*-sign*.14};for(let step=0;step<50;step++)physics.move(delta);const player=physics.position(),coordinate=(player.x-proxy.position.x)*axis.x+(player.z-proxy.position.z)*axis.z;expect(coordinate*sign).toBeGreaterThan(extent-.40);}
      finally{physics.dispose();geometry.dispose();}
    }}finally{floor.dispose();}
  });

  it('keeps live rock collision around a protruding low-detail LOD and blocks that side',()=>{
    const floor=new THREE.PlaneGeometry(40,40,1,1);floor.rotateX(-Math.PI/2);
    const levels=[new THREE.BoxGeometry(2,2,2),new THREE.BoxGeometry(2.2,2,2.4),new THREE.BoxGeometry(2,2,3.4)];
    levels[1]!.translate(.08,0,-.12);levels[2]!.translate(0,0,.38);levels.forEach(geometry=>geometry.computeBoundingBox());
    const transform=new THREE.Matrix4().compose(new THREE.Vector3(0,1.1,0),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4),new THREE.Vector3(1.1,.9,1.25));
    const lowLodProxy=collisionBoundsFromGeometries(levels,transform,.08),lod0Proxy=collisionBoundsFromGeometry(levels[0]!,transform,.08),angle=lowLodProxy.rotation??0,axis={x:Math.sin(angle),z:Math.cos(angle)},position=new THREE.Vector3(),point=new THREE.Vector3(),c=Math.cos(angle),s=Math.sin(angle);
    expect(lowLodProxy.halfExtents.z).toBeGreaterThan(lod0Proxy.halfExtents.z+.3);
    for(const geometry of levels){const vertices=geometry.getAttribute('position');for(let index=0;index<vertices.count;index++){point.fromBufferAttribute(vertices,index).applyMatrix4(transform);const dx=point.x-lowLodProxy.position.x,dz=point.z-lowLodProxy.position.z;expect(Math.abs(dx*c-dz*s)).toBeLessThanOrEqual(lowLodProxy.halfExtents.x);expect(Math.abs(dx*s+dz*c)).toBeLessThanOrEqual(lowLodProxy.halfExtents.z);expect(Math.abs(point.y-lowLodProxy.position.y)).toBeLessThanOrEqual(lowLodProxy.halfExtents.y);}}
    const physics=new PhysicsWorld(floor,[lowLodProxy],{x:axis.x*(lowLodProxy.halfExtents.z+2),y:0,z:axis.z*(lowLodProxy.halfExtents.z+2)});
    try{for(let step=0;step<40;step++)physics.move({x:-axis.x*.12,y:0,z:-axis.z*.12});const player=physics.position();position.set(player.x-lowLodProxy.position.x,0,player.z-lowLodProxy.position.z);const depth=position.x*axis.x+position.z*axis.z;expect(depth).toBeGreaterThan(lowLodProxy.halfExtents.z-.42);expect(depth).toBeLessThan(lowLodProxy.halfExtents.z+.46);}
    finally{physics.dispose();floor.dispose();levels.forEach(geometry=>geometry.dispose());}
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

  it('applies Z-axis lean to physical collision proxies',()=>{
    const floor=new THREE.PlaneGeometry(20,20,1,1);floor.rotateX(-Math.PI/2);
    const physics=new PhysicsWorld(floor,[{position:{x:0,y:1,z:0},halfExtents:{x:1,y:.15,z:.3},rotationZ:Math.PI/2}],{x:-3,y:0,z:0});
    try{for(let step=0;step<40;step++)physics.move({x:.1,y:0,z:0});expect(physics.position().x).toBeGreaterThan(-.9);}finally{physics.dispose();floor.dispose();}
  });

  it('keeps long-hull side collision around every rendered LOD and blocks a low-LOD protrusion',()=>{
    const floor=new THREE.PlaneGeometry(40,40,1,1);floor.rotateX(-Math.PI/2);const make=(width:number,height:number,depth:number,z:number)=>{const level=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth));mesh.position.z=z;level.add(mesh);return level;},levels=[make(8,1.4,1.5,0),make(8.1,1.45,1.75,.12),make(8.2,1.5,2.25,.52)],sides=longHullSideCollisionsFromLods(levels);
    try{
      const union=new THREE.Box3();for(const level of levels)union.union(new THREE.Box3().setFromObject(level,true));const farSide=union.max.z-.12;
      expect(sides).toHaveLength(2);expect(sides[1]!.position.z).toBeCloseTo(farSide);expect(sides[1]!.halfExtents.x).toBeCloseTo(union.getSize(new THREE.Vector3()).x*.5-.1);
      const physics=new PhysicsWorld(floor,sides,{x:0,y:0,z:3});for(let step=0;step<40;step++)physics.move({x:0,y:0,z:-.12});expect(physics.position().z).toBeGreaterThan(union.max.z-.55);physics.dispose();
    }finally{floor.dispose();for(const level of levels)level.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});}
  });
});
