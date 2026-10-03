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
  // Low-poly crown masses soften the open center between the larger boughs
  // without turning the canopy into a single opaque blob.
  const crownCore=new THREE.IcosahedronGeometry(1,0);crownCore.setIndex(Array.from({length:crownCore.getAttribute('position').count},(_,index)=>index));crownCore.scale(1.08+variant*.08,1.04+variant*.12,1.02+variant*.08);crownCore.translate(0,7.1+variant*.18,0);parts.push(crownCore);
  for(let i=0;i<4;i++){const angle=i*Math.PI*.5+variant*.37,mass=new THREE.IcosahedronGeometry(1,0);mass.setIndex(Array.from({length:mass.getAttribute('position').count},(_,index)=>index));mass.scale(.68+variant*.06,.73,.70);mass.translate(Math.cos(angle)*1.15,6.9+Math.sin(angle*1.8)*.28,Math.sin(angle)*1.15);parts.push(mass);}
  // Separate bough clusters, with an asymmetric open-grown oak variant.
  for(const [index,bough] of broadleafBoughs(variant).entries()){
    const cx=bough.x,cz=bough.z,cy=bough.y;
    // A small faceted leaf mass gives the cutout sprays depth when viewed
    // edge-on, without adding a separate mesh or a billboard cross.
    const foliageCore=new THREE.IcosahedronGeometry(1,0);
    foliageCore.setIndex(Array.from({length:foliageCore.getAttribute('position').count},(_,index)=>index));
    foliageCore.scale(1.02+variant*.12,.78+variant*.08,.96+variant*.1);
    foliageCore.translate(cx,cy,cz);
    parts.push(foliageCore);
    // A smaller offset leaf mass rounds out the branch silhouette in profile;
    // it stays in this shared instanced geometry and adds no draw calls.
    const angle=index*2.399+variant*.63,lobe=new THREE.IcosahedronGeometry(1,0);
    lobe.setIndex(Array.from({length:lobe.getAttribute('position').count},(_,vertex)=>vertex));
    lobe.scale(.66,.58,.64);
    lobe.translate(cx+Math.cos(angle)*.78,cy+.18+Math.sin(angle*1.7)*.24,cz+Math.sin(angle)*.78);
    parts.push(lobe);
    for(let i=0;i<16;i++){
      const a=r()*6.28,rad=Math.sqrt(r())*(variant?2.1:1.65);
      parts.push(card(1.3+r()*.65,1.3+r()*.7,cx+Math.cos(a)*rad,cy+(r()-.5)*1.5,cz+Math.sin(a)*rad,(r()-.5)*2.2,r()*6.28,(r()-.5)*1.8));
    }
  }
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}

