import * as THREE from 'three';
import {WORLD} from '../config/balance';
import type {ResourceNode,Vec3,Structure} from '../core/types';
import {IslandTerrain} from '../terrain/island';
import {Atmosphere} from '../world/atmosphere';
import {randomSource,smoothstep} from '../world/noise';
import {barkTexture,grassTexture,pineTexture,leavesTexture,stoneMaterial,terrainMaterial,groundDecalTexture} from '../world/materials';
import {pineGeometry,broadleafGeometry,trunkGeometry,rockGeometry,bushGeometry,grassGeometry,fiberGeometry,berryGeometry,fernGeometry,twigGeometry,seaweedGeometry} from '../world/models';

type InstanceRef={mesh:THREE.InstancedMesh;index:number;matrix:THREE.Matrix4};
type NaturalCollider={position:Vec3;halfExtents:Vec3;rotation?:number;nodeId?:string};
type GrassChunk={mesh:THREE.InstancedMesh;center:THREE.Vector3;fullCount:number};
type TreeFall={elapsed:number;duration:number;hold:number;fade:number;axis:THREE.Vector3;refs:InstanceRef[];node:ResourceNode};

/** The render adapter for deterministic island data; gameplay mutations arrive through syncNodes. */
export class Environment {
  readonly root=new THREE.Group();
  readonly nodes:ResourceNode[]=[];
  readonly nodeObjects=new Map<string,THREE.Object3D>();
  readonly colliders:NaturalCollider[]=[];
  readonly terrainGeometry:THREE.BufferGeometry;
  readonly spawn:Vec3;
  readonly terrain:IslandTerrain;
  readonly atmosphere:Atmosphere;
  private readonly instances=new Map<string,InstanceRef[]>();
  private readonly resources:THREE.Object3D[]=[];
  private readonly grassChunks:GrassChunk[]=[];
  private readonly treeBatches:{trunks:THREE.InstancedMesh;crowns:THREE.InstancedMesh;fullCount:number}[]=[];
  private readonly grassMaterials:THREE.MeshLambertMaterial[]=[];
  private readonly detailMeshes:{mesh:THREE.InstancedMesh;fullCount:number;minimum:'low'|'medium'|'high'}[]=[];
  private readonly decalMeshes:THREE.InstancedMesh[]=[];
  private readonly materials=new Set<THREE.Material>();
  private readonly geometries=new Set<THREE.BufferGeometry>();
  windStrength=1;
  private readonly windUniform={value:0};
  private readonly cameraUniform={value:new THREE.Vector3()};
  private readonly grassDistanceUniform={value:110};
  private readonly hits=new Map<string,{elapsed:number;intensity:number}>();
  private readonly fallingTrees=new Map<string,TreeFall>();
  private populated=false;
  private readonly grassCoveredBy=new Set<string>();
  private readonly matrixDummy=new THREE.Object3D();
  private readonly hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
  private readonly leaves:THREE.MeshLambertMaterial;
  private readonly pine:THREE.MeshLambertMaterial;
  private readonly bark:THREE.MeshStandardMaterial;
  private readonly stone:THREE.MeshStandardMaterial;
  private readonly metal:THREE.MeshStandardMaterial;
  private readonly fiber:THREE.MeshStandardMaterial;
  private readonly berries:THREE.MeshStandardMaterial;
  private readonly invisible=new THREE.MeshBasicMaterial({visible:false});
  private cullClock=0;
  private quality:'low'|'medium'|'high'|'ultra'='high';
  private foliageDensity=.72;

