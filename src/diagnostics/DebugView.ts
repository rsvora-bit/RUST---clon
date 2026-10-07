import * as THREE from 'three';
import type {Structure} from '../core/types';
import {getSockets} from '../building/rules';
import {PhysicsWorld} from '../physics/PhysicsWorld';
import type {CollisionBox} from '../physics/PhysicsWorld';

/** Edges for an axis-aligned world-space collision proxy. */
export function boundsLineVertices(boxes: readonly CollisionBox[]): Float32Array {
  const edges = [
    [0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7],
  ] as const;
  const values = new Float32Array(boxes.length * edges.length * 6);
  let offset = 0;
  for (const box of boxes) {
    const {x,y,z}=box.position, {x:hx,y:hy,z:hz}=box.halfExtents;
    const corners = [
      [x-hx,y-hy,z-hz],[x+hx,y-hy,z-hz],[x-hx,y-hy,z+hz],[x+hx,y-hy,z+hz],
      [x-hx,y+hy,z-hz],[x+hx,y+hy,z-hz],[x-hx,y+hy,z+hz],[x+hx,y+hy,z+hz],
    ];
    for (const [a,b] of edges) {for (const coordinate of corners[a]!) values[offset++]=coordinate;for (const coordinate of corners[b]!) values[offset++]=coordinate;}
  }
  return values;
}

export class DebugView {
  collisions=false;sockets=false;worldBounds=false;private lastWorldBounds=false;private lines:THREE.LineSegments|null=null;private bounds:THREE.LineSegments|null=null;private socketGroup=new THREE.Group();private structureHash='';
  constructor(private scene:THREE.Scene){scene.add(this.socketGroup);}
  update(physics:PhysicsWorld,structures:Structure[],worldColliders:readonly CollisionBox[]=[]){
    if(this.collisions){const data=physics.world.debugRender();if(!this.lines){this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.8}));this.lines.renderOrder=999;this.scene.add(this.lines);}const g=this.lines.geometry;g.setAttribute('position',new THREE.BufferAttribute(data.vertices,3));g.setAttribute('color',new THREE.BufferAttribute(data.colors,4));this.lines.visible=true;}else if(this.lines)this.lines.visible=false;
    if(this.worldBounds){if(!this.bounds){this.bounds=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#80e8ff',depthTest:false,transparent:true,opacity:.8}));this.bounds.renderOrder=1000;this.scene.add(this.bounds);}if(!this.lastWorldBounds)this.bounds.geometry.setAttribute('position',new THREE.BufferAttribute(boundsLineVertices(worldColliders),3));this.bounds.visible=true;}else if(this.bounds)this.bounds.visible=false;this.lastWorldBounds=this.worldBounds;
    this.socketGroup.visible=this.sockets;
    const hash=structures.map(s=>s.id).join(',');if(this.sockets&&hash!==this.structureHash){this.socketGroup.clear();this.structureHash=hash;for(const s of structures)for(const socket of getSockets(s)){const p=socket.position;const m=new THREE.Mesh(new THREE.SphereGeometry(.075,6,4),new THREE.MeshBasicMaterial({color:'#ffff58',depthTest:false}));m.position.set(p.x,p.y,p.z);this.socketGroup.add(m);}}
  }
}
