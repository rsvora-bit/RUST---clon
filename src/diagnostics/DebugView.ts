import * as THREE from 'three';
import type {Structure} from '../core/types';
import {getSockets} from '../building/rules';
import {PhysicsWorld} from '../physics/PhysicsWorld';
import type {CollisionBox} from '../physics/PhysicsWorld';

/** Edges for world-space collision proxies, including their authored yaw. */
export function boundsLineVertices(boxes: readonly CollisionBox[]): Float32Array {
  const edges = [
    [0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7],
  ] as const;
  const values = new Float32Array(boxes.length * edges.length * 6);
  let offset = 0;
  for (const box of boxes) {
    const {x,y,z}=box.position, {x:hx,y:hy,z:hz}=box.halfExtents;
    const c=Math.cos(box.rotation??0),s=Math.sin(box.rotation??0),corners = [
      [-hx,-hy,-hz],[hx,-hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],
      [-hx,hy,-hz],[hx,hy,-hz],[-hx,hy,hz],[hx,hy,hz],
    ].map(([lx,ly,lz])=>[x+lx!*c+lz!*s,y+ly!,z-lx!*s+lz!*c]);
    for (const [a,b] of edges) {for (const coordinate of corners[a]!) values[offset++]=coordinate;for (const coordinate of corners[b]!) values[offset++]=coordinate;}
  }
  return values;
}

/** Contact gap, proxy origin and sampled terrain normal for nearby world colliders. */
export function groundingLineVertices(boxes: readonly CollisionBox[],heightAt:(x:number,z:number)=>number,camera:{x:number;z:number},range=72):Float32Array {
  const values:number[]=[],limitSq=range*range;
  for(const box of boxes){const dx=box.position.x-camera.x,dz=box.position.z-camera.z;if(dx*dx+dz*dz>limitSq)continue;const ground=heightAt(box.position.x,box.position.z);if(!Number.isFinite(ground)||ground< -9.9)continue;
    const {x,y,z}=box.position,bottom=y-box.halfExtents.y,step=.65,gradeX=(heightAt(x+step,z)-heightAt(x-step,z))/(2*step),gradeZ=(heightAt(x,z+step)-heightAt(x,z-step))/(2*step),inv=1/Math.hypot(gradeX,1,gradeZ),nx=-gradeX*inv,ny=inv,nz=-gradeZ*inv;
    // Vertical gap from proxy foot to ground, then a one-meter normal marker.
    values.push(x,bottom,z,x,ground,z,x,ground,z,x+nx,ground+ny,z+nz);
    // Cross at the collider origin makes its authored center easy to find.
    values.push(x-.14,y,z,x+.14,y,z,x,y,z-.14,x,y,z+.14);
  }
  return new Float32Array(values);
}

/** Nearby render bounds for objects that submit shadow maps, including instances. */
export function shadowCasterLineVertices(scene:THREE.Scene,camera:{x:number;y:number;z:number},range=64,limit=160):Float32Array {
  const limitSq=range*range,candidates:{bounds:THREE.Box3;distanceSq:number}[]=[],localBox=new THREE.Box3(),worldBox=new THREE.Box3(),instance=new THREE.Matrix4(),world=new THREE.Matrix4(),center=new THREE.Vector3();
  const keep=(bounds:THREE.Box3)=>{
    bounds.getCenter(center);const dx=center.x-camera.x,dy=center.y-camera.y,dz=center.z-camera.z,distanceSq=dx*dx+dy*dy+dz*dz;if(distanceSq>limitSq)return;
    if(candidates.length>=limit){let farthest=0;for(let i=1;i<candidates.length;i++)if(candidates[i]!.distanceSq>candidates[farthest]!.distanceSq)farthest=i;if(candidates[farthest]!.distanceSq<=distanceSq)return;candidates[farthest]={bounds:bounds.clone(),distanceSq};return;}
    candidates.push({bounds:bounds.clone(),distanceSq});
  };
  scene.updateMatrixWorld(true);
  scene.traverseVisible(object=>{
    if(!(object instanceof THREE.Mesh)||!object.castShadow||object.name.includes('debug'))return;
    const geometry=object.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();if(!geometry.boundingBox)return;
    if(object instanceof THREE.InstancedMesh){for(let index=0;index<object.count;index++){object.getMatrixAt(index,instance);world.multiplyMatrices(object.matrixWorld,instance);worldBox.copy(geometry.boundingBox).applyMatrix4(world);keep(worldBox);}}
    else keep(worldBox.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld));
  });
  candidates.sort((a,b)=>a.distanceSq-b.distanceSq);
  const boxes=candidates.map(({bounds})=>{const center=bounds.getCenter(new THREE.Vector3()),half=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);return{position:{x:center.x,y:center.y,z:center.z},halfExtents:{x:half.x,y:half.y,z:half.z}};});
  return boundsLineVertices(boxes);
}

