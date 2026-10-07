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

export class DebugView {
  collisions=false;sockets=false;worldBounds=false;grounding=false;private lastWorldBounds=false;private groundingUpdatedAt=0;private lines:THREE.LineSegments|null=null;private bounds:THREE.LineSegments|null=null;private groundLines:THREE.LineSegments|null=null;private socketGroup=new THREE.Group();private structureHash='';
  constructor(private scene:THREE.Scene){scene.add(this.socketGroup);}
  update(physics:PhysicsWorld,structures:Structure[],worldColliders:readonly CollisionBox[]=[],camera?:THREE.Vector3,heightAt?:(x:number,z:number)=>number){
    if(this.collisions){const data=physics.world.debugRender();if(!this.lines){this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.8}));this.lines.name='Rapier collision debug';this.lines.renderOrder=999;this.scene.add(this.lines);}const g=this.lines.geometry;g.setAttribute('position',new THREE.BufferAttribute(data.vertices,3));g.setAttribute('color',new THREE.BufferAttribute(data.colors,4));this.lines.visible=true;}else if(this.lines)this.lines.visible=false;
    if(this.worldBounds){if(!this.bounds){this.bounds=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#80e8ff',depthTest:false,transparent:true,opacity:.8}));this.bounds.name='World proxy bounds debug';this.bounds.renderOrder=1000;this.scene.add(this.bounds);}if(!this.lastWorldBounds)this.bounds.geometry.setAttribute('position',new THREE.BufferAttribute(boundsLineVertices(worldColliders),3));this.bounds.visible=true;}else if(this.bounds)this.bounds.visible=false;this.lastWorldBounds=this.worldBounds;
    if(this.grounding&&camera&&heightAt){if(!this.groundLines){this.groundLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#ffbd68',depthTest:false,transparent:true,opacity:.9}));this.groundLines.name='World grounding debug';this.groundLines.renderOrder=1001;this.scene.add(this.groundLines);}if(performance.now()-this.groundingUpdatedAt>160){this.groundLines.geometry.setAttribute('position',new THREE.BufferAttribute(groundingLineVertices(worldColliders,heightAt,camera,72),3));this.groundingUpdatedAt=performance.now();}this.groundLines.visible=true;}else if(this.groundLines)this.groundLines.visible=false;
    this.socketGroup.visible=this.sockets;
    const hash=structures.map(s=>s.id).join(',');if(this.sockets&&hash!==this.structureHash){this.socketGroup.clear();this.structureHash=hash;for(const s of structures)for(const socket of getSockets(s)){const p=socket.position;const m=new THREE.Mesh(new THREE.SphereGeometry(.075,6,4),new THREE.MeshBasicMaterial({color:'#ffff58',depthTest:false}));m.position.set(p.x,p.y,p.z);this.socketGroup.add(m);}}
  }
}
