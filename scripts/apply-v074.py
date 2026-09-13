from pathlib import Path
import re

ROOT=Path('.')

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def replace_once(text,old,new,label):
    if old not in text: raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old,new,1)

def replace_regex(text,pattern,repl,label,flags=re.S):
    out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{label}: replacement count={n}')
    return out

# -----------------------------------------------------------------------------
# Core types + item/resource catalog
# -----------------------------------------------------------------------------
p=Path('src/core/types.ts'); s=read(p)
s=s.replace("'rock'|'torch'|'wood'|'stone'|'metal'|'fiber'|'berries'", "'rock'|'torch'|'wood'|'stone'|'metal'|'fiber'|'berries'|'sulfurOre'|'hqMetalOre'",1)
s=s.replace("kind:'tree'|'stone'|'metal'|'fiber'|'berries'|'wood'", "kind:'tree'|'stone'|'metal'|'sulfur'|'hqmetal'|'fiber'|'berries'|'wood'",1)
s=s.replace('worldGeneration?:1|2;', 'worldGeneration?:1|2|3;',1)
s=s.replace('worldGeneration?:1|2}', 'worldGeneration?:1|2|3}',1)
write(p,s)

p=Path('src/items/definitions.ts'); s=read(p)
s=replace_once(s,"  ore: item('ore', 'Raw metal resource', 'Process with fuel at a field processor.', 'resource', 1000, ['survival'], {placeable:false}),", "  ore: item('ore', 'Metal ore', 'Dense iron-bearing ore collected from mineral nodes. Process it at a field processor.', 'resource', 1000, ['survival'], {placeable:false}),\n  sulfurOre: item('sulfurOre', 'Sulfur ore', 'Bright sulfur-bearing rock gathered from rare yellow mineral deposits.', 'resource', 1000, ['survival','crafting'], {placeable:false}),\n  hqMetalOre: item('hqMetalOre', 'High quality metal ore', 'A rare dense metallic ore found in the richest dark mineral deposits.', 'resource', 250, ['survival','crafting'], {placeable:false}),", 'ore definitions')
write(p,s)

Path('public/assets/icons/sulfurOre.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#5f6257" d="M10 39 17 18l20-9 17 15-4 23-21 9z"/><path fill="#d6bd36" d="m18 29 8-10 9 5 7-3 8 9-9 4-5 10-10-5-8 3z"/><path fill="#f1dc57" d="m25 24 6-4 4 7-5 6-8-2z"/></svg>''')
Path('public/assets/icons/hqMetalOre.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#3f4547" d="M9 40 16 19l19-11 19 15-3 24-22 9z"/><path fill="#8fa7ad" d="m16 34 10-13 8 7 8-8 8 11-12 5-5 11-10-6-8 3z"/><path fill="#d7e6e8" d="m29 18 7 4-3 9-7-3z"/></svg>''')

p=Path('src/config/gameplay.ts'); s=read(p)
s=replace_once(s,"  metal: { itemId: 'ore', amount: 8, preferredTool: 'pickaxe', toolMultiplier: 1, weakSpotMultiplier:1.5, toolYield:{rock:8,hatchet:4,pickaxe:22}, label: 'Metal deposit' },", "  metal: { itemId: 'ore', amount: 8, preferredTool: 'pickaxe', toolMultiplier: 1, weakSpotMultiplier:1.5, toolYield:{rock:8,hatchet:4,pickaxe:22}, label: 'Metal ore deposit' },\n  sulfur: { itemId: 'sulfurOre', amount: 7, preferredTool: 'pickaxe', toolMultiplier: 1, weakSpotMultiplier:1.5, toolYield:{rock:6,hatchet:3,pickaxe:20}, label: 'Sulfur ore deposit' },\n  hqmetal: { itemId: 'hqMetalOre', amount: 3, preferredTool: 'pickaxe', toolMultiplier: 1, weakSpotMultiplier:1.5, toolYield:{rock:2,hatchet:1,pickaxe:8}, label: 'High quality metal deposit' },", 'gather rules')
write(p,s)

p=Path('src/save/storage.ts'); s=read(p)
s=s.replace("value.worldGeneration !== 1 && value.worldGeneration !== 2", "value.worldGeneration !== 1 && value.worldGeneration !== 2 && value.worldGeneration !== 3",1)
write(p,s)

# -----------------------------------------------------------------------------
# World generation v3: deterministic per-seed starter shore/spawn
# Existing generation 1/2 saves keep their exact old spawn.
# -----------------------------------------------------------------------------
p=Path('src/terrain/island.ts'); s=read(p)
s=replace_once(s,"import {Noise,smoothstep} from '../world/noise';", "import {Noise,randomSource,smoothstep} from '../world/noise';", 'island random import')
s=replace_once(s,"  readonly spawn={x:28,y:6.1,z:212};\n  private readonly step=WORLD.SIZE/WORLD.RESOLUTION;\n  constructor(seed:number,readonly generation:1|2=2){\n    this.noise=new Noise(seed);const n=WORLD.RESOLUTION;", "  readonly spawn:{x:number;y:number;z:number};\n  private readonly step=WORLD.SIZE/WORLD.RESOLUTION;\n  constructor(seed:number,readonly generation:1|2|3=3){\n    this.noise=new Noise(seed);\n    if(generation>=3){const rand=randomSource(seed+0x31a7),angle=rand()*Math.PI*2,radius=174+rand()*34;this.spawn={x:Math.cos(angle)*radius,y:6.1,z:Math.sin(angle)*radius};}\n    else this.spawn={x:28,y:6.1,z:212};\n    const n=WORLD.RESOLUTION;", 'island spawn constructor')
s=replace_once(s,"  private rawHeight(x:number,z:number):number {\n    return this.generation===2?this.geologicalHeight(x,z):this.legacyHeight(x,z);\n  }", "  private rawHeight(x:number,z:number):number {\n    if(this.generation===1)return this.legacyHeight(x,z);\n    const base=this.geologicalHeight(x,z);\n    if(this.generation===2)return base;\n    const starter=1-smoothstep(13,35,Math.hypot(x-this.spawn.x,z-this.spawn.z));\n    return base*(1-starter)+4.3*starter;\n  }", 'island v3 height')
write(p,s)

