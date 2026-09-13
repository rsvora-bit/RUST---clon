from pathlib import Path
import json


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, count))

# Version / changelog / package metadata.
replace('src/config/version.ts', "export const GAME_VERSION='0.7.4';\nexport const GAME_BUILD='EA-07.4';", "export const GAME_VERSION='0.7.5';\nexport const GAME_BUILD='EA-07.5';")
replace('src/config/version.ts', "export const CHANGELOG:ChangeEntry[]=[\n", "export const CHANGELOG:ChangeEntry[]=[\n  {version:'0.7.5',date:'2026-09-13',title:'Expanded island, cleaner resource HUD & horizon pass',changes:[\n    'Added world generation 4 with a substantially larger irregular coastline, multiple separated hill/ridge systems and seed-dependent starter shores instead of one dominant central mound.',\n    'Reduced decorative boulder density on generation 4 and added spacing checks so trees, boulders and harvestable mineral nodes no longer spawn through one another.',\n    'Simplified hit-resource prompts to large resource names such as Metal Ore, Sulfur Ore and High Quality Metal Ore instead of the old GATHER/deposit/remaining block.',\n    'Expanded generation-4 vegetation and resource distribution farther toward the new coastline while keeping older save generations spatially unchanged.',\n    'Added an original procedural distant-mountain horizon backdrop plus an extra high cloud veil to give the ocean skyline more depth without copying external game assets.',\n    'Added persistent active-state highlighting for F3 Fly Mode and God Mode controls.'\n  ]},\n")
for name in ['package.json','package-lock.json']:
    p=Path(name);data=json.loads(p.read_text());data['version']='0.7.5'
    if name=='package-lock.json' and isinstance(data.get('packages'),dict) and '' in data['packages']:
        data['packages']['']['version']='0.7.5'
    p.write_text(json.dumps(data,indent=2)+"\n")

# Generation 4 save compatibility.
replace('src/core/types.ts', "worldGeneration?:1|2|3", "worldGeneration?:1|2|3|4", 2)
replace('src/save/storage.ts', "value.worldGeneration !== 1 && value.worldGeneration !== 2 && value.worldGeneration !== 3", "value.worldGeneration !== 1 && value.worldGeneration !== 2 && value.worldGeneration !== 3 && value.worldGeneration !== 4")
replace('src/simulation/GameSimulation.ts', "version: 1, worldGeneration: 3, seed, elapsed: 0, timeOfDay: SURVIVAL.START_HOUR,", "version: 1, worldGeneration: 4, seed, elapsed: 0, timeOfDay: SURVIVAL.START_HOUR,")
replace('src/simulation/GameSimulation.ts', "if (['tree', 'stone', 'metal'].includes(node.kind)", "if (['tree', 'stone', 'metal', 'sulfur', 'hqmetal'].includes(node.kind)")

# Short Rust-like resource names.
replace('src/config/gameplay.ts', "label: 'Stone deposit'", "label: 'Stone'")
replace('src/config/gameplay.ts', "label: 'Metal ore deposit'", "label: 'Metal Ore'")
replace('src/config/gameplay.ts', "label: 'Sulfur ore deposit'", "label: 'Sulfur Ore'")
replace('src/config/gameplay.ts', "label: 'High quality metal deposit'", "label: 'High Quality Metal Ore'")