/** Colored bounds for nearby authored assets; color identifies the active model LOD. */
export function lodDebugGeometry(scene:THREE.Scene,camera:{x:number;y:number;z:number},range=72,limit=48):{positions:Float32Array;colors:Float32Array;assets:number}{
  const edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]] as const;
  const candidates:{box:THREE.Box3;lod:number;distanceSq:number}[]=[],local=new THREE.Box3(),world=new THREE.Box3(),matrix=new THREE.Matrix4(),center=new THREE.Vector3(),position=new THREE.Vector3(),rangeSq=range*range;
  const keep=(box:THREE.Box3,lod:number)=>{box.getCenter(center);const dx=center.x-camera.x,dy=center.y-camera.y,dz=center.z-camera.z,distanceSq=dx*dx+dy*dy+dz*dz;if(distanceSq>rangeSq)return;if(candidates.length>=limit){let farthest=0;for(let i=1;i<candidates.length;i++)if(candidates[i]!.distanceSq>candidates[farthest]!.distanceSq)farthest=i;if(candidates[farthest]!.distanceSq<=distanceSq)return;candidates[farthest]={box:box.clone(),lod,distanceSq};return;}candidates.push({box:box.clone(),lod,distanceSq});};
  scene.updateMatrixWorld(true);
  scene.traverseVisible(object=>{
    if(object instanceof THREE.LOD){const active=object.levels.findIndex(level=>level.object.visible);if(active<0)return;const level=object.levels[active]!.object;level.traverseVisible(child=>{if(!(child instanceof THREE.Mesh))return;const geometry=child.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();if(geometry.boundingBox)keep(world.copy(geometry.boundingBox).applyMatrix4(child.matrixWorld),active);});return;}
    if(!(object instanceof THREE.InstancedMesh)||typeof object.userData.generatedWorldAsset!=='string')return;
    const lod=Number.isInteger(object.userData.generatedWorldLod)?object.userData.generatedWorldLod:0,geometry=object.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();if(!geometry.boundingBox)return;
    for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);matrix.premultiply(object.matrixWorld);world.copy(geometry.boundingBox).applyMatrix4(matrix);world.getCenter(position);const dx=position.x-camera.x,dy=position.y-camera.y,dz=position.z-camera.z;if(dx*dx+dy*dy+dz*dz<=rangeSq)keep(world,lod);}
  });
  candidates.sort((a,b)=>a.distanceSq-b.distanceSq);const positions=new Float32Array(candidates.length*edges.length*6),colors=new Float32Array(positions.length),palette=[[.22,.92,1],[1,.76,.2],[1,.34,.28]];let offset=0;
  for(const {box,lod} of candidates){const min=box.min,max=box.max,corners=[[min.x,min.y,min.z],[max.x,min.y,min.z],[min.x,min.y,max.z],[max.x,min.y,max.z],[min.x,max.y,min.z],[max.x,max.y,min.z],[min.x,max.y,max.z],[max.x,max.y,max.z]],color=palette[Math.max(0,Math.min(2,lod))]!;for(const [a,b] of edges)for(const point of [corners[a]!,corners[b]!])for(let axis=0;axis<3;axis++){positions[offset]=point[axis]!;colors[offset++]=color[axis]!;}}
  return{positions,colors,assets:candidates.length};
}