# -----------------------------------------------------------------------------
# Environment: dynamic starter resources + sulfur/HQM nodes
# -----------------------------------------------------------------------------
p=Path('src/rendering/environment.ts'); s=read(p)
s=s.replace('worldGeneration:1|2=2','worldGeneration:1|2|3=3',1)
s=replace_once(s,"  private readonly metal:THREE.MeshStandardMaterial;\n  private readonly fiber", "  private readonly metal:THREE.MeshStandardMaterial;\n  private readonly sulfur:THREE.MeshStandardMaterial;\n  private readonly hqmetal:THREE.MeshStandardMaterial;\n  private readonly fiber", 'environment material fields')
s=replace_once(s,"    this.stone=stoneMaterial(0xd5d0bf);this.metal=stoneMaterial(0x8d8273);\n    this.fiber", "    this.stone=stoneMaterial(0xd5d0bf);this.metal=stoneMaterial(0x766d63);this.sulfur=stoneMaterial(0xa9a45d);this.hqmetal=stoneMaterial(0x59666a);\n    this.fiber", 'environment material init')
s=replace_once(s,"[this.bark,this.leaves,this.pine,this.stone,this.metal,this.fiber,this.berries,this.invisible]", "[this.bark,this.leaves,this.pine,this.stone,this.metal,this.sulfur,this.hqmetal,this.fiber,this.berries,this.invisible]", 'environment material ownership')
s=replace_once(s,"    for(const [x,z,scale,species] of [[6,198,.86,0],[55,200,.96,1],[-4,190,1.02,0],[53,181,.84,0]] as const)treeNodes.push({node:this.addNode('tree',x,z,scale,rand()*6.28,300),species});", "    const starterTrees=this.terrain.generation>=3?[[this.spawn.x-22,this.spawn.z-11,.86,0],[this.spawn.x+23,this.spawn.z-9,.96,1],[this.spawn.x-18,this.spawn.z+18,1.02,0],[this.spawn.x+20,this.spawn.z+17,.84,0]] as const:[[6,198,.86,0],[55,200,.96,1],[-4,190,1.02,0],[53,181,.84,0]] as const;\n    for(const [x,z,scale,species] of starterTrees)treeNodes.push({node:this.addNode('tree',x,z,scale,rand()*6.28,300),species});", 'starter trees')

new_rocks='''  private populateRocks():void {
    const rand=randomSource(this.seed+283),geos=[this.own(rockGeometry(51)),this.own(rockGeometry(114)),this.own(rockGeometry(221))];
    const boulders:{x:number;y:number;z:number;sx:number;sy:number;sz:number;rot:number;variant:number}[]=[];
    const anchors=this.terrain.generation>=3
      ? [[this.spawn.x-31,this.spawn.z-26,6,5.8,4.6],[this.spawn.x-38,this.spawn.z-22,4.2,3.4,3.7],[this.spawn.x+37,this.spawn.z-25,6.5,6,5]] as const
      : [[-3,185,6,5.8,4.6],[-10,183,4.2,3.4,3.7],[68,180,6.5,6,5]] as const;
    for(const [x,z,sx,sy,sz] of anchors)boulders.push({x,y:this.heightAt(x,z)-.1,z,sx,sy,sz,rot:rand()*6.28,variant:Math.floor(rand()*3)});
    for(let i=0;i<950;i++){
      const x=(rand()-.5)*570,z=(rand()-.5)*570,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
      if(h<.7||Math.hypot(x-this.spawn.x,z-this.spawn.z)<20)continue;
      const rocky=h>22||slope>.44;if(rand()>(rocky?.62:.10))continue;
      const size=rocky?1.8+rand()*5:.7+rand()*1.8;boulders.push({x,y:h-size*.12,z,sx:size*(.8+rand()*.5),sy:size*(.7+rand()*.55),sz:size*(.8+rand()*.5),rot:rand()*6.28,variant:Math.floor(rand()*3)});
    }
    for(let v=0;v<3;v++){
      const rocks=boulders.filter(b=>b.variant===v),mesh=new THREE.InstancedMesh(geos[v]!,this.stone,rocks.length);mesh.castShadow=mesh.receiveShadow=true;mesh.name='Weathered granite outcrops';rocks.forEach((r,i)=>{this.matrixDummy.position.set(r.x,r.y,r.z);this.matrixDummy.rotation.set((rand()-.5)*.18,r.rot,(rand()-.5)*.2);this.matrixDummy.scale.set(r.sx,r.sy,r.sz);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.12,.08,.72+rand()*.24));if(r.sy>1.5)this.colliders.push({position:{x:r.x,y:r.y+r.sy*.12,z:r.z},halfExtents:{x:r.sx*.7,y:r.sy*.64,z:r.sz*.7},rotation:r.rot});});mesh.computeBoundingSphere();this.root.add(mesh);
    }
    const make=(kind:'stone'|'metal'|'sulfur'|'hqmetal',x:number,z:number,size:number)=>{
      const capacity=kind==='stone'?240:kind==='metal'?180:kind==='sulfur'?160:90;
      const material=kind==='stone'?this.stone:kind==='metal'?this.metal:kind==='sulfur'?this.sulfur:this.hqmetal;
      const node=this.addNode(kind,x,z,size,rand()*6.28,capacity),group=new THREE.Group(),main=new THREE.Mesh(geos[Math.floor(rand()*3)]!,material);main.position.y=.52;main.scale.set(.94,.82,.88);main.castShadow=main.receiveShadow=true;group.add(main);
      const secondary=new THREE.Mesh(geos[Math.floor(rand()*3)]!,material);secondary.position.set(.57,.22,.19);secondary.scale.set(.5,.5,.55);secondary.castShadow=true;group.add(secondary);
      if(kind!=='stone'){
        const colors={metal:0xb46e43,sulfur:0xe0c83d,hqmetal:0xacc7ce} as const,veinMat=new THREE.MeshStandardMaterial({color:colors[kind],metalness:kind==='sulfur'?.08:.62,roughness:kind==='sulfur'?.76:.38,emissive:kind==='sulfur'?0x302700:kind==='hqmetal'?0x10191b:0x1e0d05,emissiveIntensity:.18});this.materials.add(veinMat);
        const chunks=kind==='hqmetal'?3:kind==='sulfur'?5:4;for(let j=0;j<chunks;j++){const vein=new THREE.Mesh(this.own(new THREE.DodecahedronGeometry(.12+rand()*.07,0)),veinMat);const a=rand()*Math.PI*2;vein.position.set(Math.cos(a)*(.38+rand()*.24),.48+rand()*.55,Math.sin(a)*(.34+rand()*.22));vein.scale.set(1.3+rand()*1.5,.38+rand()*.45,.55+rand()*.65);vein.rotation.set(rand(),rand()*6.28,rand());group.add(vein);}
      }
      group.name=kind==='stone'?'Stone node':kind==='metal'?'Metal ore node':kind==='sulfur'?'Sulfur ore node':'High quality metal ore node';
      this.place(group,node);this.colliders.push({nodeId:node.id,position:{x,y:node.position.y+.5*size,z},halfExtents:{x:.67*size,y:.73*size,z:.61*size},rotation:node.rotation});
    };
    if(this.terrain.generation>=3){make('stone',this.spawn.x+10,this.spawn.z-10,.95);make('stone',this.spawn.x-13,this.spawn.z-8,1.08);make('metal',this.spawn.x+18,this.spawn.z+12,1.05);}
    else {make('stone',24,206,.95);make('stone',35,199,1.1);make('metal',60,175,1.1);}
    for(let i=0,count=0;i<3600&&count<155;i++){
      const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z);if(h<2.1||Math.hypot(x-this.spawn.x,z-this.spawn.z)<17||this.terrain.slopeAt(x,z)>.9)continue;
      if(rand()>(h>20?.72:.31))continue;const roll=rand(),kind=roll<.57?'stone':roll<.80?'metal':roll<.95?'sulfur':'hqmetal';make(kind,x,z,.8+rand()*.65);count++;
    }
  }
'''
s=replace_regex(s,r"  private populateRocks\(\):void \{.*?\n  \}\n  private populatePlants\(\):void \{",new_rocks+"  private populatePlants():void {",'populateRocks')
s=replace_once(s,"    create('wood',29.5,209,1);create('fiber',31,207.5,1.2);create('berries',35,208,1.3);create('fiber',22,210,1.15);create('wood',19,202,1.1);", "    if(this.terrain.generation>=3){create('wood',this.spawn.x+8,this.spawn.z-7,1);create('fiber',this.spawn.x-7,this.spawn.z-8,1.2);create('berries',this.spawn.x+10,this.spawn.z+8,1.3);create('fiber',this.spawn.x-10,this.spawn.z+9,1.15);create('wood',this.spawn.x+4,this.spawn.z+13,1.1);}\n    else {create('wood',29.5,209,1);create('fiber',31,207.5,1.2);create('berries',35,208,1.3);create('fiber',22,210,1.15);create('wood',19,202,1.1);}", 'starter plants')
write(p,s)

