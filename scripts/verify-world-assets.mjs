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
const first=readGlb('shipwreck_hull_a').json,second=readGlb('shipwreck_hull_b').json;
assert.notDeepEqual(first.nodes.map(node=>node.name),second.nodes.map(node=>node.name),'shipwreck variants are distinct');
console.log(`World assets PASS · ${catalog.length} GLBs · LOD0/1/2 · all under 512 KiB`);
