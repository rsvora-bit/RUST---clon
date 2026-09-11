import * as THREE from 'three';
import type {InteractionInfo,Vec3} from '../core/types';
export interface Interactable {id:string;object:THREE.Object3D;position:()=>Vec3;enabled:()=>boolean;info:()=>InteractionInfo;interact:()=>void;kind:string}
export class InteractionSystem {
  readonly entries=new Map<string,Interactable>();private ray=new THREE.Raycaster();private center=new THREE.Vector2();current:Interactable|null=null;
  register(entry:Interactable){this.entries.set(entry.id,entry);}
  remove(id:string){this.entries.delete(id);if(this.current?.id===id)this.current=null;}
  clear(){this.entries.clear();this.current=null;}
  update(camera:THREE.PerspectiveCamera,maxDistance:number,occluders:THREE.Object3D[]=[]){
    this.ray.setFromCamera(this.center,camera);this.ray.far=maxDistance;let best=maxDistance;this.current=null;
    for(const entry of this.entries.values()){
      if(!entry.enabled())continue;const p=entry.position();if(Math.hypot(p.x-camera.position.x,p.z-camera.position.z)>maxDistance+3)continue;
      entry.object.updateWorldMatrix(true,true);const hits=this.ray.intersectObject(entry.object,true);const hit=hits.find(h=>h.object.visible);
      if(hit&&hit.distance<best){best=hit.distance;this.current=entry;}
    }
    if(this.current){const blocking=this.ray.intersectObjects(occluders,true);if(blocking.length&&blocking[0].distance<best-.1)this.current=null;}
    return this.current?.info()??null;
  }
  trigger(){this.current?.interact();}
}
