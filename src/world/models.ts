import * as THREE from 'three';
import {mergeGeometries,mergeVertices,toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {Noise,randomSource} from './noise';

const temp=new THREE.Object3D();temp.rotation.order='YXZ';
function card(w:number,h:number,x:number,y:number,z:number,rx:number,ry:number,rz=0,verticalSegments=2):THREE.BufferGeometry {
  const g=new THREE.PlaneGeometry(w,h,1,verticalSegments);g.translate(0,h/2,0);temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(1,1,1);temp.updateMatrix();g.applyMatrix4(temp.matrix);return g;
}
function broadleafBoughs(variant:number){const r=randomSource(903+variant*71);return Array.from({length:7},(_,b)=>{const angle=b*2.399,dist=1.5+r()*1.7;return {x:Math.cos(angle)*dist,z:Math.sin(angle)*dist,y:4.7+r()*3.5+Math.sin(angle)*.6};});}
function revision6CanopyMass(variant:number):THREE.SphereGeometry{
  const geometry=new THREE.SphereGeometry(1,6,4),position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),warp=1+.15*Math.sin(x*8.7+y*5.1+variant*1.9)*Math.cos(z*7.4-x*4.3+variant*.8)+.035*Math.sin(y*15.2+x*7.1-z*9.3+variant*2.7);
    position.setXYZ(i,x*warp,y*warp,z*warp);
  }
  geometry.computeVertexNormals();return geometry;
}
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
export function broadleafGeometry(variant=0,revision6=false,part:'all'|'masses'|'leaves'='all'):THREE.BufferGeometry {
  const r=randomSource(372+variant*517),parts:THREE.BufferGeometry[]=[],massParts:THREE.BufferGeometry[]=[],leafParts:THREE.BufferGeometry[]=[];
  const addMass=(geometry:THREE.BufferGeometry)=>{parts.push(geometry);massParts.push(geometry);},addLeaves=(geometry:THREE.BufferGeometry)=>{parts.push(geometry);leafParts.push(geometry);};
  // Low-poly crown masses soften the open center between the larger boughs
  // without turning the canopy into a single opaque blob.
  const crownCore=revision6?revision6CanopyMass(variant):new THREE.IcosahedronGeometry(1,0);if(!revision6)crownCore.setIndex(Array.from({length:crownCore.getAttribute('position').count},(_,index)=>index));crownCore.scale(revision6?.86+variant*.05:1.08+variant*.08,revision6?.88+variant*.05:1.04+variant*.12,revision6?.86+variant*.05:1.02+variant*.08);crownCore.translate(0,7.1+variant*.18,0);addMass(crownCore);
  if(!revision6)for(let i=0;i<4;i++){const angle=i*Math.PI*.5+variant*.37,mass=new THREE.IcosahedronGeometry(1,0);mass.setIndex(Array.from({length:mass.getAttribute('position').count},(_,index)=>index));mass.scale(.68+variant*.06,.73,.70);mass.translate(Math.cos(angle)*1.15,6.9+Math.sin(angle*1.8)*.28,Math.sin(angle)*1.15);addMass(mass);}
  // Separate bough clusters, with an asymmetric open-grown oak variant.
  for(const [index,bough] of broadleafBoughs(variant).entries()){
    const cx=bough.x,cz=bough.z,cy=bough.y;
    // A small opaque faceted mass gives the cutout sprays depth edge-on;
    // Revision 6 renders this separately so alpha testing cannot cut holes
    // through the volume.
    const foliageCore=revision6?revision6CanopyMass(variant):new THREE.IcosahedronGeometry(1,0);
    if(!revision6)foliageCore.setIndex(Array.from({length:foliageCore.getAttribute('position').count},(_,index)=>index));
    // Let neighboring bough masses overlap slightly so the lower-camera
    // silhouette reads as one branching crown instead of seven detached
    // pom-poms. Geometry remains shared and the instance/draw budget is fixed.
    foliageCore.scale(revision6?.35+variant*.03:1.02+variant*.12,revision6?.34+variant*.025:.78+variant*.08,revision6?.35+variant*.03:.96+variant*.1);
    foliageCore.translate(cx,cy,cz);
    addMass(foliageCore);
    // A smaller offset mass rounds out the branch silhouette in profile.
    if(!revision6){const angle=index*2.399+variant*.63,lobe=new THREE.IcosahedronGeometry(1,0);
      lobe.setIndex(Array.from({length:lobe.getAttribute('position').count},(_,vertex)=>vertex));
      lobe.scale(.66,.58,.64);
      lobe.translate(cx+Math.cos(angle)*.78,cy+.18+Math.sin(angle*1.7)*.24,cz+Math.sin(angle)*.78);
      addMass(lobe);}
    for(let i=0;i<(revision6?34:16);i++){
      const a=r()*6.28,rad=Math.sqrt(r())*(revision6 ? .94 : variant ? 2.1 : 1.65);
      const leafWidth=revision6 ? 1.18+r()*.32 : 1.3+r()*.65,leafHeight=revision6 ? 1.25+r()*.32 : 1.3+r()*.7;
      // Keep broadleaf sprays mostly upright. Fully random Euler tilts put
      // many planes nearly horizontal, which reads as flat umbrellas from
      // the player's low camera even though the cards are double-sided.
      addLeaves(card(leafWidth,leafHeight,cx+Math.cos(a)*rad,cy+(r()-.5)*1.5,cz+Math.sin(a)*rad,(r()-.5)*.85,r()*6.28,(r()-.5)*.65,revision6?1:2));
    }
  }
  const selected=part==='masses'?massParts:part==='leaves'?leafParts:parts,geo=mergeGeometries(selected)!;parts.forEach(g=>g.dispose());return geo;
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
export function rockGeometry(seed:number,sharperFacets=false):THREE.BufferGeometry {
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
  const hull=new ConvexGeometry(points),geo=toCreasedNormals(hull,sharperFacets?.54:.85);hull.dispose();
  const p=geo.getAttribute('position'),norm=geo.getAttribute('normal'),uv=new Float32Array(p.count*2),colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const nx=norm.getX(i),ny=norm.getY(i),nz=norm.getZ(i);uv[i*2]=Math.abs(nx)>.6?p.getZ(i):p.getX(i);uv[i*2+1]=Math.abs(ny)>.6?p.getZ(i):p.getY(i);
    const hash=Math.sin(nx*127.1+ny*311.7+nz*74.7+seed*.017)*43758.5453,variation=hash-Math.floor(hash),shade=.76+variation*.40;colors[i*3]=shade*1.015;colors[i*3+1]=shade;colors[i*3+2]=shade*.975;
  }
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));return geo;
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
/** Compact solid woodland shrub; shared by the Rev6 instanced understory batch. */
export function forestShrubGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[],rand=randomSource(4187);
  for(let lobe=0;lobe<7;lobe++){
    const angle=lobe*2.399+rand()*.24,radius=lobe===0?0:.17+rand()*.16,geometry=new THREE.IcosahedronGeometry(lobe===0?.26:.155+rand()*.075,0);
    geometry.scale(.92+rand()*.42,.8+rand()*.38,.88+rand()*.46);
    geometry.translate(Math.cos(angle)*radius,lobe===0?.47:.36+rand()*.20,Math.sin(angle)*radius);parts.push(geometry);
  }
  const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());geometry.computeVertexNormals();return geometry;
}
/** Small bent blades use real silhouettes, so distant alpha cards cannot turn
 * into dark quads. One shared 36-triangle tuft is instanced across the island. */