# Weak spots also work on the two new mineral node types.
p=Path('src/rendering/GatheringFeedback.ts'); s=read(p)
s=s.replace("type WeakKind='tree'|'stone'|'metal';", "type WeakKind='tree'|'stone'|'metal'|'sulfur'|'hqmetal';",1)
s=s.replace("kind==='tree'||kind==='stone'||kind==='metal'", "kind==='tree'||kind==='stone'||kind==='metal'||kind==='sulfur'||kind==='hqmetal'",1)
s=s.replace("(kind==='metal'?(strong?0xffe6a0:0xc9b28d):0xe3e1d7)", "(kind==='sulfur'?(strong?0xffef6b:0xd6c856):kind==='hqmetal'?(strong?0xd9f3f6:0x9db8bd):kind==='metal'?(strong?0xffc28f:0xbd8b68):0xe3e1d7)",1)
write(p,s)

# -----------------------------------------------------------------------------
# World survival: no giant tower, no visible terrain ribbon, more seeded loot.
# -----------------------------------------------------------------------------
world_survival=r'''import type {CollisionBox} from '../physics/PhysicsWorld';
import * as T from 'three';
import type {Environment} from '../rendering/environment';
import type {GameState,ItemId,Vec3} from '../core/types';
import {ensureProgression} from './progression';
import {createStation,type Station} from './stations';
import {insertItem} from '../inventory/inventory';
import {woodMaterial} from '../rendering/materials';
import {randomSource} from '../world/noise';

export interface Landmark {id:string;name:string;position:Vec3;kind:number}
const NAMES=['Coastal utility shack','Collapsed relay site','Quarry outpost','Overgrown camp'];
type LootTier='common'|'decent'|'lucky';
const LOOT:Record<LootTier,{item:ItemId;min:number;max:number;chance:number}[]>={
  common:[{item:'wood',min:25,max:90,chance:.82},{item:'stone',min:20,max:75,chance:.72},{item:'fiber',min:10,max:40,chance:.58},{item:'berries',min:2,max:8,chance:.34},{item:'ore',min:8,max:28,chance:.30}],
  decent:[{item:'ore',min:28,max:75,chance:.88},{item:'metal',min:8,max:28,chance:.72},{item:'sulfurOre',min:15,max:55,chance:.68},{item:'bandage',min:1,max:3,chance:.48},{item:'canteen',min:1,max:2,chance:.35},{item:'hatchet',min:1,max:1,chance:.18},{item:'pickaxe',min:1,max:1,chance:.18}],
  lucky:[{item:'hqMetalOre',min:8,max:28,chance:.95},{item:'sulfurOre',min:45,max:130,chance:.92},{item:'ore',min:65,max:180,chance:.92},{item:'metal',min:20,max:65,chance:.85},{item:'bandage',min:2,max:5,chance:.68},{item:'canteen',min:1,max:3,chance:.55},{item:'pickaxe',min:1,max:1,chance:.42},{item:'hatchet',min:1,max:1,chance:.36}]
};

export class WorldSurvival {
  readonly pois:Landmark[]=[];readonly group=new T.Group();readonly trails:Vec3[][]=[];
  private wood=woodMaterial('#696858');private metal=new T.MeshStandardMaterial({color:0x64706b,roughness:.88,metalness:.3});private cloth=new T.MeshStandardMaterial({color:0x6b755d,roughness:1,side:T.DoubleSide});
  constructor(private env:Environment,scene:T.Scene,private seed:number){
    scene.add(this.group);const rand=randomSource(seed+1939);
    for(let k=0;k<4;k++){let best:Vec3|null=null,score=Infinity;const angle=k*Math.PI/2+.5+(rand()-.5)*.38;for(let i=0;i<2100;i++){const a=angle+Math.sin(i*2.31+seed)*.67,r=82+(i%175);const x=Math.cos(a)*r,z=Math.sin(a)*r,y=env.heightAt(x,z);if(y<3||y>36)continue;const slope=env.terrain.slopeAt(x,z);if(slope>.36)continue;if(this.pois.some(p=>Math.hypot(p.position.x-x,p.position.z-z)<65))continue;const nearby=env.colliders.some(c=>Math.abs(c.position.x-x)<5+c.halfExtents.x&&Math.abs(c.position.z-z)<5+c.halfExtents.z);if(nearby)continue;const rank=slope+Math.abs(r-175)*.001;if(rank<score){score=rank;best={x,y,z};}}if(!best)continue;const poi={id:`poi-${k}`,name:NAMES[k]!,position:best,kind:k};this.pois.push(poi);this.make(poi);}
    let from=env.spawn;for(const poi of this.pois){const points:Vec3[]=[],distance=Math.hypot(poi.position.x-from.x,poi.position.z-from.z),segments=Math.ceil(distance/2);for(let i=0;i<=segments;i++){const t=i/segments,x=T.MathUtils.lerp(from.x,poi.position.x,t)+Math.sin(t*Math.PI)*Math.sin(seed+i*.03)*5,z=T.MathUtils.lerp(from.z,poi.position.z,t);points.push({x,y:env.heightAt(x,z)+.03,z});}this.trails.push(points);from=poi.position;}
  }
  private box(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;}
  private make(p:Landmark){
    const g=new T.Group();g.position.set(p.position.x,p.position.y,p.position.z);this.group.add(g);
    if(p.kind===1){
      // The former multi-storey relay scaffold was visually dominant and looked accidental.
      // Keep only a low collapsed relay wreck so the POI still has identity without a tower.
      for(let i=0;i<6;i++){const beam=this.box(g,-1.7+i*.65,.12+(i%2)*.08,(i%3-1)*.58,1.05,.11,.13,this.metal);beam.rotation.y=(i*.71)%Math.PI;beam.rotation.z=(i%2?.08:-.06);}
      this.box(g,.8,.23,-.7,1.55,.32,.85,this.metal);this.box(g,-.75,.16,.7,1.2,.2,.65,this.wood);
    }else if(p.kind===3){const tent=new T.Mesh(new T.ConeGeometry(1.8,2.3,4,1,true),this.cloth);tent.position.y=1.15;tent.rotation.y=Math.PI/4;g.add(tent);this.box(g,-2,.18,0,.3,.3,2,this.wood);
    }else{for(const x of [-2,2])for(const z of [-1.6,1.6])this.box(g,x,1.4,z,.18,2.8,.18,this.wood);for(let i=0;i<12;i++)this.box(g,-2+i*.35,1.2,-1.6,.32,2.4,.12,this.wood);this.box(g,0,2.8,0,4.5,.13,3.8,this.metal).rotation.z=.08;if(p.kind===2)for(let i=0;i<3;i++)this.box(g,3,.35,i*.7,1,.7,.5,this.metal);}
  }
  private tier(rand:()=>number):LootTier{const roll=rand();return roll<.60?'common':roll<.92?'decent':'lucky';}
  private fillLoot(s:Station,tier:LootTier,rand:()=>number){let added=0;for(const entry of LOOT[tier]){if(rand()>entry.chance)continue;const amount=entry.min+Math.floor(rand()*(entry.max-entry.min+1));if(insertItem(s.inventory,entry.item,amount)<amount)added++;}if(!added){const fallback=tier==='lucky'?'hqMetalOre':tier==='decent'?'ore':'wood';insertItem(s.inventory,fallback,tier==='lucky'?10:tier==='decent'?35:45);}}
  populate(state:GameState){
    const progress=ensureProgression(state),existing=new Set(progress.stations.map(s=>s.id));
    for(const poi of this.pois){const id=`loot-${poi.id}`,pos={x:poi.position.x+2.7,y:this.env.heightAt(poi.position.x+2.7,poi.position.z+2.4),z:poi.position.z+2.4},rand=randomSource(this.seed+8000+poi.kind*313);if(!existing.has(id)){const s=createStation(id,'loot',pos,rand()*Math.PI*2);this.fillLoot(s,this.tier(rand),rand);progress.stations.push(s);existing.add(id);}}
    const rand=randomSource(this.seed+12091),placed:Vec3[]=[];
    for(let tries=0,index=0;tries<6500&&index<16;tries++){
      const x=(rand()-.5)*530,z=(rand()-.5)*530,y=this.env.heightAt(x,z);if(y<2.2||y>33||this.env.terrain.slopeAt(x,z)>.48||Math.hypot(x-this.env.spawn.x,z-this.env.spawn.z)<24)continue;if(placed.some(p=>Math.hypot(p.x-x,p.z-z)<24))continue;
      const pos={x,y:y+.02,z};placed.push(pos);const id=`loot-field-${index}`,lootRand=randomSource(this.seed+24000+index*977);if(!existing.has(id)){const s=createStation(id,'loot',pos,lootRand()*Math.PI*2);this.fillLoot(s,this.tier(lootRand),lootRand);progress.stations.push(s);existing.add(id);}index++;
    }
    progress.lootGenerated=true;
  }
  collisionBoxes():CollisionBox[]{const result:CollisionBox[]=[];for(const p of this.pois){if(p.kind===1){result.push({position:{x:p.position.x+.8,y:p.position.y+.23,z:p.position.z-.7},halfExtents:{x:.8,y:.2,z:.45}});}else if(p.kind!==3)result.push({position:{x:p.position.x,y:p.position.y+1.2,z:p.position.z-1.6},halfExtents:{x:2.2,y:1.2,z:.12}});}return result;}
  dispose(){this.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.group.removeFromParent();[this.wood,this.metal,this.cloth].forEach(m=>m.dispose());}
}

export class IslandMap {
  readonly root=document.createElement('section');private canvas=document.createElement('canvas');private base=document.createElement('canvas');private ctx:CanvasRenderingContext2D;
  constructor(parent:HTMLElement,world:WorldSurvival,env:Environment,private onWaypoint:(p:{x:number;z:number}|null)=>void,close:()=>void){this.root.className='survival-panel world-map';this.root.hidden=true;this.root.innerHTML='<header><span>TIDELAND / ISLAND SURVEY</span><button>CLOSE · M / ESC</button></header><p>Click to set waypoint · Right-click to clear · North is up</p>';this.root.querySelector('button')!.onclick=close;this.canvas.width=this.canvas.height=this.base.width=this.base.height=720;this.ctx=this.canvas.getContext('2d')!;this.root.append(this.canvas);parent.append(this.root);const c=this.base.getContext('2d')!,data=c.createImageData(720,720);for(let z=0;z<720;z++)for(let x=0;x<720;x++){const h=env.heightAt(x-360,z-360),i=(z*720+x)*4,col=h<0?[39,66,75]:h<2?[154,147,117]:[72+h*1.2,88+h*.9,64+h*.9];data.data.set([...col,255],i);}c.putImageData(data,0,0);c.strokeStyle='#c0ad80';c.lineWidth=2;for(const trail of world.trails){c.beginPath();trail.forEach((p,i)=>i?c.lineTo(p.x+360,p.z+360):c.moveTo(p.x+360,p.z+360));c.stroke();}c.font='13px sans-serif';for(const p of world.pois){c.fillStyle='#e4d4a6';c.fillRect(p.position.x+355,p.position.z+355,10,10);c.fillText(p.name,p.position.x+368,p.position.z+360);}this.canvas.onclick=e=>{const r=this.canvas.getBoundingClientRect();this.onWaypoint({x:(e.clientX-r.left)/r.width*720-360,z:(e.clientY-r.top)/r.height*720-360});};this.canvas.oncontextmenu=e=>{e.preventDefault();this.onWaypoint(null);};}
  get isOpen(){return !this.root.hidden;}show(){this.root.hidden=false;}close(){this.root.hidden=true;}update(p:Vec3,yaw:number,waypoint?:{x:number;z:number}){if(!this.isOpen)return;const c=this.ctx;c.drawImage(this.base,0,0);if(waypoint){c.strokeStyle='#e3a877';c.lineWidth=3;c.strokeRect(waypoint.x+352,waypoint.z+352,16,16);}c.save();c.translate(p.x+360,p.z+360);c.rotate(-yaw);c.fillStyle='#f0f4e4';c.beginPath();c.moveTo(0,-10);c.lineTo(-6,7);c.lineTo(6,7);c.closePath();c.fill();c.restore();}
  dispose(){this.root.remove();}
}
'''
Path('src/survival/WorldSurvival.ts').write_text(world_survival)

