import * as THREE from 'three';
import type {DroppedItem} from '../core/types';
export class WorldItems {
  readonly root=new THREE.Group();readonly objects=new Map<string,THREE.Group>();private mat=new THREE.MeshStandardMaterial({color:'#bbb093',roughness:1});private strapMat=new THREE.MeshStandardMaterial({color:'#625b47',roughness:.92});
  constructor(scene:THREE.Scene){scene.add(this.root);}
  sync(drops:DroppedItem[]){const ids=new Set(drops.map(d=>d.id));for(const [id,g]of this.objects)if(!ids.has(id)){g.removeFromParent();g.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.objects.delete(id);}
    for(const d of drops){if(this.objects.has(d.id))continue;const g=new THREE.Group();const bag=new THREE.Mesh(new THREE.DodecahedronGeometry(.18,1),this.mat);bag.scale.set(1,.65,.85);bag.position.y=.12;bag.castShadow=true;g.add(bag);const strap=new THREE.Mesh(new THREE.BoxGeometry(.025,.22,.30),this.strapMat);strap.position.y=.13;g.add(strap);g.position.set(d.position.x,d.position.y,d.position.z);g.traverse(o=>o.userData.dropId=d.id);this.root.add(g);this.objects.set(d.id,g);}
  }
  dispose(){this.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.mat.dispose();this.strapMat.dispose();this.root.removeFromParent();}
}