export function grassGeometry(fuller=false):THREE.BufferGeometry {
  const r=randomSource(615),positions:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let blade=0;blade<12;blade++){
    // Revision 6 forms three loose, offset sprays instead of a uniformly
    // radial pinwheel. Keep the legacy tuft deterministic and bit-identical.
    const cluster=Math.floor(blade/4),angle=fuller?cluster*Math.PI*2/3+(r()-.5)*.86:blade/12*Math.PI*2+r()*.42,
      radius=fuller?(blade%4===0?.035+r()*.11:.21+r()*.22):blade<4?.08+r()*.09:.16+r()*.12,
      x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const height=fuller?(blade%4===0?.92+r()*.10:.25+Math.pow(r(),1.2)*.56):.34+Math.pow(r(),.78)*.58,
      width=(fuller ? .027 : .018)+r()*(fuller ? .035 : .027),lean=(fuller ? .06 : .08)+r()*(fuller ? .24 : .20);
    const dx=Math.cos(angle),dz=Math.sin(angle),base=positions.length/3;
    const points=fuller?[[-width,0,0],[width,0,0],[0,height,lean]]:[[-width,0,0],[width,0,0],[-width*.55,height*.53,lean*.35],[width*.55,height*.53,lean*.35],[0,height,lean]];
    for(const [side,y,bend] of points){positions.push(x+dx*side-dz*bend,y,z+dz*side+dx*bend);const t=y/height;colors.push(.23+t*.22,.29+t*.23,.115+t*.13);}
    if(fuller)indices.push(base,base+1,base+2);
    else indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
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
    // Keep the legacy silhouette untouched. Rev6 fronds retain a center bend
    // for a cupped leaf profile while removing redundant width tessellation
    // from a mesh that is instanced thousands of times.
    const g=new THREE.PlaneGeometry(width,height,fuller?1:2,fuller?2:4),p=g.getAttribute('position');
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

/** One wind-felled forest trunk with two broken branch stubs, for instancing. */
export function fallenLogGeometry():THREE.BufferGeometry {
  const trunk=new THREE.CylinderGeometry(.125,.19,2.45,8,2,false);trunk.rotateX(Math.PI/2);
  const parts:THREE.BufferGeometry[]=[trunk];
  for(const side of [-1,1]){const branch=new THREE.CylinderGeometry(.028,.065,.42,5,1,false);branch.rotateZ(side*.95);branch.translate(0,.08,side*.42);parts.push(branch);}
  const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());
  if(!geometry)throw new Error('Could not build fallen log geometry');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function seaweedGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  for(let blade=0;blade<6;blade++){const g=new THREE.PlaneGeometry(.14,.9,2,7),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i)+.45,t=y/.9;p.setX(i,p.getX(i)*(1-t*.72)+Math.sin(t*8+blade)*.05*t);p.setZ(i,Math.sin(t*5+blade)*.055);}g.translate((blade-2.5)*.045,.44,0);g.rotateY(blade/6*Math.PI*2);parts.push(g);}const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geo.computeVertexNormals();return geo;
}