# Generation 4 terrain: larger, irregular coast and several separated uplands.
p=Path('src/terrain/island.ts');s=p.read_text()
s=s.replace("constructor(seed:number,readonly generation:1|2|3=3){", "constructor(seed:number,readonly generation:1|2|3|4=4){")
s=s.replace("if(generation>=3){const rand=randomSource(seed+0x31a7),angle=rand()*Math.PI*2,radius=174+rand()*34;this.spawn={x:Math.cos(angle)*radius,y:6.1,z:Math.sin(angle)*radius};}", "if(generation>=3){const rand=randomSource(seed+0x31a7),angle=rand()*Math.PI*2,radius=generation>=4?238+rand()*28:174+rand()*34;this.spawn={x:Math.cos(angle)*radius,y:6.1,z:Math.sin(angle)*radius};}")
s=s.replace("    const base=this.geologicalHeight(x,z);\n    if(this.generation===2)return base;\n    const starter=1-smoothstep(13,35,Math.hypot(x-this.spawn.x,z-this.spawn.z));\n    return base*(1-starter)+4.3*starter;", "    const base=this.generation>=4?this.expandedHeight(x,z):this.geologicalHeight(x,z);\n    if(this.generation===2)return base;\n    const starter=1-smoothstep(13,35,Math.hypot(x-this.spawn.x,z-this.spawn.z));\n    return base*(1-starter)+4.3*starter;")
anchor="  /** Triangle interpolation is identical to the indexed Rapier ground mesh. */\n"
expanded="""  /** Generation 4 spreads elevation across several ridges and uses a warped,
   * lobed coastline so the island reads as a broad landmass rather than a
   * near-perfect circle with one mountain in the middle. */
  private expandedHeight(x:number,z:number):number {
    const n=this.noise;
    const wx=x+(n.fbm(x*.0043+7,z*.0043-13,3)-.5)*84;
    const wz=z+(n.fbm(x*.0043-21,z*.0043+9,3)-.5)*70;
    const angle=Math.atan2(wz,wx),radius=Math.hypot(wx/1.035,wz/.965);
    const coastNoise=(n.fbm(Math.cos(angle)*1.55+31,Math.sin(angle)*1.55-17,3)-.5)*48;
    const edge=319+Math.sin(angle*2+.6)*31+Math.sin(angle*5-1.15)*17+Math.sin(angle*9+.4)*7+coastNoise-radius;
    let h=-12+14.2*smoothstep(-38,22,edge)+3.9*smoothstep(12,96,edge);
    const land=smoothstep(20,112,edge);
    const ridgeWest=Math.exp(-Math.pow((wx*.78+wz*.24+104)/67,2)-Math.pow((wz+55)/178,2));
    const ridgeNorth=Math.exp(-Math.pow((wx-18)/142,2)-Math.pow((wz+178)/62,2));
    const ridgeEast=Math.exp(-Math.pow((wx-151)/74,2)-Math.pow((wz-24)/128,2));
    const southHills=Math.exp(-Math.pow((wx+34)/155,2)-Math.pow((wz-146)/80,2));
    const centralValley=Math.exp(-Math.pow((wx+5)/86,2)-Math.pow((wz+3)/108,2));
    const folded=n.fbm(wx*.013+5,wz*.012-7,4),detail=n.fbm(wx*.031-11,wz*.028+4,3);
    h+=(ridgeWest*(22+folded*18)+ridgeNorth*(18+folded*16)+ridgeEast*(24+detail*14)+southHills*(9+folded*8)-centralValley*8.5)*land;
    h+=(folded-.48)*8.5*land+(detail-.5)*3.2*smoothstep(8,70,edge);
    return h;
  }

"""
if anchor not in s: raise SystemExit('missing island insertion anchor')
s=s.replace(anchor,expanded+anchor,1)
s=s.replace("forestAt(x:number,z:number):number{if(this.generation===2)return (this.noise.fbm(x*.007+8,z*.007+11,3)*.78+this.noise.at(x*.039,z*.039)*.22)*(1-smoothstep(38,57,this.heightAt(x,z)));return this.noise.fbm(x*.018+8,z*.018+11,3)*(1-smoothstep(26,43,this.heightAt(x,z)));}", "forestAt(x:number,z:number):number{if(this.generation===2)return (this.noise.fbm(x*.007+8,z*.007+11,3)*.78+this.noise.at(x*.039,z*.039)*.22)*(1-smoothstep(38,57,this.heightAt(x,z)));if(this.generation>=4)return (this.noise.fbm(x*.011+8,z*.011+11,4)*.82+this.noise.at(x*.031,z*.031)*.18)*(1-smoothstep(34,50,this.heightAt(x,z)));return this.noise.fbm(x*.018+8,z*.018+11,3)*(1-smoothstep(26,43,this.heightAt(x,z)));}")
p.write_text(s)

