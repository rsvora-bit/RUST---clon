from pathlib import Path
import json,re

ROOT=Path('.')

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def replace_once(text,old,new,label):
    if old not in text: raise SystemExit(f'missing target: {label}')
    return text.replace(old,new,1)
def sub_once(text,pattern,repl,label,flags=0):
    out,n=re.subn(pattern,repl,text,count=1,flags=flags)
    if n!=1: raise SystemExit(f'expected one match for {label}, got {n}')
    return out

# --- Environment: progressive construction + reliable depletion + falling trees ---
p='src/rendering/environment.ts'; s=read(p)
s=replace_once(s,
"type GrassChunk={mesh:THREE.InstancedMesh;center:THREE.Vector3;fullCount:number};",
"type GrassChunk={mesh:THREE.InstancedMesh;center:THREE.Vector3;fullCount:number};\ntype TreeFall={elapsed:number;duration:number;hold:number;fade:number;axis:THREE.Vector3;refs:InstanceRef[];node:ResourceNode};",
'environment TreeFall type')
s=replace_once(s,
"  private readonly hits=new Map<string,number>();\n  private readonly grassCoveredBy=new Set<string>();",
"  private readonly hits=new Map<string,number>();\n  private readonly fallingTrees=new Map<string,TreeFall>();\n  private populated=false;\n  private readonly grassCoveredBy=new Set<string>();",
'environment fields')
s=replace_once(s,
"  constructor(readonly scene:THREE.Scene,readonly seed:number,worldGeneration:1|2=2){",
"  constructor(readonly scene:THREE.Scene,readonly seed:number,worldGeneration:1|2=2,deferPopulation=false){",
'environment constructor signature')
s=replace_once(s,
"    this.populateTrees();this.populateRocks();this.populatePlants();this.populateGrass();this.populateShore();this.setQuality('high');this.update(0,9.4,new THREE.Vector3(this.spawn.x,this.spawn.y,this.spawn.z));\n  }\n  heightAt",
"    if(!deferPopulation)this.populateNow();\n  }\n  private populateNow():void {\n    if(this.populated)return;\n    this.populateTrees();this.populateRocks();this.populatePlants();this.populateGrass();this.populateShore();this.setQuality('high');this.update(0,9.4,new THREE.Vector3(this.spawn.x,this.spawn.y,this.spawn.z));this.populated=true;\n  }\n  async populateAsync(stage:(progress:number,status:string,detail?:string)=>Promise<void>):Promise<void> {\n    if(this.populated)return;\n    await stage(24,'Growing coastal forest','Placing harvestable trees and preparing canopy batches');this.populateTrees();\n    await stage(36,'Scattering rock fields','Building stone outcrops and metal deposits');this.populateRocks();\n    await stage(48,'Planting ground resources','Adding fiber, berries and shoreline pickups');this.populatePlants();\n    await stage(57,'Seeding windblown grass','Preparing vegetation chunks and distance culling');this.populateGrass();\n    await stage(63,'Finishing the shoreline','Placing coastal detail and natural cover');this.populateShore();\n    this.setQuality('high');this.update(0,9.4,new THREE.Vector3(this.spawn.x,this.spawn.y,this.spawn.z));this.populated=true;\n    await stage(65,'World vegetation ready','Terrain resources are ready for gameplay systems');\n  }\n  heightAt",
'environment deferred population')
s=sub_once(s,
r"  syncNodes\(nodeChanges:Record<string,number>\):void \{\n    for\(const node of this\.nodes\)\{.*?\n  \}\n  hitNode\(id:string\):void \{this\.hits\.set\(id,0\);\}",
"""  syncNodes(nodeChanges:Record<string,number>):void {
    for(const node of this.nodes){
      const remaining=nodeChanges[node.id]??node.remaining;node.remaining=remaining;
      if(remaining>0)continue;
      const obj=this.nodeObjects.get(node.id);if(obj)obj.visible=false;
      const refs=this.instances.get(node.id),falling=this.fallingTrees.has(node.id);
      if(refs&&!falling)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,this.hiddenMatrix);ref.mesh.instanceMatrix.needsUpdate=true;}
      this.hits.delete(node.id);
    }
  }
  hitNode(id:string):void {this.hits.set(id,0);}
  fallTree(id:string,source:Vec3):void {
    const node=this.nodes.find(n=>n.id===id),refs=this.instances.get(id);if(!node||node.kind!=='tree'||!refs||this.fallingTrees.has(id))return;
    this.hits.delete(id);const dx=node.position.x-source.x,dz=node.position.z-source.z,len=Math.hypot(dx,dz)||1;
    const awayX=dx/len,awayZ=dz/len,axis=new THREE.Vector3(-awayZ,0,awayX).normalize();
    this.fallingTrees.set(id,{elapsed:0,duration:1.05,hold:.8,fade:.55,axis,refs,node});
  }""",
'environment sync/fall',flags=re.S)
marker="""    for(const [id,t] of this.hits){const elapsed=t+dt,obj=this.nodeObjects.get(id),refs=this.instances.get(id);if(elapsed>.35){this.hits.delete(id);if(obj)obj.rotation.z=0;if(refs)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}else{this.hits.set(id,elapsed);const amount=Math.sin(elapsed*32)*(1-elapsed/.35)*.016;if(obj)obj.rotation.z=amount;if(refs)for(const ref of refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.rotation.z=amount;this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}}\n  }\n  setQuality"""
replacement="""    for(const [id,t] of this.hits){const elapsed=t+dt,obj=this.nodeObjects.get(id),refs=this.instances.get(id);if(elapsed>.35){this.hits.delete(id);if(obj)obj.rotation.z=0;if(refs)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}else{this.hits.set(id,elapsed);const amount=Math.sin(elapsed*32)*(1-elapsed/.35)*.016;if(obj)obj.rotation.z=amount;if(refs)for(const ref of refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.rotation.z=amount;this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}}
    for(const [id,fall] of this.fallingTrees){
      fall.elapsed+=dt;const fallT=Math.min(1,fall.elapsed/fall.duration),eased=1-Math.pow(1-fallT,3),fadeStart=fall.duration+fall.hold,total=fadeStart+fall.fade;
      if(fall.elapsed>=total){for(const ref of fall.refs){ref.mesh.setMatrixAt(ref.index,this.hiddenMatrix);ref.mesh.instanceMatrix.needsUpdate=true;}this.fallingTrees.delete(id);continue;}
      const fadeT=fall.elapsed>fadeStart?Math.min(1,(fall.elapsed-fadeStart)/fall.fade):0,scale=1-fadeT*.92,sink=fadeT*1.15*fall.node.scale;
      const fallRotation=new THREE.Quaternion().setFromAxisAngle(fall.axis,eased*Math.PI*.49);
      for(const ref of fall.refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.quaternion.premultiply(fallRotation);this.matrixDummy.position.y-=sink;this.matrixDummy.scale.multiplyScalar(scale);this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}
    }
  }
  setQuality"""