# -----------------------------------------------------------------------------
# GameApp: random blank seeds, generation 3, multiple barrels, better uncapped
# scheduler, sulfur/HQM gathering and F3 fly/god/heal tools.
# -----------------------------------------------------------------------------
p=Path('src/app/GameApp.ts'); s=read(p)
s=replace_once(s,"import {GATHERING} from '../config/gameplay';", "import {GATHERING} from '../config/gameplay';\nimport {randomSource} from '../world/noise';", 'GameApp random import')
s=replace_once(s,"private frameTimer:number|undefined;private loopMode:'vsync'|'uncapped'|null=null;private knownStructures=new Map<string,boolean|undefined>();private rainBarrel:THREE.Group|null=null;", "private loopMode:'vsync'|'uncapped'|null=null;private frameChannel:MessageChannel|null=null;private knownStructures=new Map<string,boolean|undefined>();private rainBarrels:THREE.Group[]=[];private flyMode=false;private godMode=false;", 'GameApp loop fields')
s=replace_once(s,"newGame:(seed,slot)=>{const target=slot??this.firstFreeSaveSlot();deleteSave(target);this.refreshSaveSlots();void this.start(seed??WORLD.SEED,undefined,target);}", "newGame:(seed,slot)=>{const target=slot??this.firstFreeSaveSlot();deleteSave(target);this.refreshSaveSlots();void this.start(seed??this.randomWorldSeed(),undefined,target);}", 'random new game seed')

