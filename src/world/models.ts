import * as THREE from 'three';
import {mergeGeometries,mergeVertices,toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {Noise,randomSource} from './noise';

const temp=new THREE.Object3D();temp.rotation.order='YXZ';
function card(w:number,h:number,x:number,y:number,z:number,rx:number,ry:number,rz=0):THREE.BufferGeometry {
  const g=new THREE.PlaneGeometry(w,h,1,2);g.translate(0,h/2,0);temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(1,1,1);temp.updateMatrix();g.applyMatrix4(temp.matrix);return g;
}
function broadleafBoughs(variant:number){const r=randomSource(903+variant*71);return Array.from({length:7},(_,b)=>{const angle=b*2.399,dist=1.5+r()*1.7;return {x:Math.cos(angle)*dist,z:Math.sin(angle)*dist,y:4.7+r()*3.5+Math.sin(angle)*.6};});}
/** Branch sprays leave sky gaps and a broken silhouette instead of a solid cone. */
export function pineGeometry(variant=0):THREE.BufferGeometry {
  const r=randomSource(81+variant*391),parts:THREE.BufferGeometry[]=[];
  const height=variant===1?15:variant===2?10.8:12.8;
  const base=variant===1?5:variant===2?2.2:3.2;
  for(let level=0;level<10;level++){
    const y=base+(height-base)*level/10,t=(y-base)/(height-base);
    const radius=(variant===2?3.4:2.8)*Math.pow(1-t,.8)+.15;
    const branches=level>7?4:6;
    for(let j=0;j<branches;j++){
      if(r()<.1)continue;
      const angle=j/branches*Math.PI*2+level*2.399+r()*.5;
      const length=radius*(.5+r()*.65)*(1+.16*Math.sin(level*1.7));
      for(let k=0;k<2;k++){
        const along=.30+k*.40,x=Math.cos(angle)*length*along,z=Math.sin(angle)*length*along;
        const py=y+Math.sin(along*Math.PI)*.18-along*.35+r()*.22;
        const w=length*(.68-k*.10),h=.95+length*.40;
        parts.push(card(w,h,x,py,z,1.04+r()*.3,angle+Math.PI/2,r()*.3-.15));
        parts.push(card(w*.8,h*.83,x,py+.08,z,.62+r()*.3,angle+Math.PI/2+.35,r()*.4-.2));
      }
    }
  }
  for(let i=0;i<5;i++)parts.push(card(.7,1.4,0,height-1,0,0,i*Math.PI/5));
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}
export function broadleafGeometry(variant=0):THREE.BufferGeometry {
  const r=randomSource(372+variant*517),parts:THREE.BufferGeometry[]=[];
  // Separate bough clusters, with an asymmetric open-grown oak variant.
  for(const bough of broadleafBoughs(variant)){
    const cx=bough.x,cz=bough.z,cy=bough.y;
    for(let i=0;i<16;i++){
      const a=r()*6.28,rad=Math.sqrt(r())*(variant?2.1:1.65);
      parts.push(card(1.3+r()*.65,1.3+r()*.7,cx+Math.cos(a)*rad,cy+(r()-.5)*1.5,cz+Math.sin(a)*rad,(r()-.5)*2.2,r()*6.28,(r()-.5)*1.8));
    }
  }
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}
export function trunkGeometry(broadleaf=false,variant=0):THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[],r=randomSource(781+variant*391);
  const height=broadleaf?8:variant===1?15:variant===2?10.8:12.8;
  const trunk=new THREE.CylinderGeometry(.035,broadleaf?.32:.25,height,8,9);
  const p=trunk.getAttribute('position');
  for(let i=0;i<p.count;i++){const y=p.getY(i)+height/2,t=y/height,a=Math.atan2(p.getZ(i),p.getX(i));const rough=1+.08*Math.sin(a*5+y*1.3);p.setXYZ(i,p.getX(i)*rough+Math.sin(t*3)*t*.18,y,p.getZ(i)*rough+Math.sin(t*4+variant)*t*.14);}
  trunk.computeVertexNormals();parts.push(trunk);
  const branch=(a:THREE.Vector3,b:THREE.Vector3,width:number)=>{const d=b.clone().sub(a),g=new THREE.CylinderGeometry(.012,width,d.length(),5);g.translate(0,d.length()/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(a.x,a.y,a.z);parts.push(g);};
  if(broadleaf)for(const b of broadleafBoughs(variant)){
    const fork=new THREE.Vector3(b.x*.62,b.y-1.1,b.z*.62),tip=new THREE.Vector3(b.x,b.y+.3,b.z);
    branch(new THREE.Vector3(0,2.4,0),fork,.15);branch(fork,tip,.09);
    for(const side of [-1,1])branch(fork,new THREE.Vector3(b.x+side*.7,b.y+.1,b.z-side*.6),.055);
  }
  for(let i=0;i<(broadleaf?0:28);i++){
    const y=broadleaf?3+r()*4:2.5+r()*(height-3.4),a=i*2.399+r()*.4;
    const length=broadleaf?1.8+r()*1.5:(1-y/height)*3.4*(.7+r()*.4);
    branch(new THREE.Vector3(0,y,0),new THREE.Vector3(Math.cos(a)*length,y+(broadleaf?1.4:-.2),Math.sin(a)*length),broadleaf?.1:.055);
  }
  for(let i=0;i<5;i++){const a=i*1.257;branch(new THREE.Vector3(0,.38,0),new THREE.Vector3(Math.cos(a)*.65,.02,Math.sin(a)*.65),.13);}
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}
export function rockGeometry(seed:number):THREE.BufferGeometry {
  const r=randomSource(seed),points:THREE.Vector3[]=[];
  // Fractured strata: each ring has a different centre and broad planar faces.
  const skew=(r()-.5)*.42;
  for(let ring=0;ring<4;ring++){
    const y=[-.74,-.32,.36,.72][ring]!,radius=[.65,1.02,.89,.49][ring]!;
    const offset=(ring-1.5)*skew;
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2+.14*(ring%2),extent=radius*(.82+r()*.25);
      points.push(new THREE.Vector3(Math.cos(a)*extent+offset,y+(r()-.5)*.13,Math.sin(a)*extent*(.72+r()*.23)));
    }
  }
  const hull=new ConvexGeometry(points),geo=toCreasedNormals(hull,.85);hull.dispose();
  const p=geo.getAttribute('position'),norm=geo.getAttribute('normal'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const nx=Math.abs(norm.getX(i)),ny=Math.abs(norm.getY(i));uv[i*2]=nx>.6?p.getZ(i):p.getX(i);uv[i*2+1]=ny>.6?p.getZ(i):p.getY(i);}
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geo;
}
export function bushGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[],r=randomSource(239);for(let i=0;i<16;i++){const a=r()*6.28,rad=r()*.7;parts.push(card(.8+r()*.45,.8+r()*.7,Math.cos(a)*rad,r()*.5,Math.sin(a)*rad,(r()-.5)*1.6,r()*6.28));}
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
  const colors=new Float32Array(geo.getAttribute('position').count*3);colors.fill(1);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));return geo;
}
export function grassGeometry():THREE.BufferGeometry {
  const a=card(1.18,1.04,0,0,0,0,0),b=card(1.18,1.04,0,0,0,0,Math.PI/2);const geo=mergeGeometries([a,b])!;a.dispose();b.dispose();return geo;
}
export function fiberGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  for(let level=0;level<4;level++)for(let arm=0;arm<5;arm++){
    const g=new THREE.PlaneGeometry(.15,.43,2,4);const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i),width=1-Math.abs(y)/.24;p.setX(i,p.getX(i)*Math.max(.1,width)*(i%2?.82:1));p.setZ(i,Math.sin(y*8)*.04);}
    g.translate(0,.215,0);temp.position.set(0,.22+level*.16,0);temp.rotation.set(-.8,arm/5*6.28+level*.45,0);temp.scale.setScalar(1-level*.14);temp.updateMatrix();g.applyMatrix4(temp.matrix);parts.push(g);
  }
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geo.computeVertexNormals();return geo;
}
export function berryGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[],r=randomSource(128);for(let i=0;i<18;i++){const g=new THREE.SphereGeometry(.065,6,5);const a=r()*6.28,rad=.3+r()*.35;g.translate(Math.cos(a)*rad,.5+r()*.62,Math.sin(a)*rad);parts.push(g);}const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}