/** Solid, instancing-friendly marsh reed tuft; no alpha cards or per-stalk draws. */
export function reedGeometry():THREE.BufferGeometry{
  const parts:THREE.BufferGeometry[]=[];
  for(let stalk=0;stalk<7;stalk++){
    const angle=stalk*2.399,height=1.05+((stalk*37)%7)*.105,x=Math.cos(angle)*(.06+(stalk%3)*.095),z=Math.sin(angle)*(.06+(stalk%3)*.095),stem=new THREE.CylinderGeometry(.014,.032,height,3,1);
    const p=stem.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i),t=(y+height/2)/height;p.setX(i,p.getX(i)+t*t*Math.cos(angle)*.16);p.setZ(i,p.getZ(i)+t*t*Math.sin(angle)*.16);}stem.translate(x,height/2,z);stem.computeVertexNormals();parts.push(stem);
    if(stalk%2===0){const seed=new THREE.SphereGeometry(.052,4,3);seed.scale(.72,1.7,.72);seed.translate(x+Math.cos(angle)*.16,height+.045,z+Math.sin(angle)*.16);parts.push(seed);}
  }
  const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());geometry.computeVertexNormals();return geometry;
}

/** Shared, shallow-bowl water surface with an irregular silty edge for Rev6 marsh pools. */
export function marshPoolGeometry(seed=88217):THREE.BufferGeometry {
  const segments=40,rings=[.32,.58,.78,.92,1],rand=randomSource(seed),positions:number[]=[0,-.11,0],colors:number[]=[],indices:number[]=[];
  const center=new THREE.Color(0x344b48),inner=new THREE.Color(0x49645f),bank=new THREE.Color(0x5d604c),mud=new THREE.Color(0x645e46);
  const poolWater=center.clone().lerp(inner,.4);colors.push(poolWater.r,poolWater.g,poolWater.b);
  const phases=[rand()*6.28,rand()*6.28,rand()*6.28];
  for(let ring=0;ring<rings.length;ring++)for(let i=0;i<segments;i++){
    const angle=i/segments*Math.PI*2,noise=Math.sin(angle*3+phases[0]!)*.105+Math.sin(angle*5+phases[1]!)*.061+Math.sin(angle*9+phases[2]!)*.027+Math.sin(angle*13+phases[0]!*.7)*.012,radius=rings[ring]!*(1+noise),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=-.11*(1-rings[ring]!);
    positions.push(x,y,z);
    const tint=ring===0?poolWater: ring===1?inner.clone().lerp(bank,.16):ring===2?inner.clone().lerp(bank,.52):bank.clone().lerp(mud,.43+rand()*.12);
    colors.push(tint.r,tint.g,tint.b);
  }
  for(let i=0;i<segments;i++)indices.push(0,1+(i+1)%segments,1+i);
  for(let ring=0;ring<rings.length-1;ring++){
    const innerStart=1+ring*segments,outerStart=innerStart+segments;
    for(let i=0;i<segments;i++){
      const next=(i+1)%segments,a=innerStart+i,b=outerStart+i,c=outerStart+next,d=innerStart+next;
      indices.push(a,d,c,a,c,b);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