# Environment: generation 4 ranges, fewer rocks, overlap rejection, and clearer ore tones.
p=Path('src/rendering/environment.ts');s=p.read_text()
s=s.replace("constructor(readonly scene:THREE.Scene,readonly seed:number,worldGeneration:1|2|3=3,deferPopulation=false)", "constructor(readonly scene:THREE.Scene,readonly seed:number,worldGeneration:1|2|3|4=4,deferPopulation=false)")
s=s.replace("this.stone=stoneMaterial(0xd5d0bf);this.metal=stoneMaterial(0x766d63);this.sulfur=stoneMaterial(0xa9a45d);this.hqmetal=stoneMaterial(0x59666a);", "this.stone=stoneMaterial(0xd5d0bf);this.metal=stoneMaterial(0x8b7567);this.sulfur=stoneMaterial(0xb7a74a);this.hqmetal=stoneMaterial(0x65757d);")
s=s.replace("const modern=this.terrain.generation===2;\n    for(let i=0;i<(modern?12000:7000)&&treeNodes.length<(modern?820:560);i++){\n      const x=(rand()-.5)*580,z=(rand()-.5)*580", "const modern=this.terrain.generation===2,expanded=this.terrain.generation>=4;\n    for(let i=0;i<(expanded?9000:modern?12000:7000)&&treeNodes.length<(expanded?620:modern?820:560);i++){\n      const span=expanded?650:580,x=(rand()-.5)*span,z=(rand()-.5)*span")
old_rocks="""    const anchors=this.terrain.generation>=3
      ? [[this.spawn.x-31,this.spawn.z-26,6,5.8,4.6],[this.spawn.x-38,this.spawn.z-22,4.2,3.4,3.7],[this.spawn.x+37,this.spawn.z-25,6.5,6,5]] as const
      : [[-3,185,6,5.8,4.6],[-10,183,4.2,3.4,3.7],[68,180,6.5,6,5]] as const;
    for(const [x,z,sx,sy,sz] of anchors)boulders.push({x,y:this.heightAt(x,z)-.1,z,sx,sy,sz,rot:rand()*6.28,variant:Math.floor(rand()*3)});
    for(let i=0;i<950;i++){
      const x=(rand()-.5)*570,z=(rand()-.5)*570,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
      if(h<.7||Math.hypot(x-this.spawn.x,z-this.spawn.z)<20)continue;
      const rocky=h>22||slope>.44;if(rand()>(rocky?.62:.10))continue;
      const size=rocky?1.8+rand()*5:.7+rand()*1.8;boulders.push({x,y:h-size*.12,z,sx:size*(.8+rand()*.5),sy:size*(.7+rand()*.55),sz:size*(.8+rand()*.5),rot:rand()*6.28,variant:Math.floor(rand()*3)});
    }
"""
new_rocks="""    const anchors=this.terrain.generation>=4
      ? [[this.spawn.x-31,this.spawn.z-24,3.7,3.2,3.4],[this.spawn.x+34,this.spawn.z-27,4.1,3.6,3.9]] as const
      : this.terrain.generation>=3
        ? [[this.spawn.x-31,this.spawn.z-26,6,5.8,4.6],[this.spawn.x-38,this.spawn.z-22,4.2,3.4,3.7],[this.spawn.x+37,this.spawn.z-25,6.5,6,5]] as const
        : [[-3,185,6,5.8,4.6],[-10,183,4.2,3.4,3.7],[68,180,6.5,6,5]] as const;
    for(const [x,z,sx,sy,sz] of anchors)boulders.push({x,y:this.heightAt(x,z)-.1,z,sx,sy,sz,rot:rand()*6.28,variant:Math.floor(rand()*3)});
    if(this.terrain.generation>=4){
      for(let i=0;i<1800&&boulders.length<150;i++){
        const x=(rand()-.5)*650,z=(rand()-.5)*650,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
        if(h<.7||Math.hypot(x-this.spawn.x,z-this.spawn.z)<22)continue;
        if(this.nodes.some(n=>n.kind==='tree'&&Math.hypot(n.position.x-x,n.position.z-z)<4.8))continue;
        if(boulders.some(b=>Math.hypot(b.x-x,b.z-z)<3.1))continue;
        const rocky=h>24||slope>.47;if(rand()>(rocky?.22:.035))continue;
        const size=rocky?1.25+rand()*3.8:.65+rand()*1.45;boulders.push({x,y:h-size*.12,z,sx:size*(.8+rand()*.45),sy:size*(.7+rand()*.48),sz:size*(.8+rand()*.45),rot:rand()*6.28,variant:Math.floor(rand()*3)});
      }
    }else for(let i=0;i<950;i++){
      const x=(rand()-.5)*570,z=(rand()-.5)*570,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);
      if(h<.7||Math.hypot(x-this.spawn.x,z-this.spawn.z)<20)continue;
      const rocky=h>22||slope>.44;if(rand()>(rocky?.62:.10))continue;
      const size=rocky?1.8+rand()*5:.7+rand()*1.8;boulders.push({x,y:h-size*.12,z,sx:size*(.8+rand()*.5),sy:size*(.7+rand()*.55),sz:size*(.8+rand()*.5),rot:rand()*6.28,variant:Math.floor(rand()*3)});
    }
"""
if old_rocks not in s: raise SystemExit('missing rock generation anchor')
s=s.replace(old_rocks,new_rocks,1)
old_nodes="""    if(this.terrain.generation>=3){make('stone',this.spawn.x+10,this.spawn.z-10,.95);make('stone',this.spawn.x-13,this.spawn.z-8,1.08);make('metal',this.spawn.x+18,this.spawn.z+12,1.05);}
    else {make('stone',24,206,.95);make('stone',35,199,1.1);make('metal',60,175,1.1);}
    for(let i=0,count=0;i<3600&&count<155;i++){
      const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z);if(h<2.1||Math.hypot(x-this.spawn.x,z-this.spawn.z)<17||this.terrain.slopeAt(x,z)>.9)continue;
      if(rand()>(h>20?.72:.31))continue;const roll=rand(),kind=roll<.57?'stone':roll<.80?'metal':roll<.95?'sulfur':'hqmetal';make(kind,x,z,.8+rand()*.65);count++;
    }
"""
new_nodes="""    if(this.terrain.generation>=3){make('stone',this.spawn.x+10,this.spawn.z-10,.95);make('stone',this.spawn.x-13,this.spawn.z-8,1.08);make('metal',this.spawn.x+16,this.spawn.z+11,1.02);}
    else {make('stone',24,206,.95);make('stone',35,199,1.1);make('metal',60,175,1.1);}
    if(this.terrain.generation>=4){
      for(let i=0,count=0;i<4400&&count<92;i++){
        const x=(rand()-.5)*640,z=(rand()-.5)*640,h=this.heightAt(x,z);if(h<2.1||Math.hypot(x-this.spawn.x,z-this.spawn.z)<18||this.terrain.slopeAt(x,z)>.82)continue;
        if(this.nodes.some(n=>n.kind==='tree'&&Math.hypot(n.position.x-x,n.position.z-z)<4.6))continue;
        if(boulders.some(b=>Math.hypot(b.x-x,b.z-z)<3.5))continue;
        if(rand()>(h>20?.45:.19))continue;const roll=rand(),kind=roll<.48?'stone':roll<.76?'metal':roll<.94?'sulfur':'hqmetal';make(kind,x,z,.82+rand()*.58);count++;
      }
    }else for(let i=0,count=0;i<3600&&count<155;i++){
      const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z);if(h<2.1||Math.hypot(x-this.spawn.x,z-this.spawn.z)<17||this.terrain.slopeAt(x,z)>.9)continue;
      if(rand()>(h>20?.72:.31))continue;const roll=rand(),kind=roll<.57?'stone':roll<.80?'metal':roll<.95?'sulfur':'hqmetal';make(kind,x,z,.8+rand()*.65);count++;
    }
"""
if old_nodes not in s: raise SystemExit('missing mineral generation anchor')
s=s.replace(old_nodes,new_nodes,1)
# Expand distribution only for generation 4; older generation random streams remain unchanged.
s=s.replace("const x=(rand()-.5)*570,z=(rand()-.5)*570,h=this.heightAt(x,z);if(h<3||h>28", "const span=this.terrain.generation>=4?650:570,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z);if(h<3||h>28",1)
s=s.replace("const x=(rand()-.5)*520,z=(rand()-.5)*520,h=this.heightAt(x,z);if(h<2.3", "const span=this.terrain.generation>=4?640:520,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z);if(h<2.3",1)
s=s.replace("const x=(rand()-.5)*550,z=(rand()-.5)*550,h=this.heightAt(x,z),slope", "const span=this.terrain.generation>=4?640:550,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope",1)
s=s.replace("const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z),slope", "const span=this.terrain.generation>=4?640:540,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z),slope",1)
s=s.replace("const x=(rand()-.5)*590,z=(rand()-.5)*590,h=this.heightAt(x,z);", "const span=this.terrain.generation>=4?670:590,x=(rand()-.5)*span,z=(rand()-.5)*span,h=this.heightAt(x,z);",1)
s=s.replace("const near=count<2800,x=near?this.spawn.x+(rand()-.5)*85:(rand()-.5)*560,z=near?this.spawn.z+(rand()-.5)*85:(rand()-.5)*560;", "const near=count<2800,span=this.terrain.generation>=4?650:560,x=near?this.spawn.x+(rand()-.5)*85:(rand()-.5)*span,z=near?this.spawn.z+(rand()-.5)*85:(rand()-.5)*span;")
p.write_text(s)

