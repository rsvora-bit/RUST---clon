import * as THREE from 'three';
import {randomSource} from './noise';

/** Disconnected asymmetric massifs, batched into one inexpensive mesh per depth layer. */
export function mountainLayer(seed:number,layer:number,largeWorld:boolean):THREE.BufferGeometry{
  const random=randomSource(seed+7181+layer*991),positions:number[]=[],indices:number[]=[],groups=5,segments=36,rows=3;
  for(let group=0;group<groups;group++){
    const center=group/groups*Math.PI*2+layer*.41+(random()-.5)*.48+Math.sin(group*2.31+seed)*.18,width=.34+random()*.48,radius=(largeWorld?875:755)+layer*215+random()*108;
    const height=130+layer*42+random()*86,hero=.72+random()*.52,phase=random()*8,base=positions.length/3;
    for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
      const t=i/segments,u=t*2-1,warp=.035*Math.sin(t*5.7+phase)+.016*Math.sin(t*15.3-phase),a=center+u*width+warp,envelope=Math.pow(Math.max(0,1-u*u),1.35),peaks=.31+.20*Math.sin(t*6.2+phase)+hero*Math.exp(-Math.pow((t-.27)/.105,2))+.62*Math.exp(-Math.pow((t-.68)/.15,2))+.14*Math.sin(t*17+phase);
      const r=radius+(row-1)*74+Math.sin(t*7+phase)*34+Math.sin(t*17-phase)*12,y=row===1?Math.max(7,height*envelope*peaks):-142;positions.push(Math.cos(a)*r,y,Math.sin(a)*r);
      if(row<rows-1&&i<segments){const k=base+row*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
