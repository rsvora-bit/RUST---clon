import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WORLD} from '../config/balance';
import {generateWorldLayout,type WorldLayout} from '../survival/WorldSurvival';
import {grassSurfaceCover,palmSuitability,surfaceClimate,vegetationCover} from '../world/climate';
import type {ClimateSample} from '../terrain/island';
import type {ResourceNode,Vec3,Structure,WorldGeneration,WorldRevision} from '../core/types';
import {IslandTerrain} from '../terrain/island';
import {Atmosphere} from '../world/atmosphere';
import {addInstanceWindResponse,addWeatherSurfaceResponse,woodSurfaceMaps} from './materials';
import {collisionBoundsFromGeometry,collisionBoundsFromObject,treeAssetCollision,treeTrunkCollision} from '../physics/collisionBounds';
import {randomSource,smoothstep} from '../world/noise';
import {barkTexture,pineTexture,palmTexture,leavesTexture,leafMassTexture as makeLeafMassTexture,liftFoliageBaseColor,stoneMaterial,rockMaterialStyle,terrainMaterial,groundDecalTexture} from '../world/materials';
import {pineGeometry,pineMassGeometry,broadleafGeometry,palmGeometry,palmTrunkGeometry,trunkGeometry,rockGeometry,surfaceAlignedQuaternion,terrainContactOffset,bushGeometry,grassGeometry,fiberGeometry,berryGeometry,fernGeometry,forestShrubGeometry,twigGeometry,fallenLogGeometry,seaweedGeometry,reedGeometry,marshPoolGeometry} from '../world/models';

type InstanceRef={mesh:THREE.InstancedMesh;index:number;matrix:THREE.Matrix4};
type NaturalCollider={position:Vec3;halfExtents:Vec3;rotation?:number;nodeId?:string;rainSurface?:boolean};
type GrassChunk={mesh:THREE.InstancedMesh;center:THREE.Vector3;fullCount:number};
type TreeFall={elapsed:number;duration:number;hold:number;fade:number;axis:THREE.Vector3;refs:InstanceRef[];node:ResourceNode};

export function treeDensityForBiome(biome:string,forest:number):number{return biome==='TEMPERATE FOREST'?.88:biome==='TEMPERATE GRASSLAND'?.28:biome==='ARID'?.12:biome==='SNOW / ALPINE'?.20:biome==='COAST'?.08:.05+smoothstep(.32,.68,forest)*.79;}
export function scaledFoliageDistance(base:number,scale:number):number{return base*THREE.MathUtils.clamp(scale,.5,1.5);}
/** Revision-6 grass stays lit by the world/ground response without sampling the shadow map for every blade. */
export function grassReceivesShadows(worldRevision:number):boolean{return worldRevision<6;}
export function revisionTreeCover(cover:number,forest:number,revision:number):number{
  // Rev 6 gives its fixed tree budget to actual groves. Older saved worlds keep
  // their exact distribution, while open biomes become readable and forests
  // gain enough clustered canopy to feel intentional.
  if(revision<6)return cover;
  return Math.min(.98,cover*(forest>.52?1.3:.42));
}
/** Stable per-tree foliage tones widen Rev6 forest variation without changing legacy palettes. */
export function treeCrownTint(species:number,hueRoll:number,brightnessRoll:number,revision:number):THREE.Color {
  if(species===5)return new THREE.Color().setHSL(.25+(hueRoll-.5)*.05,.24,.70+brightnessRoll*.12);
  if([1,4,7,8,9].includes(species))return new THREE.Color().setHSL(.275+(hueRoll-.5)*(revision>=6?.10:.045),revision>=6?.23:.18,(revision>=6?.65:.58)+brightnessRoll*(revision>=6?.20:.13));
  return new THREE.Color().setHSL(.29+(hueRoll-.5)*(revision>=6?.075:.035),revision>=6?.27:.22,(revision>=6?.61:.62)+brightnessRoll*(revision>=6?.21:.14));
}
/** Revision-6 wetland reeds form fuller, tighter stands while keeping the total instance budget fixed. */
export function marshReedClumpSize(roll:number):number{return 5+Math.floor(Math.max(0,Math.min(.999999,roll))*4);}
/** Deterministically selects authored Rev6 silhouettes within compatible climate bands. */
export function climateTreeAssetVariant(species:number,biome:string,temperature:number,moisture:number,elevation:number,roll:number):number{
  if(species===5)return species;
  const deciduous=species===1||species===4||species===7||species===8||species===9;
  if((biome==='SNOW / ALPINE'||biome==='ROCKY MOUNTAIN'||elevation>42)&&![5,6].includes(species)&&roll<.58)return 6;
  if(biome==='WETLAND / MARSH'&&deciduous&&moisture>.57&&roll<.72)return 7;
  const maritimeLowland=['COAST','TEMPERATE GRASSLAND','TEMPERATE FOREST'].includes(biome)&&elevation<13&&moisture>.40;
  if(maritimeLowland&&temperature>.48&&roll<.42)return 8;
  if(biome==='TEMPERATE FOREST'&&deciduous&&roll<.27)return 9;
  return species;
}
export function treeSpeciesForBiome(biome:string,forest:number,palmRoll:number,broadRoll:number,variant:boolean,climate?:ClimateSample,elevation=0):number{if(climate){const suitability=palmSuitability(climate,elevation,biome);if(palmRoll<suitability*.68)return 5;if(climate.temperature<.42||elevation>40||biome==='SNOW / ALPINE')return variant?0:2;return broadRoll<(.20+smoothstep(.45,.68,climate.moisture)*.48)?(variant?1:4):(forest>.5?(variant?0:2):3);}const palm=(biome==='ARID'||biome==='COAST')&&palmRoll<.68,broad=!palm&&broadRoll<(.27+(biome==='COAST'?.18:0));return palm?5:broad?(variant?1:4):(biome==='SNOW / ALPINE'||forest>.5?(variant?0:2):3);}

