import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),assetDir=path.join(root,'public/assets/world'),catalog=JSON.parse(fs.readFileSync(path.join(root,'tools/world-assets/catalog.json'),'utf8'));
function readGlb(name){
  const bytes=fs.readFileSync(path.join(assetDir,`${name}.glb`));
  assert.equal(bytes.toString('ascii',0,4),'glTF',`${name} GLB magic`);
  assert.equal(bytes.readUInt32LE(4),2,`${name} glTF version`);
  assert.equal(bytes.readUInt32LE(8),bytes.length,`${name} total byte length`);
  assert.equal(bytes.readUInt32LE(16),0x4e4f534a,`${name} JSON chunk type`);
  return{bytes,json:JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)))};
}
assert.deepEqual(fs.readdirSync(assetDir).filter(name=>name.endsWith('.glb')).sort(),catalog.map(name=>`${name}.glb`).sort(),'catalog outputs match exactly');
for(const id of catalog){
  const{bytes,json}=readGlb(id),names=new Set(json.nodes.map(node=>node.name));
  for(const level of ['LOD0','LOD1','LOD2'])assert.ok(names.has(level),`${id} contains ${level}`);
  assert.ok(json.scenes[0].nodes.length>0,`${id} has scene roots`);
  assert.equal(json.meshes.length,3,`${id} has one mesh for each LOD`);
  assert.ok(bytes.length<512*1024,`${id} is within the 512 KiB shipping budget`);
}
const treeIds=['broadleaf_a','broadleaf_b','broadleaf_c','conifer_a','conifer_b','conifer_c','alpine_conifer','marsh_tree','coastal_tree'];
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
console.log(`World assets PASS · ${catalog.length} GLBs · LOD0/1/2 · all under 512 KiB`);
