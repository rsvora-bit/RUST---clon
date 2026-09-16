import * as THREE from 'three';
import {randomSource} from './noise';

/** Disconnected asymmetric massifs, batched into one inexpensive mesh per depth layer. */
export function mountainLayer(seed:number,layer:number,largeWorld:boolean):THREE.BufferGeometry{
  const random=randomSource(seed+7181+layer*991),positions:number[]=[],indices:number[]=[],groups=4,segments=28,rows=3;
  for(let group=0;group<groups;group++){
    const center=group/groups*Math.PI*2+layer*.41+(random()-.5)*.42,width=.42+random()*.36,radius=(largeWorld?910:790)+layer*205+random()*35;
    const height=125+layer*45+random()*70,hero=.70+random()*.45,phase=random()*8,base=positions.length/3;
    for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
      const t=i/segments,u=t*2-1,a=center+u*width,envelope=Math.pow(Math.max(0,1-u*u),1.5),ridge=height*envelope*(.38+.22*Math.sin(t*7+phase)+hero*Math.exp(-Math.pow((t-.37)/.12,2))+.35*Math.exp(-Math.pow((t-.70)/.17,2))+.12*Math.sin(t*19+phase));
      const r=radius+(row-1)*68+Math.sin(t*9+phase)*27,y=row===1?ridge:-135;positions.push(Math.cos(a)*r,y,Math.sin(a)*r);
      if(row<rows-1&&i<segments){const k=base+row*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