s=replace_once(s,marker,replacement,'environment fall update')
write(p,s)

# --- GameApp: granular loading, actual async yields, warm-up stabilization, tree depletion animation ---
p='src/app/GameApp.ts'; s=read(p)
s=replace_once(s,
"  async init(){this.ui.setLoading(true);await this.loadingStage(5,'Starting physics');await initPhysics();await this.loadingStage(12,'Preparing procedural island');await this.makeWorld(WORLD.SEED);await this.warmUpWorld();this.activeWorld=false;this.ui.setLoading(false);this.setScreen('menu');this.installDevAPI();this.renderer.setAnimationLoop(t=>this.frame(t));}",
"  async init(){this.ui.setLoading(true);await this.loadingStage(3,'Bootstrapping renderer','Creating the WebGL pipeline and interface');await this.loadingStage(8,'Starting physics engine','Loading Rapier and preparing collision workers');await initPhysics();await this.loadingStage(13,'Preparing preview island','Generating a ready-to-play world behind the main menu');await this.makeWorld(WORLD.SEED);await this.warmUpWorld();this.activeWorld=false;this.ui.setLoading(false);this.setScreen('menu');this.installDevAPI();this.renderer.setAnimationLoop(t=>this.frame(t));}",
'GameApp init loading')
s=replace_once(s,
"    await this.loadingStage(20,'Shaping terrain');\n    this.environment=new Environment(this.scene,seed,saved ? saved.worldGeneration ?? 1 : 2);\n    this.simulation=new GameSimulation(seed,this.environment.spawn,saved);this.simulation.onNotify=msg=>this.ui.notify(msg);\n    this.environment.syncNodes(this.simulation.state.nodeChanges);\n    await this.loadingStage(42,'Placing resources');\n    this.physics=new PhysicsWorld(this.environment.terrainGeometry,this.environment.colliders,this.simulation.state.player.position);\n    await this.loadingStage(56,'Building collision world');",
"    await this.loadingStage(17,'Shaping terrain heightfield','Generating beaches, valleys, slopes and the player spawn');\n    this.environment=new Environment(this.scene,seed,saved ? saved.worldGeneration ?? 1 : 2,true);\n    await this.environment.populateAsync((progress,status,detail)=>this.loadingStage(progress,status,detail));\n    this.simulation=new GameSimulation(seed,this.environment.spawn,saved);this.simulation.onNotify=msg=>this.ui.notify(msg);\n    await this.loadingStage(68,'Restoring resource state','Applying depleted nodes and saved world mutations');this.environment.syncNodes(this.simulation.state.nodeChanges);\n    await this.loadingStage(72,'Building collision world','Creating terrain, resource and natural obstacle colliders');\n    this.physics=new PhysicsWorld(this.environment.terrainGeometry,this.environment.colliders,this.simulation.state.player.position);\n    await this.loadingStage(76,'Synchronizing physics','Removing depleted colliders and preparing the player body');",
'GameApp makeWorld early stages')
s=replace_once(s,
"    this.player=new PlayerController(this.physics,this.camera,this.input,this.settings,this.simulation.state);this.player.onStep=()=>this.audio.play('step');\n    this.worldSurvival=new WorldSurvival(this.environment,this.scene,seed);this.worldSurvival.populate(this.simulation.state);this.physics.setStructure('landmarks',this.worldSurvival.collisionBoxes());this.weather=new Weather(this.scene);\n    await this.loadingStage(70,'Growing the island');this.islandMap=new IslandMap(this.uiContainer,this.worldSurvival,this.environment,p=>{",
"    this.player=new PlayerController(this.physics,this.camera,this.input,this.settings,this.simulation.state);this.player.onStep=()=>this.audio.play('step');\n    await this.loadingStage(80,'Placing landmarks','Populating survival points of interest and weather systems');this.worldSurvival=new WorldSurvival(this.environment,this.scene,seed);this.worldSurvival.populate(this.simulation.state);this.physics.setStructure('landmarks',this.worldSurvival.collisionBoxes());this.weather=new Weather(this.scene);\n    await this.loadingStage(84,'Preparing map and stations','Building navigation, station renderers and interaction data');this.islandMap=new IslandMap(this.uiContainer,this.worldSurvival,this.environment,p=>{",
'GameApp makeWorld late stages')
s=replace_once(s,
"    await this.loadingStage(86,'Finalizing world systems');",
"    await this.loadingStage(89,'Finalizing gameplay systems','Syncing structures, held items, saves and the first simulation frame');",
'GameApp finalizing stage')
s=replace_once(s,
"    try {await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));await this.makeWorld(Number.isFinite(seed)?Math.trunc(seed):WORLD.SEED,saved);await this.warmUpWorld();this.activeWorld=true;this.screen='playing';this.ui.setScreen('playing');this.ui.notify(saved?'Welcome back to your island.':'Washed ashore. Everything begins here.');}",
"    try {await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const normalized=Number.isFinite(seed)?Math.trunc(seed):WORLD.SEED,prepared=!saved&&!this.activeWorld&&this.environment?.seed===normalized;if(prepared)await this.loadingStage(82,'Using prepared island','The menu preview already contains this seed, so the world can be reused');else await this.makeWorld(normalized,saved);await this.warmUpWorld();this.activeWorld=true;this.screen='playing';this.ui.setScreen('playing');this.ui.notify(saved?'Welcome back to your island.':'Washed ashore. Everything begins here.');}",
'GameApp prepared world reuse')
s=replace_once(s,
"  private async loadingStage(progress:number,status:string){this.ui.setLoadingProgress(progress,status);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}\n  private async warmUpWorld(){\n    await this.loadingStage(90,'Compiling shaders');\n    try{this.renderer.compile(this.scene,this.camera);}catch{ /* A normal render below still warms the pipeline. */ }\n    for(let i=0;i<6;i++){this.renderer.render(this.scene,this.camera);this.ui.setLoadingProgress(92+(i+1)*1.25,'Warming renderer');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}\n    this.frameMs=16.7;this.fps=60;this.last=performance.now();\n    this.ui.setLoadingProgress(100,'Ready');\n    await new Promise<void>(resolve=>setTimeout(resolve,80));\n  }",
"""  private async loadingStage(progress:number,status:string,detail?:string){this.ui.setLoadingProgress(progress,status,detail);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
  private async warmUpWorld(){
    await this.loadingStage(91,'Compiling GPU shaders','Preparing terrain, foliage, lighting and first-person materials before gameplay');
    try{const renderer=this.renderer as THREE.WebGLRenderer&{compileAsync?:(scene:THREE.Object3D,camera:THREE.Camera)=>Promise<void>};if(renderer.compileAsync)await renderer.compileAsync(this.scene,this.camera);else this.renderer.compile(this.scene,this.camera);}catch{ /* Warm-up renders below still initialize the pipeline. */ }
    await this.loadingStage(94,'Uploading visible geometry','Rendering the island from multiple headings so buffers are resident on the GPU');
    const original=this.camera.quaternion.clone(),up=new THREE.Vector3(0,1,0);
    for(let i=0;i<8;i++){const turn=new THREE.Quaternion().setFromAxisAngle(up,i*Math.PI/4);this.camera.quaternion.copy(original).premultiply(turn);this.renderer.render(this.scene,this.camera);this.ui.setLoadingProgress(94+(i+1)*.32,'Uploading visible geometry',`Warm-up view ${i+1} / 8`);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
    this.camera.quaternion.copy(original);
    await this.loadingStage(97,'Stabilizing frame pacing','Waiting for startup shader compilation and asset uploads to leave the live frame budget');
    let stable=0,previous=performance.now();for(let i=0;i<24&&stable<6;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const now=performance.now(),frame=now-previous;previous=now;stable=frame<34?stable+1:0;this.renderer.render(this.scene,this.camera);this.ui.setLoadingProgress(97+Math.min(2.4,(i+1)*.1),'Stabilizing frame pacing',`Stable frames ${stable} / 6 · last ${frame.toFixed(1)} ms`);}
    this.frameMs=16.7;this.fps=60;this.last=performance.now();this.accumulator=0;
    this.ui.setLoadingProgress(100,'Ready','Renderer warm-up complete · entering the island with clean FPS timing');
    await new Promise<void>(resolve=>setTimeout(resolve,120));
  }""",
'GameApp warmup')
s=replace_once(s,
"this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');this.environment.hitNode(node.id);this.audio.play(node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'||node.kind==='metal'?'stone':'pickup');this.environment.syncNodes(this.simulation.state.nodeChanges);if(result.depleted)this.physics.removeNodeCollider(node.id);",
"this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');if(result.depleted&&node.kind==='tree')this.environment.fallTree(node.id,this.simulation.state.player.position);else this.environment.hitNode(node.id);this.audio.play(node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'||node.kind==='metal'?'stone':'pickup');this.environment.syncNodes(this.simulation.state.nodeChanges);if(result.depleted)this.physics.removeNodeCollider(node.id);",
'GameApp falling tree trigger')
write(p,s)