new_loop='''  private configureFrameLoop(){
    const mode=this.settings.vsync?'vsync':'uncapped';if(this.loopMode===mode)return;this.loopMode=mode;
    this.renderer.setAnimationLoop(null);if(this.frameChannel){this.frameChannel.port1.close();this.frameChannel.port2.close();this.frameChannel=null;}this.last=performance.now();this.accumulator=0;
    if(mode==='vsync'){this.renderer.setAnimationLoop(t=>this.frame(t));return;}
    // setTimeout(0) is often clamped around 8 ms in foreground tabs, which made
    // "V-Sync OFF" slower than a 165 Hz display. MessageChannel keeps the game
    // submission loop uncapped by timer granularity; the browser compositor may
    // still present at the monitor refresh rate.
    const channel=new MessageChannel();this.frameChannel=channel;channel.port1.onmessage=()=>{if(this.frameChannel!==channel||this.loopMode!=='uncapped'||this.settings.vsync)return;this.frame(performance.now());channel.port2.postMessage(0);};channel.port2.postMessage(0);
  }
'''
s=replace_regex(s,r"  private configureFrameLoop\(\)\{.*?\n  \}\n  private async makeWorld",new_loop+"  private async makeWorld",'frame loop')
s=s.replace("this.rainBarrel?.removeFromParent();", "for(const barrel of this.rainBarrels)barrel.removeFromParent();this.rainBarrels=[];",1)
s=s.replace("saved ? saved.worldGeneration ?? 1 : 2", "saved ? saved.worldGeneration ?? 1 : 3",1)
s=s.replace("this.registerNodes();this.createWaterSource();", "this.registerNodes();this.createWaterSources();",1)

