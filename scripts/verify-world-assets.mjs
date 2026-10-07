import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

const root=process.cwd(),assetDir=path.join(root,'public/assets/world'),catalog=JSON.parse(fs.readFileSync(path.join(root,'tools/world-assets/catalog.json'),'utf8')),collisionDir=path.join(assetDir,'collision-proxies');
function readGlb(name){
  const bytes=fs.readFileSync(path.join(assetDir,`${name}.glb`));
  assert.equal(bytes.toString('ascii',0,4),'glTF',`${name} GLB magic`);
  assert.equal(bytes.readUInt32LE(4),2,`${name} glTF version`);
  assert.equal(bytes.readUInt32LE(8),bytes.length,`${name} total byte length`);
  assert.equal(bytes.readUInt32LE(16),0x4e4f534a,`${name} JSON chunk type`);
  return{bytes,json:JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)))};
}
function nodeMatrix(node){
  if(node.matrix)return new THREE.Matrix4().fromArray(node.matrix);
  return new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1])));
}
function lod0Bounds(json,id){
  const root=json.nodes.findIndex(node=>node.name==='LOD0'||node.name===`${id} LOD0`);assert.ok(root>=0,`${id} has an LOD0 root`);
  const bounds=new THREE.Box3().makeEmpty(),visit=(index,parent)=>{const node=json.nodes[index],world=parent.clone().multiply(nodeMatrix(node));if(node.mesh!==undefined)for(const primitive of json.meshes[node.mesh].primitives){const accessor=json.accessors[primitive.attributes.POSITION],min=accessor.min,max=accessor.max;for(let corner=0;corner<8;corner++)bounds.expandByPoint(new THREE.Vector3(corner&1?max[0]:min[0],corner&2?max[1]:min[1],corner&4?max[2]:min[2]).applyMatrix4(world));}for(const child of node.children??[])visit(child,world);};
  visit(root,new THREE.Matrix4());assert.ok(!bounds.isEmpty(),`${id} LOD0 has measurable geometry`);return bounds;
}
assert.deepEqual(fs.readdirSync(assetDir).filter(name=>name.endsWith('.glb')).sort(),catalog.map(name=>`${name}.glb`).sort(),'catalog outputs match exactly');
assert.deepEqual(fs.readdirSync(collisionDir).filter(name=>name.endsWith('.json')).sort(),catalog.map(name=>`${name}.json`).sort(),'collision proxy outputs match the asset catalog');
for(const id of catalog){
  const proxy=JSON.parse(fs.readFileSync(path.join(collisionDir,`${id}.json`),'utf8'));
  assert.equal(proxy.asset,id,`${id} collision proxy identity`);assert.equal(proxy.units,'meters',`${id} collision proxy units`);assert.equal(proxy.coordinateSystem,'gltf-y-up',`${id} collision proxy coordinates`);assert.equal(proxy.source,'LOD0',`${id} collision proxy source`);assert.equal(proxy.shapes.length,1,`${id} has one coarse collision proxy`);
  const shape=proxy.shapes[0];if(shape.type==='box')assert.ok(shape.center.length===3&&shape.halfExtents.length===3&&shape.halfExtents.every(value=>Number.isFinite(value)&&value>0),`${id} has valid box bounds`);else assert.ok(shape.type==='capsule'&&shape.axis==='y'&&shape.center.length===3&&shape.radius>0&&shape.halfHeight>0,`${id} has a valid tree trunk capsule`);
  if(shape.type==='box'){const bounds=lod0Bounds(readGlb(id).json,id),visualCenter=bounds.getCenter(new THREE.Vector3()),visualHalf=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5),proxyCenter=new THREE.Vector3(...shape.center),proxyHalf=new THREE.Vector3(...shape.halfExtents);assert.ok(proxyCenter.distanceTo(visualCenter)<.04,`${id} collision proxy center aligns with LOD0`);for(const axis of ['x','y','z']){assert.ok(proxyHalf[axis]>=visualHalf[axis]-.02,`${id} collision proxy contains LOD0 ${axis} extent`);assert.ok(proxyHalf[axis]<=visualHalf[axis]*1.25+.04,`${id} collision proxy does not excessively inflate LOD0 ${axis} extent`);}}
}
for(const id of catalog){
  const{bytes,json}=readGlb(id),names=new Set(json.nodes.map(node=>node.name));
  for(const level of ['LOD0','LOD1','LOD2'])assert.ok(names.has(level),`${id} contains ${level}`);
  assert.ok(json.scenes[0].nodes.length>0,`${id} has scene roots`);
  assert.equal(json.meshes.length,3,`${id} has one mesh for each LOD`);
  assert.ok(bytes.length<512*1024,`${id} is within the 512 KiB shipping budget`);
}
const treeIds=['broadleaf_a','broadleaf_b','broadleaf_c','conifer_a','conifer_b','conifer_c','alpine_conifer','marsh_tree','coastal_tree','palm_tree_a'];
for(const id of treeIds){
  assert.ok(catalog.includes(id),`tree library contains ${id}`);
  const{json}=readGlb(id),triangles=level=>{const node=json.nodes.find(item=>item.name===`${level}`||item.name===`${id} ${level}`);assert.ok(node&&Number.isInteger(node.mesh),`${id} has mesh-backed ${level}`);return json.meshes[node.mesh].primitives.reduce((sum,primitive)=>sum+(primitive.indices!==undefined?json.accessors[primitive.indices].count/3:json.accessors[primitive.attributes.POSITION].count/3),0);};
  const lod0=triangles('LOD0'),lod1=triangles('LOD1'),lod2=triangles('LOD2');
  assert.ok(lod0>lod1&&lod1>lod2,`${id} reduces geometry at every LOD (${lod0}/${lod1}/${lod2} triangles)`);
}
assert.notDeepEqual(readGlb('broadleaf_a').bytes,readGlb('broadleaf_b').bytes,'broadleaf variants use separately modeled geometry');
assert.notDeepEqual(readGlb('conifer_a').bytes,readGlb('conifer_c').bytes,'conifer variants use separately modeled geometry');
const rockIds=['small_rock_a','small_rock_b','small_rock_c','medium_rock_a','medium_rock_b','medium_rock_c','large_boulder_a','large_boulder_b','large_boulder_c','coastal_rock','alpine_rock','cliff_slab_a','cliff_slab_b','broken_stone'];
for(const id of rockIds){assert.ok(catalog.includes(id),`fractured rock library contains ${id}`);const{json}=readGlb(id);for(const level of ['LOD0','LOD1','LOD2'])assert.ok(json.nodes.some(node=>node.name===level||node.name===`${id} ${level}`),`${id} contains ${level}`);}
assert.notDeepEqual(readGlb('large_boulder_a').bytes,readGlb('large_boulder_c').bytes,'large boulders have distinct chipped silhouettes');
assert.notDeepEqual(readGlb('cliff_slab_a').bytes,readGlb('cliff_slab_b').bytes,'cliff slabs have distinct fractured faces');
const first=readGlb('shipwreck_hull_a').json,second=readGlb('shipwreck_hull_b').json;
assert.notDeepEqual(first.nodes.map(node=>node.name),second.nodes.map(node=>node.name),'shipwreck variants are distinct');
console.log(`World assets PASS · ${catalog.length} GLBs · ${catalog.length} collision proxies · LOD0/1/2 · all under 512 KiB`);