# --- UI: detailed loading dashboard ---
p='src/ui/UI.ts'; s=read(p)
s=replace_once(s,
"      <div class=\"loading-screen\" hidden><div class=\"loading-mark\">${mark}</div><h2>FINDING YOUR SHORE</h2><div class=\"loading-bar\"><i class=\"loading-bar-fill\"></i></div><div class=\"loading-meta\"><span class=\"loading-status\">Preparing engine</span><b class=\"loading-percent\">0%</b></div><p>Shaping the land. Letting the wild in.</p></div>",
"""      <div class="loading-screen" hidden><div class="loading-shell"><header class="loading-top"><div class="loading-mark">${mark}</div><div><span>WORLD INITIALIZATION</span><b>TIDELAND</b></div><small>v${GAME_VERSION} · ${GAME_BUILD}</small></header><div class="loading-heading"><div class="eyebrow"><span></span> PROCEDURAL SURVIVAL WORLD</div><h2>FINDING YOUR SHORE<span>.</span></h2><p>The world is built locally on this device. Heavy work stays behind this screen so the first playable frames stay smooth.</p></div><section class="loading-task"><span>CURRENT TASK</span><strong class="loading-status">Preparing engine</strong><p class="loading-detail">Starting the world pipeline</p></section><div class="loading-bar"><i class="loading-bar-fill"></i></div><div class="loading-meta"><span class="loading-phase">PHASE 1 / 6</span><b class="loading-percent">0%</b></div><div class="loading-pipeline"><div data-load-phase="engine"><i></i><span>ENGINE</span><b>WAITING</b></div><div data-load-phase="terrain"><i></i><span>TERRAIN</span><b>WAITING</b></div><div data-load-phase="world"><i></i><span>WORLD</span><b>WAITING</b></div><div data-load-phase="physics"><i></i><span>PHYSICS</span><b>WAITING</b></div><div data-load-phase="systems"><i></i><span>SYSTEMS</span><b>WAITING</b></div><div data-load-phase="gpu"><i></i><span>GPU WARM-UP</span><b>WAITING</b></div></div><footer class="loading-foot"><span>PREPARING FRAME PACING</span><small>Shaders, geometry and vegetation are warmed before control is handed to you.</small></footer></div></div>""",
'UI loading markup')
s=replace_once(s,
"  setLoading(loading: boolean): void { this.find('.loading-screen').hidden = !loading; if(loading)this.setLoadingProgress(0,'Preparing engine'); }\n  setLoadingProgress(progress:number,status:string):void{const value=Math.max(0,Math.min(100,progress));this.find<HTMLElement>('.loading-bar-fill').style.width=`${value}%`;this.find('.loading-percent').textContent=`${Math.round(value)}%`;this.find('.loading-status').textContent=status;}",
"""  setLoading(loading: boolean): void { this.find('.loading-screen').hidden = !loading; if(loading)this.setLoadingProgress(0,'Preparing engine','Starting the world pipeline'); }
  setLoadingProgress(progress:number,status:string,detail='Working through the world pipeline'):void{
    const value=Math.max(0,Math.min(100,progress));this.find<HTMLElement>('.loading-bar-fill').style.width=`${value}%`;this.find('.loading-percent').textContent=`${Math.round(value)}%`;this.find('.loading-status').textContent=status;this.find('.loading-detail').textContent=detail;
    const phases=[{key:'engine',max:14},{key:'terrain',max:23},{key:'world',max:66},{key:'physics',max:77},{key:'systems',max:90},{key:'gpu',max:100}],current=Math.max(0,phases.findIndex(p=>value<=p.max));this.find('.loading-phase').textContent=value>=100?'READY':`PHASE ${current+1} / ${phases.length}`;
    phases.forEach((phase,index)=>{const row=this.find<HTMLElement>(`[data-load-phase="${phase.key}"]`),done=value>=100||index<current,active=value<100&&index===current;row.dataset.state=done?'done':active?'active':'pending';row.querySelector('b')!.textContent=done?'READY':active?'LOADING':'WAITING';});
  }""",
'UI loading methods')
write(p,s)