export class DebugView {
  collisions=false;sockets=false;worldBounds=false;grounding=false;shadowCasters=false;lod=false;private lastWorldBounds=false;private boundsUpdatedAt=0;private groundingUpdatedAt=0;private shadowCastersUpdatedAt=0;private lodUpdatedAt=0;private lines:THREE.LineSegments|null=null;private bounds:THREE.LineSegments|null=null;private groundLines:THREE.LineSegments|null=null;private shadowCasterLines:THREE.LineSegments|null=null;private lodLines:THREE.LineSegments|null=null;private socketGroup=new THREE.Group();private structureHash='';
  constructor(private scene:THREE.Scene){scene.add(this.socketGroup);}
  update(physics:PhysicsWorld,structures:Structure[],worldColliders:readonly CollisionBox[]=[],camera?:THREE.Vector3,heightAt?:(x:number,z:number)=>number,additionalColliders?:()=>readonly CollisionBox[]){
    if(this.collisions){const data=physics.world.debugRender();if(!this.lines){this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.8}));this.lines.name='Rapier collision debug';this.lines.renderOrder=999;this.scene.add(this.lines);}const g=this.lines.geometry;g.setAttribute('position',new THREE.BufferAttribute(data.vertices,3));g.setAttribute('color',new THREE.BufferAttribute(data.colors,4));this.lines.visible=true;}else if(this.lines)this.lines.visible=false;
    const now=performance.now(),needsWorldProxies=this.worldBounds||(this.grounding&&!!camera&&!!heightAt),allColliders=needsWorldProxies&&additionalColliders?[...worldColliders,...additionalColliders()]:worldColliders;
    if(this.worldBounds){if(!this.bounds){this.bounds=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#80e8ff',depthTest:false,transparent:true,opacity:.8}));this.bounds.name='World proxy bounds debug';this.bounds.renderOrder=1000;this.scene.add(this.bounds);}if(!this.lastWorldBounds||now-this.boundsUpdatedAt>500){this.bounds.geometry.setAttribute('position',new THREE.BufferAttribute(boundsLineVertices(allColliders),3));this.boundsUpdatedAt=now;}this.bounds.visible=true;}else if(this.bounds)this.bounds.visible=false;this.lastWorldBounds=this.worldBounds;
    if(this.grounding&&camera&&heightAt){if(!this.groundLines){this.groundLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#ffbd68',depthTest:false,transparent:true,opacity:.9}));this.groundLines.name='World grounding debug';this.groundLines.renderOrder=1001;this.scene.add(this.groundLines);}if(now-this.groundingUpdatedAt>160){this.groundLines.geometry.setAttribute('position',new THREE.BufferAttribute(groundingLineVertices(allColliders,heightAt,camera,72),3));this.groundingUpdatedAt=now;}this.groundLines.visible=true;}else if(this.groundLines)this.groundLines.visible=false;
    if(this.shadowCasters&&camera){if(!this.shadowCasterLines){this.shadowCasterLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#ffb347',depthTest:false,transparent:true,opacity:.92}));this.shadowCasterLines.name='World shadow caster debug';this.shadowCasterLines.renderOrder=1002;this.scene.add(this.shadowCasterLines);}if(this.shadowCastersUpdatedAt===0||now-this.shadowCastersUpdatedAt>500){this.shadowCasterLines.geometry.setAttribute('position',new THREE.BufferAttribute(shadowCasterLineVertices(this.scene,camera),3));this.shadowCastersUpdatedAt=now;}this.shadowCasterLines.visible=true;}else if(this.shadowCasterLines)this.shadowCasterLines.visible=false;
    if(this.lod&&camera){if(!this.lodLines){this.lodLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.95}));this.lodLines.name='World active LOD debug';this.lodLines.renderOrder=1003;this.scene.add(this.lodLines);}if(this.lodUpdatedAt===0||now-this.lodUpdatedAt>500){const data=lodDebugGeometry(this.scene,camera);this.lodLines.geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));this.lodLines.geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));this.lodLines.geometry.computeBoundingSphere();this.lodLines.userData.assetCount=data.assets;this.lodUpdatedAt=now;}this.lodLines.visible=true;}else if(this.lodLines)this.lodLines.visible=false;
    this.socketGroup.visible=this.sockets;
    const hash=structures.map(s=>s.id).join(',');if(this.sockets&&hash!==this.structureHash){this.socketGroup.clear();this.structureHash=hash;for(const s of structures)for(const socket of getSockets(s)){const p=socket.position;const m=new THREE.Mesh(new THREE.SphereGeometry(.075,6,4),new THREE.MeshBasicMaterial({color:'#ffff58',depthTest:false}));m.position.set(p.x,p.y,p.z);this.socketGroup.add(m);}}
  }
}