  constructor(readonly scene:THREE.Scene,readonly seed:number,worldGeneration:1|2=2,deferPopulation=false){
    this.root.name='Tideland — procedural island';scene.add(this.root);
    this.terrain=new IslandTerrain(seed,worldGeneration);this.terrainGeometry=this.terrain.geometry;this.spawn={...this.terrain.spawn};
    const terrainMat=terrainMaterial(),ground=new THREE.Mesh(this.terrainGeometry,terrainMat);ground.name='Island ground';ground.receiveShadow=true;this.root.add(ground);this.materials.add(terrainMat);this.geometries.add(this.terrainGeometry);
    this.atmosphere=new Atmosphere(scene,this.terrain.heightTexture);
    this.bark=new THREE.MeshStandardMaterial({map:barkTexture(),color:0xb6b4a4,roughness:.97});
    this.leaves=this.foliageMaterial(leavesTexture(),0xffffff);this.pine=this.foliageMaterial(pineTexture(),0xffffff);
    this.stone=stoneMaterial(0xd5d0bf);this.metal=stoneMaterial(0x8d8273);
    this.fiber=new THREE.MeshStandardMaterial({color:0x5e753e,roughness:.85,side:THREE.DoubleSide});this.berries=new THREE.MeshStandardMaterial({color:0x98383c,roughness:.7});
    [this.bark,this.leaves,this.pine,this.stone,this.metal,this.fiber,this.berries,this.invisible].forEach(m=>this.materials.add(m));
    if(!deferPopulation)this.populateNow();
  }
  private populateNow():void {
    if(this.populated)return;
    this.populateTrees();this.populateRocks();this.populatePlants();this.populateUnderstory();this.populateGrass();this.populateShore();this.populateGroundDecals();this.setQuality('high');this.update(0,9.4,new THREE.Vector3(this.spawn.x,this.spawn.y,this.spawn.z));this.populated=true;
  }
  async populateAsync(stage:(progress:number,status:string,detail?:string)=>Promise<void>):Promise<void> {
    if(this.populated)return;
    await stage(24,'Growing coastal forest','Placing harvestable trees and preparing canopy batches');this.populateTrees();
    await stage(36,'Scattering rock fields','Building stone outcrops and metal deposits');this.populateRocks();
    await stage(47,'Planting ground resources','Adding fiber, berries and shoreline pickups');this.populatePlants();
    await stage(53,'Layering forest understory','Adding ferns, fallen twigs and dry meadow tufts');this.populateUnderstory();
    await stage(59,'Seeding windblown grass','Preparing vegetation chunks and distance culling');this.populateGrass();
    await stage(63,'Finishing the shoreline','Placing pebbles, driftwood and tidal seaweed');this.populateShore();
    await stage(64,'Painting terrain detail','Scattering low-cost soil, leaf-litter and rock decals');this.populateGroundDecals();
    this.setQuality('high');this.update(0,9.4,new THREE.Vector3(this.spawn.x,this.spawn.y,this.spawn.z));this.populated=true;
    await stage(65,'World vegetation ready','Terrain resources are ready for gameplay systems');
  }
  heightAt(x:number,z:number):number{return this.terrain.heightAt(x,z);}
  biomeAt(x:number,z:number):string{return this.terrain.biomeAt(x,z);}
  private foliageMaterial(tex:THREE.Texture,color:number):THREE.MeshLambertMaterial {
    // Foliage gets a restrained green lift so back-lit cards still read as
    // needle/leaf volume.  The texture remains the primary color source; this
    // only keeps the shaded side from becoming a featureless silhouette.
    const mat=new THREE.MeshLambertMaterial({map:tex,color,vertexColors:true,alphaTest:.38,side:THREE.DoubleSide,emissive:0x394435,emissiveIntensity:.12});
    mat.onBeforeCompile=s=>{s.uniforms.windTime=this.windUniform;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float windTime;');s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
      float treePhase=instanceMatrix[3].x*.14+instanceMatrix[3].z*.11;transformed.x+=sin(windTime*1.05+treePhase+position.y*.6)*.045*max(0.,position.y-2.);
      #endif`);};return mat;
  }
  private own<T extends THREE.BufferGeometry>(g:T):T {this.geometries.add(g);return g;}
  private addNode(kind:ResourceNode['kind'],x:number,z:number,scale:number,rotation:number,capacity:number):ResourceNode {
    const node:ResourceNode={id:`${kind}-${this.nodes.length}`,kind,position:{x,y:this.heightAt(x,z),z},scale,rotation,capacity,remaining:capacity};this.nodes.push(node);return node;
  }
  private place(object:THREE.Object3D,node:ResourceNode):void {
    object.position.set(node.position.x,node.position.y,node.position.z);object.rotation.y=node.rotation;object.scale.setScalar(node.scale);object.userData.nodeId=node.id;object.traverse(o=>{o.userData.nodeId=node.id;});this.nodeObjects.set(node.id,object);this.resources.push(object);this.root.add(object);
  }
  private populateTrees():void {
    const rand=randomSource(this.seed+139),treeNodes:{node:ResourceNode;species:number}[]=[];
    // Keep the starter clearing readable from the default first-person heading.
    // The first hand-placed trees still frame the spawn, but no trunk fills the
    // reticle at arm's length before the player has had a chance to look around.
    for(const [x,z,scale,species] of [[6,198,.86,0],[55,200,.96,1],[-4,190,1.02,0],[53,181,.84,0]] as const)treeNodes.push({node:this.addNode('tree',x,z,scale,rand()*6.28,300),species});
    const modern=this.terrain.generation===2;
    for(let i=0;i<(modern?12000:7000)&&treeNodes.length<(modern?820:560);i++){
      const x=(rand()-.5)*580,z=(rand()-.5)*580,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z),forest=this.terrain.forestAt(x,z);
      if(h<4||h>38||slope>.68||Math.hypot(x-this.spawn.x,z-this.spawn.z)<30)continue;
      const density=smoothstep(.32,.68,forest);if(rand()>.055+density*.79)continue;
      // Blue-noise rejection gives each trunk natural breathing room inside groves.
      if(treeNodes.some(t=>Math.hypot(t.node.position.x-x,t.node.position.z-z)<4))continue;
      const broad=rand()<(.27+(h<16?.18:0));
      const variant=Math.sin(x*12.9898+z*78.233)>0;
      const species=broad?(variant?1:4):(forest>.5?(variant?0:2):3);
      treeNodes.push({node:this.addNode('tree',x,z,.72+rand()*.57,rand()*6.28,300),species});
    }
    for(let species=0;species<5;species++){
      const entries=treeNodes.filter(t=>t.species===species),trunk=this.own(trunkGeometry(species===1||species===4,species===2||species===4?1:species===3?2:0)),crown=this.own(species===1||species===4?broadleafGeometry(species===4?1:0):pineGeometry(species===2?1:species===3?2:0));
      // Instanced canopy tinting needs a neutral per-vertex color channel;
      // without it Three.js multiplies the foliage texture by an undefined
      // attribute and the entire canopy falls to black.
      if(!crown.getAttribute('color')){const colors=new Float32Array(crown.getAttribute('position').count*3);colors.fill(1);crown.setAttribute('color',new THREE.BufferAttribute(colors,3));}
      const trunks=new THREE.InstancedMesh(trunk,this.bark,entries.length),crowns=new THREE.InstancedMesh(crown,species===1||species===4?this.leaves:this.pine,entries.length);
      const broad=species===1||species===4;trunks.name=broad?'Oak trunks':'Pine trunks';crowns.name=broad?'Oak canopy':'Pine canopy';trunks.castShadow=trunks.receiveShadow=true;crowns.castShadow=true;crowns.receiveShadow=true;this.root.add(trunks,crowns);
      const hitGeometry=this.own(new THREE.CylinderGeometry(.37,.45,broad?7.7:12.8,6));hitGeometry.translate(0,broad?3.85:6.4,0);
      entries.forEach(({node},index)=>{
        this.matrixDummy.position.set(node.position.x,node.position.y-.08,node.position.z);this.matrixDummy.rotation.set(0,node.rotation,0);this.matrixDummy.scale.setScalar(node.scale);this.matrixDummy.updateMatrix();const m=this.matrixDummy.matrix.clone();trunks.setMatrixAt(index,m);crowns.setMatrixAt(index,m);trunks.setColorAt(index,new THREE.Color().setHSL(.08+(rand()-.5)*.018,.18,.78+rand()*.12));
        const col=species===1||species===4?new THREE.Color().setHSL(.27+(rand()-.5)*.05,.28,.56+rand()*.14):new THREE.Color().setHSL(.25+(rand()-.5)*.04,.34,.48+rand()*.15);crowns.setColorAt(index,col);
        this.instances.set(node.id,[{mesh:trunks,index,matrix:m},{mesh:crowns,index,matrix:m}]);
        const hit=new THREE.Mesh(hitGeometry,this.invisible);this.place(hit,node);
        this.colliders.push({nodeId:node.id,position:{x:node.position.x,y:node.position.y+(broad?3.6:6.2)*node.scale,z:node.position.z},halfExtents:{x:.27*node.scale,y:(broad?3.6:6.2)*node.scale,z:.27*node.scale}});
      });if(crowns.instanceColor)crowns.instanceColor.needsUpdate=true;if(trunks.instanceColor)trunks.instanceColor.needsUpdate=true;trunks.computeBoundingSphere();crowns.computeBoundingSphere();this.treeBatches.push({trunks,crowns,fullCount:entries.length});
    }
  }
  private populateRocks():void {
    const rand=randomSource(this.seed+283),geos=[this.own(rockGeometry(51)),this.own(rockGeometry(114)),this.own(rockGeometry(221))];
    const boulders:{x:number;y:number;z:number;sx:number;sy:number;sz:number;rot:number;variant:number}[]=[];
    // A broken coastal outcrop anchors the first view and frames the inland valley.
    for(const [x,z,sx,sy,sz] of [[-3,185,6,5.8,4.6],[-10,183,4.2,3.4,3.7],[-1,190,4,2.5,3.5],[68,180,6.5,6,5],[71,183,4,3,5]] as const)boulders.push({x,y:this.heightAt(x,z)-.1,z,sx,sy,sz,rot:rand()*6.28,variant:Math.floor(rand()*3)});
    for(let i=0;i<950;i++){
      const x=(rand()-.5)*570,z=(rand()-.5)*570,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
      if(h<.7||Math.hypot(x-this.spawn.x,z-this.spawn.z)<20)continue;
      const rocky=h>22||slope>.44;if(rand()>(rocky?.62:.10))continue;
      const size=rocky?1.8+rand()*5:.7+rand()*1.8;boulders.push({x,y:h-size*.12,z,sx:size*(.8+rand()*.5),sy:size*(.7+rand()*.55),sz:size*(.8+rand()*.5),rot:rand()*6.28,variant:Math.floor(rand()*3)});
    }
    for(let v=0;v<3;v++){
      const rocks=boulders.filter(b=>b.variant===v),mesh=new THREE.InstancedMesh(geos[v]!,this.stone,rocks.length);mesh.castShadow=mesh.receiveShadow=true;mesh.name='Weathered granite outcrops';rocks.forEach((r,i)=>{this.matrixDummy.position.set(r.x,r.y,r.z);this.matrixDummy.rotation.set((rand()-.5)*.18,r.rot,(rand()-.5)*.2);this.matrixDummy.scale.set(r.sx,r.sy,r.sz);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.12,.08,.72+rand()*.24));if(r.sy>1.5)this.colliders.push({position:{x:r.x,y:r.y+r.sy*.12,z:r.z},halfExtents:{x:r.sx*.7,y:r.sy*.64,z:r.sz*.7},rotation:r.rot});});mesh.computeBoundingSphere();this.root.add(mesh);
    }
    const make=(kind:'stone'|'metal',x:number,z:number,size:number)=>{
      const node=this.addNode(kind,x,z,size,rand()*6.28,kind==='stone'?240:180),group=new THREE.Group(),main=new THREE.Mesh(geos[Math.floor(rand()*3)]!,kind==='metal'?this.metal:this.stone);main.position.y=.52;main.scale.set(.94,.82,.88);main.castShadow=main.receiveShadow=true;group.add(main);
      const secondary=new THREE.Mesh(geos[Math.floor(rand()*3)]!,kind==='metal'?this.metal:this.stone);secondary.position.set(.57,.22,.19);secondary.scale.set(.5,.5,.55);secondary.castShadow=true;group.add(secondary);
      if(kind==='metal'){
        const veinMat=new THREE.MeshStandardMaterial({color:0xb99967,metalness:.48,roughness:.62});this.materials.add(veinMat);const vein=new THREE.Mesh(this.own(new THREE.DodecahedronGeometry(.16,0)),veinMat);vein.position.set(-.46,.89,.42);vein.scale.set(2.3,.46,.65);group.add(vein);
      }
      this.place(group,node);this.colliders.push({nodeId:node.id,position:{x,y:node.position.y+.5*size,z},halfExtents:{x:.67*size,y:.73*size,z:.61*size},rotation:node.rotation});
    };
    make('stone',24,206,.95);make('stone',35,199,1.1);make('metal',60,175,1.1);
    for(let i=0,count=0;i<2400&&count<118;i++){
      const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z);if(h<2.1||Math.hypot(x-this.spawn.x,z-this.spawn.z)<16||this.terrain.slopeAt(x,z)>.9)continue;
      if(rand()>(h>20?.7:.27))continue;make(rand()<.25?'metal':'stone',x,z,.8+rand()*.65);count++;
    }
  }
  private populatePlants():void {
    const rand=randomSource(this.seed+590),bush=this.own(bushGeometry()),fiberGeo=this.own(fiberGeometry()),berryGeo=this.own(berryGeometry()),twigGeo=this.own(new THREE.CylinderGeometry(.07,.12,1.5,7));
    twigGeo.rotateZ(Math.PI/2);const bushPositions:{x:number;y:number;z:number;s:number;r:number}[]=[];
    for(let i=0;i<2800&&bushPositions.length<490;i++){
      const x=(rand()-.5)*570,z=(rand()-.5)*570,h=this.heightAt(x,z);if(h<3||h>28||this.terrain.slopeAt(x,z)>.64||Math.hypot(x-this.spawn.x,z-this.spawn.z)<9)continue;
      if(this.terrain.forestAt(x,z)<.3||rand()>.42)continue;bushPositions.push({x,y:h,z,s:.55+rand()*.8,r:rand()*6.28});
    }
    const shrub=new THREE.InstancedMesh(bush,this.leaves,bushPositions.length);shrub.name='Coastal shrubs';shrub.receiveShadow=true;for(let i=0;i<bushPositions.length;i++){const b=bushPositions[i]!;this.matrixDummy.position.set(b.x,b.y,b.z);this.matrixDummy.rotation.set(0,b.r,0);this.matrixDummy.scale.set(b.s,b.s*.8,b.s);this.matrixDummy.updateMatrix();shrub.setMatrixAt(i,this.matrixDummy.matrix);}shrub.computeBoundingSphere();this.root.add(shrub);
    const create=(kind:'fiber'|'berries'|'wood',x:number,z:number,s:number)=>{
      const node=this.addNode(kind,x,z,s,rand()*6.28,kind==='wood'?60:kind==='fiber'?30:12);const group=new THREE.Group();
      if(kind==='wood'){
        for(let j=0;j<3;j++){const twig=new THREE.Mesh(twigGeo,this.bark);twig.position.set((rand()-.5)*.4,.15+j*.08,(j-1)*.2);twig.rotation.set(0,(rand()-.5)*.6,(rand()-.5)*.09);twig.castShadow=true;group.add(twig);}
      }else if(kind==='fiber'){
        const leaves=new THREE.Mesh(fiberGeo,this.fiber);leaves.castShadow=true;group.add(leaves);const stem=new THREE.Mesh(this.own(new THREE.CylinderGeometry(.013,.025,.88,5)),this.fiber);stem.position.y=.44;group.add(stem);
      }else{
        const foliage=new THREE.Mesh(bush,this.leaves);foliage.scale.set(.8,.8,.8);group.add(foliage);const fruit=new THREE.Mesh(berryGeo,this.berries);fruit.castShadow=true;group.add(fruit);
      }
      this.place(group,node);
    };
    create('wood',29.5,209,1);create('fiber',31,207.5,1.2);create('berries',35,208,1.3);create('fiber',22,210,1.15);create('wood',19,202,1.1);
    for(let i=0,count=0;i<1900&&count<150;i++){
      const x=(rand()-.5)*520,z=(rand()-.5)*520,h=this.heightAt(x,z);if(h<2.3||h>30||this.terrain.slopeAt(x,z)>.6||Math.hypot(x-this.spawn.x,z-this.spawn.z)<12)continue;
      if(rand()>.55)continue;create(rand()<.28?'wood':rand()<.34?'berries':'fiber',x,z,.75+rand()*.45);count++;
    }
  }
  private populateUnderstory():void {
    const rand=randomSource(this.seed+4421),fernG=this.own(fernGeometry()),twigG=this.own(twigGeometry()),tuftG=this.own(grassGeometry());
    const fernM=new THREE.MeshLambertMaterial({color:0x526d40,side:THREE.DoubleSide});
    const tuftTex=grassTexture(991,true),tuftM=new THREE.MeshLambertMaterial({map:tuftTex,color:0xc1b78d,alphaTest:.42,side:THREE.DoubleSide});this.materials.add(fernM);this.materials.add(tuftM);
    const fernPos:{x:number;y:number;z:number;s:number;r:number}[]=[],twigPos:{x:number;y:number;z:number;s:number;r:number}[]=[],tuftPos:{x:number;y:number;z:number;s:number;r:number}[]=[];
    for(let i=0;i<9000&&(fernPos.length<720||twigPos.length<620||tuftPos.length<680);i++){
      const x=(rand()-.5)*550,z=(rand()-.5)*550,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);if(h<2||h>34||slope>.68||Math.hypot(x-this.spawn.x,z-this.spawn.z)<12)continue;const forest=this.terrain.forestAt(x,z),biome=this.biomeAt(x,z);
      if(fernPos.length<720&&forest>.45&&rand()<.23)fernPos.push({x,y:h,z,s:.35+rand()*.52,r:rand()*6.28});
      if(twigPos.length<620&&forest>.34&&rand()<.18)twigPos.push({x,y:h+.025,z,s:.42+rand()*.85,r:rand()*6.28});
      if(tuftPos.length<680&&biome==='GRASSLAND'&&rand()<.20)tuftPos.push({x,y:h-.01,z,s:.32+rand()*.62,r:rand()*6.28});
    }
    const build=(positions:typeof fernPos,geometry:THREE.BufferGeometry,material:THREE.Material,name:string,minimum:'low'|'medium'|'high')=>{const mesh=new THREE.InstancedMesh(geometry,material,positions.length);mesh.name=name;mesh.receiveShadow=true;positions.forEach((p,i)=>{this.matrixDummy.position.set(p.x,p.y,p.z);this.matrixDummy.rotation.set(0,p.r,0);this.matrixDummy.scale.setScalar(p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);if(name.includes('Fern'))mesh.setColorAt(i,new THREE.Color().setHSL(.24+rand()*.045,.28,.52+rand()*.13));});if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.root.add(mesh);this.detailMeshes.push({mesh,fullCount:positions.length,minimum});};
    build(fernPos,fernG,fernM,'Forest fern understory','medium');build(twigPos,twigG,this.bark,'Fallen twig litter','medium');build(tuftPos,tuftG,tuftM,'Dry meadow tufts','low');
  }

  private populateGroundDecals():void {
    const rand=randomSource(this.seed+7719),geometry=this.own(new THREE.CircleGeometry(1,14));geometry.rotateX(-Math.PI/2);
    const configs=[['soil',groundDecalTexture(251,'soil'),240],['leaves',groundDecalTexture(617,'leaves'),220],['stone',groundDecalTexture(877,'stone'),150]] as const;
    for(const [kind,tex,count] of configs){const mat=new THREE.MeshStandardMaterial({map:tex,transparent:true,opacity:kind==='stone'?.30:.36,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});this.materials.add(mat);const matrices:THREE.Matrix4[]=[];
      for(let i=0,tries=0;i<count&&tries<count*12;tries++){const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z),forest=this.terrain.forestAt(x,z);if(h<1.4||h>36||slope>.45)continue;if(kind==='leaves'&&forest<.42)continue;if(kind==='stone'&&h<18&&slope<.28)continue;if(kind==='soil'&&forest>.68)continue;this.matrixDummy.position.set(x,h+.028,z);this.matrixDummy.rotation.set(0,rand()*6.28,0);this.matrixDummy.scale.set(.75+rand()*2.1,1,.45+rand()*1.5);this.matrixDummy.updateMatrix();matrices.push(this.matrixDummy.matrix.clone());i++;}
      const mesh=new THREE.InstancedMesh(geometry,mat,matrices.length);mesh.name=`${kind} ground decals`;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.renderOrder=1;mesh.computeBoundingSphere();this.root.add(mesh);this.decalMeshes.push(mesh);this.detailMeshes.push({mesh,fullCount:matrices.length,minimum:'high'});
    }
  }

  private populateShore():void {
    const rand=randomSource(this.seed+29119),stones:THREE.Matrix4[]=[],wood:THREE.Matrix4[]=[],weed:THREE.Matrix4[]=[];
    for(let i=0;i<4200;i++){
      const x=(rand()-.5)*590,z=(rand()-.5)*590,h=this.heightAt(x,z);if(h<.15||h>2.35||this.terrain.noise.at(x*.06,z*.06)<.54)continue;
      const choice=rand();if(choice<.075){const s=.55+rand()*.8;this.matrixDummy.position.set(x,h,z);this.matrixDummy.rotation.set(0,rand()*6.28,(rand()-.5)*.12);this.matrixDummy.scale.setScalar(s);this.matrixDummy.updateMatrix();wood.push(this.matrixDummy.matrix.clone());}
      else if(choice<.19){const s=.28+rand()*.55;this.matrixDummy.position.set(x,h-.03,z);this.matrixDummy.rotation.set(0,rand()*6.28,0);this.matrixDummy.scale.set(s,s*(.65+rand()*.6),s);this.matrixDummy.updateMatrix();weed.push(this.matrixDummy.matrix.clone());}
      else{const s=.10+rand()*.32;this.matrixDummy.position.set(x,h-s*.3,z);this.matrixDummy.rotation.set(0,rand()*6.28,(rand()-.5)*.12);this.matrixDummy.scale.setScalar(s);this.matrixDummy.updateMatrix();stones.push(this.matrixDummy.matrix.clone());}
    }
    const log=this.own(new THREE.CylinderGeometry(.055,.10,1.9,7));log.rotateZ(Math.PI/2);const weedG=this.own(seaweedGeometry()),weedM=new THREE.MeshStandardMaterial({color:0x596340,roughness:.92,side:THREE.DoubleSide});this.materials.add(weedM);
    for(const [matrices,geometry,material,name] of [[stones,this.own(rockGeometry(811)),this.stone,'Tide-washed pebbles'],[wood,log,this.bark,'Stranded branches'],[weed,weedG,weedM,'Tidal seaweed']] as const){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.name=name;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.root.add(mesh);if(name==='Tidal seaweed')this.detailMeshes.push({mesh,fullCount:matrices.length,minimum:'medium'});}
  }
  private populateGrass():void {
    const rand=randomSource(this.seed+814),geometry=this.own(grassGeometry()),chunks=new Map<string,{positions:{x:number;y:number;z:number;s:number;r:number}[];x:number;z:number;type:number}>();
    const textureA=grassTexture(525),textureB=grassTexture(623,true);
    for(const map of [textureA,textureB]){
      // Keep meadow cards on the stable material path. The previous custom
      // vertex-distance fade could collapse blades into dark/black strips on
      // some ANGLE/WebGL drivers. Chunk culling still keeps the GPU cost bounded.
      const mat=new THREE.MeshLambertMaterial({map,color:0xd3d8ba,alphaTest:.5,side:THREE.DoubleSide,emissive:0x1b2415,emissiveIntensity:.12});
      this.grassMaterials.push(mat);this.materials.add(mat);
    }
    const total=Math.floor(WORLD.GRASS_DENSITY*.72);
    for(let attempt=0,count=0;attempt<total*8&&count<total;attempt++){
      const near=count<14500,x=near?this.spawn.x+(rand()-.5)*85:(rand()-.5)*560,z=near?this.spawn.z+(rand()-.5)*85:(rand()-.5)*560;
      const h=this.heightAt(x,z);if(h<2||h>35||this.terrain.slopeAt(x,z)>.76)continue;
      const n=this.terrain.noise.at(x*.12,z*.12),patch=this.terrain.noise.fbm(x*.035+41,z*.035-17,3);if(rand()>smoothstep(.2,.73,n)*smoothstep(.24,.68,patch)*.94+.035)continue;
      const cx=Math.floor(x/40),cz=Math.floor(z/40),type=rand()<smoothstep(.44,.7,patch)*.36?1:0,key=`${cx},${cz},${type}`;let chunk=chunks.get(key);if(!chunk){chunk={positions:[],x:cx*40+20,z:cz*40+20,type};chunks.set(key,chunk);}
      chunk.positions.push({x,y:h-.02,z,s:(.24+Math.pow(rand(),1.7)*.72)*(h<4?.8:1),r:rand()*Math.PI*2});count++;
    }
    for(const chunk of chunks.values()){
      const mesh=new THREE.InstancedMesh(geometry,this.grassMaterials[chunk.type]!,chunk.positions.length);mesh.name='Windblown meadow';mesh.receiveShadow=true;
      chunk.positions.forEach((p,i)=>{this.matrixDummy.position.set(p.x,p.y,p.z);this.matrixDummy.rotation.set(0,p.r,0);this.matrixDummy.scale.set(p.s,p.s*(.55+rand()*.8),p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.20+rand()*.035,.24,.58+rand()*.16));});mesh.computeBoundingSphere();this.root.add(mesh);this.grassChunks.push({mesh,center:new THREE.Vector3(chunk.x,this.heightAt(chunk.x,chunk.z),chunk.z),fullCount:chunk.positions.length});
    }
  }
  update(dt:number,timeOfDay:number,cameraPosition:THREE.Vector3):void {
    this.windUniform.value+=dt*this.windStrength;this.cameraUniform.value.copy(cameraPosition);this.atmosphere.update(dt,timeOfDay,cameraPosition);this.cullClock-=dt;
    if(this.cullClock<=0){this.cullClock=.28;const d=this.quality==='low'?68:this.quality==='medium'?92:118;for(const c of this.grassChunks)c.mesh.visible=c.center.distanceToSquared(cameraPosition)<(d+32)*(d+32);const resourceDistance=this.quality==='low'?115:this.quality==='medium'?165:215;for(const obj of this.resources){const id=obj.userData.nodeId as string;const node=this.nodes.find(n=>n.id===id);obj.visible=!!node&&node.remaining>0&&obj.position.distanceToSquared(cameraPosition)<resourceDistance*resourceDistance;}}
    for(const [id,hit] of this.hits){const elapsed=hit.elapsed+dt,obj=this.nodeObjects.get(id),refs=this.instances.get(id);if(elapsed>.4){this.hits.delete(id);if(obj)obj.rotation.z=0;if(refs)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}else{hit.elapsed=elapsed;const amount=Math.sin(elapsed*34)*(1-elapsed/.4)*.022*hit.intensity;if(obj)obj.rotation.z=amount;if(refs)for(const ref of refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.rotation.z=amount;this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}}
    for(const [id,fall] of this.fallingTrees){
      fall.elapsed+=dt;const fallT=Math.min(1,fall.elapsed/fall.duration),eased=1-Math.pow(1-fallT,3),fadeStart=fall.duration+fall.hold,total=fadeStart+fall.fade;
      if(fall.elapsed>=total){for(const ref of fall.refs){ref.mesh.setMatrixAt(ref.index,this.hiddenMatrix);ref.mesh.instanceMatrix.needsUpdate=true;}this.fallingTrees.delete(id);continue;}
      const fadeT=fall.elapsed>fadeStart?Math.min(1,(fall.elapsed-fadeStart)/fall.fade):0,scale=1-fadeT*.92,sink=fadeT*1.15*fall.node.scale;
      const fallRotation=new THREE.Quaternion().setFromAxisAngle(fall.axis,eased*Math.PI*.49);
      for(const ref of fall.refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.quaternion.premultiply(fallRotation);this.matrixDummy.position.y-=sink;this.matrixDummy.scale.multiplyScalar(scale);this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}
    }
  }
  setQuality(quality:'low'|'medium'|'high'|'ultra'):void {
    this.quality=quality;this.atmosphere.setQuality(quality);this.grassDistanceUniform.value=quality==='low'?62:quality==='medium'?86:quality==='high'?112:128;
    const fraction=(quality==='low'?.30:quality==='medium'?.58:quality==='high'?.82:1)*this.foliageDensity;for(const c of this.grassChunks)c.mesh.count=Math.floor(c.fullCount*fraction);
    const rank={low:0,medium:1,high:2,ultra:3} as const;for(const d of this.detailMeshes){const allowed=rank[quality]>=rank[d.minimum],f=quality==='low'?.25:quality==='medium'?.55:quality==='high'?.82:1;d.mesh.count=allowed?Math.floor(d.fullCount*f):0;}
    for(const batch of this.treeBatches){batch.trunks.count=batch.fullCount;batch.crowns.count=batch.fullCount;}
    this.root.traverse(o=>{if(o instanceof THREE.InstancedMesh&&(o.name==='Oak canopy'||o.name==='Pine canopy'))o.castShadow=quality==='high'||quality==='ultra';});this.cullClock=0;
  }
  setFoliageDensity(value:number):void {this.foliageDensity=Math.max(.25,Math.min(1,value));this.setQuality(this.quality);}
  syncNodes(nodeChanges:Record<string,number>):void {
    for(const node of this.nodes){
      const remaining=nodeChanges[node.id]??node.remaining;node.remaining=remaining;
      if(remaining>0)continue;
      const obj=this.nodeObjects.get(node.id);if(obj)obj.visible=false;
      const refs=this.instances.get(node.id),falling=this.fallingTrees.has(node.id);
      if(refs&&!falling)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,this.hiddenMatrix);ref.mesh.instanceMatrix.needsUpdate=true;}
      this.hits.delete(node.id);
    }
  }
  hitNode(id:string,intensity=1):void {this.hits.set(id,{elapsed:0,intensity:Math.max(.7,Math.min(1.6,intensity))});}
  fallTree(id:string,source:Vec3):void {
    const node=this.nodes.find(n=>n.id===id),refs=this.instances.get(id);if(!node||node.kind!=='tree'||!refs||this.fallingTrees.has(id))return;
    this.hits.delete(id);const dx=node.position.x-source.x,dz=node.position.z-source.z,len=Math.hypot(dx,dz)||1;
    const awayX=dx/len,awayZ=dz/len,axis=new THREE.Vector3(-awayZ,0,awayX).normalize();
    this.fallingTrees.set(id,{elapsed:0,duration:1.18,hold:1.35,fade:.72,axis,refs,node});
  }
  coverGrass(structures:Structure[]):void {
    for(const structure of structures){
      if(structure.pieceType!=='foundation'||this.grassCoveredBy.has(structure.id))continue;
      this.coverArea(structure.id,structure.position,3.16,3.16,structure.rotation);
    }
  }
  coverArea(id:string,p:{x:number;z:number},width:number,depth:number,rotation=0):void {
    if(this.grassCoveredBy.has(id))return;this.grassCoveredBy.add(id);const c=Math.cos(rotation),s=Math.sin(rotation);
    for(const chunk of this.grassChunks){
      if(Math.abs(chunk.center.x-p.x)>24||Math.abs(chunk.center.z-p.z)>24)continue;
      let changed=false;
      for(let i=0;i<chunk.fullCount;i++){
        chunk.mesh.getMatrixAt(i,this.matrixDummy.matrix);const e=this.matrixDummy.matrix.elements,dx=e[12]!-p.x,dz=e[14]!-p.z;
        if(Math.abs(dx*c-dz*s)<width/2&&Math.abs(dx*s+dz*c)<depth/2){chunk.mesh.setMatrixAt(i,this.hiddenMatrix);changed=true;}
      }
      if(changed)chunk.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  dispose():void {
    this.scene.remove(this.root);this.atmosphere.dispose();this.terrain.heightTexture.dispose();for(const g of this.geometries)g.dispose();
    const textures=new Set<THREE.Texture>();for(const mat of this.materials){const textured=mat as THREE.MeshStandardMaterial;if(textured.map)textures.add(textured.map);if(Array.isArray(mat.userData.textures))for(const tex of mat.userData.textures)textures.add(tex);mat.dispose();}for(const tex of textures)tex.dispose();this.root.clear();
  }
}
