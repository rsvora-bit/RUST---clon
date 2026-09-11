import {WorldSurvival,IslandMap} from '../survival/WorldSurvival';
import {Weather,WEATHER} from '../survival/Weather';
import {createStation,STATIONS,STATION_KINDS,transfer,takeAll,type Station,type StationKind} from '../survival/stations';
import {ensureProgression,upgrade,repair,demolish} from '../survival/progression';
import {StationRenderer} from '../survival/StationRenderer';
import {StationUI} from '../survival/StationUI';
import {DevTerminal} from '../survival/DevTerminal';
import * as THREE from 'three';
import {FirstPersonProjection,horizontalFov} from '../camera/FirstPersonProjection';
import {Environment} from '../rendering/environment';
import {PhysicsWorld,initPhysics} from '../physics/PhysicsWorld';
import {PlayerController} from '../player/PlayerController';
import {Input} from '../input/Input';
import {GameSimulation} from '../simulation/GameSimulation';
import {UI} from '../ui/UI';
import {AudioMixer} from '../audio/AudioMixer';
import {HeldItem} from '../rendering/HeldItem';
import {ImpactFX} from '../rendering/ImpactFX';
import {StructureRenderer} from '../building/StructureRenderer';
import {findBuildCandidate,PIECES} from '../building/rules';
import {InteractionSystem} from '../entities/InteractionSystem';
import {WorldItems} from '../entities/WorldItems';
import {DebugView} from '../diagnostics/DebugView';
import {saveGame,loadGame,hasSave,resetSave,loadSettings,saveSettings} from '../save/storage';
import {ITEMS} from '../items/definitions';
import {GATHERING} from '../config/gameplay';
import {PLAYER,WORLD,BUILD} from '../config/balance';
import type {BuildCandidate,GameState,HUDData,ItemId,PieceType,ResourceNode,Screen,Settings,Structure,Vec3} from '../core/types';
export class GameApp {
  readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(60,1,.075,1700);private readonly projection=new FirstPersonProjection(this.camera);readonly renderer:THREE.WebGLRenderer;
  readonly ui:UI;readonly input:Input;readonly audio:AudioMixer;readonly held=new HeldItem();readonly impactFx:ImpactFX;readonly torchLight=new THREE.PointLight(0xffd0a0,0,14,2);readonly interactions=new InteractionSystem();
  environment!:Environment;physics!:PhysicsWorld;player!:PlayerController;simulation!:GameSimulation;structures!:StructureRenderer;worldItems!:WorldItems;debug:DebugView;
  private settings:Settings=loadSettings();private screen:Screen='menu';private activeWorld=false;private building=false;private buildPiece:PieceType='foundation';private buildRotation=0;private candidate:BuildCandidate|null=null;
  private ray=new THREE.Raycaster();private screenCenter=new THREE.Vector2();private groundMesh!:THREE.Mesh;private targetPoint=new THREE.Vector3();private direction=new THREE.Vector3();
  private pendingHit:{node:ResourceNode;remaining:number}|null=null;
  private capturePaused=false;
  private worldSurvival!:WorldSurvival;private weather!:Weather;private islandMap!:IslandMap;private uiContainer:HTMLElement;
  private maintenancePanel:HTMLElement|null=null;private terminalReturn:Screen='menu';
  private stationRenderer!:StationRenderer;private stationUI:StationUI;private terminal:DevTerminal;private openStation:string|null=null;private stationIds=new Set<string>();private stationPlacement:{kind:StationKind;position:THREE.Vector3;valid:boolean}|null=null;

