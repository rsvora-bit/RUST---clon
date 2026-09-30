import * as THREE from 'three';
import {randomSource} from './noise';

/** Disconnected asymmetric massifs, batched into one inexpensive mesh per depth layer. */
export function mountainLayer(seed:number,layer:number,largeWorld:boolean):THREE.BufferGeometry{
  const random=randomSource(seed+7181+layer*991),positions:number[]=[],indices:number[]=[],groups=5,segments=36,rows=3,heroGroup=Math.floor(random()*groups);
  for(let group=0;group<groups;group++){
    const center=group/groups*Math.PI*2+layer*.41+(random()-.5)*.86+Math.sin(group*2.31+seed)*.23,width=.30+random()*.54,radius=(largeWorld?875:755)+layer*215+random()*108;
    const height=130+layer*42+random()*86,hero=group===heroGroup?1.35:.52+random()*.42,peakA=.14+random()*.72,peakB=.18+random()*.64,peakWidthA=.045+random()*.09,peakWidthB=.10+random()*.16,phase=random()*8,base=positions.length/3;
    for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
      const t=i/segments,u=t*2-1,warp=.042*Math.sin(t*4.8+phase)+.024*Math.sin(t*13.7-phase),a=center+u*width+warp,envelope=Math.pow(Math.max(0,1-u*u),1.35),peaks=.28+.18*Math.sin(t*5.7+phase)+hero*.78*Math.exp(-Math.pow((t-peakA)/peakWidthA,2))+.56*Math.exp(-Math.pow((t-peakB)/peakWidthB,2))+.14*Math.sin(t*17+phase);
      const r=radius+(row-1)*74+Math.sin(t*7+phase)*34+Math.sin(t*17-phase)*12,y=row===1?Math.max(7,height*envelope*peaks):-142;positions.push(Math.cos(a)*r,y,Math.sin(a)*r);
      if(row<rows-1&&i<segments){const k=base+row*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