/** The render adapter for deterministic island data; gameplay mutations arrive through syncNodes. */
export class Environment {
  readonly root=new THREE.Group();
  readonly nodes:ResourceNode[]=[];
  private readonly nodesById=new Map<string,ResourceNode>();
  readonly nodeObjects=new Map<string,THREE.Object3D>();
  readonly colliders:NaturalCollider[]=[];
  readonly terrainGeometry:THREE.BufferGeometry;
  readonly spawn:Vec3;
  readonly terrain:IslandTerrain;
  readonly atmosphere:Atmosphere;
  private readonly instances=new Map<string,InstanceRef[]>();
  private readonly resources:THREE.Object3D[]=[];
  private readonly grassChunks:GrassChunk[]=[];
  private readonly reedLocations:Vec3[]=[];
  private readonly marshPoolLocations:Vec3[]=[];
  private readonly treeBatches:{trunks:THREE.InstancedMesh;crowns:THREE.InstancedMesh;masses?:THREE.InstancedMesh;species:number;fullCount:number;generatedLods?:{trunk:THREE.BufferGeometry;foliage:THREE.BufferGeometry}[];instances:{id:string;x:number;z:number;matrix:THREE.Matrix4;crownMatrix:THREE.Matrix4;active:boolean;visible:boolean;renderIndex:number;trunkColor:THREE.Color;crownColor:THREE.Color;collision:NaturalCollider}[]}[]=[];
  private readonly outcropBatches:{mesh:THREE.InstancedMesh;variant:number;collisionRefs:(NaturalCollider|undefined)[];generatedLods?:THREE.BufferGeometry[]}[]=[];
  private shoreDriftwoodBatch?:{mesh:THREE.InstancedMesh;generatedLods?:THREE.BufferGeometry[]};
  private readonly treeInstancesById=new Map<string,{active:boolean}>();
  private readonly grassMaterials:THREE.MeshLambertMaterial[]=[];
  private readonly surfaceWetness:{value:number};
  private readonly detailMeshes:{mesh:THREE.InstancedMesh;fullCount:number;minimum:'low'|'medium'|'high'}[]=[];
  private readonly decalMeshes:THREE.InstancedMesh[]=[];
  private readonly materials=new Set<THREE.Material>();
  private readonly geometries=new Set<THREE.BufferGeometry>();
  windStrength=1;
  private readonly windUniform={value:0};
  private readonly windStrengthUniform={value:.12};
  private generatedBarkMaps?:ReturnType<typeof woodSurfaceMaps>;
  private readonly cameraUniform={value:new THREE.Vector3()};
  private readonly grassDistanceUniform={value:110};
  private readonly hits=new Map<string,{elapsed:number;intensity:number}>();
  private readonly fallingTrees=new Map<string,TreeFall>();
  private populated=false;
  private readonly grassCoveredBy=new Set<string>();
  private readonly matrixDummy=new THREE.Object3D();
  private readonly hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
  private readonly hitRotation=new THREE.Matrix4();
  private readonly fallRotation=new THREE.Quaternion();
  private readonly leaves:THREE.MeshLambertMaterial;
  private readonly leafMass:THREE.MeshLambertMaterial;
  private readonly pineMass:THREE.MeshLambertMaterial;
  private readonly pine:THREE.MeshLambertMaterial;
  private readonly palm:THREE.MeshLambertMaterial;
  readonly layout?:WorldLayout;
  private readonly roadCells=new Map<string,Vec3[]>();
  private readonly bark:THREE.MeshStandardMaterial;
  private readonly stone:THREE.MeshStandardMaterial;
  private readonly outcrop:THREE.MeshStandardMaterial;
  private readonly metal:THREE.MeshStandardMaterial;
  private readonly sulfur:THREE.MeshStandardMaterial;
  private readonly hqmetal:THREE.MeshStandardMaterial;
  private readonly fiber:THREE.MeshStandardMaterial;
  private readonly berries:THREE.MeshStandardMaterial;
  private readonly invisible=new THREE.MeshBasicMaterial({visible:false});
  private cullClock=0;
  private quality:'low'|'medium'|'high'|'ultra'='high';
  private foliageDensity=.72;
  private foliageDistance=1;
  get renderedTreeCount():number{return this.treeBatches.reduce((n,b)=>n+b.instances.filter(t=>t.visible).length,0);}
  get renderedTreeInstanceCount():number{return this.treeBatches.reduce((n,b)=>n+b.trunks.count,0);}
  get generatedTreeModelStats():{trees:number;batches:number;meshes:number;triangles:number;lod:number;assets:string[]}{const meshes=this.root.children.filter((object):object is THREE.InstancedMesh=>object instanceof THREE.InstancedMesh&&typeof object.userData.generatedWorldAsset==='string'),assets=[...new Set(meshes.map(mesh=>mesh.userData.generatedWorldAsset as string))];return{trees:meshes.filter(mesh=>mesh.name.endsWith('trunks')).reduce((sum,mesh)=>sum+mesh.count,0),batches:assets.length,meshes:meshes.length,triangles:meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3*mesh.count,0),lod:this.quality==='ultra'?0:this.quality==='high'?1:2,assets};}
  nearbyAssetDebug(camera:THREE.Vector3):{name:string;distance:number}|null{
    let nearestSq=120*120,name:string|null=null;
    const generated:Record<number,string>={0:'conifer_a',1:'broadleaf_a',2:'conifer_b',3:'conifer_c',4:'broadleaf_c',5:'palm_tree_a',6:'alpine_conifer',7:'marsh_tree',8:'coastal_tree',9:'broadleaf_b'};
    for(const batch of this.treeBatches)for(const tree of batch.instances){if(!tree.active)continue;const dx=tree.x-camera.x,dz=tree.z-camera.z,distanceSq=dx*dx+dz*dz;if(distanceSq<nearestSq){nearestSq=distanceSq;name=generated[batch.species]??`tree-species-${batch.species}`;}}
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3();for(const batch of this.outcropBatches){const asset=batch.mesh.userData.generatedWorldAsset as string|undefined;if(!asset)continue;for(let index=0;index<batch.mesh.count;index++){batch.mesh.getMatrixAt(index,matrix);position.setFromMatrixPosition(matrix);const dx=position.x-camera.x,dz=position.z-camera.z,distanceSq=dx*dx+dz*dz;if(distanceSq<nearestSq){nearestSq=distanceSq;name=asset;}}}
    return name?{name,distance:Math.sqrt(nearestSq)}:null;
  }
  get generatedRockModelStats():{instances:number;batches:number;triangles:number;lod:number}{const meshes=this.outcropBatches.filter(batch=>batch.mesh.userData.generatedWorldAsset).map(batch=>batch.mesh);return{instances:meshes.reduce((sum,mesh)=>sum+mesh.count,0),batches:meshes.length,triangles:meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3*mesh.count,0),lod:this.quality==='low'?2:this.quality==='medium'?1:0};}
  get generatedShoreModelStats():{instances:number;triangles:number;lod:number;asset:string|null}{const batch=this.shoreDriftwoodBatch,mesh=batch?.mesh;return{instances:mesh?.count??0,triangles:mesh?((mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3)*mesh.count:0,lod:this.quality==='low'?2:this.quality==='medium'?1:0,asset:mesh?.userData.generatedWorldAsset??null};}
  get treeCrownScales():[number,number,number][]{const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();return this.treeBatches.flatMap(batch=>Array.from({length:batch.crowns.count},(_,index)=>{batch.crowns.getMatrixAt(index,matrix);matrix.decompose(position,rotation,scale);return[scale.x,scale.y,scale.z] as [number,number,number];}));}
  get renderedTreeIds():string[]{return this.treeBatches.flatMap(batch=>batch.instances.filter(tree=>tree.visible).map(tree=>tree.id));}
  get fallingTreeCount():number{return this.fallingTrees.size;}
  get grassInstanceCount():number{return this.grassChunks.reduce((n,chunk)=>n+chunk.fullCount,0);}
  get grassChunkCount():number{return this.grassChunks.length;}
  get groundDecalStats():{name:string;instances:number;fullCount:number}[]{return this.decalMeshes.map(mesh=>({name:mesh.name,instances:mesh.count,fullCount:this.detailMeshes.find(detail=>detail.mesh===mesh)?.fullCount??mesh.count}));}
  get outcropInstances():{position:Vec3;scale:Vec3}[]{
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
    return this.root.children.filter((object):object is THREE.InstancedMesh=>object instanceof THREE.InstancedMesh&&object.name==='Weathered granite outcrops').flatMap(mesh=>Array.from({length:mesh.count},(_,index)=>{mesh.getMatrixAt(index,matrix);matrix.decompose(position,rotation,scale);return{position:{x:position.x,y:position.y,z:position.z},scale:{x:scale.x,y:scale.y,z:scale.z}};}));
  }
  get reedInstanceCount():number{const reeds=this.root.getObjectByName('Marsh reeds');return reeds instanceof THREE.InstancedMesh?reeds.count:0;}
  get marshReedLocations():Vec3[]{return this.reedLocations;}
  get marshPoolCount():number{const pools=this.root.getObjectByName('Marsh pools');return pools instanceof THREE.InstancedMesh?pools.count:0;}
  get marshPoolPositions():Vec3[]{return this.marshPoolLocations;}
  get understoryLocations():{name:string;positions:Vec3[];visiblePositions:Vec3[]}[]{
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3();
    const read=(mesh:THREE.InstancedMesh,count:number)=>Array.from({length:count},(_,i)=>{mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);return{x:position.x,y:position.y,z:position.z};});
    return this.detailMeshes.filter(detail=>detail.mesh.name==='Forest fern understory'||detail.mesh.name==='Forest shrub understory'||detail.mesh.name==='Forest fallen logs'||detail.mesh.name==='Fallen twig litter'||detail.mesh.name==='Dry meadow tufts').map(detail=>({name:detail.mesh.name,positions:read(detail.mesh,detail.fullCount),visiblePositions:read(detail.mesh,detail.mesh.count)}));
  }

  constructor(readonly scene:THREE.Scene,readonly seed:number,worldGeneration:WorldGeneration=5,deferPopulation=false,readonly worldRevision:WorldRevision=5){
    this.root.name='Tideland — procedural island';scene.add(this.root);
    this.terrain=new IslandTerrain(seed,worldGeneration,worldRevision);this.terrainGeometry=this.terrain.geometry;this.spawn={...this.terrain.spawn};
    if(worldGeneration===5&&worldRevision>=2)this.layout=generateWorldLayout(this.terrain,this.spawn,[],seed,worldRevision);
    if(this.layout)for(const trail of this.layout.trails)for(const p of trail){const key=`${Math.floor(p.x/16)},${Math.floor(p.z/16)}`;const cell=this.roadCells.get(key)??[];cell.push(p);this.roadCells.set(key,cell);}
    const terrainMat=terrainMaterial(this.worldRevision);this.surfaceWetness=terrainMat.userData.surfaceWetness as {value:number};const ground=new THREE.Mesh(this.terrainGeometry,terrainMat);ground.name='Island ground';ground.receiveShadow=true;this.root.add(ground);this.materials.add(terrainMat);this.geometries.add(this.terrainGeometry);
    this.atmosphere=new Atmosphere(scene,this.terrain.heightTexture,this.terrain.size,seed,this.worldRevision);
    this.bark=new THREE.MeshStandardMaterial({map:barkTexture(this.worldRevision>=6),color:0xb6b4a4,roughness:.97});addWeatherSurfaceResponse(this.bark,this.surfaceWetness,.58,.58);
    this.leaves=this.foliageMaterial(leavesTexture(667,this.worldRevision>=6),this.worldRevision>=6?0xc7d09e:0xffffff,this.worldRevision>=6?.065:.095);this.leafMass=new THREE.MeshLambertMaterial({map:this.worldRevision>=6?makeLeafMassTexture():null,color:this.worldRevision>=6?0xffffff:0x788c46,emissive:this.worldRevision>=6?0x2a401b:0x0b1008,emissiveIntensity:this.worldRevision>=6?.55:.012});this.pineMass=new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x080d06,emissiveIntensity:.04,flatShading:true,vertexColors:true});this.pine=this.foliageMaterial(pineTexture(this.worldRevision>=6),0xffffff,.115);this.palm=this.foliageMaterial(palmTexture(),0xffffff,.095);
    const rockStyle=rockMaterialStyle(this.worldRevision),rockWetness=this.worldRevision>=6?this.surfaceWetness:undefined;this.stone=stoneMaterial(rockStyle.resourceTint,rockStyle.vertexColors,rockWetness);this.outcrop=stoneMaterial(rockStyle.outcropTint,rockStyle.vertexColors,rockWetness);this.metal=stoneMaterial(0x8b7567,rockStyle.vertexColors,rockWetness);this.sulfur=stoneMaterial(0xb7a74a,rockStyle.vertexColors,rockWetness);this.hqmetal=stoneMaterial(0x65757d,rockStyle.vertexColors,rockWetness);
    this.fiber=new THREE.MeshStandardMaterial({color:0x5e753e,roughness:.85,side:THREE.DoubleSide});this.berries=new THREE.MeshStandardMaterial({color:0x98383c,roughness:.7});
    [this.bark,this.leaves,this.leafMass,this.pineMass,this.pine,this.palm,this.stone,this.outcrop,this.metal,this.sulfur,this.hqmetal,this.fiber,this.berries,this.invisible].forEach(m=>this.materials.add(m));
    if(!deferPopulation)this.populateNow();
  }
  private populateNow():void {
    if(this.populated)return;
    this.populateTrees();this.populateRocks();this.populatePlants();this.populateUnderstory();this.populateForestDeadfall();this.populateMarshReeds();this.populateGrass();this.populateShore();this.populateGroundDecals();this.setQuality('high');this.update(0,9.4,new THREE.Vector3(this.spawn.x,this.spawn.y,this.spawn.z));this.populated=true;
  }
  private removeTreeInstance(id:string):void {
    const tree=this.treeInstancesById.get(id);if(!tree)return;tree.active=false;
    for(const batch of this.treeBatches){
      const removed=batch.instances.find(instance=>instance.id===id);if(!removed||!removed.visible)continue;
      const index=removed.renderIndex,last=batch.trunks.count-1;
      if(index<last){
        const matrix=new THREE.Matrix4(),color=new THREE.Color();batch.trunks.getMatrixAt(last,matrix);batch.trunks.setMatrixAt(index,matrix);batch.crowns.getMatrixAt(last,matrix);batch.crowns.setMatrixAt(index,matrix);
        if(batch.trunks.instanceColor){batch.trunks.getColorAt(last,color);batch.trunks.setColorAt(index,color);}if(batch.crowns.instanceColor){batch.crowns.getColorAt(last,color);batch.crowns.setColorAt(index,color);}
        const moved=batch.instances.find(instance=>instance.visible&&instance.renderIndex===last);if(moved){moved.renderIndex=index;const refs=this.instances.get(moved.id);if(refs)for(const ref of refs)ref.index=index;}
        batch.trunks.instanceMatrix.needsUpdate=batch.crowns.instanceMatrix.needsUpdate=true;if(batch.trunks.instanceColor)batch.trunks.instanceColor.needsUpdate=true;if(batch.crowns.instanceColor)batch.crowns.instanceColor.needsUpdate=true;
      }
      removed.visible=false;batch.trunks.count=batch.crowns.count=last;
    }
  }
  async populateAsync(stage:(progress:number,status:string,detail?:string)=>Promise<void>):Promise<void> {
    if(this.populated)return;
    await stage(24,'Growing coastal forest','Placing harvestable trees and preparing canopy batches');this.populateTrees();
    await stage(36,'Scattering rock fields','Building stone outcrops and metal deposits');this.populateRocks();
    await stage(47,'Planting ground resources','Adding fiber, berries and shoreline pickups');this.populatePlants();
    await stage(53,'Layering forest understory','Adding ferns, fallen logs, broken twigs and dry meadow tufts');this.populateUnderstory();this.populateForestDeadfall();
    await stage(56,'Growing wetland reeds','Planting climate-aware marsh cover');this.populateMarshReeds();this.populateMarshPools();
    await stage(59,'Seeding windblown grass','Preparing vegetation chunks and distance culling');this.populateGrass();
    await stage(63,'Finishing the shoreline','Placing pebbles, driftwood and tidal seaweed');this.populateShore();
    await stage(64,'Painting terrain detail','Scattering low-cost soil, leaf-litter and rock decals');this.populateGroundDecals();
    this.setQuality('high');this.update(0,9.4,new THREE.Vector3(this.spawn.x,this.spawn.y,this.spawn.z));this.populated=true;
    await stage(65,'World vegetation ready','Terrain resources are ready for gameplay systems');
  }
  heightAt(x:number,z:number):number{return this.terrain.heightAt(x,z);}
  biomeAt(x:number,z:number):string{return this.terrain.biomeAt(x,z);}
  private foliageMaterial(tex:THREE.Texture,color:number,emissiveIntensity=.055):THREE.MeshLambertMaterial {
    // Opaque alpha cutouts write depth in the same way in color and shadow passes.
    // No vertex deformation: the old wind shader only moved the color geometry.
    const material=new THREE.MeshLambertMaterial({map:tex,color,alphaTest:.38,
      transparent:false,depthWrite:true,side:THREE.DoubleSide,
      emissive:0xffffff,emissiveMap:tex,emissiveIntensity});
    addInstanceWindResponse(material,this.windUniform,this.windStrengthUniform,.095,.34);return material;
  }

  private own<T extends THREE.BufferGeometry>(g:T):T {this.geometries.add(g);return g;}
  private addNode(kind:ResourceNode['kind'],x:number,z:number,scale:number,rotation:number,capacity:number):ResourceNode {
    const node:ResourceNode={id:`${kind}-${this.nodes.length}`,kind,position:{x,y:this.heightAt(x,z),z},scale,rotation,capacity,remaining:capacity};this.nodes.push(node);this.nodesById.set(node.id,node);return node;
  }
  private place(object:THREE.Object3D,node:ResourceNode):void {
    object.position.set(node.position.x,node.position.y,node.position.z);object.rotation.y=node.rotation;object.scale.setScalar(node.scale);object.userData.nodeId=node.id;object.traverse(o=>{o.userData.nodeId=node.id;});this.nodeObjects.set(node.id,object);this.resources.push(object);this.root.add(object);
  }
  private roadClear(x:number,z:number,margin=4):boolean {
    if(!this.layout)return true;
    if(this.layout.pois.some(p=>Math.hypot(x-p.position.x,z-p.position.z)<9))return false;
    const cx=Math.floor(x/16),cz=Math.floor(z/16);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const cell=this.roadCells.get(`${cx+dx},${cz+dz}`);if(cell)for(const p of cell)if(Math.hypot(x-p.x,z-p.z)<margin+1.25)return false;}return true;
  }
  private populateTrees():void {
    const rand=randomSource(this.seed+139),treeNodes:{node:ResourceNode;species:number}[]=[];
    const useTreeGrid=this.terrain.generation===5&&this.worldRevision>=3,treeGrid=new Map<string,{x:number;z:number}[]>(),cellKey=(x:number,z:number)=>`${Math.floor(x/4)},${Math.floor(z/4)}`;
    const rememberTree=(tree:{node:ResourceNode;species:number})=>{treeNodes.push(tree);if(useTreeGrid){const key=cellKey(tree.node.position.x,tree.node.position.z),cell=treeGrid.get(key)??[];cell.push(tree.node.position);treeGrid.set(key,cell);}};
    // Keep the starter clearing readable from the default first-person heading.
    // The first hand-placed trees still frame the spawn, but no trunk fills the
    // reticle at arm's length before the player has had a chance to look around.
    const starterTrees=this.terrain.generation>=3?[[this.spawn.x-22,this.spawn.z-11,.86,0],[this.spawn.x+23,this.spawn.z-9,.96,1],[this.spawn.x-18,this.spawn.z+18,1.02,0],[this.spawn.x+20,this.spawn.z+17,.84,0]] as const:[[6,198,.86,0],[55,200,.96,1],[-4,190,1.02,0],[53,181,.84,0]] as const;
    for(const [x,z,scale,species] of starterTrees)if(this.roadClear(x,z,4.4))rememberTree({node:this.addNode('tree',x,z,scale,rand()*6.28,300),species});
    const modern=this.terrain.generation===2,expanded=this.terrain.generation>=4,g5=this.terrain.generation===5;
    const treeLimit=g5?(this.worldRevision>=6?1500:this.worldRevision>=3?1180:900):expanded?620:modern?820:560,treeAttempts=g5?(this.worldRevision>=6?43000:this.worldRevision>=3?27000:18000):expanded?9000:modern?12000:7000;
    for(let i=0;i<treeAttempts&&treeNodes.length<treeLimit;i++){
      const span=g5?this.terrain.size*.94:expanded?650:580,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z),forest=this.terrain.forestAtSample(x,z,h);
      if(h<4||h>(g5?58:38)||slope>.68||Math.hypot(x-this.spawn.x,z-this.spawn.z)<30||!this.roadClear(x,z,4.4))continue;
      const climate=g5&&this.worldRevision>=2?this.terrain.climateAtSample(x,z,h):undefined,biome=this.terrain.biomeAtSample(x,z,h,slope,climate);
      const density=smoothstep(.32,.68,forest),wetlandNoise=this.worldRevision>=6?this.terrain.noise.at(x*.0071+72,z*.0071-31):0,climateDensity=climate?revisionTreeCover(vegetationCover(climate,h,slope,wetlandNoise),forest,this.worldRevision):treeDensityForBiome(biome,forest),clump=g5&&this.worldRevision>=3?.40+this.terrain.noise.fbm(x*.013+81,z*.013-47,3)*1.2:1,biomeDensity=g5?Math.min(.98,climateDensity*clump):.055+density*.79;if(rand()>biomeDensity)continue;
      // Blue-noise rejection gives each trunk natural breathing room inside groves.
      let overlaps=false;if(useTreeGrid){for(let dz=-1;dz<=1&&!overlaps;dz++)for(let dx=-1;dx<=1&&!overlaps;dx++)for(const t of treeGrid.get(`${Math.floor(x/4)+dx},${Math.floor(z/4)+dz}`)??[])if(Math.hypot(t.x-x,t.z-z)<4){overlaps=true;break;}}else overlaps=treeNodes.some(t=>Math.hypot(t.node.position.x-x,t.node.position.z-z)<4);if(overlaps)continue;
      const variant=Math.sin(x*12.9898+z*78.233)>0;
      const selectedSpecies=g5?treeSpeciesForBiome(biome,forest,rand(),rand(),variant,climate,h):(rand()<(.27+(h<16?.18:0))?(variant?1:4):(forest>.5?(variant?0:2):3)),variantRoll=this.terrain.noise.at(x*.037+this.seed*.001,z*.041-this.seed*.001),species=g5&&this.worldRevision>=6&&climate?climateTreeAssetVariant(selectedSpecies,biome,climate.temperature,climate.moisture,h,variantRoll):selectedSpecies;
      rememberTree({node:this.addNode('tree',x,z,.72+rand()*.57,rand()*6.28,300),species});
    }
    for(let species=0;species<10;species++){
      const entries=treeNodes.filter(t=>t.species===species);if(!entries.length)continue;
      const palm=species===5,broad=[1,4,7,8,9].includes(species),leafMassTree=broad,pineVariant=species===2?1:species===3?2:species===6?1:0,variant=species===4||species===8||species===9?1:0,trunk=this.own(palm?palmTrunkGeometry():trunkGeometry(broad,species===2||species===4?1:species===3?2:0)),crown=this.own(palm?palmGeometry():broad?broadleafGeometry(variant,this.worldRevision>=6,this.worldRevision>=6?'leaves':'all'):pineGeometry(pineVariant,this.worldRevision>=6)),massGeometry=this.worldRevision>=6?(leafMassTree?this.own(broadleafGeometry(variant,true,'masses')):!palm?this.own(pineMassGeometry(pineVariant)):undefined):undefined;
      if(this.worldRevision>=6){const lateral=palm?1.08:broad?1.28:1.18;for(const geometry of [crown,massGeometry].filter((entry):entry is THREE.BufferGeometry=>!!entry)){const position=geometry.getAttribute('position');for(let i=0;i<position.count;i++)position.setXYZ(i,position.getX(i)*lateral,position.getY(i),position.getZ(i)*lateral);position.needsUpdate=true;geometry.computeVertexNormals();}}
      // Instanced canopy tinting needs a neutral per-vertex color channel;
      // without it Three.js multiplies the foliage texture by an undefined
      // attribute and the entire canopy falls to black.
      if(!crown.getAttribute('color')){const colors=new Float32Array(crown.getAttribute('position').count*3);colors.fill(1);crown.setAttribute('color',new THREE.BufferAttribute(colors,3));}
      const trunks=new THREE.InstancedMesh(trunk,this.bark,entries.length),crowns=new THREE.InstancedMesh(crown,palm?this.palm:broad?this.leaves:this.pine,entries.length),masses=massGeometry?new THREE.InstancedMesh(massGeometry,leafMassTree?this.leafMass:this.pineMass,entries.length):undefined;
      trunks.name=palm?'Palm trunks':broad?'Oak trunks':'Pine trunks';crowns.name=palm?'Palm canopy':broad?'Oak canopy':'Pine canopy';if(masses)masses.name=leafMassTree?'Oak canopy masses':'Pine canopy masses';trunks.castShadow=trunks.receiveShadow=true;crowns.castShadow=this.worldRevision<6;crowns.receiveShadow=false;if(masses){masses.castShadow=false;masses.receiveShadow=false;this.root.add(masses);}this.root.add(trunks,crowns);
      const hitGeometry=this.own(new THREE.CylinderGeometry(.37,.45,broad?7.7:12.8,6));hitGeometry.translate(0,broad?3.85:6.4,0);
      const batchInstances:{id:string;x:number;z:number;matrix:THREE.Matrix4;crownMatrix:THREE.Matrix4;active:boolean;visible:boolean;renderIndex:number;trunkColor:THREE.Color;crownColor:THREE.Color;collision:NaturalCollider}[]=[];entries.forEach(({node},index)=>{
        this.matrixDummy.position.set(node.position.x,node.position.y-.08,node.position.z);this.matrixDummy.rotation.set(0,node.rotation,0);this.matrixDummy.scale.setScalar(node.scale);this.matrixDummy.updateMatrix();const m=this.matrixDummy.matrix.clone();trunks.setMatrixAt(index,m);
        const crownVariation=this.worldRevision>=6,scaleX=crownVariation ? .90+Math.abs(Math.sin(node.position.x*12.9898+node.position.z*78.233))*.20:1,scaleY=crownVariation ? .94+Math.abs(Math.sin(node.position.x*39.346+node.position.z*11.135))*.12:1,scaleZ=crownVariation ? .90+Math.abs(Math.sin(node.position.x*73.156+node.position.z*23.789))*.20:1;this.matrixDummy.scale.set(node.scale*scaleX,node.scale*scaleY,node.scale*scaleZ);this.matrixDummy.updateMatrix();const crownMatrix=this.matrixDummy.matrix.clone();crowns.setMatrixAt(index,crownMatrix);masses?.setMatrixAt(index,crownMatrix);
        const trunkColor=new THREE.Color().setHSL(.08+(rand()-.5)*.018,.18,.78+rand()*.12),crownColor=treeCrownTint(species,rand(),rand(),this.worldRevision);
        trunks.setColorAt(index,trunkColor);crowns.setColorAt(index,crownColor);masses?.setColorAt(index,crownColor);
        this.instances.set(node.id,[{mesh:trunks,index,matrix:m},{mesh:crowns,index,matrix:crownMatrix},...(masses?[{mesh:masses,index,matrix:crownMatrix}]:[])]);
        const hit=new THREE.Mesh(hitGeometry,this.invisible);hit.userData.species=species;this.place(hit,node);
        const collision={...(this.worldRevision>=6?treeAssetCollision(node.position,node.scale,species):treeTrunkCollision(node.position,node.scale,species)),nodeId:node.id,rainSurface:false};this.colliders.push(collision);
        batchInstances.push({id:node.id,x:node.position.x,z:node.position.z,matrix:m,crownMatrix,active:true,visible:true,renderIndex:index,trunkColor,crownColor,collision});
      });if(crowns.instanceColor)crowns.instanceColor.needsUpdate=true;if(masses?.instanceColor)masses.instanceColor.needsUpdate=true;if(trunks.instanceColor)trunks.instanceColor.needsUpdate=true;trunks.computeBoundingSphere();crowns.computeBoundingSphere();masses?.computeBoundingSphere();this.treeBatches.push({trunks,crowns,masses,species,fullCount:entries.length,instances:batchInstances});for(const tree of batchInstances)this.treeInstancesById.set(tree.id,tree);
    }
  }

  /** Replace procedural tree silhouettes with the original Blender LOD0 meshes while retaining one instanced batch per surface. */
  useGeneratedTreeModels(models:Record<string,THREE.Object3D>):number {
    if(this.terrain.generation!==5||this.worldRevision<6)return 0;
    const assetBySpecies:Record<number,string>={0:'conifer_a',1:'broadleaf_a',2:'conifer_b',3:'conifer_c',4:'broadleaf_c',5:'palm_tree_a',6:'alpine_conifer',7:'marsh_tree',8:'coastal_tree',9:'broadleaf_b'};let integrated=0;
    for(const batch of this.treeBatches){
      const assetId=assetBySpecies[batch.species],asset=models[assetId],lod=asset?.getObjectByName('LOD0');if(!asset||!lod)continue;
      asset.updateMatrixWorld(true);const generatedLods:{trunk:THREE.BufferGeometry;foliage:THREE.BufferGeometry}[]=[],foliageMaterials=new Map<string,THREE.Material>();let trunkMaterial:THREE.Material|undefined,valid=true;
      for(const lodName of ['LOD0','LOD1','LOD2']){const level=asset.getObjectByName(lodName);if(!level){valid=false;break;}level.updateMatrixWorld(true);const inverseLod=level.matrixWorld.clone().invert(),trunkGeometries:THREE.BufferGeometry[]=[],foliageGeometries:THREE.BufferGeometry[]=[];
        level.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const material=Array.isArray(object.material)?object.material[0]:object.material;if(!material)return;const geometry=object.geometry.clone(),relative=inverseLod.clone().multiply(object.matrixWorld);geometry.applyMatrix4(relative);geometry.clearGroups();geometry.addGroup(0,geometry.index?.count??geometry.getAttribute('position').count,0);if(material.name.toLowerCase().includes('bark')){trunkGeometries.push(geometry);trunkMaterial??=material;}else{foliageGeometries.push(geometry);foliageMaterials.set(material.name,material);}});
        const trunk=trunkGeometries.length?mergeGeometries(trunkGeometries,false):null,foliage=foliageGeometries.length?mergeGeometries(foliageGeometries,true):null;[...trunkGeometries,...foliageGeometries].forEach(geometry=>geometry.dispose());if(!trunk||!foliage){trunk?.dispose();foliage?.dispose();valid=false;break;}trunk.computeBoundingSphere();foliage.computeBoundingSphere();generatedLods.push({trunk,foliage});
      }
      if(!valid||generatedLods.length!==3||!trunkMaterial){generatedLods.forEach(level=>{level.trunk.dispose();level.foliage.dispose();});continue;}
      for(const level of generatedLods){this.geometries.add(level.trunk);this.geometries.add(level.foliage);}const sharedFoliageMaterials=[...foliageMaterials.values()];for(const material of sharedFoliageMaterials){material.side=THREE.DoubleSide;if(material instanceof THREE.MeshStandardMaterial||material instanceof THREE.MeshLambertMaterial)material.color.copy(liftFoliageBaseColor(material.color));if(material instanceof THREE.MeshStandardMaterial)material.roughness=Math.max(material.roughness,.78);addInstanceWindResponse(material,this.windUniform,this.windStrengthUniform,.095,.34);this.materials.add(material);}if(trunkMaterial instanceof THREE.MeshStandardMaterial){const maps=this.generatedBarkMaps??=woodSurfaceMaps(449);if(!trunkMaterial.map){trunkMaterial.color.set(0xffffff);trunkMaterial.map=this.bark.map;}trunkMaterial.normalMap??=maps.normal;trunkMaterial.roughnessMap??=maps.roughness;trunkMaterial.normalScale.set(.12,.12);trunkMaterial.roughness=Math.max(.90,trunkMaterial.roughness);trunkMaterial.metalness=0;trunkMaterial.userData.textures=[...new Set([...(Array.isArray(trunkMaterial.userData.textures)?trunkMaterial.userData.textures:[]),trunkMaterial.map,maps.normal,maps.roughness])];addWeatherSurfaceResponse(trunkMaterial,this.surfaceWetness,.58,.58);trunkMaterial.needsUpdate=true;}this.materials.add(trunkMaterial);
      batch.generatedLods=generatedLods;const lodIndex=this.quality==='ultra'?0:this.quality==='high'?1:2;batch.trunks.geometry=generatedLods[lodIndex]!.trunk;batch.trunks.material=trunkMaterial;batch.crowns.geometry=generatedLods[lodIndex]!.foliage;batch.crowns.material=sharedFoliageMaterials;batch.crowns.visible=true;batch.trunks.visible=true;batch.trunks.userData.generatedWorldAsset=assetId;batch.crowns.userData.generatedWorldAsset=assetId;batch.trunks.name=batch.species===5?'Palm trunks':batch.species===1||batch.species===4?'Oak trunks':'Pine trunks';batch.crowns.name=batch.species===5?'Palm canopy':batch.species===1||batch.species===4?'Oak canopy':'Pine canopy';batch.trunks.castShadow=batch.trunks.receiveShadow=true;batch.crowns.castShadow=false;batch.crowns.receiveShadow=false;
      for(const tree of batch.instances){batch.crowns.setMatrixAt(tree.renderIndex,tree.crownMatrix);const refs=this.instances.get(tree.id);if(refs){const crownRef=refs.find(reference=>reference.mesh===batch.crowns);if(crownRef)crownRef.matrix=tree.crownMatrix;}}
      batch.trunks.computeBoundingSphere();batch.crowns.computeBoundingSphere();batch.crowns.instanceMatrix.needsUpdate=true;if(batch.masses){batch.masses.visible=false;batch.masses.count=0;}
      integrated+=batch.fullCount;
    }
    this.cullClock=0;return integrated;
  }
  /** Use the authored fractured-stone library for decorative outcrops without changing harvest nodes or collider placement. */
  useGeneratedRockModels(models:Record<string,THREE.Object3D>):number {
    if(this.terrain.generation!==5||this.worldRevision<6)return 0;
    const assetIds=['large_boulder_a','large_boulder_b','large_boulder_c'];let integrated=0;
    for(const batch of this.outcropBatches){const assetId=assetIds[batch.variant]!,asset=models[assetId];if(!asset)continue;asset.updateMatrixWorld(true);const levels:THREE.BufferGeometry[]=[];let valid=true;
      for(const lodName of ['LOD0','LOD1','LOD2']){const lod=asset.getObjectByName(lodName);if(!lod){valid=false;break;}lod.updateMatrixWorld(true);const inverseLod=lod.matrixWorld.clone().invert(),parts:THREE.BufferGeometry[]=[];
        lod.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const material=Array.isArray(object.material)?object.material[0]:object.material,geometry=object.geometry.clone();geometry.applyMatrix4(inverseLod.clone().multiply(object.matrixWorld));geometry.scale(.38,.22,.40);const materialName=material?.name.toLowerCase()??'',tint=materialName.includes('moss')?[.76,.94,.70]:materialName.includes('fracture')?[1.13,1.08,1.02]:[1,1,1],colors=new Float32Array(geometry.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=tint[0]!;colors[i+1]=tint[1]!;colors[i+2]=tint[2]!;}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.clearGroups();parts.push(geometry);});
        const merged=parts.length?mergeGeometries(parts,false):null;parts.forEach(geometry=>geometry.dispose());if(!merged){valid=false;break;}merged.computeBoundingSphere();levels.push(merged);
      }
      if(!valid||levels.length!==3){levels.forEach(geometry=>geometry.dispose());continue;}for(const geometry of levels){geometry.computeBoundingBox();this.geometries.add(geometry);}batch.generatedLods=levels;batch.mesh.geometry=levels[this.quality==='low'?2:this.quality==='medium'?1:0]!;batch.mesh.userData.generatedWorldAsset=assetId;
      const matrix=new THREE.Matrix4();for(let index=0;index<batch.mesh.count;index++){batch.mesh.getMatrixAt(index,matrix);matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.position.y+=terrainContactOffset(levels[0]!,matrix,(x,z)=>this.heightAt(x,z),this.matrixDummy.scale.y*.14);this.matrixDummy.updateMatrix();batch.mesh.setMatrixAt(index,this.matrixDummy.matrix);const collider=batch.collisionRefs[index];if(collider)Object.assign(collider,collisionBoundsFromGeometry(levels[0]!,this.matrixDummy.matrix,.08));}batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingSphere();integrated+=batch.mesh.count;
    }
    return integrated;
  }
  /** Replace the simple beach-log proxy with the authored, weather-reactive GLB while keeping one instanced batch. */
  useGeneratedShoreDriftwood(asset:THREE.Object3D):number {
    const batch=this.shoreDriftwoodBatch;if(!batch||this.terrain.generation!==5||this.worldRevision<6)return 0;
    asset.updateMatrixWorld(true);const lods:THREE.BufferGeometry[]=[];let sourceMaterials:THREE.Material[]|undefined;
    for(const name of ['LOD0','LOD1','LOD2']){
      const level=asset.getObjectByName(name);if(!level)break;level.updateMatrixWorld(true);const inverse=level.matrixWorld.clone().invert(),parts:THREE.BufferGeometry[]=[],partMaterials:THREE.Material[]=[];
      level.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const source=object.geometry.clone();source.applyMatrix4(inverse.clone().multiply(object.matrixWorld));parts.push(source);for(const material of Array.isArray(object.material)?object.material:[object.material])if(!partMaterials.some(existing=>existing===material))partMaterials.push(material);});
      const geometry=parts.length===1?parts[0]!:parts.length?mergeGeometries(parts,true):null;if(parts.length>1)parts.forEach(part=>part.dispose());if(!geometry)break;geometry.computeBoundingSphere();lods.push(geometry);sourceMaterials??=partMaterials;
    }
    if(lods.length!==3||!sourceMaterials?.length){lods.forEach(geometry=>geometry.dispose());return 0;}
    const materials=sourceMaterials.map(source=>{const material=source instanceof THREE.MeshStandardMaterial?source.clone():new THREE.MeshStandardMaterial({color:0x82765e,roughness:.94});material.roughness=Math.max(.82,material.roughness);addWeatherSurfaceResponse(material,this.surfaceWetness,.48,.50);this.materials.add(material);return material;});
    lods.forEach(geometry=>this.geometries.add(geometry));batch.generatedLods=lods;batch.mesh.geometry=lods[this.quality==='low'?2:this.quality==='medium'?1:0]!;batch.mesh.material=materials;batch.mesh.userData.generatedWorldAsset='driftwood_a';batch.mesh.computeBoundingSphere();this.shoreDriftwoodBatch=batch;return batch.mesh.count;
  }
  private populateRocks():void {
    const rand=randomSource(this.seed+283),revision6Shape=this.terrain.generation===5&&this.worldRevision>=6,geos=[this.own(rockGeometry(51,revision6Shape,revision6Shape)),this.own(rockGeometry(114,revision6Shape,revision6Shape)),this.own(rockGeometry(221,revision6Shape,revision6Shape))];
    const boulders:{x:number;y:number;z:number;sx:number;sy:number;sz:number;rot:number;variant:number}[]=[];
    const anchors=this.terrain.generation>=4
      ? [[this.spawn.x-31,this.spawn.z-24,3.7,3.2,3.4],[this.spawn.x+34,this.spawn.z-27,4.1,3.6,3.9]] as const
      : this.terrain.generation>=3
        ? [[this.spawn.x-31,this.spawn.z-26,6,5.8,4.6],[this.spawn.x-38,this.spawn.z-22,4.2,3.4,3.7],[this.spawn.x+37,this.spawn.z-25,6.5,6,5]] as const
        : [[-3,185,6,5.8,4.6],[-10,183,4.2,3.4,3.7],[68,180,6.5,6,5]] as const;
    for(const [x,z,sx,sy,sz] of anchors)boulders.push({x,y:this.heightAt(x,z)-.1,z,sx,sy,sz,rot:rand()*6.28,variant:Math.floor(rand()*3)});
    if(this.terrain.generation>=4){
      const g5=this.terrain.generation===5,span=g5?this.terrain.size*.96:650;
      for(let i=0;i<(g5?(this.worldRevision>=6?5600:3800):1800)&&boulders.length<(g5?(this.worldRevision>=6?320:240):150);i++){
        const x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
        if(h<.7||(this.layout&&slope>1.15)||Math.hypot(x-this.spawn.x,z-this.spawn.z)<22||!this.roadClear(x,z,6))continue;
        if(this.nodes.some(n=>n.kind==='tree'&&Math.hypot(n.position.x-x,n.position.z-z)<4.8))continue;
        if(boulders.some(b=>Math.hypot(b.x-x,b.z-z)<3.1))continue;
        const biome=this.biomeAt(x,z),rocky=h>24||slope>.47||biome==='ROCKY MOUNTAIN';if(rand()>(rocky?.22:biome==='ARID'?.065:.035))continue;
        const size=rocky?1.25+rand()*3.8:.65+rand()*1.45;boulders.push({x,y:h-size*.12,z,sx:size*(.8+rand()*.45),sy:size*(.7+rand()*.48),sz:size*(.8+rand()*.45),rot:rand()*6.28,variant:Math.floor(rand()*3)});
      }
    }else for(let i=0;i<950;i++){
      const x=(rand()-.5)*570,z=(rand()-.5)*570,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
      if(h<.7||Math.hypot(x-this.spawn.x,z-this.spawn.z)<20)continue;
      const rocky=h>22||slope>.44;if(rand()>(rocky?.62:.10))continue;
      const size=rocky?1.8+rand()*5:.7+rand()*1.8;boulders.push({x,y:h-size*.12,z,sx:size*(.8+rand()*.5),sy:size*(.7+rand()*.55),sz:size*(.8+rand()*.5),rot:rand()*6.28,variant:Math.floor(rand()*3)});
    }
    for(let v=0;v<3;v++){
      const rocks=boulders.filter(b=>b.variant===v),mesh=new THREE.InstancedMesh(geos[v]!,this.outcrop,rocks.length),collisionRefs:(NaturalCollider|undefined)[]=new Array(rocks.length);mesh.castShadow=mesh.receiveShadow=true;mesh.name='Weathered granite outcrops';rocks.forEach((r,i)=>{this.matrixDummy.position.set(r.x,r.y,r.z);if(revision6Shape){const gradeX=(this.heightAt(r.x+2,r.z)-this.heightAt(r.x-2,r.z))*.25,gradeZ=(this.heightAt(r.x,r.z+2)-this.heightAt(r.x,r.z-2))*.25,surface=new THREE.Vector3(-gradeX,1,-gradeZ).normalize();this.matrixDummy.quaternion.copy(surfaceAlignedQuaternion(surface,r.rot)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rand()-.5)*.12,0,(rand()-.5)*.14)));}else this.matrixDummy.rotation.set((rand()-.5)*.18,r.rot,(rand()-.5)*.2);this.matrixDummy.scale.set(r.sx,r.sy,r.sz);this.matrixDummy.updateMatrix();
        // The original fixed center offset only worked for one rock scale and
        // flat ground. Seat each shared instance against its sampled terrain.
        this.matrixDummy.position.y+=terrainContactOffset(geos[v]!,this.matrixDummy.matrix,(x,z)=>this.heightAt(x,z),.035);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);
        const tone=rand(),biome=this.worldRevision>=6?this.biomeAt(r.x,r.z):'';if(this.worldRevision>=6){const alpine=biome==='SNOW / ALPINE'||biome==='ROCKY MOUNTAIN',arid=biome==='ARID',hue=alpine ? .58 : arid ? .105 : .17,saturation=alpine ? .10 : arid ? .18 : .14,light=alpine ? .18 : arid ? .22 : .20;mesh.setColorAt(i,new THREE.Color().setHSL(hue+Math.sin(r.x*1.71+r.z*.93)*.018,saturation,light+tone*.10));}else mesh.setColorAt(i,new THREE.Color().setHSL(.12,.08,.72+tone*.24));if(r.sy>1.5){const collider=collisionBoundsFromGeometry(geos[v]!,this.matrixDummy.matrix,.08);this.colliders.push(collider);collisionRefs[i]=collider;}});mesh.computeBoundingSphere();this.root.add(mesh);if(revision6Shape)this.outcropBatches.push({mesh,variant:v,collisionRefs});
    }
    const make=(kind:'stone'|'metal'|'sulfur'|'hqmetal',x:number,z:number,size:number)=>{
      const capacity=kind==='stone'?240:kind==='metal'?180:kind==='sulfur'?160:90;
      const material=kind==='stone'?this.stone:kind==='metal'?this.metal:kind==='sulfur'?this.sulfur:this.hqmetal;
      const node=this.addNode(kind,x,z,size,rand()*6.28,capacity),group=new THREE.Group(),main=new THREE.Mesh(geos[Math.floor(rand()*3)]!,material);main.position.y=.39;main.scale.set(.94,.82,.88);main.castShadow=main.receiveShadow=true;group.add(main);
      const secondary=new THREE.Mesh(geos[Math.floor(rand()*3)]!,material);secondary.position.set(.57,.22,.19);secondary.scale.set(.5,.5,.55);secondary.castShadow=true;group.add(secondary);
      if(kind!=='stone'){
        const colors={metal:0xb46e43,sulfur:0xe0c83d,hqmetal:0xacc7ce} as const,veinMat=new THREE.MeshStandardMaterial({color:colors[kind],metalness:kind==='sulfur'?.08:.62,roughness:kind==='sulfur'?.76:.38,emissive:kind==='sulfur'?0x302700:kind==='hqmetal'?0x10191b:0x1e0d05,emissiveIntensity:.18});this.materials.add(veinMat);
        const chunks=kind==='hqmetal'?3:kind==='sulfur'?5:4;for(let j=0;j<chunks;j++){const vein=new THREE.Mesh(this.own(new THREE.DodecahedronGeometry(.12+rand()*.07,0)),veinMat);const a=rand()*Math.PI*2;vein.position.set(Math.cos(a)*(.38+rand()*.24),.48+rand()*.55,Math.sin(a)*(.34+rand()*.22));vein.scale.set(1.3+rand()*1.5,.38+rand()*.45,.55+rand()*.65);vein.rotation.set(rand(),rand()*6.28,rand());group.add(vein);}
      }
      group.name=kind==='stone'?'Stone node':kind==='metal'?'Metal ore node':kind==='sulfur'?'Sulfur ore node':'High quality metal ore node';
      this.place(group,node);
      // Keep resource identity and the gameplay collider upright, while the
      // rendered mineral mass settles into the local terrain plane.
      const gradeX=(this.heightAt(x+2,z)-this.heightAt(x-2,z))*.25,gradeZ=(this.heightAt(x,z+2)-this.heightAt(x,z-2))*.25;
      const surfaceNormal=new THREE.Vector3(-gradeX,1,-gradeZ).normalize();group.quaternion.copy(surfaceAlignedQuaternion(surfaceNormal,node.rotation));group.updateMatrixWorld(true);group.position.y+=terrainContactOffset(main.geometry,main.matrixWorld,(px,pz)=>this.heightAt(px,pz));
      this.colliders.push({...collisionBoundsFromObject(group,.08),nodeId:node.id,rainSurface:false});
    };
    if(this.terrain.generation>=3){make('stone',this.spawn.x+10,this.spawn.z-10,.95);make('stone',this.spawn.x-13,this.spawn.z-8,1.08);make('metal',this.spawn.x+16,this.spawn.z+11,1.02);}
    else {make('stone',24,206,.95);make('stone',35,199,1.1);make('metal',60,175,1.1);}
    if(this.terrain.generation>=4){
      const g5=this.terrain.generation===5,span=g5?this.terrain.size*.94:640;
      for(let i=0,count=0;i<(g5?(this.worldRevision>=6?13800:9200):4400)&&count<(g5?(this.worldRevision>=6?195:150):92);i++){
        const x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z);if(!this.roadClear(x,z,4)||h<2.1||Math.hypot(x-this.spawn.x,z-this.spawn.z)<18||this.terrain.slopeAt(x,z)>.82)continue;
        if(this.nodes.some(n=>n.kind==='tree'&&Math.hypot(n.position.x-x,n.position.z-z)<4.6))continue;
        if(boulders.some(b=>Math.hypot(b.x-x,b.z-z)<3.5))continue;
        const biome=this.biomeAt(x,z),mineralRegion=biome==='ROCKY MOUNTAIN'||biome==='ARID'||biome==='SNOW / ALPINE';if(rand()>(h>20?.45:mineralRegion?.28:.16))continue;const roll=rand(),kind=roll<.48?'stone':roll<.76?'metal':roll<.94?'sulfur':'hqmetal';make(kind,x,z,.82+rand()*.58);count++;
      }
    }else for(let i=0,count=0;i<3600&&count<155;i++){
      const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z);if(h<2.1||Math.hypot(x-this.spawn.x,z-this.spawn.z)<17||this.terrain.slopeAt(x,z)>.9)continue;
      if(rand()>(h>20?.72:.31))continue;const roll=rand(),kind=roll<.57?'stone':roll<.80?'metal':roll<.95?'sulfur':'hqmetal';make(kind,x,z,.8+rand()*.65);count++;
    }
  }
  private populatePlants():void {
    const rand=randomSource(this.seed+590),bush=this.own(bushGeometry()),fiberGeo=this.own(fiberGeometry()),berryGeo=this.own(berryGeometry()),twigGeo=this.own(new THREE.CylinderGeometry(.07,.12,1.5,7));
    twigGeo.rotateZ(Math.PI/2);const bushPositions:{x:number;y:number;z:number;s:number;r:number}[]=[];
    for(let i=0;i<(this.worldRevision>=6?3800:2800)&&bushPositions.length<(this.worldRevision>=6?620:490);i++){
      const span=this.terrain.generation===5?this.terrain.size*.94:this.terrain.generation>=4?650:570,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z);if(!this.roadClear(x,z,3.5)||h<3||h>32||this.terrain.slopeAt(x,z)>.64||Math.hypot(x-this.spawn.x,z-this.spawn.z)<9)continue;
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
    if(this.terrain.generation>=3){create('wood',this.spawn.x+8,this.spawn.z-7,1);create('fiber',this.spawn.x-7,this.spawn.z-8,1.2);create('berries',this.spawn.x+10,this.spawn.z+8,1.3);create('fiber',this.spawn.x-10,this.spawn.z+9,1.15);create('wood',this.spawn.x+4,this.spawn.z+13,1.1);}
    else {create('wood',29.5,209,1);create('fiber',31,207.5,1.2);create('berries',35,208,1.3);create('fiber',22,210,1.15);create('wood',19,202,1.1);}
    for(let i=0,count=0;i<(this.worldRevision>=6?4600:3400)&&count<(this.worldRevision>=6?330:260);i++){
      const span=this.terrain.generation===5?this.terrain.size*.94:this.terrain.generation>=4?640:520,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z);if(!this.roadClear(x,z,3.5)||h<2.3||h>34||this.terrain.slopeAt(x,z)>.6||Math.hypot(x-this.spawn.x,z-this.spawn.z)<12)continue;
      if(rand()>.62)continue;const roll=rand();create(roll<.40?'wood':roll<.70?'berries':'fiber',x,z,.75+rand()*.45);count++;
    }
  }
  private populateUnderstory():void {
    const revision6=this.worldRevision>=6,rand=randomSource(this.seed+4421),fernG=this.own(fernGeometry(revision6)),twigG=this.own(twigGeometry()),tuftG=this.own(grassGeometry(revision6));
    const fernM=new THREE.MeshLambertMaterial({color:revision6?0x6d8050:0x526d40,side:THREE.DoubleSide});
    const tuftM=new THREE.MeshLambertMaterial({color:0xd5c39a,vertexColors:true,side:THREE.DoubleSide});this.materials.add(fernM);this.materials.add(tuftM);
    const fernPos:{x:number;y:number;z:number;s:number;r:number}[]=[],twigPos:{x:number;y:number;z:number;s:number;r:number}[]=[],tuftPos:{x:number;y:number;z:number;s:number;r:number}[]=[];
    const fernTarget=revision6?2800:720,twigTarget=revision6?780:620,tuftTarget=revision6?850:680;
    for(let i=0;i<(revision6?34000:12500)&&(fernPos.length<fernTarget||twigPos.length<twigTarget||tuftPos.length<tuftTarget);i++){
      const span=this.terrain.generation===5?this.terrain.size*.94:this.terrain.generation>=4?640:550,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);if(h<2||h>42||slope>.68||Math.hypot(x-this.spawn.x,z-this.spawn.z)<12)continue;const forest=this.terrain.forestAtSample(x,z,h),wetlandNoise=revision6?this.terrain.noise.at(x*.0071+72,z*.0071-31):0,climateSample=revision6?this.terrain.climateAtSample(x,z,h):undefined,biome=this.terrain.biomeAtSample(x,z,h,slope,climateSample),climate=climateSample?surfaceClimate(climateSample,h,slope,wetlandNoise):null,forestBand=climate?.forest??forest,fernEligible=climate?forestBand>.28&&climate.arid<.62&&climate.snow<.62&&climate.marsh<.58:(biome==='TEMPERATE FOREST'||biome==='FOREST')&&forest>.45,twigEligible=climate?forestBand>.25&&climate.arid<.48&&climate.snow<.58:biome!=='ARID'&&forest>.34,tuftEligible=climate?(climate.arid>.16||(forestBand<.34&&climate.snow<.48&&climate.marsh<.46&&h>3.4&&slope<.58)):(biome==='GRASSLAND'||biome==='TEMPERATE GRASSLAND'||biome==='ARID');
      if(fernPos.length<fernTarget&&fernEligible&&rand()<(climate?.12+forestBand*.17:.23)){const clump=revision6?3+Math.floor(rand()*3):2+Math.floor(rand()*3);for(let j=0;j<clump&&fernPos.length<fernTarget;j++){const angle=rand()*Math.PI*2,radius=j===0?0:rand()*(revision6?1.2:1.05),fx=x+Math.cos(angle)*radius,fz=z+Math.sin(angle)*radius,fy=this.heightAt(fx,fz);if(fy<2||this.terrain.slopeAt(fx,fz)>.72)continue;fernPos.push({x:fx,y:fy,z:fz,s:revision6?.48+rand()*.67:.38+rand()*.65,r:rand()*6.28});}}
      if(twigPos.length<twigTarget&&twigEligible&&rand()<.18)twigPos.push({x,y:h+.025,z,s:.42+rand()*.85,r:rand()*6.28});
      if(tuftPos.length<tuftTarget&&tuftEligible&&rand()<.20)tuftPos.push({x,y:h-.01,z,s:.32+rand()*.62,r:rand()*6.28});
    }
    const shrubPos:typeof fernPos=[];
    if(revision6){
      const shrubRand=randomSource(this.seed+77119),shrubG=this.own(forestShrubGeometry()),shrubM=new THREE.MeshLambertMaterial({color:0xffffff}),target=1400,span=this.terrain.generation===5?this.terrain.size*.94:640;
      this.materials.add(shrubM);
      for(let tries=0;tries<42000&&shrubPos.length<target;tries++){
        const x=(shrubRand()-.5)*span,z=(shrubRand()-.5)*span,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
        if(h<3.6||h>31||slope>.5||Math.hypot(x-this.spawn.x,z-this.spawn.z)<18||!this.roadClear(x,z,4))continue;
        const climate=surfaceClimate(this.terrain.climateAtSample(x,z,h),h,slope,this.terrain.noise.at(x*.0071+72,z*.0071-31));
        if(climate.forest<.55||climate.arid>.54||climate.snow>.48||climate.marsh>.5||shrubRand()>.48)continue;
        const clump=2+Math.floor(shrubRand()*3);
        for(let j=0;j<clump&&shrubPos.length<target;j++){
          const angle=shrubRand()*Math.PI*2,radius=j===0?0:shrubRand()*1.8,sx=x+Math.cos(angle)*radius,sz=z+Math.sin(angle)*radius,sy=this.heightAt(sx,sz);
          if(sy<3.6||this.terrain.slopeAt(sx,sz)>.56||!this.roadClear(sx,sz,3.5))continue;
          shrubPos.push({x:sx,y:sy,z:sz,s:.68+shrubRand()*.56,r:shrubRand()*6.28});
        }
      }
      const mesh=new THREE.InstancedMesh(shrubG,shrubM,shrubPos.length);mesh.name='Forest shrub understory';mesh.receiveShadow=true;
      shrubPos.forEach((p,i)=>{this.matrixDummy.position.set(p.x,p.y,p.z);this.matrixDummy.rotation.set(0,p.r,0);this.matrixDummy.scale.set(p.s,p.s,p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.255+shrubRand()*.045,.34+shrubRand()*.12,.095+shrubRand()*.045));});
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.root.add(mesh);this.detailMeshes.push({mesh,fullCount:shrubPos.length,minimum:'medium'});
    }
    const build=(positions:typeof fernPos,geometry:THREE.BufferGeometry,material:THREE.Material,name:string,minimum:'low'|'medium'|'high')=>{const mesh=new THREE.InstancedMesh(geometry,material,positions.length);mesh.name=name;mesh.receiveShadow=true;positions.forEach((p,i)=>{this.matrixDummy.position.set(p.x,p.y,p.z);this.matrixDummy.rotation.set(0,p.r,0);this.matrixDummy.scale.setScalar(p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);if(name.includes('Fern'))mesh.setColorAt(i,new THREE.Color().setHSL(revision6?.29+rand()*.035:.24+rand()*.045,revision6?.38:.28,revision6?.34+rand()*.09:.52+rand()*.13));});if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.root.add(mesh);this.detailMeshes.push({mesh,fullCount:positions.length,minimum});};
    build(fernPos,fernG,fernM,'Forest fern understory','medium');build(twigPos,twigG,this.bark,'Fallen twig litter','medium');build(tuftPos,tuftG,tuftM,'Dry meadow tufts','low');
  }

  private populateForestDeadfall():void {
    if(this.terrain.generation!==5||this.worldRevision<6)return;
    const rand=randomSource(this.seed+93241),span=this.terrain.size*.94,target=220,positions:{x:number;y:number;z:number;s:number;r:number}[]=[];
    for(let tries=0;tries<target*80&&positions.length<target;tries++){
      const ax=(rand()-.5)*span,az=(rand()-.5)*span,ah=this.heightAt(ax,az),aslope=this.terrain.slopeAt(ax,az);
      if(ah<3.6||ah>31||aslope>.36||Math.hypot(ax-this.spawn.x,az-this.spawn.z)<24||!this.roadClear(ax,az,6))continue;
      const climate=surfaceClimate(this.terrain.climateAtSample(ax,az,ah),ah,aslope,this.terrain.noise.at(ax*.0071+72,az*.0071-31));
      if(climate.forest<.64||climate.arid>.46||climate.snow>.38||climate.marsh>.44||rand()>.72)continue;
      const clump=1+Math.floor(rand()*3);
      for(let j=0;j<clump&&positions.length<target;j++){
        const angle=rand()*Math.PI*2,radius=j===0?0:rand()*4.8,x=ax+Math.cos(angle)*radius,z=az+Math.sin(angle)*radius,y=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
        if(y<3.6||y>31||slope>.4||!this.roadClear(x,z,5.5))continue;
        const local=surfaceClimate(this.terrain.climateAtSample(x,z,y),y,slope,this.terrain.noise.at(x*.0071+72,z*.0071-31));
        if(local.forest<.56||local.arid>.52||local.snow>.44||local.marsh>.48)continue;
        positions.push({x,y:y+.035,z,s:.72+rand()*.62,r:rand()*Math.PI*2});
      }
    }
    const mesh=new THREE.InstancedMesh(this.own(fallenLogGeometry()),this.bark,positions.length);mesh.name='Forest fallen logs';mesh.castShadow=false;mesh.receiveShadow=false;
    positions.forEach((p,i)=>{const gradeX=(this.heightAt(p.x+1.5,p.z)-this.heightAt(p.x-1.5,p.z))/3,gradeZ=(this.heightAt(p.x,p.z+1.5)-this.heightAt(p.x,p.z-1.5))/3,normal=new THREE.Vector3(-gradeX,1,-gradeZ).normalize();this.matrixDummy.position.set(p.x,p.y+.165*p.s,p.z);this.matrixDummy.quaternion.copy(surfaceAlignedQuaternion(normal,p.r));this.matrixDummy.scale.setScalar(p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.055+rand()*.035,.22+rand()*.12,.43+rand()*.11));});
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.root.add(mesh);this.detailMeshes.push({mesh,fullCount:positions.length,minimum:'medium'});
  }

  private populateMarshReeds():void {
    if(this.terrain.generation!==5||this.worldRevision<6)return;
    const rand=randomSource(this.seed+78031),positions:{x:number;y:number;z:number;s:number;r:number}[]=[],target=2700,span=this.terrain.size*.94;
    for(let tries=0;positions.length<target&&tries<target*18;tries++){
      const x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);if(h<3.35||h>13.5||slope>.28||!this.roadClear(x,z,3.4))continue;
      const wetland=surfaceClimate(this.terrain.climateAtSample(x,z,h),h,slope,this.terrain.noise.at(x*.0071+72,z*.0071-31)).marsh,patch=this.terrain.noise.fbm(x*.035+17,z*.035-63,3);if(wetland<.39||patch<.39||rand()>.62)continue;
      // Each accepted marsh patch seeds a small, tightly grouped clump rather than isolated stalks.
      for(let stalk=0;stalk<marshReedClumpSize(rand())&&positions.length<target;stalk++){
        const angle=rand()*Math.PI*2,radius=rand()*1.2,rx=x+Math.cos(angle)*radius,rz=z+Math.sin(angle)*radius,rh=this.heightAt(rx,rz);if(!this.roadClear(rx,rz,3.4))continue;
        positions.push({x:rx,y:rh-.025,z:rz,s:.78+rand()*.86,r:rand()*Math.PI*2});this.reedLocations.push({x:rx,y:rh,z:rz});
      }
    }
    if(!positions.length)return;
    const geometry=this.own(reedGeometry()),material=new THREE.MeshLambertMaterial({color:0xc4b27c}),mesh=new THREE.InstancedMesh(geometry,material,positions.length);this.materials.add(material);mesh.name='Marsh reeds';mesh.castShadow=false;mesh.receiveShadow=true;
    positions.forEach((p,i)=>{this.matrixDummy.position.set(p.x,p.y,p.z);this.matrixDummy.rotation.set(0,p.r,0);this.matrixDummy.scale.setScalar(p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.19+rand()*.07,.22+rand()*.16,.56+rand()*.16));});mesh.computeBoundingSphere();this.root.add(mesh);this.detailMeshes.push({mesh,fullCount:positions.length,minimum:'low'});
  }

  private populateMarshPools():void {
    if(this.terrain.generation!==5||this.worldRevision<6)return;
    const rand=randomSource(this.seed+88217),pools:{x:number;y:number;z:number;sx:number;sz:number;r:number}[]=[],target=150,span=this.terrain.size*.94;
    for(let tries=0;pools.length<target&&tries<target*110;tries++){
      const x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);if(h<3.8||h>11.5||slope>.105||Math.hypot(x-this.spawn.x,z-this.spawn.z)<20||!this.roadClear(x,z,4))continue;
      const wetland=surfaceClimate(this.terrain.climateAtSample(x,z,h),h,slope,this.terrain.noise.at(x*.0071+72,z*.0071-31)).marsh,patch=this.terrain.noise.fbm(x*.035+49,z*.035-23,3);if(wetland<.48||patch<.39||rand()>.78)continue;
      pools.push({x,y:h+.085,z,sx:1.25+rand()*2.3,sz:.82+rand()*1.5,r:rand()*Math.PI});
      this.marshPoolLocations.push({x,y:h+.085,z});
    }
    if(!pools.length)return;
    const geometry=this.own(marshPoolGeometry()),material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.30,metalness:.035,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});this.materials.add(material);
    const mesh=new THREE.InstancedMesh(geometry,material,pools.length);mesh.name='Marsh pools';mesh.receiveShadow=true;mesh.castShadow=false;
    const up=new THREE.Vector3();pools.forEach((p,i)=>{const gradeX=(this.heightAt(p.x+2,p.z)-this.heightAt(p.x-2,p.z))*.25,gradeZ=(this.heightAt(p.x,p.z+2)-this.heightAt(p.x,p.z-2))*.25,normal=up.set(-gradeX,1,-gradeZ).normalize();this.matrixDummy.position.set(p.x,p.y-.055,p.z);this.matrixDummy.quaternion.copy(surfaceAlignedQuaternion(normal,p.r));this.matrixDummy.scale.set(p.sx,1,p.sz);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.47+rand()*.035,.12+rand()*.07,.64+rand()*.07));});
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.root.add(mesh);this.detailMeshes.push({mesh,fullCount:pools.length,minimum:'medium'});
  }

  private populateGroundDecals():void {
    const rand=randomSource(this.seed+7719),geometry=this.own(new THREE.CircleGeometry(1,14));geometry.rotateX(-Math.PI/2);const normal=new THREE.Vector3();
    type DecalKind='soil'|'leaves'|'stone'|'mud'|'moss';const revision6=this.terrain.generation===5&&this.worldRevision>=6,multiplier=revision6?1.3:1,configs:[DecalKind,THREE.CanvasTexture,number][]=[['soil',groundDecalTexture(251,'soil'),Math.round(240*multiplier)],['leaves',groundDecalTexture(617,'leaves'),Math.round(220*multiplier)],['stone',groundDecalTexture(877,'stone'),Math.round(150*multiplier)]];
    if(revision6)configs.push(['mud',groundDecalTexture(1968,'mud'),135],['moss',groundDecalTexture(2077,'moss'),180]);
    for(const [kind,tex,count] of configs){const opacity=kind==='stone'?.30:kind==='mud'?.42:kind==='moss'?.26:.36,mat=new THREE.MeshStandardMaterial({map:tex,transparent:true,opacity,depthWrite:false,roughness:kind==='mud'?.84:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});this.materials.add(mat);const matrices:THREE.Matrix4[]=[];
      for(let i=0,tries=0; i<count&&tries<count*12;tries++){const span=this.terrain.generation===5?this.terrain.size*.94:this.terrain.generation>=4?640:540,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z),forest=this.terrain.forestAt(x,z);if(h<1.4||h>46||slope>.45)continue;if(kind==='leaves'&&forest<.42)continue;if(kind==='stone'&&h<18&&slope<.28)continue;if(kind==='soil'&&forest>.68)continue;
        if(kind==='mud'||kind==='moss'){const wetlandNoise=this.terrain.noise.at(x*.0071+72,z*.0071-31),climate=surfaceClimate(this.terrain.climateAtSample(x,z,h),h,slope,wetlandNoise);if(kind==='mud'&&(climate.marsh<.34||h>13.5||slope>.20))continue;if(kind==='moss'&&(climate.forest<.26||climate.arid>.50||this.terrain.climateAtSample(x,z,h).moisture<.56))continue;}
        const yaw=rand()*6.28,gradeX=(this.heightAt(x+2,z)-this.heightAt(x-2,z))*.25,gradeZ=(this.heightAt(x,z+2)-this.heightAt(x,z-2))*.25;normal.set(-gradeX,1,-gradeZ).normalize();this.matrixDummy.position.set(x,h+.028,z);this.matrixDummy.quaternion.copy(surfaceAlignedQuaternion(normal,yaw));this.matrixDummy.scale.set(.75+rand()*2.1,1,.45+rand()*1.5);this.matrixDummy.updateMatrix();matrices.push(this.matrixDummy.matrix.clone());i++;}
      const mesh=new THREE.InstancedMesh(geometry,mat,matrices.length);mesh.name=`${kind} ground decals`;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.renderOrder=1;mesh.computeBoundingSphere();this.root.add(mesh);this.decalMeshes.push(mesh);this.detailMeshes.push({mesh,fullCount:matrices.length,minimum:'high'});
    }
    if(revision6&&this.layout?.pois.length){
      const groups=[{kind:'oil' as const,seed:5107,sites:[0,2,5] as const},{kind:'rust' as const,seed:7319,sites:[0,1,2,4,5,6,7] as const}];
      for(const group of groups){const rand=randomSource(this.seed+group.seed),texture=groundDecalTexture(group.seed,group.kind),material=new THREE.MeshStandardMaterial({map:texture,transparent:true,opacity:group.kind==='oil'?.34:.31,depthWrite:false,roughness:group.kind==='oil'?.45:.96,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),matrices:THREE.Matrix4[]=[];this.materials.add(material);
        for(const poi of this.layout.pois){if(!group.sites.some(kind=>kind===poi.kind))continue;for(let stain=0;stain<4;stain++){for(let attempt=0;attempt<5;attempt++){const angle=rand()*Math.PI*2,radius=group.kind==='oil'?2.5+rand()*4.5:3.4+rand()*6.2,x=poi.position.x+Math.cos(angle)*radius,z=poi.position.z+Math.sin(angle)*radius,y=this.heightAt(x,z);if(y<.35||y>(poi.kind===7?48:28)||this.terrain.slopeAt(x,z)>.28)continue;const gradeX=(this.heightAt(x+2,z)-this.heightAt(x-2,z))*.25,gradeZ=(this.heightAt(x,z+2)-this.heightAt(x,z-2))*.25;normal.set(-gradeX,1,-gradeZ).normalize();this.matrixDummy.position.set(x,y+.032,z);this.matrixDummy.quaternion.copy(surfaceAlignedQuaternion(normal,rand()*Math.PI*2));const size=group.kind==='oil'?.58+rand()*.82:.42+rand()*.72;this.matrixDummy.scale.set(size,1,size*(.56+rand()*.5));this.matrixDummy.updateMatrix();matrices.push(this.matrixDummy.matrix.clone());break;}}}
        if(!matrices.length)continue;const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);mesh.name=`${group.kind} POI ground decals`;matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));mesh.renderOrder=1;mesh.computeBoundingSphere();this.root.add(mesh);this.decalMeshes.push(mesh);this.detailMeshes.push({mesh,fullCount:matrices.length,minimum:'high'});
      }
    }
  }

  private populateShore():void {
    const rand=randomSource(this.seed+29119),stones:[THREE.Matrix4[],THREE.Matrix4[],THREE.Matrix4[]]=[[],[],[]],wood:THREE.Matrix4[]=[],weed:THREE.Matrix4[]=[],revision6=this.terrain.generation===5&&this.worldRevision>=6;
    // The larger revision-six archipelago needs a fuller, still batched tidal
    // berm so long beach views read as a worked shoreline instead of bare sand.
    for(let i=0;i<(revision6?54000:this.worldRevision>=6?5600:4200);i++){
      const span=this.terrain.generation===5?this.terrain.size*.98:this.terrain.generation>=4?670:590,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z);if(h<.15||h>(revision6?2.9:2.35)||this.terrain.noise.at(x*.06,z*.06)<(revision6?.48:.54))continue;
      const choice=rand();if(choice<(revision6?.095:.075)){const s=.62+rand()*.92,rotation=rand()*6.28;this.matrixDummy.position.set(x,h,z);this.matrixDummy.rotation.set(0,rotation,(rand()-.5)*.12);this.matrixDummy.scale.setScalar(s);this.matrixDummy.updateMatrix();wood.push(this.matrixDummy.matrix.clone());if(revision6&&rand()<.34){const side=rand()<.5?-1:1,offset=.8+rand()*1.2,branchX=x+Math.cos(rotation)*offset*side,branchZ=z+Math.sin(rotation)*offset*side,branchY=this.heightAt(branchX,branchZ);if(branchY>.15&&branchY<2.9){this.matrixDummy.position.set(branchX,branchY,branchZ);this.matrixDummy.rotation.set(0,rotation+(rand()-.5)*.48,(rand()-.5)*.1);this.matrixDummy.scale.setScalar(s*(.34+rand()*.18));this.matrixDummy.updateMatrix();wood.push(this.matrixDummy.matrix.clone());}}if(revision6){const pebbles=3+Math.floor(rand()*4);for(let pebble=0;pebble<pebbles;pebble++){const angle=rand()*Math.PI*2,radius=.28+rand()*1.35,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius,py=this.heightAt(px,pz);if(py<.15||py>2.9)continue;const size=revision6?.09+rand()*.20:.075+rand()*.14,variant=Math.floor(Math.abs(Math.sin(px*12.9898+pz*78.233))*3);this.matrixDummy.position.set(px,py-size*.28,pz);this.matrixDummy.rotation.set(0,rand()*6.28,(rand()-.5)*.12);this.matrixDummy.scale.setScalar(size);this.matrixDummy.updateMatrix();stones[variant]!.push(this.matrixDummy.matrix.clone());}}}
      else if(choice<(revision6?.25:.19)){const s=.38+rand()*.68;this.matrixDummy.position.set(x,h-.03,z);this.matrixDummy.rotation.set(0,rand()*6.28,0);this.matrixDummy.scale.set(s,s*(.65+rand()*.6),s);this.matrixDummy.updateMatrix();weed.push(this.matrixDummy.matrix.clone());}
      else{const s=revision6?.16+rand()*.52:.12+rand()*.38,variant=Math.floor(Math.abs(Math.sin(x*12.9898+z*78.233))*3);this.matrixDummy.position.set(x,h-s*.3,z);this.matrixDummy.rotation.set(0,rand()*6.28,(rand()-.5)*.12);this.matrixDummy.scale.setScalar(s);this.matrixDummy.updateMatrix();stones[variant]!.push(this.matrixDummy.matrix.clone());}
    }
    const log=this.own(new THREE.CylinderGeometry(.055,.10,1.9,7));log.rotateZ(Math.PI/2);const weedG=this.own(seaweedGeometry()),weedM=new THREE.MeshStandardMaterial({color:0x596340,roughness:.92,side:THREE.DoubleSide});this.materials.add(weedM);
    for(const [index,matrices] of stones.entries()){const mesh=new THREE.InstancedMesh(this.own(rockGeometry([811,1391,2209][index]!)),this.stone,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.name=index===0?'Tide-washed pebbles':`Tide-washed pebbles variant ${index+1}`;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.root.add(mesh);}
    for(const [matrices,geometry,material,name] of [[wood,log,this.bark,'Stranded branches'],[weed,weedG,weedM,'Tidal seaweed']] as const){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.name=name;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.root.add(mesh);if(name==='Stranded branches'&&revision6)this.shoreDriftwoodBatch={mesh};if(name==='Tidal seaweed')this.detailMeshes.push({mesh,fullCount:matrices.length,minimum:'medium'});}
  }
  private populateGrass():void {
    const rand=randomSource(this.seed+814),revision6=this.worldRevision>=6,grassVariants=Array.from({length:revision6?4:1},(_,variant)=>this.own(grassGeometry(revision6,variant))),chunks=new Map<string,{positions:{x:number;y:number;z:number;s:number;r:number;dry:boolean}[];x:number;z:number;type:number;variant:number}>();
    const chunkSize=this.worldRevision>=6?64:40;
    for(const color of (revision6?[0xffffff]:[0xffffff,0xd5c39a])){
      const mat=new THREE.MeshLambertMaterial({color,vertexColors:true,side:THREE.DoubleSide});
      addInstanceWindResponse(mat,this.windUniform,this.windStrengthUniform,1,.13);
      this.grassMaterials.push(mat);this.materials.add(mat);
    }
    const total=this.terrain.generation===5?(this.worldRevision>=6?84000:68000):16000;
    for(let attempt=0,count=0;attempt<total*8&&count<total;attempt++){
      const near=count<(this.terrain.generation===5?(this.worldRevision>=6?18000:15000):2800),span=this.terrain.generation===5?this.terrain.size*.94:this.terrain.generation>=4?650:560,x=near?this.spawn.x+(rand()-.5)*82:(rand()-.5)*span,z=near?this.spawn.z+(rand()-.5)*82:(rand()-.5)*span;
      const h=this.heightAt(x,z);if(h<2||h>48||this.terrain.slopeAt(x,z)>.55||!this.roadClear(x,z,3.1))continue;
      const n=this.terrain.noise.at(x*.12,z*.12),patch=this.terrain.noise.fbm(x*.035+41,z*.035-17,3),slope=this.terrain.slopeAt(x,z),wetlandNoise=this.worldRevision>=6?this.terrain.noise.at(x*.0071+72,z*.0071-31):0,climateSample=this.terrain.generation===5?this.terrain.climateAtSample(x,z,h):null;const climate=climateSample?surfaceClimate(climateSample,h,slope,wetlandNoise):null;const legacyCover=climate?(1-climate.arid*.80)*(1-climate.snow*.94)*(1-climate.marsh*.52):1,cover=climateSample&&revision6?grassSurfaceCover(climateSample,h,slope,wetlandNoise):legacyCover;if(rand()>(smoothstep(.2,.73,n)*smoothstep(.24,.68,patch)*.94+.035)*cover)continue;
      const cx=Math.floor(x/chunkSize),cz=Math.floor(z/chunkSize),type=rand()<Math.max(climate?.arid??0,smoothstep(.44,.7,patch)*.36)?1:0,key=revision6?`${cx},${cz}`:`${cx},${cz},${type}`;let chunk=chunks.get(key);if(!chunk){const variant=revision6?(((cx*73856093)^(cz*19349663)^this.seed)>>>0)%grassVariants.length:0;chunk={positions:[],x:cx*chunkSize+chunkSize/2,z:cz*chunkSize+chunkSize/2,type:revision6?0:type,variant};chunks.set(key,chunk);}
      chunk.positions.push({x,y:h-.02,z,s:(.35+Math.pow(rand(),1.55)*.78)*(h<4?.82:1),r:rand()*Math.PI*2,dry:revision6&&type===1});count++;
    }
    for(const chunk of chunks.values()){
      const mesh=new THREE.InstancedMesh(grassVariants[chunk.variant]!,this.grassMaterials[chunk.type]!,chunk.positions.length);mesh.name='Windblown meadow';mesh.receiveShadow=grassReceivesShadows(this.worldRevision);
      chunk.positions.forEach((p,i)=>{this.matrixDummy.position.set(p.x,p.y,p.z);this.matrixDummy.rotation.set(0,p.r,0);this.matrixDummy.scale.set(p.s,p.s*(.55+rand()*.8),p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);const tint=new THREE.Color().setHSL(revision6 ? .18+rand()*.065 : .20+rand()*.035,revision6 ? .15+rand()*.09 : .10,revision6 ? .72+rand()*.18 : .84+rand()*.12);if(p.dry)tint.offsetHSL(.035,.07,-.12);mesh.setColorAt(i,tint);});mesh.computeBoundingSphere();this.root.add(mesh);this.grassChunks.push({mesh,center:new THREE.Vector3(chunk.x,this.heightAt(chunk.x,chunk.z),chunk.z),fullCount:chunk.positions.length});
    }
  }
  update(dt:number,timeOfDay:number,cameraPosition:THREE.Vector3):void {
    this.windUniform.value+=dt*this.windStrength;this.windStrengthUniform.value=THREE.MathUtils.damp(this.windStrengthUniform.value,.12+THREE.MathUtils.clamp((this.windStrength-1)*.20,0,.30),1.4,dt);this.cameraUniform.value.copy(cameraPosition);this.atmosphere.update(dt,timeOfDay,cameraPosition);this.cullClock-=dt;
    if(this.cullClock<=0){this.cullClock=.28;const d=scaledFoliageDistance(this.quality==='low'?68:this.quality==='medium'?92:this.quality==='high'?118:136,this.foliageDistance);for(const c of this.grassChunks){const distance=c.center.distanceTo(cameraPosition);const fade=1-smoothstep(d*.35,d+28,distance);const fraction=(this.quality==='low'?.30:this.quality==='medium'?.58:this.quality==='high'?.82:1)*this.foliageDensity;c.mesh.count=Math.floor(c.fullCount*fraction*fade);c.mesh.visible=c.mesh.count>0;}const treeDistance=scaledFoliageDistance(this.quality==='low'?250:this.quality==='medium'?360:this.quality==='high'?520:720,this.foliageDistance),treeDistanceSq=treeDistance*treeDistance;for(const batch of this.treeBatches){let visibleCount=0,changedTrunks=false,changedCrowns=false,changedMasses=false,changedTrunkColors=false,changedCrownColors=false;for(const tree of batch.instances){const dx=tree.x-cameraPosition.x,dz=tree.z-cameraPosition.z,show=dx*dx+dz*dz<treeDistanceSq&&(tree.active||this.fallingTrees.has(tree.id)),wasVisible=tree.visible;tree.visible=show;if(!show)continue;const index=visibleCount++;if(!wasVisible||tree.renderIndex!==index){batch.trunks.setMatrixAt(index,tree.matrix);batch.crowns.setMatrixAt(index,tree.crownMatrix);batch.masses?.setMatrixAt(index,tree.crownMatrix);batch.trunks.setColorAt(index,tree.trunkColor);batch.crowns.setColorAt(index,tree.crownColor);batch.masses?.setColorAt(index,tree.crownColor);const refs=this.instances.get(tree.id);if(refs)for(const ref of refs)ref.index=index;tree.renderIndex=index;changedTrunks=changedCrowns=changedTrunkColors=changedCrownColors=true;if(batch.masses)changedMasses=true;}}batch.trunks.count=batch.crowns.count=visibleCount;if(batch.masses)batch.masses.count=visibleCount;if(changedTrunks)batch.trunks.instanceMatrix.needsUpdate=true;if(changedCrowns)batch.crowns.instanceMatrix.needsUpdate=true;if(changedMasses&&batch.masses)batch.masses.instanceMatrix.needsUpdate=true;if(changedTrunkColors&&batch.trunks.instanceColor)batch.trunks.instanceColor.needsUpdate=true;if(changedCrownColors&&batch.crowns.instanceColor)batch.crowns.instanceColor.needsUpdate=true;if(changedCrownColors&&batch.masses?.instanceColor)batch.masses.instanceColor.needsUpdate=true;}const resourceDistance=this.quality==='low'?115:this.quality==='medium'?165:215;for(const obj of this.resources){const node=this.nodesById.get(obj.userData.nodeId as string);obj.visible=!!node&&node.remaining>0&&obj.position.distanceToSquared(cameraPosition)<resourceDistance*resourceDistance;}}
    for(const [id,hit] of this.hits){const elapsed=hit.elapsed+dt,obj=this.nodeObjects.get(id),refs=this.instances.get(id);if(elapsed>.4){this.hits.delete(id);if(obj)obj.rotation.z=0;if(refs)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}else{hit.elapsed=elapsed;const amount=Math.sin(elapsed*34)*(1-elapsed/.4)*.022*hit.intensity;if(obj)obj.rotation.z=amount;if(refs){this.hitRotation.makeRotationZ(amount);for(const ref of refs){this.matrixDummy.matrix.copy(ref.matrix).multiply(this.hitRotation);ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}}}
    for(const [id,fall] of this.fallingTrees){
      fall.elapsed+=dt;const fallT=Math.min(1,fall.elapsed/fall.duration),eased=1-Math.pow(1-fallT,3),fadeStart=fall.duration+fall.hold,total=fadeStart+fall.fade;
      if(fall.elapsed>=total){for(const ref of fall.refs){ref.mesh.setMatrixAt(ref.index,this.hiddenMatrix);ref.mesh.instanceMatrix.needsUpdate=true;}this.removeTreeInstance(id);this.fallingTrees.delete(id);this.cullClock=0;continue;}
      const fadeT=fall.elapsed>fadeStart?Math.min(1,(fall.elapsed-fadeStart)/fall.fade):0,scale=1-fadeT*.92,sink=fadeT*1.15*fall.node.scale;
      this.fallRotation.setFromAxisAngle(fall.axis,eased*Math.PI*.49);
      for(const ref of fall.refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.quaternion.premultiply(this.fallRotation);this.matrixDummy.position.y-=sink;this.matrixDummy.scale.multiplyScalar(scale);this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}
    }
  }
  setQuality(quality:'low'|'medium'|'high'|'ultra'):void {
    this.quality=quality;this.atmosphere.setQuality(quality);this.grassDistanceUniform.value=scaledFoliageDistance(quality==='low'?62:quality==='medium'?86:quality==='high'?112:128,this.foliageDistance);
    const treeLod=quality==='ultra'?0:quality==='high'?1:2,rockLod=quality==='low'?2:quality==='medium'?1:0;for(const batch of this.treeBatches){const level=batch.generatedLods?.[treeLod];if(level){batch.trunks.geometry=level.trunk;batch.crowns.geometry=level.foliage;}}for(const batch of this.outcropBatches){const level=batch.generatedLods?.[rockLod];if(level)batch.mesh.geometry=level;}const shoreLod=this.shoreDriftwoodBatch?.generatedLods?.[rockLod];if(shoreLod&&this.shoreDriftwoodBatch)this.shoreDriftwoodBatch.mesh.geometry=shoreLod;
    const fraction=(quality==='low'?.30:quality==='medium'?.58:quality==='high'?.82:1)*this.foliageDensity;for(const c of this.grassChunks)c.mesh.count=Math.floor(c.fullCount*fraction);
    const rank={low:0,medium:1,high:2,ultra:3} as const;for(const d of this.detailMeshes){const allowed=rank[quality]>=rank[d.minimum],f=quality==='low'?.25:quality==='medium'?.55:quality==='high'?.82:1;d.mesh.count=allowed?Math.floor(d.fullCount*f):0;}
    this.root.traverse(o=>{if(o instanceof THREE.InstancedMesh&&(o.name==='Oak canopy'||o.name==='Pine canopy'||o.name==='Oak canopy masses'))o.castShadow=quality==='ultra'||(this.worldRevision<6&&quality==='high');});this.cullClock=0;
  }
  setFoliageDensity(value:number):void {this.foliageDensity=Math.max(.25,Math.min(1,value));this.setQuality(this.quality);}
  setFoliageDistance(value:number):void {this.foliageDistance=Math.max(.5,Math.min(1.5,value));this.setQuality(this.quality);}
  setWeatherWetness(rain:number,storm=0):void {this.surfaceWetness.value=THREE.MathUtils.clamp(rain*.58+storm*.42,0,1);}
  syncNodes(nodeChanges:Record<string,number>):void {
    for(const node of this.nodes){
      const remaining=nodeChanges[node.id]??node.remaining;node.remaining=remaining;
      if(remaining>0)continue;
      const obj=this.nodeObjects.get(node.id);if(obj)obj.visible=false;
      const refs=this.instances.get(node.id),falling=this.fallingTrees.has(node.id),tree=this.treeInstancesById.get(node.id);if(tree)tree.active=remaining>0;
      if(refs&&!falling)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,this.hiddenMatrix);ref.mesh.instanceMatrix.needsUpdate=true;}
      this.hits.delete(node.id);
    }
  }
  hitNode(id:string,intensity=1):void {this.hits.set(id,{elapsed:0,intensity:Math.max(.7,Math.min(1.6,intensity))});}
  fallTree(id:string,source:Vec3):void {
    const node=this.nodes.find(n=>n.id===id),refs=this.instances.get(id);if(!node||node.kind!=='tree'||!refs||this.fallingTrees.has(id))return;
    this.hits.delete(id);const tree=this.treeInstancesById.get(id);if(tree)tree.active=false;const dx=node.position.x-source.x,dz=node.position.z,len=Math.hypot(dx,dz)||1;
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