# Mineable kinds and resource labels/audio mapping.
s=s.replace("['tree','stone','metal'].includes(node.kind)", "['tree','stone','metal','sulfur','hqmetal'].includes(node.kind)")
s=replace_once(s,"detail:`${GATHERING[node.kind].itemId==='metal'?'METAL ORE':GATHERING[node.kind].itemId.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`", "detail:`${ITEMS[GATHERING[node.kind].itemId].displayName.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`", 'resource interaction detail')
s=replace_once(s,"const kind=node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries';", "const kind=node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'||node.kind==='sulfur'||node.kind==='hqmetal'?'metal':node.kind as 'fiber'|'berries';", 'impact material mapping')
s=replace_once(s,"this.audio.gather((active==='rock'||active==='hatchet'||active==='pickaxe'?active:null) as GatherTool|null,node.kind as 'tree'|'stone'|'metal',actual.weakSpot)", "this.audio.gather((active==='rock'||active==='hatchet'||active==='pickaxe'?active:null) as GatherTool|null,(node.kind==='sulfur'||node.kind==='hqmetal'?'metal':node.kind) as 'tree'|'stone'|'metal',actual.weakSpot)", 'gather audio mapping')

# Multiple seeded rain collectors instead of one fixed spawn barrel.
water_sources='''  private createWaterSources(){
    const rand=randomSource(this.simulation.state.seed+40391),positions:Vec3[]=[];
    const tryAdd=(x:number,z:number)=>{const y=this.environment.heightAt(x,z);if(y<2||y>31||this.environment.terrain.slopeAt(x,z)>.5||positions.some(p=>Math.hypot(p.x-x,p.z-z)<34))return false;positions.push({x,y,z});return true;};
    const p=this.environment.spawn,nearAngle=rand()*Math.PI*2;tryAdd(p.x+Math.cos(nearAngle)*10,p.z+Math.sin(nearAngle)*10);
    for(let tries=0;tries<4000&&positions.length<9;tries++){const x=(rand()-.5)*510,z=(rand()-.5)*510;if(Math.hypot(x-p.x,z-p.z)<28)continue;tryAdd(x,z);}
    positions.forEach((position,index)=>{
      const g=new THREE.Group();g.position.set(position.x,position.y,position.z);g.rotation.y=rand()*Math.PI*2;
      const barrelMat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.51,.12,.34+rand()*.08),roughness:.84,metalness:.22}),ringMat=new THREE.MeshStandardMaterial({color:'#444943',metalness:.62,roughness:.48});
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.43,.4,.88,20,1,true),barrelMat);barrel.position.y=.44;barrel.castShadow=true;g.add(barrel);
      for(const h of [.08,.78]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.415,.024,6,20),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=h;g.add(ring);}
      const water=new THREE.Mesh(new THREE.CircleGeometry(.39,20),new THREE.MeshStandardMaterial({color:'#6096a3',roughness:.15,metalness:.35}));water.rotation.x=-Math.PI/2;water.position.y=.70;g.add(water);this.scene.add(g);this.rainBarrels.push(g);
      const id=`rain-collector-${index}`;this.interactions.register({id,kind:'water',object:g,position:()=>g.position,enabled:()=>true,info:()=>({title:'Rain collector',action:'DRINK FRESH WATER',key:keyLabel(this.settings.keybinds.interact),detail:'A little kindness left behind.'}),interact:()=>{this.simulation.state.player.stats.thirst=Math.min(100,this.simulation.state.player.stats.thirst+35);this.ui.notify('Hydration +35');this.audio.play('eat');}});
    });
  }
'''
s=replace_regex(s,r"  private createWaterSource\(\)\{.*?\n  \}\n  private footstepSurface",water_sources+"  private footstepSurface",'water sources')

# Fly/god simulation path.
s=replace_once(s,"while(this.accumulator>=1/60&&steps<6){this.player.tick(1/60,this.simulation.state,playing);this.simulation.tick(1/60,this.player.sprinting);this.accumulator-=1/60;steps++;}", "while(this.accumulator>=1/60&&steps<6){if(this.flyMode)this.tickFly(1/60,playing);else this.player.tick(1/60,this.simulation.state,playing);this.simulation.tick(1/60,this.flyMode?false:this.player.sprinting);if(this.godMode){const stats=this.simulation.state.player.stats;stats.health=stats.hunger=stats.thirst=stats.stamina=100;}this.accumulator-=1/60;steps++;}", 'fly simulation loop')
s=replace_once(s,"private refreshSaveSlots(){this.ui?.setSaveSlots(listSaveSlots());}", "private tickFly(dt:number,active:boolean){const keys=this.settings.keybinds,state=this.simulation.state,p=state.player.position;const forward=new THREE.Vector3(-Math.sin(this.player.yaw),0,-Math.cos(this.player.yaw)),right=new THREE.Vector3(Math.cos(this.player.yaw),0,-Math.sin(this.player.yaw)),move=new THREE.Vector3();if(active){move.addScaledVector(forward,Number(this.input.down(keys.forward))-Number(this.input.down(keys.backward)));move.addScaledVector(right,Number(this.input.down(keys.right))-Number(this.input.down(keys.left)));move.y+=Number(this.input.down(keys.jump))-Number(this.input.down(keys.crouch));}if(move.lengthSq()>1)move.normalize();const fast=active&&this.input.down(keys.sprint),speed=fast?34:14,next={x:p.x+move.x*speed*dt,y:p.y+move.y*speed*dt,z:p.z+move.z*speed*dt};this.player.sprinting=fast&&move.lengthSq()>0;this.player.teleport(next);state.player.position={...next};state.player.yaw=this.player.yaw;state.player.pitch=this.player.pitch;}\n  private randomWorldSeed(){const data=new Uint32Array(1);crypto.getRandomValues(data);return data[0]!%1_000_000_000;}\n  private refreshSaveSlots(){this.ui?.setSaveSlots(listSaveSlots());}", 'fly and random seed methods')

