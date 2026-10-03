import * as THREE from 'three';
import {randomSource} from './noise';

/** Disconnected asymmetric massifs, batched into one inexpensive mesh per depth layer. */
export function mountainLayer(seed:number,layer:number,largeWorld:boolean):THREE.BufferGeometry{
  const random=randomSource(seed+7181+layer*991),positions:number[]=[],colors:number[]=[],indices:number[]=[],groups=6,segments=72,rows=7,heroGroup=Math.floor(random()*groups);
  for(let group=0;group<groups;group++){
    const center=group/groups*Math.PI*2+layer*.41+(random()-.5)*1.05+Math.sin(group*2.31+seed)*.31,width=.25+random()*.42,radius=(largeWorld?875:755)+layer*215+random()*148;
    const height=132+layer*42+random()*92,hero=group===heroGroup?1.4:.60+random()*.38,peakA=.14+random()*.72,peakB=.18+random()*.64,peakC=.12+random()*.76,peakWidthA=.27+random()*.17,peakWidthB=.25+random()*.20,peakWidthC=.20+random()*.17,phase=random()*8,groupTone=.965+(random()-.5)*.035,shoulderA=.1+random()*.8,shoulderB=.1+random()*.8,shoulderC=.1+random()*.8,shoulderWidthA=.06+random()*.045,shoulderWidthB=.075+random()*.055,shoulderWidthC=.055+random()*.05,base=positions.length/3;
    for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
      const t=i/segments,u=t*2-1,warp=.055*Math.sin(t*4.1+phase)+.033*Math.sin(t*11.3-phase),a=center+u*width+warp,envelope=Math.pow(Math.max(0,1-u*u),1.08),ridge=(p:number,w:number)=>Math.exp(-Math.pow(Math.abs((t-p)/w),2.35)),peaks=.32+.16*Math.sin(t*4.7+phase)+hero*.58*ridge(peakA,peakWidthA)+.45*ridge(peakB,peakWidthB)+.29*ridge(peakC,peakWidthC)+.18*ridge(shoulderA,shoulderWidthA)+.16*ridge(shoulderB,shoulderWidthB)+.14*ridge(shoulderC,shoulderWidthC)+.12*Math.sin(t*13+phase)+.065*Math.sin(t*29-phase)+.035*Math.sin(t*53+phase*.7);
      const radialOffsets=[-245,-163,-82,0,82,163,245] as const,profile=[-142,-6,.48,1,.48,-6,-142] as const,edgeDrop=120*(1-envelope),r=radius+radialOffsets[row]!+Math.sin(t*7+phase)*34+Math.sin(t*17-phase)*12,y=profile[row]!<0?profile[row]!-edgeDrop:Math.max(-120,height*envelope*peaks*profile[row]!-edgeDrop);positions.push(Math.cos(a)*r,y,Math.sin(a)*r);const ridgeTone=profile[row]===1?.875+THREE.MathUtils.smoothstep(envelope*peaks,.28,1.1)*.10:profile[row]!>0?.85:.82;colors.push(groupTone*ridgeTone,groupTone*ridgeTone,groupTone*ridgeTone);
      if(row<rows-1&&i<segments){const k=base+row*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