# --- CSS: detailed loading screen ---
p='src/ui/style.css'; s=read(p)
old=re.search(r"\.loading-screen\{.*?\.loading-percent\{[^}]*\}",s,re.S)
if not old: raise SystemExit('missing loading CSS block')
new=""".loading-screen{position:absolute;inset:0;z-index:50;pointer-events:auto;background:radial-gradient(circle at 78% 20%,#31463855,transparent 28%),linear-gradient(135deg,#0f1b17,#16251e 52%,#101b17);display:grid;place-items:center;overflow:hidden}.loading-screen:before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 49.9%,#dbe4cf0b 50%,transparent 50.1%),linear-gradient(#fff0 49.9%,#dbe4cf08 50%,#fff0 50.1%);background-size:110px 110px;opacity:.45}.loading-shell{position:relative;width:min(760px,84vw);padding:34px 38px 30px;border:1px solid #d7e3cc18;background:#0f1c17d9;box-shadow:0 35px 100px #0007;backdrop-filter:blur(10px)}.loading-top{display:flex;align-items:center;gap:14px;border-bottom:1px solid #d7e3cc18;padding-bottom:18px}.loading-mark{height:38px;width:38px;color:var(--rust-light);margin:0}.loading-mark svg{height:100%;width:100%;fill:currentColor;animation:loading-pulse 1.4s ease-in-out infinite}.loading-top>div:nth-child(2){display:flex;flex-direction:column;gap:2px}.loading-top span,.loading-top small{font-family:var(--title-font);font-size:8px;letter-spacing:.16em;color:#849781}.loading-top b{font-family:var(--title-font);font-size:19px;letter-spacing:.12em;font-weight:600}.loading-top small{margin-left:auto}.loading-heading{margin-top:30px}.loading-heading .eyebrow{color:#98aa91;font-size:8px}.loading-heading h2{font-family:var(--title-font);font-size:54px;line-height:.95;letter-spacing:.035em;font-weight:600;margin:10px 0 0}.loading-heading h2 span{color:var(--rust-light)}.loading-heading>p{font-size:11px;line-height:1.55;color:#8fa184;margin-top:12px;max-width:600px}.loading-task{margin-top:30px;padding:17px 18px;border-left:2px solid var(--rust-light);background:#b7c8aa0c}.loading-task>span{display:block;font-family:var(--title-font);font-size:7px;letter-spacing:.16em;color:#768a72}.loading-task strong{display:block;font-family:var(--title-font);font-size:20px;letter-spacing:.05em;font-weight:500;margin-top:4px;color:#dbe1d2}.loading-task p{font-size:10px;color:#879a7d;margin-top:5px}.loading-bar{width:100%;height:4px;background:#b5c69c18;margin-top:22px;overflow:hidden}.loading-bar-fill{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--rust),var(--rust-light));transition:width .16s ease-out;box-shadow:0 0 18px #e0835177}.loading-meta{width:100%;margin-top:9px;display:flex;justify-content:space-between;align-items:center;font-family:var(--title-font);font-size:8px;letter-spacing:.13em;color:#809277;text-transform:uppercase}.loading-percent{font-size:14px;font-weight:500;color:#d6ddc9}.loading-pipeline{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:24px}.loading-pipeline>div{min-height:57px;border:1px solid #ccdac21a;padding:9px 8px;display:flex;flex-direction:column;gap:5px;transition:border-color .18s,background .18s}.loading-pipeline i{width:5px;height:5px;border-radius:50%;background:#71826a}.loading-pipeline span{font-family:var(--title-font);font-size:8px;letter-spacing:.08em;color:#84977d}.loading-pipeline b{font-family:var(--title-font);font-size:8px;font-weight:500;letter-spacing:.08em;color:#657760}.loading-pipeline>div[data-state="active"]{border-color:#d4865b66;background:#bf603d12}.loading-pipeline>div[data-state="active"] i{background:var(--rust-light);box-shadow:0 0 10px #e0835188}.loading-pipeline>div[data-state="active"] b{color:#d79a73}.loading-pipeline>div[data-state="done"]{border-color:#8fa87938;background:#93a8790b}.loading-pipeline>div[data-state="done"] i{background:#92ad74}.loading-pipeline>div[data-state="done"] b{color:#91aa78}.loading-foot{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #d7e3cc13;margin-top:22px;padding-top:14px;font-family:var(--title-font)}.loading-foot span{font-size:8px;letter-spacing:.13em;color:#8fa07f}.loading-foot small{font-family:var(--ui-font);font-size:9px;color:#6f826d;text-align:right}"""
s=s[:old.start()]+new+s[old.end():]
write(p,s)