# World landmarks/loot use the expanded generation-4 footprint.
p=Path('src/survival/WorldSurvival.ts');s=p.read_text()
s=s.replace("const angle=k*Math.PI/2+.5+(rand()-.5)*.38;for(let i=0;i<2100;i++){const a=angle+Math.sin(i*2.31+seed)*.67,r=82+(i%175);", "const angle=k*Math.PI/2+.5+(rand()-.5)*.38;for(let i=0;i<2100;i++){const a=angle+Math.sin(i*2.31+seed)*.67,r=env.terrain.generation>=4?96+(i%215):82+(i%175);")
s=s.replace("const x=(rand()-.5)*530,z=(rand()-.5)*530,y=this.env.heightAt(x,z);", "const span=this.env.terrain.generation>=4?640:530,x=(rand()-.5)*span,z=(rand()-.5)*span,y=this.env.heightAt(x,z);")
p.write_text(s)

# Atmosphere: original procedural horizon mountains + extra high cloud veil.
p=Path('src/world/atmosphere.ts');s=p.read_text()
s=s.replace("  readonly fog=new THREE.FogExp2(0xb1c6cf,.00145);", "  readonly fog=new THREE.FogExp2(0xb1c6cf,.00145);\n  readonly horizon=new THREE.Group();private horizonGeometries:THREE.BufferGeometry[]=[];private horizonMaterials:THREE.Material[]=[];")
s=s.replace("vec3 horizon=mix(vec3(.045,.065,.115),vec3(.54,.69,.76),daylight);vec3 zenith=mix(vec3(.008,.015,.048),vec3(.095,.31,.62),daylight);", "vec3 horizon=mix(vec3(.045,.065,.115),vec3(.49,.70,.84),daylight);vec3 zenith=mix(vec3(.008,.015,.048),vec3(.075,.31,.69),daylight);")
s=s.replace("float stars=step(.9987,hash(floor(d.xz/max(.055,d.y)*620.)))*smoothstep(.045,.4,d.y)*(1.-daylight);col+=stars*vec3(.62,.72,.95);gl_FragColor=vec4(col,1.);", "float wisps=smoothstep(.57,.73,fbm(baseUv*.25-drift*.35+vec2(73.,-41.)))*smoothstep(.06,.35,d.y)*(1.-smoothstep(.62,.92,d.y));col=mix(col,vec3(.93,.97,1.),wisps*.19*daylight*(1.-weather*.55));float stars=step(.9987,hash(floor(d.xz/max(.055,d.y)*620.)))*smoothstep(.045,.4,d.y)*(1.-daylight);col+=stars*vec3(.62,.72,.95);gl_FragColor=vec4(col,1.);")
s=s.replace("    this.sky.frustumCulled=false;this.sky.renderOrder=-10;scene.add(this.sky);", "    this.sky.frustumCulled=false;this.sky.renderOrder=-10;scene.add(this.sky);this.buildHorizon();scene.add(this.horizon);")
insert="""  private buildHorizon():void{
    const ring=(radius:number,segments:number,phase:number,height:number,color:number,opacity:number)=>{
      const vertices:number[]=[],indices:number[]=[];
      for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=radius+Math.sin(a*5+phase)*22+Math.sin(a*11-phase)*9,peak=22+height*(.30+.48*Math.pow(Math.max(0,Math.sin(a*3.0+phase)),2)+.28*Math.pow(Math.max(0,Math.sin(a*7.0-phase*.7)),4));vertices.push(Math.cos(a)*r,-92,Math.sin(a)*r,Math.cos(a)*r,peak,Math.sin(a)*r);}
      for(let i=0;i<segments;i++){const b=i*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,fog:true});const mesh=new THREE.Mesh(g,m);mesh.renderOrder=-5;this.horizon.add(mesh);this.horizonGeometries.push(g);this.horizonMaterials.push(m);
    };
    ring(830,128,.8,112,0x668297,.52);ring(1080,144,2.15,175,0x8299a8,.34);
  }

"""
marker="  update(dt:number,time:number,camera:THREE.Vector3):void{\n"
if marker not in s: raise SystemExit('missing atmosphere update anchor')
s=s.replace(marker,insert+marker,1)
s=s.replace("this.sky.position.copy(camera);", "this.sky.position.copy(camera);this.horizon.position.set(camera.x,camera.y-28,camera.z);")
s=s.replace("dispose():void{this.sky.geometry.dispose();this.sky.material.dispose();this.ocean.geometry.dispose();this.ocean.material.dispose();this.scene.remove(this.sky,this.ocean,this.sun,this.sun.target,this.fill);this.sun.shadow.map?.dispose();}", "dispose():void{this.sky.geometry.dispose();this.sky.material.dispose();this.ocean.geometry.dispose();this.ocean.material.dispose();for(const g of this.horizonGeometries)g.dispose();for(const m of this.horizonMaterials)m.dispose();this.scene.remove(this.sky,this.horizon,this.ocean,this.sun,this.sun.target,this.fill);this.sun.shadow.map?.dispose();}")
p.write_text(s)

