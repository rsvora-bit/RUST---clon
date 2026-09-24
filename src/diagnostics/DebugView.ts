import * as THREE from 'three';
import type {Structure} from '../core/types';
import {getSockets} from '../building/rules';
import {PhysicsWorld} from '../physics/PhysicsWorld';
export class DebugView {
  collisions=false;sockets=false;private lines:THREE.LineSegments|null=null;private socketGroup=new THREE.Group();private structureHash='';
  constructor(private scene:THREE.Scene){scene.add(this.socketGroup);}
  update(physics:PhysicsWorld,structures:Structure[]){
    if(this.collisions){const data=physics.world.debugRender();if(!this.lines){this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.8}));this.lines.renderOrder=999;this.scene.add(this.lines);}const g=this.lines.geometry;g.setAttribute('position',new THREE.BufferAttribute(data.vertices,3));g.setAttribute('color',new THREE.BufferAttribute(data.colors,4));this.lines.visible=true;}else if(this.lines)this.lines.visible=false;
    this.socketGroup.visible=this.sockets;
    const hash=structures.map(s=>s.id).join(',');if(this.sockets&&hash!==this.structureHash){this.socketGroup.clear();this.structureHash=hash;for(const s of structures)for(const socket of getSockets(s)){const p=socket.position;const m=new THREE.Mesh(new THREE.SphereGeometry(.075,6,4),new THREE.MeshBasicMaterial({color:'#ffff58',depthTest:false}));m.position.set(p.x,p.y,p.z);this.socketGroup.add(m);}}
  }
}