# --- Version / package / changelog / README ---
p='src/config/version.ts'; s=read(p)
s=s.replace("GAME_VERSION='0.2.2'","GAME_VERSION='0.2.3'",1).replace("GAME_BUILD='EA-02.2'","GAME_BUILD='EA-02.3'",1)
s=replace_once(s,"export const CHANGELOG:ChangeEntry[]=[\n", "export const CHANGELOG:ChangeEntry[]=[\n  {version:'0.2.3',date:'2026-09-11',title:'World startup & harvesting polish',changes:[\n    'Split procedural world population into visible loading phases that yield between expensive generation steps.',\n    'Expanded the loading screen with six pipeline phases, live task detail and GPU warm-up status.',\n    'Pre-compiles shaders, warms multiple camera headings and waits for stable frame pacing before gameplay begins.',\n    'Reuses the already prepared default menu island when starting a fresh game with the same seed.',\n    'Fixed depleted resource visuals so destroyed nodes reliably disappear instead of remaining in the world.',\n    'Trees now fall away from the player, rest briefly, then sink/fade out after the final harvesting hit.'\n  ]},\n",'version changelog entry')
write(p,s)

p='package.json'; data=json.loads(read(p));data['version']='0.2.3';write(p,json.dumps(data,indent=2)+"\n")
p='package-lock.json'; s=read(p);s=s.replace('"version": "0.2.2"','"version": "0.2.3"',2);write(p,s)
p='CHANGELOG.md'; s=read(p);entry="""# Tideland changelog

## 0.2.3 — 2026-09-11

World startup and harvesting polish.

- Split procedural island population into real loading phases with browser paint/yield points between expensive generation passes.
- Expanded the loading screen to show Engine, Terrain, World, Physics, Systems and GPU Warm-up phases with live task details.
- Uses async shader compilation when available, warms eight camera headings and waits for stable frame pacing before gameplay begins.
- Reuses the already-prepared default menu island for a fresh game with the same seed instead of rebuilding it immediately.
- Fixed depleted resource synchronization so destroyed resource visuals are actually removed.
- Trees now fall away from the player on the final hit, remain on the ground briefly, then sink and disappear.

"""
if not s.startswith('# Tideland changelog\n'): raise SystemExit('unexpected changelog header')
s=entry+s[len('# Tideland changelog\n\n'):]
write(p,s)
p='README.md'; s=read(p);s=s.replace('`v0.2.2 / EA-02.2`','`v0.2.3 / EA-02.3`',1);s=s.replace('From `v0.2.2` onward','From `v0.2.3` onward',1);write(p,s)

print('v0.2.3 patch applied')