/** Low-cost original palm crown for arid/coastal generation-five groves. */
export function palmGeometry():THREE.BufferGeometry{
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<12;i++){const angle=i/12*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle),base=positions.length/3,length=3.0+(i%3)*.32;
    for(let j=0;j<=5;j++){const t=j/5,reach=length*t,y=7.8+Math.sin(t*Math.PI)*.48-t*t*1.15,width=.46*(1-t*.78);
      for(const side of [-1,1]){positions.push(dx*reach-dz*width*side,y,dz*reach+dx*width*side);uvs.push((side+1)/2,t);}
      if(j<5){const k=base+j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function palmTrunkGeometry():THREE.BufferGeometry{
  const g=new THREE.CylinderGeometry(.11,.25,7.8,7,10);g.translate(0,3.9,0);const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i),t=y/7.8,ring=1+.04*Math.sin(y*19);p.setXYZ(i,p.getX(i)*ring+t*t*.36,y,p.getZ(i)*ring);}g.computeVertexNormals();return g;
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
  for(let i=0;i<(broadleaf?0:18);i++){
    const y=broadleaf?3+r()*4:height*(.46+r()*.49),a=i*2.399+r()*.4;
    const length=broadleaf?1.8+r()*1.5:(1-y/height)*1.85*(.72+r()*.35);
    branch(new THREE.Vector3(0,y,0),new THREE.Vector3(Math.cos(a)*length,y+(broadleaf?1.4:.24),Math.sin(a)*length),broadleaf?.1:.055);
  }
  for(let i=0;i<5;i++){const a=i*1.257;branch(new THREE.Vector3(0,.38,0),new THREE.Vector3(Math.cos(a)*.65,.02,Math.sin(a)*.65),.13);}
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}
export function rockGeometry(seed:number):THREE.BufferGeometry {
  const r=randomSource(seed),points:THREE.Vector3[]=[];
  // Broken, slightly slumped strata give the three shared batches distinct
  // silhouettes without adding meshes or changing any resource placement.
  const skew=(r()-.5)*.42,phase=r()*Math.PI*2,profile=[.65,1.02,.89,.49];
  const ringCount=6+Math.floor(r()*3);
  for(let ring=0;ring<4;ring++){
    const y=[-.74,-.32,.36,.72][ring]!,radius=profile[ring]!*(.88+r()*.24);
    const offset=(ring-1.5)*skew,rotation=phase+(ring%2)*.11;
    for(let i=0;i<ringCount;i++){
      const a=i/ringCount*Math.PI*2+rotation;
      const strata=Math.sin(a*2+phase)*.08+Math.sin(a*3-phase)*.045;
      const extent=radius*(.77+r()*.34+strata);
      const slump=(ring===3?Math.max(0,Math.cos(a+phase))*.16:0);
      points.push(new THREE.Vector3(Math.cos(a)*extent+offset,y+(r()-.5)*.16-slump,Math.sin(a)*extent*(.68+r()*.31)));
    }
  }
  const hull=new ConvexGeometry(points),geo=toCreasedNormals(hull,.85);hull.dispose();
  const p=geo.getAttribute('position'),norm=geo.getAttribute('normal'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const nx=Math.abs(norm.getX(i)),ny=Math.abs(norm.getY(i));uv[i*2]=nx>.6?p.getZ(i):p.getX(i);uv[i*2+1]=ny>.6?p.getZ(i):p.getY(i);}
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geo;
}
/** Orient a rendered resource mesh into a sampled ground plane while retaining
 * its deterministic yaw about the terrain normal. Gameplay colliders stay upright. */
export function surfaceAlignedQuaternion(normal:THREE.Vector3,yaw:number):THREE.Quaternion {
  const up=new THREE.Vector3(0,1,0),surface=normal.clone().normalize();
  return new THREE.Quaternion().setFromAxisAngle(surface,yaw).multiply(new THREE.Quaternion().setFromUnitVectors(up,surface));
}
/** Vertically seats a transformed resource mesh against the sampled terrain.
 * This only adjusts rendered geometry; callers keep gameplay positions/colliders. */
export function terrainContactOffset(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4,heightAt:(x:number,z:number)=>number,embed=.035):number {
  const position=geometry.getAttribute('position');if(!position)return 0;
  const point=new THREE.Vector3();let lowestClearance=Infinity;
  for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(matrix);
    const ground=heightAt(point.x,point.z);if(ground<=-9.9)continue;
    lowestClearance=Math.min(lowestClearance,point.y-ground);
  }
  return Number.isFinite(lowestClearance)?embed-lowestClearance:0;
}
export function bushGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[],r=randomSource(239);for(let i=0;i<16;i++){const a=r()*6.28,rad=r()*.7;parts.push(card(.8+r()*.45,.8+r()*.7,Math.cos(a)*rad,r()*.5,Math.sin(a)*rad,(r()-.5)*1.6,r()*6.28));}
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
  const colors=new Float32Array(geo.getAttribute('position').count*3);colors.fill(1);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));return geo;
}
/** Small bent blades use real silhouettes, so distant alpha cards cannot turn
 * into dark quads. One shared 36-triangle tuft is instanced across the island. */