# Gameplay prompt, generation selection and dev active state.
p=Path('src/app/GameApp.ts');s=p.read_text()
s=s.replace("saved ? saved.worldGeneration ?? 1 : 3,true", "saved ? saved.worldGeneration ?? 1 : 4,true")
old="""  private registerNodes(){
    for(const node of this.environment.nodes){const object=this.environment.nodeObjects.get(node.id);if(!object)continue;
      this.interactions.register({id:node.id,kind:'resource',object,position:()=>node.position,enabled:()=>node.remaining>0,info:()=>({title:GATHERING[node.kind].label,action:['fiber','berries','wood'].includes(node.kind)?'PICK UP':'GATHER',key:['fiber','berries','wood'].includes(node.kind)?keyLabel(this.settings.keybinds.interact):'LMB',detail:`${ITEMS[GATHERING[node.kind].itemId].displayName.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`,progress:node.remaining/node.capacity}),interact:()=>this.gather(node,true,this.resourceStrike(node,object))});
    }
  }
"""
new="""  private registerNodes(){
    for(const node of this.environment.nodes){const object=this.environment.nodeObjects.get(node.id);if(!object)continue;const pickup=['fiber','berries','wood'].includes(node.kind);
      this.interactions.register({id:node.id,kind:'resource',object,position:()=>node.position,enabled:()=>node.remaining>0,info:()=>pickup?{title:GATHERING[node.kind].label,action:'PICK UP',key:keyLabel(this.settings.keybinds.interact),detail:`${ITEMS[GATHERING[node.kind].itemId].displayName.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`,progress:node.remaining/node.capacity}:{title:GATHERING[node.kind].label,action:'',key:''},interact:()=>this.gather(node,true,this.resourceStrike(node,object))});
    }
  }
"""
if old not in s: raise SystemExit('missing registerNodes anchor')
s=s.replace(old,new,1)
s=s.replace("if(action==='fly'){this.flyMode=!this.flyMode;this.ui.notify(`Fly mode ${this.flyMode?'ON':'OFF'} · WASD + Space/Crouch · Shift fast`);}if(action==='god'){this.godMode=!this.godMode;this.ui.notify(`God mode ${this.godMode?'ON':'OFF'}`);}", "if(action==='fly'){this.flyMode=!this.flyMode;this.ui.notify(`Fly mode ${this.flyMode?'ON':'OFF'} · WASD + Space/Crouch · Shift fast`);}if(action==='god'){this.godMode=!this.godMode;this.ui.notify(`God mode ${this.godMode?'ON':'OFF'}`);}this.ui.setDevModes(this.flyMode,this.godMode);")
p.write_text(s)