  private last=0;private accumulator=0;private uiTimer=0;private elapsed=0;private autoSave=0;private cooldown=0;private fps=60;private frameMs=16.7;private timeMultiplier=1;private loading=false;private leftDown=false;private knownStructures=new Map<string,boolean|undefined>();private rainBarrel:THREE.Group|null=null;
  constructor(private canvas:HTMLCanvasElement,uiRoot:HTMLElement){
    this.uiContainer=uiRoot;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.input=new Input(canvas);this.audio=new AudioMixer(this.settings);this.impactFx=new ImpactFX(this.scene);this.scene.add(this.torchLight);this.debug=new DebugView(this.scene);
    this.ui=new UI(uiRoot,{
      respawn:()=>this.respawn(),
      newGame:seed=>{void this.start(seed??WORLD.SEED);},continueGame:()=>{const saved=loadGame();if(saved)void this.start(saved.seed,saved);else this.ui.notify('No valid save was found. Start a new island.');},resume:()=>this.setScreen('playing'),save:()=>this.save(),mainMenu:()=>{if(this.activeWorld)this.save();this.setScreen('menu');},resetSave:()=>{resetSave();this.ui.setSaveAvailable(false);this.ui.notify('Saved world removed');},settings:s=>this.applySettings(s),setScreen:s=>this.setScreen(s),
      moveItem:(from,to,split)=>{this.simulation.moveItem(from,to,split);this.syncHeld();},dropItem:slot=>{const p=this.dropPosition();this.simulation.dropItem(slot,p);this.syncWorldItems();this.syncHeld();},consume:slot=>{if(this.simulation.consume(slot))this.audio.play('eat');this.syncHeld();},craft:id=>{this.simulation.craft(id);},canCraft:id=>this.simulation?.canCraft(id)??false,selectSlot:slot=>{this.simulation.selectSlot(slot);this.syncHeld();},selectPiece:piece=>{this.buildPiece=piece;this.building=true;},dev:(a,v)=>this.dev(a,v)
    });
    this.stationUI=new StationUI(uiRoot,{move:(id,a,b,split)=>{const station=this.station(id);if(station&&!transfer(this.simulation.state.inventory,station,a,b,split,p=>this.simulation.fitsQueue(p)))this.ui.notify('Transfer blocked: slot type, capacity or reserved crafting space');},takeAll:id=>{const s=this.station(id);if(s)takeAll(this.simulation.state.inventory,s,p=>this.simulation.fitsQueue(p));},toggle:id=>{const s=this.station(id);if(s)s.active=!s.active;},spawn:id=>{ensureProgression(this.simulation.state).spawnId=id;this.ui.notify('Respawn point set');},close:()=>{this.stationUI.close();this.openStation=null;this.setScreen('playing');}});
    this.terminal=new DevTerminal(uiRoot,open=>{if(open){this.terminalReturn=this.screen;this.setScreen('pause');}else this.setScreen(this.terminalReturn);});this.registerCommands();
    this.input.onLook=(x,y)=>{if(this.screen==='playing'&&this.player)this.player.look(x,y);};this.input.onKey=code=>this.onKey(code);
    this.input.onClick=button=>{if(this.screen!=='playing')return;if(!this.input.locked){void this.input.lock();if(button===0){this.leftDown=true;this.use();}if(button===2){this.building=false;this.candidate=null;this.structures.preview(null);}return;}if(button===0){this.leftDown=true;this.use();}if(button===2){this.building=false;this.candidate=null;this.structures.preview(null);}};
    this.input.onWheel=dir=>{if(this.screen!=='playing')return;if(this.building)this.cyclePiece(dir);else{this.simulation.selectSlot((this.simulation.state.activeSlot+dir+6)%6);this.syncHeld();}};
    this.input.onLockChange=locked=>{if(!locked){this.leftDown=false;if(this.screen==='playing'&&!this.loading)this.setScreen('pause');}};
    window.addEventListener('mouseup',()=>this.leftDown=false);window.addEventListener('resize',()=>this.resize());document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.screen==='playing')this.setScreen('pause');});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.setScreen('pause');this.ui.notify('Graphics context interrupted. Restoring…');});canvas.addEventListener('webglcontextrestored',()=>{this.applySettings(this.settings);this.ui.notify('Graphics restored. Resume when ready.');});
    window.addEventListener('beforeunload',()=>{if(this.activeWorld&&this.simulation.state.player.stats.health>0)saveGame(this.simulation.state);});
    this.ui.setSettings(this.settings);this.ui.setSaveAvailable(hasSave());this.ui.setLoading(true);this.projection.setBaseFov(this.settings.fov);this.resize();
  }
  async init(){this.ui.setLoading(true);await this.loadingStage(5,'Starting physics');await initPhysics();await this.loadingStage(12,'Preparing procedural island');await this.makeWorld(WORLD.SEED);await this.warmUpWorld();this.activeWorld=false;this.ui.setLoading(false);this.setScreen('menu');this.installDevAPI();this.renderer.setAnimationLoop(t=>this.frame(t));}
  private async makeWorld(seed:number,saved?:GameState){
    this.worldSurvival?.dispose();this.weather?.dispose();this.islandMap?.dispose();
    this.stationRenderer?.dispose();this.stationIds.clear();this.stationUI?.close();this.openStation=null;this.interactions.clear();this.knownStructures.clear();this.rainBarrel?.removeFromParent();this.structures?.dispose();this.worldItems?.dispose();this.physics?.dispose();this.environment?.dispose();
    await this.loadingStage(20,'Shaping terrain');
    this.environment=new Environment(this.scene,seed,saved ? saved.worldGeneration ?? 1 : 2);
    this.simulation=new GameSimulation(seed,this.environment.spawn,saved);this.simulation.onNotify=msg=>this.ui.notify(msg);
    this.environment.syncNodes(this.simulation.state.nodeChanges);
    await this.loadingStage(42,'Placing resources');
    this.physics=new PhysicsWorld(this.environment.terrainGeometry,this.environment.colliders,this.simulation.state.player.position);
    await this.loadingStage(56,'Building collision world');
    // Saved depleted nodes keep their simulation state; remove their static
    // colliders after the physics bridge is rebuilt so invisible resources do
    // not become walls on a continued island.
    for (const node of this.environment.nodes) if ((this.simulation.state.nodeChanges[node.id] ?? node.remaining) <= 0) this.physics.removeNodeCollider(node.id);
    this.player=new PlayerController(this.physics,this.camera,this.input,this.settings,this.simulation.state);this.player.onStep=()=>this.audio.play('step');
    this.worldSurvival=new WorldSurvival(this.environment,this.scene,seed);this.worldSurvival.populate(this.simulation.state);this.physics.setStructure('landmarks',this.worldSurvival.collisionBoxes());this.weather=new Weather(this.scene);
    await this.loadingStage(70,'Growing the island');this.islandMap=new IslandMap(this.uiContainer,this.worldSurvival,this.environment,p=>{const progress=ensureProgression(this.simulation.state);if(p)progress.waypoint=p;else delete progress.waypoint;},()=>{this.islandMap.close();this.setScreen('playing');});
    this.stationRenderer=new StationRenderer(this.scene);this.syncStations();
    this.structures=new StructureRenderer(this.scene);this.worldItems=new WorldItems(this.scene);
    this.groundMesh=new THREE.Mesh(this.environment.terrainGeometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    this.registerNodes();this.createWaterSource();this.syncStructures();this.syncWorldItems();this.syncHeld();this.applySettings(this.settings);this.player.tick(1/60,this.simulation.state,false);this.accumulator=0;this.autoSave=0;this.building=false;this.candidate=null;
    await this.loadingStage(86,'Finalizing world systems');
  }
  private async start(seed:number,saved?:GameState){
    if(this.loading)return;this.loading=true;this.ui.setLoading(true);void this.audio.start();void this.input.lock();
    try {await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));await this.makeWorld(Number.isFinite(seed)?Math.trunc(seed):WORLD.SEED,saved);await this.warmUpWorld();this.activeWorld=true;this.screen='playing';this.ui.setScreen('playing');this.ui.notify(saved?'Welcome back to your island.':'Washed ashore. Everything begins here.');}
    catch(error){console.error(error);this.ui.notify('The island could not be created. Reload to try again.');this.setScreen('menu');}
    finally{this.loading=false;this.ui.setLoading(false);}
  }
  private async loadingStage(progress:number,status:string){this.ui.setLoadingProgress(progress,status);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
  private async warmUpWorld(){
    await this.loadingStage(90,'Compiling shaders');
    try{this.renderer.compile(this.scene,this.camera);}catch{ /* A normal render below still warms the pipeline. */ }
    for(let i=0;i<6;i++){this.renderer.render(this.scene,this.camera);this.ui.setLoadingProgress(92+(i+1)*1.25,'Warming renderer');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
    this.frameMs=16.7;this.fps=60;this.last=performance.now();
    this.ui.setLoadingProgress(100,'Ready');
    await new Promise<void>(resolve=>setTimeout(resolve,80));
  }
  private setScreen(screen:Screen){if(screen==='playing'&&!this.activeWorld)return;this.screen=screen;this.ui.setScreen(screen);this.input.keys.clear();this.leftDown=false;if(screen==='playing'){void this.audio.start();void this.input.lock();}else{this.input.release();this.structures?.preview(null);}this.ui.setSaveAvailable(hasSave());}
  private onKey(code:string){
    if((code==='KeyM'||code==='Escape')&&this.islandMap?.isOpen){this.islandMap.close();this.setScreen('playing');return;}
    if(code==='KeyM'&&this.screen==='playing'){this.islandMap.show();this.setScreen('station');return;}
    if(code==='F10'||code==='Backquote'){this.terminal.toggle();return;}
    if(this.terminal.isOpen)return;
    if(code==='Escape'&&this.maintenancePanel){this.maintenancePanel.remove();this.maintenancePanel=null;this.setScreen('playing');return;}
    if(code==='Escape'&&this.stationUI.isOpen){this.stationUI.close();this.openStation=null;this.setScreen('playing');return;}
    if(code==='KeyG'&&this.screen==='playing'){this.structureMenu();return;}
    if(code==='F3'){this.ui.toggleDiagnostics();return;}
    if(code==='Escape'){if(this.screen==='playing'||this.screen==='inventory')this.setScreen('pause');else if(this.screen==='pause')this.setScreen('playing');else if(this.screen==='settings')this.setScreen(this.activeWorld?'pause':'menu');return;}
    if(code==='Tab'){if(this.screen==='playing')this.setScreen('inventory');else if(this.screen==='inventory')this.setScreen('playing');return;}
    if(this.screen!=='playing')return;
    if(/^Digit[1-6]$/.test(code)){this.simulation.selectSlot(Number(code.slice(-1))-1);this.building=false;this.syncHeld();}
    if(code==='Space')this.player.jump();
    if(code==='KeyE')this.interactions.trigger();
    if(code==='KeyB')this.toggleBuild();
    if(code==='KeyR'&&(this.building||this.stationPlacement))this.buildRotation+=Math.PI/2;
    if(code==='KeyQ'&&this.building)this.cyclePiece(1);
    if(code==='KeyF'){const slot=this.simulation.state.activeSlot;if(this.simulation.consume(slot)){this.audio.play('eat');this.syncHeld();}}
  }
  private toggleBuild(){
    if(this.building){this.building=false;return;}
    if(!this.simulation.count('plan')){this.ui.notify('Craft a building plan in your inventory [TAB]');this.audio.play('error');return;}
    const slot=this.simulation.state.inventory.findIndex(s=>s?.itemId==='plan');if(slot>=6){const free=this.simulation.state.inventory.slice(0,6).findIndex(s=>!s);this.simulation.moveItem(slot,free>=0?free:this.simulation.state.activeSlot);this.simulation.selectSlot(free>=0?free:this.simulation.state.activeSlot);}else this.simulation.selectSlot(slot);
    this.syncHeld();this.building=true;
  }
  private cyclePiece(direction:number){const pieces:PieceType[]=['foundation','wall','doorway','door','floor','roof'];this.buildPiece=pieces[(pieces.indexOf(this.buildPiece)+direction+pieces.length)%pieces.length];}
  private syncHeld(){if(!this.simulation)return;const item=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId??null;this.held.set(item);if(item==='plan')this.building=true;else this.building=false;}
  private updateTorchLight(playing:boolean){
    if(!this.simulation){this.torchLight.intensity=0;return;}
    const active=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId;
    const lit=playing&&active==='torch';this.torchLight.visible=lit;
    if(!lit){this.torchLight.intensity=0;return;}
    this.camera.getWorldDirection(this.direction);
    this.torchLight.position.copy(this.camera.position).addScaledVector(this.direction,.42);this.torchLight.position.y-=.65;
    // The physical light is intentionally broader than the flame mesh: a
    // small warm pool keeps night navigation readable without flattening the
    // moonlit silhouettes at the edge of the player's reach.
    this.torchLight.intensity=13+Math.sin(this.elapsed*3.7)*.65+Math.sin(this.elapsed*7.1)*.35;this.torchLight.distance=14+Math.sin(this.elapsed*2.3)*.35;
  }
  private registerNodes(){
    for(const node of this.environment.nodes){const object=this.environment.nodeObjects.get(node.id);if(!object)continue;
      this.interactions.register({id:node.id,kind:'resource',object,position:()=>node.position,enabled:()=>node.remaining>0,info:()=>({title:GATHERING[node.kind].label,action:['fiber','berries','wood'].includes(node.kind)?'PICK UP':'GATHER',key:['fiber','berries','wood'].includes(node.kind)?'E':'LMB',detail:`${GATHERING[node.kind].itemId==='metal'?'METAL ORE':GATHERING[node.kind].itemId.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`,progress:node.remaining/node.capacity}),interact:()=>this.gather(node)});
    }
  }
  private gather(node:ResourceNode,animate=true){if(this.cooldown>0)return;const result=this.simulation.gather(node);if(result.amount>0){this.cooldown=['fiber','berries','wood'].includes(node.kind)?.22:.62;if(animate)this.held.hit();this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');this.environment.hitNode(node.id);this.audio.play(node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'||node.kind==='metal'?'stone':'pickup');this.environment.syncNodes(this.simulation.state.nodeChanges);if(result.depleted)this.physics.removeNodeCollider(node.id);}}
  private use(){
    if(this.cooldown>0)return;
    if(this.stationPlacement){this.placeStation(this.stationPlacement.kind,this.stationPlacement.position,this.buildRotation);return;}
    if(this.building){if(this.candidate){const s=this.simulation.place(this.candidate);if(s){this.syncStructures();this.impactFx.burst(this.candidate.position,'build');this.audio.play('build');this.held.hit();this.cooldown=.28;}else this.audio.play('error');}return;}
    const target=this.interactions.current;
    if(target?.kind==='resource'){const node=this.environment.nodes.find(n=>n.id===target.id);if(node&&['tree','stone','metal'].includes(node.kind)){const active=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId;if(active==='rock'||active==='hatchet'||active==='pickaxe'){this.held.hit();this.pendingHit={node,remaining:.13};this.cooldown=.62;}else target.interact();}else target.interact();return;}
    const slot=this.simulation.state.activeSlot,item=this.simulation.state.inventory[slot]?.itemId;
    if(item&&ITEMS[item].consumable){if(this.simulation.consume(slot)){this.audio.play('eat');this.cooldown=.7;this.syncHeld();}}else{this.held.hit();this.cooldown=.5;}
  }
  private syncStructures(){
    const state=this.simulation.state;for(const id of this.knownStructures.keys())if(!state.structures.some(s=>s.id===id)){this.physics.removeStructure(id);this.interactions.remove(id);this.knownStructures.delete(id);}this.structures.sync(state.structures);this.environment.coverGrass(state.structures);
    for(const s of state.structures){if(!this.knownStructures.has(s.id)||this.knownStructures.get(s.id)!==s.open){this.physics.setStructure(s.id,this.structures.boxes(s));this.knownStructures.set(s.id,s.open);}
      if(s.pieceType==='door'&&!this.interactions.entries.has(s.id)){this.interactions.register({id:s.id,kind:'door',object:this.structures.objects.get(s.id)!,position:()=>s.position,enabled:()=>true,info:()=>({title:'Timber door',action:s.open?'CLOSE':'OPEN',key:'E'}),interact:()=>{if(this.simulation.toggleDoor(s.id)){this.syncStructures();this.audio.play('door');}}});}}
  }
  private syncWorldItems(){this.worldItems.sync(this.simulation.state.drops);for(const [id,entry] of this.interactions.entries)if(entry.kind==='drop'&&!this.worldItems.objects.has(id))this.interactions.remove(id);for(const drop of this.simulation.state.drops){if(this.interactions.entries.has(drop.id))continue;this.interactions.register({id:drop.id,kind:'drop',object:this.worldItems.objects.get(drop.id)!,position:()=>drop.position,enabled:()=>true,info:()=>({title:ITEMS[drop.stack.itemId].displayName,action:`PICK UP ×${drop.stack.count}`,key:'E'}),interact:()=>{if(this.simulation.pickup(drop.id)){this.audio.play('pickup');this.syncWorldItems();this.syncHeld();}}});}}
  private dropPosition():Vec3{this.camera.getWorldDirection(this.direction);const p=this.simulation.state.player.position;const x=p.x+this.direction.x*1.4,z=p.z+this.direction.z*1.4;return {x,y:Math.max(p.y,this.environment.heightAt(x,z))+.05,z};}
  private updateBuild(){
    if(this.updateStationPreview()){this.candidate=null;this.structures.preview(null);return;}
    if(!this.building){this.candidate=null;this.structures.preview(null);return;}
    this.ray.setFromCamera(this.screenCenter,this.camera);this.ray.far=BUILD.MAX_DISTANCE;const hits=this.ray.intersectObjects([this.groundMesh,...this.structures.objects.values()],true);
    if(hits.length)this.targetPoint.copy(hits[0].point);else{this.camera.getWorldDirection(this.direction);this.targetPoint.copy(this.camera.position).addScaledVector(this.direction,5);this.targetPoint.y=this.environment.heightAt(this.targetPoint.x,this.targetPoint.z);}
    const c=findBuildCandidate(this.buildPiece,this.targetPoint,this.buildRotation,this.simulation.state.structures,(x,z)=>this.environment.heightAt(x,z),id=>this.simulation.count(id),this.simulation.state.player.position);
    if(!hits.length&&this.camera.getWorldDirection(this.direction).y>.16){c.valid=false;c.reason='Aim at the ground or an attachment socket';}
    if(c.valid&&c.pieceType==='foundation'){
      for(const prop of [...this.environment.colliders,...ensureProgression(this.simulation.state).stations.flatMap(s=>this.stationRenderer.boxes(s)),...this.worldSurvival.collisionBoxes()]){if(prop.nodeId&&this.simulation.state.nodeChanges[prop.nodeId]===0)continue;if(Math.abs(prop.position.x-c.position.x)<BUILD.SIZE/2+prop.halfExtents.x-.15&&Math.abs(prop.position.z-c.position.z)<BUILD.SIZE/2+prop.halfExtents.z-.15&&prop.position.y+prop.halfExtents.y>c.position.y&&prop.position.y-prop.halfExtents.y<c.position.y+BUILD.FOUNDATION_HEIGHT+1){c.valid=false;c.reason='Obstructed by a tree or rock';break;}}
    }
    this.candidate=c;this.structures.preview(c);
  }
  private station(id:string){return ensureProgression(this.simulation.state).stations.find(s=>s.id===id);}
  private syncStations(){const stations=ensureProgression(this.simulation.state).stations;this.stationRenderer.sync(stations);for(const s of stations)if(!this.stationIds.has(s.id)){this.stationIds.add(s.id);const size=STATIONS[s.kind].size;this.environment.coverArea(s.id,s.position,size[0]+.25,size[2]+.25,s.rotation);this.physics.setStructure(s.id,this.stationRenderer.boxes(s));this.interactions.register({id:s.id,kind:'station',object:this.stationRenderer.objects.get(s.id)!,position:()=>s.position,enabled:()=>true,info:()=>({title:STATIONS[s.kind].name,action:'OPEN',key:'E'}),interact:()=>{this.openStation=s.id;this.setScreen('station');this.stationUI.open(s,this.simulation.state.inventory);}});}}
  private updateStationPreview(){const item=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId;const kind=item&&STATION_KINDS.includes(item as StationKind)?item as StationKind:null;if(!kind||kind==='loot'){this.stationPlacement=null;this.stationRenderer.preview(null);return false;}this.ray.setFromCamera(this.screenCenter,this.camera);this.ray.far=5;const hit=this.ray.intersectObjects([this.groundMesh,...this.structures.objects.values()],true)[0];const position=hit?.point.clone()??this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(this.direction),3);const valid=!!hit&&hit.face!==null&&Math.abs(hit.face?.normal.y??0)>.7&&this.stationCanPlace(kind,position);this.stationPlacement={kind,position,valid};this.stationRenderer.preview(kind,position,this.buildRotation,valid);return true;}
  private stationCanPlace(kind:StationKind,p:Vec3){const [w,h,d]=STATIONS[kind].size;if(p.y<0||Math.hypot(p.x-this.simulation.state.player.position.x,p.z-this.simulation.state.player.position.z)<1.1)return false;for(const s of ensureProgression(this.simulation.state).stations){const size=STATIONS[s.kind].size;if(Math.hypot(s.position.x-p.x,s.position.z-p.z)<Math.hypot(w,d)/2+Math.hypot(size[0],size[2])/2&&Math.abs(s.position.y-p.y)<h)return false;}for(const c of [...this.environment.colliders,...this.simulation.state.structures.flatMap(s=>this.structures.boxes(s)),...this.worldSurvival.collisionBoxes()]){if(c.nodeId&&this.simulation.state.nodeChanges[c.nodeId]===0)continue;if(Math.abs(c.position.x-p.x)<w/2+c.halfExtents.x&&Math.abs(c.position.z-p.z)<d/2+c.halfExtents.z&&c.position.y+c.halfExtents.y>p.y+.15&&c.position.y-c.halfExtents.y<p.y+h)return false;}return true;}
  private placeStation(kind:StationKind,p:THREE.Vector3,rotation=0,dev=false){if(!STATION_KINDS.includes(kind))return null;if(!dev&&(!this.stationPlacement?.valid||!this.stationCanPlace(kind,p))){this.ui.notify('Cannot place: aim at an unobstructed surface');return null;}const state=this.simulation.state;if(ensureProgression(state).stations.length>=500){this.ui.notify('Station limit reached');return null;}if(!dev){const slot=state.inventory[state.activeSlot];if(slot?.itemId!==kind)return null;if(--slot.count===0)state.inventory[state.activeSlot]=null;}const station=createStation(`station-${state.nextId++}`,kind,p,rotation);ensureProgression(state).stations.push(station);this.syncStations();this.syncHeld();this.audio.play('build');this.cooldown=.3;return station;}
  private respawn(){const state=this.simulation.state,progress=ensureProgression(state),bed=progress.stations.find(s=>s.id===progress.spawnId&&s.kind==='bedroll');this.simulation.resetStats();const p=bed?{x:bed.position.x+1.4,y:bed.position.y+.4,z:bed.position.z}:this.environment.spawn;this.player.teleport(p);state.player.position={...p};this.setScreen('playing');this.save(false);}
  private structureMenu(){this.ray.setFromCamera(this.screenCenter,this.camera);this.ray.far=5;const hit=this.ray.intersectObjects([...this.structures.objects.values()],true)[0],id=hit?.object.userData.structureId;const s=this.simulation.state.structures.find(s=>s.id===id);if(!s){this.ui.notify('Aim at your structure, then press G');return;}this.setScreen('pause');this.maintenancePanel?.remove();const panel=document.createElement('section');this.maintenancePanel=panel;panel.className='survival-panel';panel.innerHTML=`<h1>Structure maintenance</h1><p>${s.grade??'wood'} · ${Math.ceil(s.health)} / ${s.maxHealth??250} HP</p><button data-do="upgrade">UPGRADE · ${s.grade==='stone'?'100 metal':'120 stone'}</button> <button data-do="repair">REPAIR DAMAGE</button> <button data-do="demolish">DEMOLISH…</button> <button data-do="close">CLOSE</button><p>Remove dependent pieces before demolishing a support. No demolition refund.</p>`;document.body.append(panel);panel.onclick=e=>{const action=(e.target as HTMLElement).dataset.do;if(!action)return;if(action==='demolish'){(e.target as HTMLElement).textContent='CONFIRM PERMANENT DEMOLITION';(e.target as HTMLElement).dataset.do='confirm';return;}if(action==='upgrade')this.ui.notify(upgrade(this.simulation.state,s)?'Structure upgraded':'Cannot upgrade: maximum grade or missing resources');if(action==='repair')this.ui.notify(repair(this.simulation.state,s)?'Structure repaired':'No repair needed or missing resources');if(action==='confirm')this.ui.notify(demolish(this.simulation.state,s.id)?'Structure removed':'Remove attached pieces first');this.syncStructures();panel.remove();this.maintenancePanel=null;this.setScreen('playing');};}
  private registerCommands(){const t=this.terminal;t.register('camdebug','on | off',args=>{this.ui.setDiagnostics(args[0]!=='off');return this.player.debugText();});t.register('fov','60–100',args=>{const value=Number(args[0]);if(!Number.isFinite(value)||value<60||value>100)throw Error('FOV must be 60–100');this.applySettings({...this.settings,fov:value});});t.register('time','day | evening | night',args=>{const hours:Record<string,number>={day:10,evening:17.5,night:0};if(!(args[0] in hours))throw Error('Use day, evening or night');this.simulation.state.timeOfDay=hours[args[0]];});t.register('give','resources | buildkit',args=>{if(args[0]==='resources'){for(const id of ['wood','stone','fiber','ore','metal'] as ItemId[])this.simulation.addItem(id,2000);}else if(args[0]==='buildkit'){for(const id of ['plan','storage','furnace','workbench1','workbench2','workbench3','campfire','bedroll'] as ItemId[])this.simulation.addItem(id,1);}else throw Error('Use resources or buildkit');});t.register('spawn','storage | furnace | workbench1/2/3 | campfire | bedroll',args=>{if(!STATION_KINDS.includes(args[0] as StationKind))throw Error('Unknown station');const p=this.dropPosition();return this.placeStation(args[0] as StationKind,new THREE.Vector3(p.x,p.y,p.z),0,true)?.id;});t.register('teleport','spawn',args=>{if(args[0]==='spawn')this.player.teleport(this.environment.spawn);else {const poi=this.worldSurvival.pois.find(p=>p.id===args[0]);if(!poi)throw Error('Use spawn or '+this.worldSurvival.pois.map(p=>p.id).join(', '));const p={x:poi.position.x,y:this.environment.heightAt(poi.position.x,poi.position.z+7)+.2,z:poi.position.z+7};this.player.teleport(p);this.player.yaw=0;this.player.pitch=0;}});t.register('weather','clear | rain | fog | storm',args=>{if(!WEATHER.includes(args[0] as typeof WEATHER[number]))throw Error('Unknown weather');const w=ensureProgression(this.simulation.state).weather;w.kind=args[0] as typeof w.kind;w.remaining=300;});t.register('save','Save current world',()=>{this.save();});t.register('load','Continue saved world',async()=>{const saved=loadGame();if(!saved)throw Error('No valid save');await this.start(saved.seed,saved);});}
  private createWaterSource(){
    const g=new THREE.Group();const p=this.environment.spawn;const x=p.x+8,z=p.z+5,y=this.environment.heightAt(x,z);g.position.set(x,y,z);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.43,.4,.88,20,1,true),new THREE.MeshStandardMaterial({color:'#64777b',roughness:.85,metalness:.2,side:THREE.DoubleSide}));barrel.position.y=.44;barrel.castShadow=true;g.add(barrel);
    for(const h of [.08,.78]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.415,.024,6,20),new THREE.MeshStandardMaterial({color:'#444943',metalness:.6,roughness:.5}));ring.rotation.x=Math.PI/2;ring.position.y=h;g.add(ring);}
    const water=new THREE.Mesh(new THREE.CircleGeometry(.39,20),new THREE.MeshStandardMaterial({color:'#6096a3',roughness:.15,metalness:.6}));water.rotation.x=-Math.PI/2;water.position.y=.70;g.add(water);this.scene.add(g);this.rainBarrel=g;
    this.interactions.register({id:'rain-collector',kind:'water',object:g,position:()=>g.position,enabled:()=>true,info:()=>({title:'Rain collector',action:'DRINK FRESH WATER',key:'E',detail:'A little kindness left behind.'}),interact:()=>{this.simulation.state.player.stats.thirst=Math.min(100,this.simulation.state.player.stats.thirst+35);this.ui.notify('Hydration +35');this.audio.play('eat');}});
  }
  private tutorial(){if(this.stationPlacement)return `${STATIONS[this.stationPlacement.kind].name} · LMB place · R rotate · ${this.stationPlacement.valid?'READY':'Aim at a clear surface'}`;const s=this.simulation.state,waypoint=ensureProgression(s).waypoint;if(waypoint)return `WAYPOINT ${Math.round(Math.hypot(waypoint.x-s.player.position.x,waypoint.z-s.player.position.z))} m · M map · G structure maintenance`; if(s.structures.length>=5)return 'Make this shore your own.  ·  ESC to save your world';if(s.structures.length>0)return 'Build your shelter.  ·  Q selects a piece · R rotates';if(this.simulation.count('plan'))return 'Equip your building plan.  ·  B to build';if(this.simulation.count('wood')>=25&&this.simulation.count('fiber')>=10)return 'You have the essentials.  ·  TAB to craft a building plan';return 'Find your footing.  ·  Gather wood and wild flax · TAB for crafting';}
  private frame(timestamp:number){
    const dt=Math.min((timestamp-(this.last||timestamp))/1000,.1);this.last=timestamp;if(!this.environment||this.loading)return;this.elapsed+=dt;this.frameMs=THREE.MathUtils.lerp(this.frameMs,dt*1000,.04);this.fps=1000/Math.max(this.frameMs,1);this.cooldown=Math.max(0,this.cooldown-dt);
    const playing=this.screen==='playing',running=playing||this.screen==='inventory'||this.screen==='station';
    if(this.pendingHit){if(!playing)this.pendingHit=null;else{this.pendingHit.remaining-=dt;if(this.pendingHit.remaining<=0){const node=this.pendingHit.node;this.pendingHit=null;const p=this.simulation.state.player.position;if(Math.hypot(p.x-node.position.x,p.z-node.position.z)<=PLAYER.INTERACT_DISTANCE+node.scale){this.cooldown=0;this.gather(node,false);}}}}
    if(running&&this.activeWorld){
      this.accumulator+=this.capturePaused?0:dt;let steps=0;while(this.accumulator>=1/60&&steps<6){this.player.tick(1/60,this.simulation.state,playing);this.simulation.tick(1/60,this.player.sprinting);this.accumulator-=1/60;steps++;}
      if(this.timeMultiplier!==1)this.simulation.state.timeOfDay=(this.simulation.state.timeOfDay+dt*(this.timeMultiplier-1)*24/1800)%24;
      if(this.simulation.state.player.position.y<-.5){this.simulation.state.player.stats.health=Math.max(0,this.simulation.state.player.stats.health-dt*3);}
      if(this.simulation.state.player.position.y<-9){this.player.teleport(this.environment.spawn);this.ui.notify('The current carried you back to shore');}
      if(this.simulation.state.player.stats.health<=0)this.setScreen('dead');
      this.player.renderCamera(this.accumulator/(1/60));
      this.autoSave+=dt;if(this.autoSave>60){this.save(false);this.autoSave=0;}
      if(playing){this.updateBuild();this.interactions.update(this.camera,PLAYER.INTERACT_DISTANCE,[this.groundMesh,...this.structures.objects.values()].filter(o=>o!==this.interactions.current?.object));if(this.leftDown&&!this.building&&this.interactions.current?.kind==='resource'&&this.cooldown<=0)this.use();}
      else this.structures.preview(null);
      this.held.update(dt,this.player.speed);
    } else if(this.screen==='menu'||(this.screen==='settings'&&!this.activeWorld)){
      const p=this.environment.spawn;this.camera.position.set(p.x+29,this.environment.heightAt(p.x+29,p.z+25)+9,p.z+25);this.camera.lookAt(p.x-25,10,p.z-60);
    }
    this.projection.update(dt,playing&&this.player.sprinting);
    const hour=this.activeWorld?this.simulation.state.timeOfDay:9.4;
    this.environment.update(dt,hour,this.camera.position);const weather=this.weather.update(running?dt:0,this.simulation.state,this.environment.atmosphere,this.camera.position,this.settings.quality);this.environment.windStrength=weather.wind;this.audio.setWeather(weather.rain);this.islandMap.update(this.simulation.state.player.position,this.player.yaw,ensureProgression(this.simulation.state).waypoint);this.stationRenderer.update(ensureProgression(this.simulation.state).stations,this.elapsed,this.camera.position);if(this.openStation){const s=this.station(this.openStation);if(s)this.stationUI.update(s,this.simulation.state.inventory);}this.impactFx.update(dt);this.updateTorchLight(playing);this.debug.update(this.physics,this.simulation.state.structures);
    // Keep diagnostics for the complete frame, including the separate viewmodel pass.
    this.renderer.info.autoReset=false;this.renderer.info.reset();
    this.renderer.render(this.scene,this.camera);if(playing)this.held.render(this.renderer);
    this.uiTimer+=dt;if(this.uiTimer>=.1){this.uiTimer=0;const state=this.simulation.state,p=state.player.position;const stats=this.renderer.info.render;
      const c=this.candidate;const hud:HUDData={stats:state.player.stats,inventory:state.inventory,activeSlot:state.activeSlot,compass:-THREE.MathUtils.radToDeg(this.player.yaw),biome:this.environment.biomeAt(p.x,p.z),timeOfDay:hour,interaction:!this.building?this.interactions.current?.info()??null:null,build:this.building?{piece:this.buildPiece,valid:c?.valid??false,reason:c?.reason??'Aim at the ground',cost:Object.entries(PIECES[this.buildPiece].cost).map(([id,n])=>`${n} ${ITEMS[id as ItemId].displayName}`).join(' · ')}:null,fps:this.fps,diagnostics:`${this.player.debugText()}\n${this.fps.toFixed(0)} FPS  /  ${this.frameMs.toFixed(1)} MS\n${stats.calls} DRAW CALLS  /  ${stats.triangles.toLocaleString()} TRIANGLES\nPOSITION  ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\nWORLD SEED  ${state.seed}\nBIOME  ${this.environment.biomeAt(p.x,p.z).toUpperCase()}\nENTITIES  ${this.environment.nodes.filter(n=>n.remaining>0).length} NODES / ${state.structures.length} STRUCTURES\nTIME  ${hour.toFixed(2)} / ×${this.timeMultiplier}`,tutorial:this.tutorial()};
      this.ui.update(hud,state);
    }
  }
  private save(notify=true){if(!this.activeWorld)return;const success=saveGame(this.simulation.state);if(notify)this.ui.notify(success?'World saved. Your progress is safe.':'Storage is full or unavailable. Save could not be written.');this.ui.setSaveAvailable(hasSave());}
  private applySettings(s:Settings){this.settings={...s};this.projection.setBaseFov(s.fov);saveSettings(s);this.ui?.setSettings(s);this.audio?.setSettings(s);this.player?.setSettings(s);this.held.setFov(s.viewmodelFov);const qualityDpr=s.quality==='low'?1:s.quality==='medium'?Math.min(devicePixelRatio,1.25):Math.min(devicePixelRatio,1.6);this.renderer.setPixelRatio(Math.max(.5,qualityDpr*s.renderScale));this.renderer.shadowMap.enabled=s.shadows&&s.quality!=='low';this.environment?.setQuality(s.quality);this.resize();}
  private resize(){const w=window.innerWidth,h=window.innerHeight;this.projection.resize(w/Math.max(1,h));this.renderer.setSize(w,h,false);this.held.resize(w,h);}
  private dev(action:string,value?:number){if(!this.simulation)return;if(action==='resources'){for(const id of ['wood','stone','fiber','metal','berries'] as ItemId[])this.simulation.addItem(id,id==='berries'?30:2000);this.ui.notify('Development resources added');}if(action==='plan'){this.simulation.addItem('plan',1);this.ui.notify('Development building plan added');this.syncHeld();}if(action==='spawn')this.player.teleport(this.environment.spawn);if(action==='day')this.simulation.state.timeOfDay=10;if(action==='night')this.simulation.state.timeOfDay=0;if(action==='speed')this.timeMultiplier=20;if(action==='normal')this.timeMultiplier=1;if(action==='time'&&value!==undefined)this.simulation.state.timeOfDay=value;if(action==='collisions')this.debug.collisions=!this.debug.collisions;if(action==='sockets')this.debug.sockets=!this.debug.sockets;}
  private installDevAPI(){
    // The bridge is intentionally tiny and local-only. It powers deterministic browser smoke tests
    // and the in-game F3 diagnostics without changing simulation ownership.
    (window as unknown as {__TIDELAND:unknown}).__TIDELAND={
      setCapturePaused:(paused:boolean)=>{this.capturePaused=paused;},
      stationCandidate:()=>this.stationPlacement,
      landmarks:()=>this.worldSurvival.pois,
      stationPlace:(kind:StationKind,p:Vec3)=>this.placeStation(kind,new THREE.Vector3(p.x,p.y,p.z),0,true),command:(line:string)=>this.terminal.execute(line),
      cameraDebug:()=>this.player.cameraDebug(),
      cameraState:()=>({settings:{...this.settings},world:{fov:this.camera.fov,horizontalFov:horizontalFov(this.camera.fov,this.camera.aspect),aspect:this.camera.aspect,near:this.camera.near,far:this.camera.far,projection:this.camera.projectionMatrix.toArray(),position:this.camera.position.toArray(),rotation:[this.camera.rotation.x,this.camera.rotation.y,this.camera.rotation.z]},viewmodel:{...this.held.diagnostics(),fov:this.held.camera.fov,aspect:this.held.camera.aspect,projection:this.held.camera.projectionMatrix.toArray()},sprinting:this.player.sprinting}),
      snapshot:()=>structuredClone(this.simulation.state),nodes:()=>this.environment.nodes.map(n=>({...n})),getScreen:()=>this.screen,dev:(a:string,v?:number)=>this.dev(a,v),teleport:(p:Vec3)=>{this.player.teleport(p);this.simulation.state.player.position={...p};this.camera.position.set(p.x,p.y+PLAYER.EYE_HEIGHT,p.z);},lookAt:(p:Vec3)=>{const d=new THREE.Vector3(p.x,p.y,p.z).sub(this.camera.position);this.player.yaw=Math.atan2(-d.x,-d.z);this.player.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));},candidate:()=>this.candidate,interaction:()=>this.interactions.current?.info()??null,physics:()=>({position:this.physics.position(),grounded:this.player.grounded}),setPiece:(p:PieceType)=>{this.buildPiece=p;this.building=true;},save:()=>this.save(),stats:()=>({fps:this.fps,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles}),height:(x:number,z:number)=>this.environment.heightAt(x,z),gather:(id:string)=>{const n=this.environment.nodes.find(n=>n.id===id);if(n){this.cooldown=0;this.gather(n);}},sim:()=>this.simulation,placeAt:(piece:PieceType,p:Vec3,rotation=0)=>{const c=findBuildCandidate(piece,p,rotation,this.simulation.state.structures,(x,z)=>this.environment.heightAt(x,z),id=>this.simulation.count(id),this.simulation.state.player.position);const s=this.simulation.place(c);if(s)this.syncStructures();return {candidate:c,structure:s};},toggleDoor:(id:string)=>{this.simulation.toggleDoor(id);this.syncStructures();}
    };
  }
}