export function grassGeometry():THREE.BufferGeometry {
  const r=randomSource(615),positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let blade=0;blade<12;blade++){
    const angle=blade/12*Math.PI*2+r()*.42,radius=blade<4?.08+r()*.09:.16+r()*.12,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const height=.34+Math.pow(r(),.78)*.58,width=.018+r()*.027,lean=.08+r()*.20;
    const dx=Math.cos(angle),dz=Math.sin(angle),base=positions.length/3;
    const points=[[-width,0,0],[width,0,0],[-width*.55,height*.53,lean*.35],[width*.55,height*.53,lean*.35],[0,height,lean]];
    for(const [side,y,bend] of points){positions.push(x+dx*side-dz*bend,y,z+dz*side+dx*bend);const t=y/height;colors.push(.23+t*.22,.29+t*.23,.115+t*.13);}
    indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
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


export function fernGeometry(fuller=false):THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  const height=fuller?1.12:.95,width=fuller?.46:.34,arms=9;
  for(let arm=0;arm<arms;arm++){
    const g=new THREE.PlaneGeometry(width,height,2,4),p=g.getAttribute('position');
    for(let i=0;i<p.count;i++){const y=p.getY(i)+height/2,t=Math.max(0,Math.min(1,y/height)),w=Math.sin(t*Math.PI)*(.92-.22*t);p.setX(i,p.getX(i)*w);p.setZ(i,Math.sin(t*Math.PI)*.13);}
    g.translate(0,height*.485,0);temp.position.set(0,.02,0);temp.rotation.set(-.72+(arm%3)*.08,arm/arms*Math.PI*2,(arm%2?1:-1)*.08);temp.scale.set(1,1,1);temp.updateMatrix();g.applyMatrix4(temp.matrix);parts.push(g);
  }
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geo.computeVertexNormals();return geo;
}

export function twigGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  const add=(x:number,z:number,len:number,rot:number)=>{const g=new THREE.CylinderGeometry(.012,.021,len,5);g.rotateZ(Math.PI/2);g.rotateY(rot);g.translate(x,.025,z);parts.push(g);};
  add(0,0,.95,.2);add(.08,.03,.62,-.55);add(-.14,-.04,.48,.83);const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}

export function seaweedGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  for(let blade=0;blade<6;blade++){const g=new THREE.PlaneGeometry(.14,.9,2,7),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i)+.45,t=y/.9;p.setX(i,p.getX(i)*(1-t*.72)+Math.sin(t*8+blade)*.05*t);p.setZ(i,Math.sin(t*5+blade)*.055);}g.translate((blade-2.5)*.045,.44,0);g.rotateY(blade/6*Math.PI*2);parts.push(g);}const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geo.computeVertexNormals();return geo;
}

/** Solid, instancing-friendly marsh reed tuft; no alpha cards or per-stalk draws. */
export function reedGeometry():THREE.BufferGeometry{
  const parts:THREE.BufferGeometry[]=[];
  for(let stalk=0;stalk<7;stalk++){
    const angle=stalk*2.399,height=1.05+((stalk*37)%7)*.105,x=Math.cos(angle)*(.06+(stalk%3)*.095),z=Math.sin(angle)*(.06+(stalk%3)*.095),stem=new THREE.CylinderGeometry(.014,.032,height,5,2);
    const p=stem.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i),t=(y+height/2)/height;p.setX(i,p.getX(i)+t*t*Math.cos(angle)*.16);p.setZ(i,p.getZ(i)+t*t*Math.sin(angle)*.16);}stem.translate(x,height/2,z);stem.computeVertexNormals();parts.push(stem);
    if(stalk%2===0){const seed=new THREE.SphereGeometry(.052,5,5);seed.scale(.72,1.7,.72);seed.translate(x+Math.cos(angle)*.16,height+.045,z+Math.sin(angle)*.16);parts.push(seed);}
  }
  const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());geometry.computeVertexNormals();return geometry;
}