# Diagnostics text + dev actions.
s=replace_once(s,"TIME  ${hour.toFixed(2)} / ×${this.timeMultiplier}`", "TIME  ${hour.toFixed(2)} / ×${this.timeMultiplier}\\nDEV  FLY ${this.flyMode?'ON':'OFF'} / GOD ${this.godMode?'ON':'OFF'}`", 'diagnostics dev state')
old_dev="private dev(action:string,value?:number){if(!this.simulation)return;if(action==='resources'){for(const id of ['wood','stone','fiber','metal','berries'] as ItemId[])this.simulation.addItem(id,id==='berries'?30:2000);this.ui.notify('Development resources added');}if(action==='plan'){this.simulation.addItem('plan',1);this.ui.notify('Development building plan added');this.syncHeld();}if(action==='spawn')this.player.teleport(this.environment.spawn);if(action==='day')this.simulation.state.timeOfDay=10;if(action==='night')this.simulation.state.timeOfDay=0;if(action==='speed')this.timeMultiplier=20;if(action==='normal')this.timeMultiplier=1;if(action==='time'&&value!==undefined)this.simulation.state.timeOfDay=value;if(action==='collisions')this.debug.collisions=!this.debug.collisions;if(action==='sockets')this.debug.sockets=!this.debug.sockets;}"
new_dev="private dev(action:string,value?:number){if(!this.simulation)return;if(action==='resources'){for(const id of ['wood','stone','fiber','ore','metal','sulfurOre','hqMetalOre','berries'] as ItemId[])this.simulation.addItem(id,id==='berries'?30:id==='hqMetalOre'?200:2000);this.ui.notify('Development resources added');}if(action==='plan'){this.simulation.addItem('plan',1);this.ui.notify('Development building plan added');this.syncHeld();}if(action==='spawn'){this.player.teleport(this.environment.spawn);this.simulation.state.player.position={...this.environment.spawn};}if(action==='fly'){this.flyMode=!this.flyMode;this.ui.notify(`Fly mode ${this.flyMode?'ON':'OFF'} · WASD + Space/Crouch · Shift fast`);}if(action==='god'){this.godMode=!this.godMode;this.ui.notify(`God mode ${this.godMode?'ON':'OFF'}`);}if(action==='heal'){const stats=this.simulation.state.player.stats;stats.health=stats.hunger=stats.thirst=stats.stamina=100;this.ui.notify('Vitals restored');}if(action==='day')this.simulation.state.timeOfDay=10;if(action==='night')this.simulation.state.timeOfDay=0;if(action==='speed')this.timeMultiplier=20;if(action==='normal')this.timeMultiplier=1;if(action==='time'&&value!==undefined)this.simulation.state.timeOfDay=value;if(action==='collisions')this.debug.collisions=!this.debug.collisions;if(action==='sockets')this.debug.sockets=!this.debug.sockets;}"
s=replace_once(s,old_dev,new_dev,'dev actions')
write(p,s)

# -----------------------------------------------------------------------------
# UI: Back button, auto-close HISTORY, new mineral labels, F3 dev controls.
# -----------------------------------------------------------------------------
p=Path('src/ui/UI.ts'); s=read(p)
s=replace_once(s,"<button class=\"close-button\" data-action=\"saveBrowserClose\">×</button>", "<button class=\"close-button save-browser-back\" data-action=\"saveBrowserClose\"><span>← BACK</span><kbd>ESC</kbd></button>", 'save browser back')
s=replace_once(s,"this.closeSaveBrowser();\n    this.find('.help-panel').hidden = true;", "this.closeSaveBrowser();\n    this.find('.history-panel').hidden = true;\n    this.find('.help-panel').hidden = true;", 'history auto close')
s=replace_once(s,"{tree:'DŘEVO',wood:'DŘEVO',stone:'KÁMEN',metal:'KOVOVÁ RUDA',fiber:'VLÁKNO',berries:'BOBULE'}:{tree:'WOOD',wood:'WOOD',stone:'STONE',metal:'METAL ORE',fiber:'CLOTH FIBER',berries:'BERRIES'}", "{tree:'DŘEVO',wood:'DŘEVO',stone:'KÁMEN',metal:'KOVOVÁ RUDA',sulfur:'SÍROVÁ RUDA',hqmetal:'HQ KOVOVÁ RUDA',fiber:'VLÁKNO',berries:'BOBULE'}:{tree:'WOOD',wood:'WOOD',stone:'STONE',metal:'METAL ORE',sulfur:'SULFUR ORE',hqmetal:'HIGH QUALITY METAL ORE',fiber:'CLOTH FIBER',berries:'BERRIES'}", 'resource labels')
s=replace_once(s,"<button data-dev=\"resources\">GIVE RESOURCES</button><button data-dev=\"plan\">GIVE PLAN</button><button data-dev=\"spawn\">RESET POSITION</button>", "<button data-dev=\"fly\">FLY MODE</button><button data-dev=\"god\">GOD MODE</button><button data-dev=\"heal\">HEAL / VITALS</button><button data-dev=\"resources\">GIVE RESOURCES</button><button data-dev=\"plan\">GIVE PLAN</button><button data-dev=\"spawn\">RESET POSITION</button>", 'F3 dev buttons')
write(p,s)

p=Path('src/ui/style.css'); s=read(p)
s += "\n/* v0.7.4 save-browser navigation: explicit back affordance instead of an unlabeled ×. */\n.save-browser-back{width:auto!important;min-width:118px!important;padding:0 14px!important;display:flex!important;align-items:center;justify-content:center;gap:12px;font-weight:800;letter-spacing:.08em}.save-browser-back kbd{font-size:8px;opacity:.6;border:1px solid rgba(255,255,255,.18);padding:4px 6px}.telemetry-actions{flex-wrap:wrap}.telemetry-actions [data-dev=\"fly\"],.telemetry-actions [data-dev=\"god\"]{border-color:rgba(207,215,119,.42)}\n"
write(p,s)