# UI: name-only resource targeting and highlighted dev toggles.
p=Path('src/ui/UI.ts');s=p.read_text()
old="""      const promptHTML = interaction ? `<span class=\"interaction-key\"><kbd>${esc(interaction.key)}</kbd></span><div class=\"interaction-copy\"><strong>${esc(this.interactionAction(interaction.action))}</strong><span>${esc(interaction.title)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class=\"interaction-progress\" style=\"width:${interaction.progress*100}%\"></i>` : ''}</div>` : '';
      const prompt = this.find('.interaction-prompt');
      if(prompt.innerHTML !== promptHTML) prompt.innerHTML = promptHTML;
"""
new="""      const nameOnly=Boolean(interaction&&!interaction.action);
      const promptHTML = interaction ? nameOnly?`<div class=\"interaction-copy resource-name-only\"><strong>${esc(interaction.title)}</strong></div>`:`<span class=\"interaction-key\"><kbd>${esc(interaction.key)}</kbd></span><div class=\"interaction-copy\"><strong>${esc(this.interactionAction(interaction.action))}</strong><span>${esc(interaction.title)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class=\"interaction-progress\" style=\"width:${interaction.progress*100}%\"></i>` : ''}</div>` : '';
      const prompt = this.find('.interaction-prompt');prompt.classList.toggle('resource-target',nameOnly);
      if(prompt.innerHTML !== promptHTML) prompt.innerHTML = promptHTML;
"""
if old not in s: raise SystemExit('missing interaction prompt UI anchor')
s=s.replace(old,new,1)
method="""  setDevModes(fly:boolean,god:boolean):void{for(const [mode,on] of [['fly',fly],['god',god]] as const){const button=this.root.querySelector<HTMLButtonElement>(`[data-dev=\"${mode}\"]`);if(!button)continue;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));}}

"""
anchor="  private renderHotbar(hud: HUDData): void {\n"
if anchor not in s: raise SystemExit('missing UI dev method anchor')
s=s.replace(anchor,method+anchor,1)
p.write_text(s)

# Styling for larger clean resource label and clear ON states.
p=Path('src/ui/style.css');s=p.read_text()
s += """

/* v0.7.5: minimal hit-resource target label and persistent developer toggle state. */
.interaction-prompt.resource-target{top:calc(50% + 31px);gap:0;text-align:center;filter:drop-shadow(0 2px 7px rgba(0,0,0,.65))}
.interaction-prompt.resource-target .resource-name-only strong{font-size:28px;line-height:1;font-weight:700;letter-spacing:.055em;text-transform:uppercase;color:#f2eedb;text-shadow:0 2px 9px #07170bdd}
.telemetry-actions button.active{position:relative;background:linear-gradient(180deg,rgba(171,190,92,.30),rgba(92,112,52,.24));border-color:rgba(218,232,126,.88)!important;color:#eff7b0;box-shadow:inset 0 0 0 1px rgba(220,235,137,.14),0 0 15px rgba(183,206,91,.10)}
.telemetry-actions button.active:after{content:'ON';margin-left:6px;color:#ddeb82;font-size:6px;letter-spacing:.12em}
"""
p.write_text(s)

# Lightweight regression coverage (no node:fs so tsc build stays browser-only).
Path('tests/v075-world-shape-ui.test.ts').write_text("""import {describe,it,expect} from 'vitest';
import {IslandTerrain} from '../src/terrain/island';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {GATHERING} from '../src/config/gameplay';

describe('v0.7.5 expanded world and resource labels',()=>{
  it('records generation 4 on new worlds and keeps the terrain deterministic',()=>{
    const a=new IslandTerrain(445152874,4),b=new IslandTerrain(445152874,4);
    const state=new GameSimulation(445152874,a.spawn).state;
    expect(state.worldGeneration).toBe(4);
    expect(a.heights).toEqual(b.heights);
    const samples=[0,Math.PI/4,Math.PI/2,Math.PI*3/4,Math.PI,Math.PI*5/4,Math.PI*3/2,Math.PI*7/4].map(angle=>a.heightAt(Math.cos(angle)*300,Math.sin(angle)*300));
    expect(Math.max(...samples)-Math.min(...samples)).toBeGreaterThan(2);
    a.geometry.dispose();a.heightTexture.dispose();b.geometry.dispose();b.heightTexture.dispose();
  });
  it('uses concise mineral target names',()=>{
    expect(GATHERING.stone.label).toBe('Stone');
    expect(GATHERING.metal.label).toBe('Metal Ore');
    expect(GATHERING.sulfur.label).toBe('Sulfur Ore');
    expect(GATHERING.hqmetal.label).toBe('High Quality Metal Ore');
  });
});
""")

print('Tideland v0.7.5 patch applied')