# -----------------------------------------------------------------------------
# Version/history/readme
# -----------------------------------------------------------------------------
p=Path('src/config/version.ts'); s=read(p)
s=s.replace("GAME_VERSION='0.7.3'","GAME_VERSION='0.7.4'",1).replace("GAME_BUILD='EA-07.3'","GAME_BUILD='EA-07.4'",1)
entry="""  {version:'0.7.4',date:'2026-09-13',title:'Seeded world variety, loot & developer tools',changes:[
    'Added world generation 3 with deterministic seed-based starter shores and made blank New World creation generate a fresh random seed while preserving generation 1/2 saves.',
    'Added seeded rain collectors and sixteen scattered salvage crates with common, decent and rare lucky loot tiers.',
    'Added distinct stone, metal ore, sulfur ore and high-quality metal ore deposits with seeded random distribution and original procedural mineral styling.',
    'Removed the oversized relay scaffold and the visible world-space trail ribbon; map trails remain available only on the island survey.',
    'Replaced the timer-limited V-Sync OFF loop with a MessageChannel uncapped scheduler and added F3 Fly, God and Heal developer controls.',
    'Replaced the save-manager close glyph with an explicit Back control and made History/Help overlays close automatically when the screen changes.'
  ]},
"""
s=replace_once(s,"export const CHANGELOG:ChangeEntry[]=[\n","export const CHANGELOG:ChangeEntry[]=[\n"+entry,'history v074')
write(p,s)

p=Path('CHANGELOG.md'); s=read(p)
md="""## v0.7.4 / EA-07.4 — Seeded world variety, loot & developer tools (2026-09-13)

- Added generation 3 with deterministic seed-based starter spawn/clearing and fresh random seeds for blank New World creation. Existing generation 1/2 saves keep their old world layout.
- Added multiple seeded rain collectors plus sixteen scattered salvage crates with common, decent and rare lucky loot tables.
- Added distinct stone, metal ore, sulfur ore and high-quality metal ore deposits with random seed-driven distribution and original procedural mineral styling.
- Removed the oversized relay tower and the accidental-looking world-space trail ribbon; trails remain on the island map only.
- Replaced timer-based V-Sync OFF scheduling with a MessageChannel uncapped render submission loop.
- Added F3 Fly Mode, God Mode and Heal/Vitals development controls.
- Added an explicit Back button to save management and fixed History/Help overlays remaining visible after entering gameplay or Settings.

"""
write(p,md+s)

p=Path('README.md'); s=read(p)
s=s.replace('version-v0.7.3%20%7C%20EA--07.3','version-v0.7.4%20%7C%20EA--07.4',1)
s=s.replace('**Current release:** `v0.7.3 / EA-07.3` · **13 September 2026**','**Current release:** `v0.7.4 / EA-07.4` · **13 September 2026**',1)
s=s.replace('- Harvestable trees, stone, metal, fiber and berries','- Harvestable trees, stone, metal ore, sulfur ore, high-quality metal ore, fiber and berries',1)
s=s.replace('- Map, waypoints, diagnostics and developer telemetry','- Map, waypoints, diagnostics and developer telemetry with fly/god/vitals controls',1)
s=replace_once(s,'- ✅ Reliable multi-save confirmation controls, optional V-Sync/frame pacing and denser gatherable loose wood/berry resources','- ✅ Reliable multi-save confirmation controls, explicit Back navigation and auto-closing History overlays\n- ✅ Seed-driven generation 3 spawns, scattered rain collectors and tiered salvage crates\n- ✅ Stone, metal, sulfur and high-quality metal mineral node variants with seeded random distribution\n- ✅ Optional V-Sync/frame pacing with an uncapped OFF scheduler plus F3 fly/god/vitals tools\n- ✅ Denser gatherable loose wood/berry resources','README v074 focus')
write(p,s)

for name in ['package.json','package-lock.json']:
    p=Path(name); s=read(p); s=s.replace('"version": "0.7.3"','"version": "0.7.4"',2); write(p,s)

# -----------------------------------------------------------------------------
# Regression tests
# -----------------------------------------------------------------------------
Path('tests/v074-world-variety.test.ts').write_text(r'''import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import {IslandTerrain} from '../src/terrain/island';
import {GATHERING} from '../src/config/gameplay';
import {ITEMS} from '../src/items/definitions';
import {validateGameState} from '../src/save/storage';
import {GameSimulation} from '../src/simulation/GameSimulation';

describe('v0.7.4 seeded world variety',()=>{
  it('keeps generation 2 spawn stable but gives generation 3 seed-dependent spawn',()=>{
    const oldWorld=new IslandTerrain(731942,2),a=new IslandTerrain(731942,3),a2=new IslandTerrain(731942,3),b=new IslandTerrain(123456,3);
    expect({x:oldWorld.spawn.x,z:oldWorld.spawn.z}).toEqual({x:28,z:212});
    expect({x:a.spawn.x,z:a.spawn.z}).toEqual({x:a2.spawn.x,z:a2.spawn.z});
    expect(Math.hypot(a.spawn.x-b.spawn.x,a.spawn.z-b.spawn.z)).toBeGreaterThan(5);
    expect(a.spawn.y).toBeGreaterThan(2);
  });
  it('ships sulfur and high quality metal as gatherable resources',()=>{
    expect(GATHERING.sulfur.itemId).toBe('sulfurOre');expect(GATHERING.hqmetal.itemId).toBe('hqMetalOre');
    expect(ITEMS.sulfurOre.displayName).toBe('Sulfur ore');expect(ITEMS.hqMetalOre.displayName).toContain('High quality');
  });
  it('accepts generation 3 save snapshots',()=>{
    const sim=new GameSimulation(99,{x:0,y:5,z:0});expect(sim.state.worldGeneration).toBe(3);expect(validateGameState(sim.state)).toBe(true);
  });
  it('removes the world trail ribbon and giant relay tower while retaining map trail data',()=>{
    const source=fs.readFileSync('src/survival/WorldSurvival.ts','utf8');expect(source).not.toContain("private trail=new T.MeshStandardMaterial");expect(source).not.toContain('i*1.4');expect(source).toContain('Collapsed relay site');expect(source).toContain('this.trails.push(points)');expect(source).toContain('loot-field-');
  });
  it('uses a MessageChannel uncapped loop and closes menu overlays on screen change',()=>{
    const app=fs.readFileSync('src/app/GameApp.ts','utf8'),ui=fs.readFileSync('src/ui/UI.ts','utf8');expect(app).toContain('new MessageChannel()');expect(app).not.toContain('frameTimer=window.setTimeout');expect(app).toContain("if(action==='fly')");expect(ui).toContain("this.find('.history-panel').hidden = true");expect(ui).toContain('← BACK');
  });
});
''')

print('Tideland v0.7.4 patch applied')
