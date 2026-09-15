import {WorldSurvival,IslandMap} from '../survival/WorldSurvival';
import {Weather,WEATHER} from '../survival/Weather';
import {countPlayerStations,createStation,isPlaceableStationKind,MAX_PLAYER_STATIONS,STATIONS,STATION_KINDS,transfer,takeAll,type Station,type StationKind} from '../survival/stations';
import {ensureProgression} from '../survival/progression';
import {activeLostPacks,consumeEmptyContainer,handlePlayerDeath,resolveRespawnBedroll,respawnPlayerState} from '../survival/death';
import {StationRenderer} from '../survival/StationRenderer';
import {StationUI} from '../survival/StationUI';
import {TechTreeUI} from '../crafting/TechTreeUI';
import {DevTerminal} from '../survival/DevTerminal';
import * as THREE from 'three';
import {FirstPersonProjection,horizontalFov} from '../camera/FirstPersonProjection';
import {Environment} from '../rendering/environment';
import {PhysicsWorld,initPhysics} from '../physics/PhysicsWorld';
import {PlayerController} from '../player/PlayerController';
import {Input} from '../input/Input';
import {GameSimulation} from '../simulation/GameSimulation';
import {UI} from '../ui/UI';
import {keyLabel} from '../ui/i18n';
import {AudioMixer,type FootstepSurface,type GatherTool} from '../audio/AudioMixer';
import {HeldItem} from '../rendering/HeldItem';
import {ImpactFX} from '../rendering/ImpactFX';
import {WorldPostFX} from '../rendering/WorldPostFX';
import {GatheringFeedback,type GatherStrike} from '../rendering/GatheringFeedback';
import {StructureRenderer} from '../building/StructureRenderer';
import {HammerMenu} from '../building/HammerMenu';
import {structureCurrentHealth,structureGrade,structureMaxHealth} from '../building/grades';
import {findBuildCandidate,PIECES} from '../building/rules';
import {InteractionSystem} from '../entities/InteractionSystem';
import {WorldItems} from '../entities/WorldItems';
import {DebugView} from '../diagnostics/DebugView';
import {saveGame,loadGame,listSaveSlots,latestSaveSlot,deleteSave,resetSave,loadSettings,saveSettings} from '../save/storage';
import {ITEMS} from '../items/definitions';
import {GATHERING} from '../config/gameplay';
import {randomSource} from '../world/noise';
import {PLAYER,WORLD,BUILD} from '../config/balance';
import {fallDamageForSpeed} from '../player/fallDamage';
import type {BuildCandidate,GameState,HUDData,ItemId,PieceType,ResourceNode,Screen,Settings,Structure,Vec3} from '../core/types';
export class GameApp {
  readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(60,1,.075,1700);private readonly projection=new FirstPersonProjection(this.camera);readonly renderer:THREE.WebGLRenderer;
  readonly ui:UI;readonly input:Input;readonly audio:AudioMixer;readonly held=new HeldItem();readonly impactFx:ImpactFX;readonly gatheringFeedback:GatheringFeedback;readonly postFX:WorldPostFX;readonly torchLight=new THREE.PointLight(0xffd0a0,0,14,2);readonly interactions=new InteractionSystem();
  environment!:Environment;physics!:PhysicsWorld;player!:PlayerController;simulation!:GameSimulation;structures!:StructureRenderer;worldItems!:WorldItems;debug:DebugView;
  private settings:Settings=loadSettings();private screen:Screen='menu';private activeWorld=false;private activeSaveSlot:number|null=null;private building=false;private buildPiece:PieceType='foundation';private buildRotation=0;private candidate:BuildCandidate|null=null;
  private ray=new THREE.Raycaster();private screenCenter=new THREE.Vector2();private groundMesh!:THREE.Mesh;private targetPoint=new THREE.Vector3();private direction=new THREE.Vector3();
  private pendingHit:{node:ResourceNode;remaining:number;strike:GatherStrike}|null=null;
  private capturePaused=false;
  private worldSurvival!:WorldSurvival;private weather!:Weather;private islandMap!:IslandMap;private uiContainer:HTMLElement;
  private hammerMenu:HammerMenu;private terminalReturn:Screen='menu';
  private stationRenderer!:StationRenderer;private stationUI:StationUI;private techTreeUI:TechTreeUI;private terminal:DevTerminal;private openStation:string|null=null;private stationIds=new Set<string>();private stationPlacement:{kind:StationKind;position:THREE.Vector3;valid:boolean}|null=null;
  private lastSafeGrounded:Vec3|null=null;

  private last=0;private accumulator=0;private uiTimer=0;private elapsed=0;private autoSave=0;private cooldown=0;private fps=60;private frameMs=16.7;private timeMultiplier=1;private loading=false;private leftDown=false;private loopStarted=false;private loopMode:'vsync'|'uncapped'|null=null;private frameChannel:MessageChannel|null=null;private knownStructures=new Map<string,string>();private rainBarrels:THREE.Group[]=[];private flyMode=false;private godMode=false;
  constructor(private canvas:HTMLCanvasElement,uiRoot:HTMLElement){
    this.uiContainer=uiRoot;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.postFX=new WorldPostFX(this.renderer,this.scene,this.camera);
    this.input=new Input(canvas);this.audio=new AudioMixer(this.settings);this.impactFx=new ImpactFX(this.scene);this.gatheringFeedback=new GatheringFeedback(this.scene);this.scene.add(this.torchLight);this.debug=new DebugView(this.scene);
    this.ui=new UI(uiRoot,{
      respawn:()=>this.respawn(),
      newGame:(seed,slot)=>{const target=slot??this.firstFreeSaveSlot();deleteSave(target);this.refreshSaveSlots();void this.start(seed??this.randomWorldSeed(),undefined,target);},continueGame:slot=>{const target=slot??latestSaveSlot();const saved=target!==null?loadGame(target):null;if(saved&&target!==null)void this.start(saved.seed,saved,target);else this.ui.notify('No valid save was found. Start a new island.');},resume:()=>this.setScreen('playing'),save:()=>this.save(),mainMenu:()=>{if(this.activeWorld&&this.activeSaveSlot!==null)this.save(false,false);this.setScreen('menu');},resetSave:()=>{resetSave();this.activeSaveSlot=null;this.refreshSaveSlots();this.ui.notify('All saved worlds removed');},deleteSave:slot=>this.deleteSaveSlot(slot),settings:s=>this.applySettings(s),setScreen:s=>this.setScreen(s),
      moveItem:(from,to,split)=>{this.simulation.moveItem(from,to,split);this.syncHeld();},dropItem:slot=>{const p=this.dropPosition();this.simulation.dropItem(slot,p);this.syncWorldItems();this.syncHeld();},consume:slot=>{if(this.simulation.consume(slot))this.audio.play('eat');this.syncHeld();},craft:id=>{this.simulation.craft(id);},canCraft:id=>this.simulation?.canCraft(id)??false,selectSlot:slot=>{this.simulation.selectSlot(slot);this.syncHeld();},selectPiece:piece=>{this.buildPiece=piece;this.building=true;},dev:(a,v)=>this.dev(a,v)
    });
    this.stationUI=new StationUI(uiRoot,{move:(id,a,b,split)=>{const station=this.station(id);if(!station)return;const moved=transfer(this.simulation.state.inventory,station,a,b,split,p=>this.simulation.fitsQueue(p));if(!moved){this.ui.notify('Transfer blocked: slot type, capacity or reserved crafting space');return;}this.consumeDisposable(station);},takeAll:id=>{const s=this.station(id);if(!s)return;const hadLoot=s.inventory.some(Boolean),moved=takeAll(this.simulation.state.inventory,s,p=>this.simulation.fitsQueue(p));if(hadLoot&&moved>0)this.consumeDisposable(s);},toggle:id=>{const s=this.station(id);if(s)s.active=!s.active;},spawn:id=>{ensureProgression(this.simulation.state).spawnId=id;this.ui.notify('Respawn point set');},openTechTree:id=>this.openTechTree(id),close:()=>{this.stationUI.close();this.openStation=null;this.setScreen('playing');}});
    this.techTreeUI=new TechTreeUI(uiRoot,{research:id=>{const result=this.simulation.researchTech(id);if(result.ok){this.ui.notify(`Research complete · ${result.node?.displayName} unlocked`);this.save(false,false);}return result;},close:()=>this.closeTechTree()});
    this.hammerMenu=new HammerMenu(uiRoot,{state:()=>this.simulation.state,structure:id=>this.simulation.state.structures.find(s=>s.id===id),upgrade:id=>this.applyHammerAction(id,'upgrade'),repair:id=>this.applyHammerAction(id,'repair'),rotate:id=>this.applyHammerAction(id,'rotate'),demolish:id=>this.applyHammerAction(id,'demolish'),notify:message=>this.ui.notify(message),close:()=>{if(this.screen==='station')this.setScreen('playing');}});
    this.terminal=new DevTerminal(uiRoot,open=>{if(open){this.terminalReturn=this.screen;this.setScreen('pause');}else this.setScreen(this.terminalReturn);});this.registerCommands();
    this.input.onLook=(x,y)=>{if(this.screen==='playing'&&this.player){this.player.look(x,y);this.held.look(x,y);}};this.input.onKey=code=>this.onKey(code);
    this.input.onClick=button=>{if(this.screen!=='playing')return;if(!this.input.locked){void this.input.lock();if(button===0){this.leftDown=true;this.use();}if(button===2){this.building=false;this.candidate=null;this.structures.preview(null);}return;}if(button===0){this.leftDown=true;this.use();}if(button===2){if(this.activeItem()==='hammer'&&this.openHammerMenu())return;this.building=false;this.candidate=null;this.structures.preview(null);}};
    this.input.onWheel=dir=>{if(this.screen!=='playing')return;if(this.building)this.cyclePiece(dir);else{this.simulation.selectSlot((this.simulation.state.activeSlot+dir+6)%6);this.syncHeld();}};
    this.input.onLockChange=locked=>{if(!locked){this.leftDown=false;if(this.screen==='playing'&&!this.loading)this.setScreen('pause');}};
    window.addEventListener('mouseup',()=>this.leftDown=false);window.addEventListener('resize',()=>this.resize());document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.screen==='playing')this.setScreen('pause');});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.setScreen('pause');this.ui.notify('Graphics context interrupted. Restoring…');});canvas.addEventListener('webglcontextrestored',()=>{this.applySettings(this.settings);this.ui.notify('Graphics restored. Resume when ready.');});
    window.addEventListener('beforeunload',()=>{if(this.activeWorld&&this.activeSaveSlot!==null)saveGame(this.simulation.state,this.activeSaveSlot);});
    this.ui.setSettings(this.settings);this.refreshSaveSlots();this.ui.setLoading(true);this.projection.setBaseFov(this.settings.fov);this.resize();
  }
  async init(){this.ui.setLoading(true);await this.loadingStage(3,'Bootstrapping renderer','Creating the WebGL pipeline and interface');await this.loadingStage(8,'Starting physics engine','Loading Rapier and preparing collision workers');await initPhysics();await this.loadingStage(13,'Preparing preview island','Generating a ready-to-play world behind the main menu');await this.makeWorld(WORLD.SEED);await this.warmUpWorld();this.activeWorld=false;this.ui.setLoading(false);this.setScreen('menu');this.installDevAPI();this.loopStarted=true;this.configureFrameLoop();}
  private configureFrameLoop(){
    const mode=this.settings.vsync?'vsync':'uncapped';if(this.loopMode===mode)return;this.loopMode=mode;
    this.renderer.setAnimationLoop(null);if(this.frameChannel){this.frameChannel.port1.close();this.frameChannel.port2.close();this.frameChannel=null;}this.last=performance.now();this.accumulator=0;
    if(mode==='vsync'){this.renderer.setAnimationLoop(t=>this.frame(t));return;}
    // setTimeout(0) is often clamped around 8 ms in foreground tabs, which made
    // "V-Sync OFF" slower than a 165 Hz display. MessageChannel keeps the game
    // submission loop uncapped by timer granularity; the browser compositor may
    // still present at the monitor refresh rate.
    const channel=new MessageChannel();this.frameChannel=channel;channel.port1.onmessage=()=>{if(this.frameChannel!==channel||this.loopMode!=='uncapped'||this.settings.vsync)return;this.frame(performance.now());channel.port2.postMessage(0);};channel.port2.postMessage(0);
  }
  private async makeWorld(seed:number,saved?:GameState){
    this.worldSurvival?.dispose();this.weather?.dispose();this.islandMap?.dispose();
    this.stationRenderer?.dispose();this.stationIds.clear();this.stationUI?.close();this.openStation=null;this.interactions.clear();this.gatheringFeedback.clear();this.knownStructures.clear();for(const barrel of this.rainBarrels)barrel.removeFromParent();this.rainBarrels=[];this.structures?.dispose();this.worldItems?.dispose();this.physics?.dispose();this.environment?.dispose();
    await this.loadingStage(17,'Shaping terrain heightfield','Generating beaches, valleys, slopes and the player spawn');
    this.environment=new Environment(this.scene,seed,saved ? saved.worldGeneration ?? 1 : 5,true);
    await this.environment.populateAsync((progress,status,detail)=>this.loadingStage(progress,status,detail));
    this.simulation=new GameSimulation(seed,this.environment.spawn,saved);this.simulation.onNotify=msg=>this.ui.notify(msg);
    await this.loadingStage(68,'Restoring resource state','Applying depleted nodes and saved world mutations');this.environment.syncNodes(this.simulation.state.nodeChanges);
    await this.loadingStage(72,'Building collision world','Creating terrain, resource and natural obstacle colliders');
    this.physics=new PhysicsWorld(this.environment.terrainGeometry,this.environment.colliders,this.simulation.state.player.position);
    await this.loadingStage(76,'Synchronizing physics','Removing depleted colliders and preparing the player body');
    // Saved depleted nodes keep their simulation state; remove their static
    // colliders after the physics bridge is rebuilt so invisible resources do
    // not become walls on a continued island.
    for (const node of this.environment.nodes) if ((this.simulation.state.nodeChanges[node.id] ?? node.remaining) <= 0) this.physics.removeNodeCollider(node.id);
    this.player=new PlayerController(this.physics,this.camera,this.input,this.settings,this.simulation.state);this.player.onStep=speed=>this.audio.footstep(this.footstepSurface(),speed);this.player.onLand=speed=>{const damage=fallDamageForSpeed(speed);this.player.lastFallDamage=damage;if(damage>0&&!this.flyMode){this.damagePlayer(damage,'fall');this.audio.play('error');if(this.simulation.state.player.stats.health>0)this.ui.notify(`Hard landing · ${damage} health lost`);}};
    await this.loadingStage(80,'Placing landmarks','Populating survival points of interest and weather systems');this.worldSurvival=new WorldSurvival(this.environment,this.scene,seed);this.worldSurvival.populate(this.simulation.state);this.physics.setStructure('landmarks',this.worldSurvival.collisionBoxes());this.weather=new Weather(this.scene);
    await this.loadingStage(84,'Preparing map and stations','Building navigation, station renderers and interaction data');this.islandMap=new IslandMap(this.uiContainer,this.worldSurvival,this.environment,p=>{const progress=ensureProgression(this.simulation.state);if(p)progress.waypoint=p;else delete progress.waypoint;},()=>{this.islandMap.close();this.setScreen('playing');});
    this.stationRenderer=new StationRenderer(this.scene);this.syncStations();
    this.structures=new StructureRenderer(this.scene);this.worldItems=new WorldItems(this.scene);
    this.groundMesh=new THREE.Mesh(this.environment.terrainGeometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    this.registerNodes();this.createWaterSources();this.syncStructures();this.syncWorldItems();this.syncHeld();this.applySettings(this.settings);this.player.tick(1/60,this.simulation.state,false);this.lastSafeGrounded={...this.simulation.state.player.position};this.accumulator=0;this.autoSave=0;this.building=false;this.candidate=null;
    await this.loadingStage(89,'Finalizing gameplay systems','Syncing structures, held items, saves and the first simulation frame');
  }
  private async start(seed:number,saved?:GameState,slot=1){
    if(this.loading)return;this.loading=true;this.ui.setLoading(true);void this.audio.start();void this.input.lock();
    try {await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const normalized=Number.isFinite(seed)?Math.trunc(seed):WORLD.SEED,prepared=!saved&&!this.activeWorld&&this.environment?.seed===normalized;if(prepared)await this.loadingStage(82,'Using prepared island','The menu preview already contains this seed, so the world can be reused');else await this.makeWorld(normalized,saved);await this.warmUpWorld();this.activeWorld=true;this.activeSaveSlot=slot;this.refreshSaveSlots();if(this.simulation.state.player.stats.health<=0)this.handleDeathLifecycle('legacy-save');else{this.screen='playing';this.ui.setScreen('playing');this.ui.notify(saved?`Welcome back · save slot ${slot}.`:`Washed ashore · save slot ${slot}.`);}}
    catch(error){console.error(error);this.ui.notify('The island could not be created. Reload to try again.');this.setScreen('menu');}
    finally{this.loading=false;this.ui.setLoading(false);}
  }
  private async loadingStage(progress:number,status:string,detail?:string){this.ui.setLoadingProgress(progress,status,detail);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
  private async warmUpWorld(){
    await this.loadingStage(91,'Compiling GPU shaders','Preparing terrain, foliage, lighting and first-person materials before gameplay');
    try{const renderer=this.renderer as THREE.WebGLRenderer&{compileAsync?:(scene:THREE.Object3D,camera:THREE.Camera)=>Promise<void>};if(renderer.compileAsync)await renderer.compileAsync(this.scene,this.camera);else this.renderer.compile(this.scene,this.camera);}catch{ /* Warm-up renders below still initialize the pipeline. */ }
    await this.loadingStage(94,'Uploading visible geometry','Rendering the island from multiple headings so buffers are resident on the GPU');
    const original=this.camera.quaternion.clone(),up=new THREE.Vector3(0,1,0);
    for(let i=0;i<8;i++){const turn=new THREE.Quaternion().setFromAxisAngle(up,i*Math.PI/4);this.camera.quaternion.copy(original).premultiply(turn);this.postFX.render();this.ui.setLoadingProgress(94+(i+1)*.32,'Uploading visible geometry',`Warm-up view ${i+1} / 8`);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
    this.camera.quaternion.copy(original);
    await this.loadingStage(97,'Stabilizing frame pacing','Waiting for startup shader compilation and asset uploads to leave the live frame budget');
    let stable=0,previous=performance.now();for(let i=0;i<24&&stable<6;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const now=performance.now(),frame=now-previous;previous=now;stable=frame<34?stable+1:0;this.postFX.render();this.ui.setLoadingProgress(97+Math.min(2.4,(i+1)*.1),'Stabilizing frame pacing',`Stable frames ${stable} / 6 · last ${frame.toFixed(1)} ms`);}
    this.frameMs=16.7;this.fps=60;this.last=performance.now();this.accumulator=0;
    this.ui.setLoadingProgress(100,'Ready','Renderer warm-up complete · entering the island with clean FPS timing');
    await new Promise<void>(resolve=>setTimeout(resolve,120));
  }
  private setScreen(screen:Screen){if(screen==='playing'&&!this.activeWorld)return;this.screen=screen;this.ui.setScreen(screen);this.input.keys.clear();this.leftDown=false;if(screen==='playing'){void this.audio.start();void this.input.lock();}else{this.input.release();this.structures?.preview(null);}this.refreshSaveSlots();}
  private onKey(code:string){
    const keys=this.settings.keybinds;
    if(this.screen==='dead')return;
    if((code===keys.map||code==='Escape')&&this.islandMap?.isOpen){this.islandMap.close();this.setScreen('playing');return;}
    if(code===keys.map&&this.screen==='playing'){this.islandMap.show();this.setScreen('station');return;}
    if(code==='F10'||code==='Backquote'){this.terminal.toggle();return;}
    if(this.terminal.isOpen)return;
    if(code==='Escape'&&this.techTreeUI?.isOpen){this.closeTechTree();return;}
    if(code==='Escape'&&this.stationUI.isOpen){this.stationUI.close();this.openStation=null;this.setScreen('playing');return;}
    if(code===keys.maintenance&&this.screen==='playing'){if(this.activeItem()==='hammer')this.openHammerMenu();else this.ui.notify('Equip a builder\'s hammer, aim at a structure and use RMB');return;}
    if(code==='Escape'&&this.screen==='settings'){this.ui.backFromSettings();return;}
    if(code==='F3'){this.ui.toggleDiagnostics();return;}
    if(code==='Escape'){if(this.screen==='playing'||this.screen==='inventory')this.setScreen('pause');else if(this.screen==='pause')this.setScreen('playing');else if(this.screen==='settings')this.setScreen(this.activeWorld?'pause':'menu');return;}
    if(code===keys.inventory){if(this.screen==='playing')this.setScreen('inventory');else if(this.screen==='inventory')this.setScreen('playing');return;}
    if(this.screen!=='playing')return;
    if(/^Digit[1-6]$/.test(code)){this.simulation.selectSlot(Number(code.slice(-1))-1);this.building=false;this.syncHeld();}
    if(code===keys.jump)this.player.jump();
    if(code===keys.autoRun){const enabled=this.player.toggleAutoRun();this.ui.notify(this.settings.language==='cs'?(enabled?'Automatický běh zapnut':'Automatický běh vypnut'):(enabled?'Auto-run enabled':'Auto-run disabled'));}
    if(code===keys.inspect)this.held.inspect();
    if(code===keys.interact)this.interactions.trigger();
    if(code===keys.build)this.toggleBuild();
    if(code===keys.rotate&&(this.building||this.stationPlacement))this.buildRotation+=Math.PI/2;
    if(code===keys.cycleBuild&&this.building)this.cyclePiece(1);
    if(code===keys.use){const slot=this.simulation.state.activeSlot;if(this.simulation.consume(slot)){this.audio.play('eat');this.syncHeld();}}
  }
  private toggleBuild(){
    if(this.building){this.building=false;return;}
    if(!this.simulation.count('plan')){this.ui.notify('Craft a building plan in your inventory [TAB]');this.audio.play('error');return;}
    const slot=this.simulation.state.inventory.findIndex(s=>s?.itemId==='plan');if(slot>=6){const free=this.simulation.state.inventory.slice(0,6).findIndex(s=>!s);this.simulation.moveItem(slot,free>=0?free:this.simulation.state.activeSlot);this.simulation.selectSlot(free>=0?free:this.simulation.state.activeSlot);}else this.simulation.selectSlot(slot);
    this.syncHeld();this.building=true;
  }
  private cyclePiece(direction:number){const pieces:PieceType[]=['foundation','wall','doorway','door','floor','roof'];this.buildPiece=pieces[(pieces.indexOf(this.buildPiece)+direction+pieces.length)%pieces.length];}
  private syncHeld(){if(!this.simulation)return;const item=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId??null;this.held.set(item);if(item==='plan')this.building=true;else this.building=false;}
  private activeItem(){return this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId??null;}
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
    for(const node of this.environment.nodes){const object=this.environment.nodeObjects.get(node.id);if(!object)continue;const pickup=['fiber','berries','wood'].includes(node.kind);
      this.interactions.register({id:node.id,kind:'resource',object,position:()=>node.position,enabled:()=>node.remaining>0,info:()=>pickup?{title:GATHERING[node.kind].label,action:'PICK UP',key:keyLabel(this.settings.keybinds.interact),detail:`${ITEMS[GATHERING[node.kind].itemId].displayName.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`,progress:node.remaining/node.capacity}:{title:GATHERING[node.kind].label,action:'',key:'',detail:`${Math.ceil(node.remaining)} / ${Math.ceil(node.capacity)} HP`,progress:node.remaining/node.capacity},interact:()=>{if(pickup)this.gather(node,true,this.resourceStrike(node,object));}});
    }
  }
  private resourceStrike(node:ResourceNode,object?:THREE.Object3D):GatherStrike{
    this.ray.setFromCamera(this.screenCenter,this.camera);this.ray.far=PLAYER.INTERACT_DISTANCE+1;
    const hit=object?this.ray.intersectObject(object,true)[0]:undefined;
    const fallback=new THREE.Vector3(node.position.x,node.position.y+(node.kind==='tree'?1.8:.55)*node.scale,node.position.z);
    return this.gatheringFeedback.capture(node,this.ray.ray,hit?.point??fallback);
  }
  private gather(node:ResourceNode,animate=true,strike?:GatherStrike){
    if(this.cooldown>0)return;const actual=strike??this.resourceStrike(node,this.environment.nodeObjects.get(node.id));const active=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId;
    const result=this.simulation.gather(node,actual.weakSpot);if(result.amount<=0)return;
    this.cooldown=['fiber','berries','wood'].includes(node.kind)?.22:.62;if(animate)this.held.hit();if(['tree','stone','metal','wood'].includes(node.kind))this.held.impact();
    const kind=node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'||node.kind==='sulfur'||node.kind==='hqmetal'?'metal':node.kind as 'fiber'|'berries';
    this.impactFx.burst(actual.point,kind,actual.weakSpot?1.55:1);this.gatheringFeedback.onHit(node,actual.point,actual.weakSpot,result.depleted);this.ui.resourceHit(node.kind,result.amount,result.depleted,actual.weakSpot);
    if(['tree','stone','metal','sulfur','hqmetal'].includes(node.kind))this.audio.gather((active==='rock'||active==='hatchet'||active==='pickaxe'?active:null) as GatherTool|null,(node.kind==='sulfur'||node.kind==='hqmetal'?'metal':node.kind) as 'tree'|'stone'|'metal',actual.weakSpot);else this.audio.play('pickup');
    if(result.depleted&&node.kind==='tree'){this.environment.fallTree(node.id,this.simulation.state.player.position);this.audio.treeFall();}else if(!result.depleted)this.environment.hitNode(node.id,actual.weakSpot?1.45:1);
    this.environment.syncNodes(this.simulation.state.nodeChanges);if(result.depleted)this.physics.removeNodeCollider(node.id);
  }
  private use(){
    if(this.cooldown>0)return;
    if(this.stationPlacement){this.placeStation(this.stationPlacement.kind,this.stationPlacement.position,this.buildRotation);return;}
    if(this.building){if(this.candidate){const s=this.simulation.place(this.candidate);if(s){this.syncStructures();this.impactFx.burst(this.candidate.position,'build');this.audio.play('build');this.held.hit();this.cooldown=.28;}else this.audio.play('error');}return;}
    const target=this.interactions.current;
    if(target?.kind==='resource'){const node=this.environment.nodes.find(n=>n.id===target.id);if(node&&['tree','stone','metal','sulfur','hqmetal'].includes(node.kind)){const active=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId;if(active==='rock'||active==='hatchet'||active==='pickaxe'){this.held.hit();this.pendingHit={node,remaining:.13,strike:this.resourceStrike(node,target.object)};this.cooldown=.62;}else target.interact();}else target.interact();return;}
    const slot=this.simulation.state.activeSlot,item=this.simulation.state.inventory[slot]?.itemId;
    if(item&&ITEMS[item].consumable){if(this.simulation.consume(slot)){this.audio.play('eat');this.cooldown=.7;this.syncHeld();}}else{this.held.hit();this.cooldown=.5;}
  }
  private syncStructures(){
    const state=this.simulation.state;for(const id of this.knownStructures.keys())if(!state.structures.some(s=>s.id===id)){this.physics.removeStructure(id);this.interactions.remove(id);this.knownStructures.delete(id);}this.structures.sync(state.structures);this.environment.coverGrass(state.structures);
    for(const s of state.structures){const signature=`${s.open??false}|${s.flipped??false}|${structureGrade(s)}`;if(!this.knownStructures.has(s.id)||this.knownStructures.get(s.id)!==signature){this.physics.setStructure(s.id,this.structures.boxes(s));this.knownStructures.set(s.id,signature);}
      const existing=this.interactions.entries.get(s.id);if(existing)existing.object=this.structures.objects.get(s.id)!;else this.interactions.register({id:s.id,kind:'structure',object:this.structures.objects.get(s.id)!,position:()=>s.position,enabled:()=>this.activeItem()==='hammer'||s.pieceType==='door',info:()=>this.activeItem()==='hammer'?{title:s.pieceType.toUpperCase(),action:'',key:'RMB',structure:{grade:structureGrade(s),currentHealth:structureCurrentHealth(s),maxHealth:structureMaxHealth(s)}}:{title:'Timber door',action:s.open?'CLOSE':'OPEN',key:keyLabel(this.settings.keybinds.interact)},interact:()=>{if(this.activeItem()!=='hammer'&&this.simulation.toggleDoor(s.id)){this.syncStructures();this.audio.play('door');}}});}
  }
  private syncWorldItems(){this.worldItems.sync(this.simulation.state.drops);for(const [id,entry] of this.interactions.entries)if(entry.kind==='drop'&&!this.worldItems.objects.has(id))this.interactions.remove(id);for(const drop of this.simulation.state.drops){if(this.interactions.entries.has(drop.id))continue;this.interactions.register({id:drop.id,kind:'drop',object:this.worldItems.objects.get(drop.id)!,position:()=>drop.position,enabled:()=>true,info:()=>({title:ITEMS[drop.stack.itemId].displayName,action:`PICK UP ×${drop.stack.count}`,key:keyLabel(this.settings.keybinds.interact)}),interact:()=>{if(this.simulation.pickup(drop.id)){this.audio.play('pickup');this.syncWorldItems();this.syncHeld();}}});}}
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
  private openTechTree(id:string){const station=this.station(id);if(!station||!station.kind.startsWith('workbench'))return;this.techTreeUI.open(station,this.simulation.state);this.input.release();}
  private closeTechTree(){this.techTreeUI.close();this.input.release();}
  private consumeDisposable(s:Station):void{
    const removed=consumeEmptyContainer(this.simulation.state,s.id);if(!removed)return;
    this.stationUI.close();this.openStation=null;this.stationRenderer.collapseContainer(s.id);this.syncStations();this.audio.play('pickup');this.ui.notify(removed.kind==='deathbag'?'Lost Pack recovered':'Salvage cache emptied');this.save(false,false);
    if(this.screen==='station')this.setScreen('playing');
  }
  private syncStations(){const stations=ensureProgression(this.simulation.state).stations,ids=new Set(stations.map(s=>s.id));for(const id of [...this.stationIds])if(!ids.has(id)){this.stationIds.delete(id);this.interactions.remove(id);this.physics?.removeStructure(id);}this.stationRenderer.sync(stations);for(const s of stations)if(!this.stationIds.has(s.id)){this.stationIds.add(s.id);const size=STATIONS[s.kind].size;this.environment.coverArea(s.id,s.position,size[0]+.25,size[2]+.25,s.rotation);this.physics.setStructure(s.id,this.stationRenderer.boxes(s));this.interactions.register({id:s.id,kind:'station',object:this.stationRenderer.objects.get(s.id)!,position:()=>s.position,enabled:()=>true,info:()=>({title:STATIONS[s.kind].name,action:'OPEN',key:keyLabel(this.settings.keybinds.interact)}),interact:()=>{this.openStation=s.id;this.setScreen('station');this.stationUI.open(s,this.simulation.state.inventory);}});}}
  private updateStationPreview(){const item=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId;const kind=item&&STATION_KINDS.includes(item as StationKind)?item as StationKind:null;if(!kind||!isPlaceableStationKind(kind)){this.stationPlacement=null;this.stationRenderer.preview(null);return false;}this.ray.setFromCamera(this.screenCenter,this.camera);this.ray.far=5;const hit=this.ray.intersectObjects([this.groundMesh,...this.structures.objects.values()],true)[0];const position=hit?.point.clone()??this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(this.direction),3);const valid=!!hit&&hit.face!==null&&Math.abs(hit.face?.normal.y??0)>.7&&this.stationCanPlace(kind,position);this.stationPlacement={kind,position,valid};this.stationRenderer.preview(kind,position,this.buildRotation,valid);return true;}
  private stationCanPlace(kind:StationKind,p:Vec3){const [w,h,d]=STATIONS[kind].size;if(p.y<0||Math.hypot(p.x-this.simulation.state.player.position.x,p.z-this.simulation.state.player.position.z)<1.1)return false;for(const s of ensureProgression(this.simulation.state).stations){const size=STATIONS[s.kind].size;if(Math.hypot(s.position.x-p.x,s.position.z-p.z)<Math.hypot(w,d)/2+Math.hypot(size[0],size[2])/2&&Math.abs(s.position.y-p.y)<h)return false;}for(const c of [...this.environment.colliders,...this.simulation.state.structures.flatMap(s=>this.structures.boxes(s)),...this.worldSurvival.collisionBoxes()]){if(c.nodeId&&this.simulation.state.nodeChanges[c.nodeId]===0)continue;if(Math.abs(c.position.x-p.x)<w/2+c.halfExtents.x&&Math.abs(c.position.z-p.z)<d/2+c.halfExtents.z&&c.position.y+c.halfExtents.y>p.y+.15&&c.position.y-c.halfExtents.y<p.y+h)return false;}return true;}
  private placeStation(kind:StationKind,p:THREE.Vector3,rotation=0,dev=false){if(!STATION_KINDS.includes(kind)||!isPlaceableStationKind(kind))return null;if(!dev&&(!this.stationPlacement?.valid||!this.stationCanPlace(kind,p))){this.ui.notify('Cannot place: aim at an unobstructed surface');return null;}const state=this.simulation.state;if(countPlayerStations(ensureProgression(state).stations)>=MAX_PLAYER_STATIONS){this.ui.notify('Station limit reached');return null;}if(!dev){const slot=state.inventory[state.activeSlot];if(slot?.itemId!==kind)return null;if(--slot.count===0)state.inventory[state.activeSlot]=null;}const station=createStation(`station-${state.nextId++}`,kind,p,rotation);ensureProgression(state).stations.push(station);this.syncStations();this.syncHeld();this.audio.play('build');this.cooldown=.3;return station;}
  private respawn(){const state=this.simulation.state;if(ensureProgression(state).death?.phase!=='dead')return;const target=this.respawnLocation();if(!respawnPlayerState(state))return;this.pendingHit=null;this.cooldown=0;this.building=false;this.candidate=null;this.stationPlacement=null;this.structures.preview(null);this.stationRenderer.preview(null);if(this.hammerMenu.isOpen)this.hammerMenu.close();this.stationUI.close();this.openStation=null;this.flyMode=false;this.ui.setDevModes(this.flyMode,this.godMode);this.held.set(null);this.player.resetForRespawn(target.position);state.player.position={...target.position};this.lastSafeGrounded={...target.position};this.syncHeld();this.audio.play('ui');this.setScreen('playing');this.ui.playRespawnFade();this.save(false);}
  private safeDeathPosition():Vec3{
    const p=this.simulation.state.player.position,half=this.environment.terrain.halfSize,valid=[p.x,p.y,p.z].every(Number.isFinite)&&Math.abs(p.x)<=half&&Math.abs(p.z)<=half;
    if(valid){const ground=this.environment.heightAt(p.x,p.z);if(ground>.12)return {x:p.x,y:this.player.grounded?Math.max(ground+.06,p.y):ground+.06,z:p.z};}
    if(this.lastSafeGrounded)return {...this.lastSafeGrounded};return {...this.environment.spawn};
  }
  private respawnCandidate(origin:Vec3,ignoreStation?:string):Vec3|null{
    const half=this.environment.terrain.halfSize;if(![origin.x,origin.z].every(Number.isFinite)||Math.abs(origin.x)>half||Math.abs(origin.z)>half)return null;const terrain=this.environment.heightAt(origin.x,origin.z);if(terrain<.12||this.environment.terrain.slopeAt(origin.x,origin.z)>.7)return null;const y=Math.max(terrain+.06,origin.y);
    const blocked=[...this.environment.colliders,...ensureProgression(this.simulation.state).stations.filter(s=>s.id!==ignoreStation).flatMap(s=>this.stationRenderer.boxes(s)),...this.simulation.state.structures.flatMap(s=>this.structures.boxes(s))].some(c=>Math.abs(c.position.x-origin.x)<c.halfExtents.x+.43&&Math.abs(c.position.z-origin.z)<c.halfExtents.z+.43&&c.position.y+c.halfExtents.y>y+.08&&c.position.y-c.halfExtents.y<y+1.75);
    return blocked?null:{x:origin.x,y,z:origin.z};
  }
  private respawnLocation():{position:Vec3;bedroll:boolean}{
    const bed=resolveRespawnBedroll(this.simulation.state);
    if(bed){for(const [x,z] of [[1.65,0],[-1.65,0],[0,2.05],[0,-2.05],[2.1,1.4],[-2.1,-1.4]]){const candidate=this.respawnCandidate({x:bed.position.x+x,y:bed.position.y+.25,z:bed.position.z+z},bed.id);if(candidate)return {position:candidate,bedroll:true};}}
    for(const [x,z] of [[0,0],[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]]){const candidate=this.respawnCandidate({x:this.environment.spawn.x+x,y:this.environment.spawn.y,z:this.environment.spawn.z+z});if(candidate)return {position:candidate,bedroll:false};}
    return {position:{...this.environment.spawn},bedroll:false};
  }
  private updateDeathContext(){const progress=ensureProgression(this.simulation.state),bed=resolveRespawnBedroll(this.simulation.state),pack=progress.death?.packId?this.station(progress.death.packId):undefined,origin=bed?.position??this.environment.spawn;this.ui.setDeathContext({atBedroll:!!bed,lostPack:!!pack,...(pack?{distance:Math.hypot(pack.position.x-origin.x,pack.position.z-origin.z)}:{})});}
  private handleDeathLifecycle(cause='survival'){
    if(this.godMode){this.simulation.state.player.stats.health=100;return null;}const result=handlePlayerDeath(this.simulation.state,this.safeDeathPosition(),cause);this.pendingHit=null;this.leftDown=false;this.building=false;this.candidate=null;this.stationPlacement=null;this.structures.preview(null);this.stationRenderer.preview(null);if(this.hammerMenu.isOpen)this.hammerMenu.close();this.stationUI.close();this.openStation=null;this.held.set(null);this.syncStations();this.updateDeathContext();this.audio.play('error');this.setScreen('dead');this.save(false,false);return result;
  }
  /** Stable future entrypoint for wildlife, hazards, world events and combat. */
  damagePlayer(amount:number,cause='environment'){const safeCause=typeof cause==='string'?cause.slice(0,80):'environment';if(!Number.isFinite(amount)||amount<=0)return this.simulation.damagePlayer(amount,safeCause);if(this.godMode)return {ok:true,health:this.simulation.state.player.stats.health,killed:false,cause:safeCause};const result=this.simulation.damagePlayer(amount,safeCause);if(result.killed)this.handleDeathLifecycle(safeCause);return result;}
  private hammerTarget(){this.ray.setFromCamera(this.screenCenter,this.camera);this.ray.far=PLAYER.INTERACT_DISTANCE;const hit=this.ray.intersectObjects([...this.structures.objects.values()],true)[0],id=hit?.object.userData.structureId;return this.simulation.state.structures.find(s=>s.id===id);}
  private openHammerMenu(){const structure=this.hammerTarget();if(!structure){this.ui.notify('Aim the hammer at a structure');return false;}this.setScreen('station');this.hammerMenu.open(structure);return true;}
  private applyHammerAction(id:string,action:'upgrade'|'repair'|'rotate'|'demolish'){
    const before=this.simulation.state.structures.find(s=>s.id===id),position=before?{...before.position}:null;
    const result=action==='upgrade'?this.simulation.upgradeStructure(id):action==='repair'?this.simulation.repairStructure(id):action==='rotate'?this.simulation.rotateStructure(id):this.simulation.demolishStructure(id);
    if(result.ok){this.syncStructures();if(position&&action!=='rotate')this.impactFx.burst(position,'build',action==='demolish'?1.45:1);this.audio.play(action==='rotate'?'door':'build');this.held.hit();}
    return result;
  }
  /** Stable future entrypoint for raids, NPC attacks and decay. */
  damageStructure(id:string,amount:number){const target=this.simulation.state.structures.find(s=>s.id===id),position=target?{...target.position}:null,result=this.simulation.damageStructure(id,amount);if(result.ok){this.syncStructures();if(position)this.impactFx.burst(position,'build',result.removedIds?.length?1.5:.65);}return result;}
  private registerCommands(){const t=this.terminal;t.register('camdebug','on | off',args=>{this.ui.setDiagnostics(args[0]!=='off');return this.player.debugText();});t.register('fov','60–100',args=>{const value=Number(args[0]);if(!Number.isFinite(value)||value<60||value>100)throw Error('FOV must be 60–100');this.applySettings({...this.settings,fov:value});});t.register('time','day | evening | night',args=>{const hours:Record<string,number>={day:10,evening:17.5,night:0};if(!(args[0] in hours))throw Error('Use day, evening or night');this.simulation.state.timeOfDay=hours[args[0]];});t.register('give','resources | buildkit',args=>{if(args[0]==='resources'){for(const id of ['wood','stone','fiber','ore','metal'] as ItemId[])this.simulation.addItem(id,2000);}else if(args[0]==='buildkit'){for(const id of ['plan','storage','furnace','workbench1','workbench2','workbench3','campfire','bedroll'] as ItemId[])this.simulation.addItem(id,1);}else throw Error('Use resources or buildkit');});t.register('spawn','storage | furnace | workbench1/2/3 | campfire | bedroll',args=>{if(!STATION_KINDS.includes(args[0] as StationKind))throw Error('Unknown station');const p=this.dropPosition();return this.placeStation(args[0] as StationKind,new THREE.Vector3(p.x,p.y,p.z),0,true)?.id;});t.register('teleport','spawn',args=>{if(args[0]==='spawn')this.player.teleport(this.environment.spawn);else {const poi=this.worldSurvival.pois.find(p=>p.id===args[0]);if(!poi)throw Error('Use spawn or '+this.worldSurvival.pois.map(p=>p.id).join(', '));const p={x:poi.position.x,y:this.environment.heightAt(poi.position.x,poi.position.z+7)+.2,z:poi.position.z+7};this.player.teleport(p);this.player.yaw=0;this.player.pitch=0;}});t.register('weather','clear | rain | fog | storm',args=>{if(!WEATHER.includes(args[0] as typeof WEATHER[number]))throw Error('Unknown weather');const w=ensureProgression(this.simulation.state).weather;w.kind=args[0] as typeof w.kind;w.remaining=300;});t.register('save','Save current world',()=>{this.save();});t.register('load','Continue saved world',async()=>{const saved=loadGame();if(!saved)throw Error('No valid save');await this.start(saved.seed,saved);});}
  private createWaterSources(){
    const rand=randomSource(this.simulation.state.seed+40391),positions:Vec3[]=[];
    const tryAdd=(x:number,z:number)=>{const y=this.environment.heightAt(x,z);if(y<2||y>31||this.environment.terrain.slopeAt(x,z)>.5||positions.some(p=>Math.hypot(p.x-x,p.z-z)<34))return false;positions.push({x,y,z});return true;};
    const p=this.environment.spawn,nearAngle=rand()*Math.PI*2;tryAdd(p.x+Math.cos(nearAngle)*10,p.z+Math.sin(nearAngle)*10);
    const span=this.environment.terrain.generation===5?this.environment.terrain.size*.78:510,target=this.environment.terrain.generation===5?14:9;
    for(let tries=0;tries<6000&&positions.length<target;tries++){const x=(rand()-.5)*span,z=(rand()-.5)*span;if(Math.hypot(x-p.x,z-p.z)<28)continue;tryAdd(x,z);}
    positions.forEach((position,index)=>{
      const g=new THREE.Group();g.position.set(position.x,position.y,position.z);g.rotation.y=rand()*Math.PI*2;
      const barrelMat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.51,.12,.34+rand()*.08),roughness:.84,metalness:.22}),ringMat=new THREE.MeshStandardMaterial({color:'#444943',metalness:.62,roughness:.48});
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.43,.4,.88,20,1,true),barrelMat);barrel.position.y=.44;barrel.castShadow=true;g.add(barrel);
      for(const h of [.08,.78]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.415,.024,6,20),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=h;g.add(ring);}
      const water=new THREE.Mesh(new THREE.CircleGeometry(.39,20),new THREE.MeshStandardMaterial({color:'#6096a3',roughness:.15,metalness:.35}));water.rotation.x=-Math.PI/2;water.position.y=.70;g.add(water);this.scene.add(g);this.rainBarrels.push(g);
      const id=`rain-collector-${index}`;this.interactions.register({id,kind:'water',object:g,position:()=>g.position,enabled:()=>true,info:()=>({title:'Rain collector',action:'DRINK FRESH WATER',key:keyLabel(this.settings.keybinds.interact),detail:'A little kindness left behind.'}),interact:()=>{this.simulation.state.player.stats.thirst=Math.min(100,this.simulation.state.player.stats.thirst+35);this.ui.notify('Hydration +35');this.audio.play('eat');}});
    });
  }
  private footstepSurface():FootstepSurface{
    const p=this.simulation.state.player.position;
    // Player-built floors/foundations get a dry timber transient; natural ground
    // maps the procedural biome to distinct sand/grass/forest/rock profiles.
    const onTimber=this.simulation.state.structures.some(s=>{if(!['foundation','floor','roof'].includes(s.pieceType))return false;const dx=Math.abs(s.position.x-p.x),dz=Math.abs(s.position.z-p.z);return dx<1.55&&dz<1.55&&Math.abs(p.y-s.position.y)<1.25;});
    if(onTimber)return 'wood';
    const biome=this.environment.biomeAt(p.x,p.z);
    if(biome==='COAST')return 'sand';
    if(biome==='ROCKY UPLAND'||biome==='ROCKY MOUNTAIN'||biome==='SNOW / ALPINE')return 'rock';
    if(biome==='FOREST'||biome==='TEMPERATE FOREST')return 'forest';
    return 'grass';
  }
  private tutorial(){if(this.stationPlacement)return `${STATIONS[this.stationPlacement.kind].name} · LMB place · R rotate · ${this.stationPlacement.valid?'READY':'Aim at a clear surface'}`;const s=this.simulation.state,waypoint=ensureProgression(s).waypoint;if(waypoint)return `WAYPOINT ${Math.round(Math.hypot(waypoint.x-s.player.position.x,waypoint.z-s.player.position.z))} m · M map · Hammer + RMB maintenance`; if(s.structures.length>=5)return 'Equip a builder\'s hammer and use RMB to improve your shelter.';if(s.structures.length>0)return 'Build your shelter.  ·  Q selects a piece · R rotates';if(this.simulation.count('plan'))return 'Equip your building plan.  ·  B to build';if(this.simulation.count('wood')>=25&&this.simulation.count('fiber')>=10)return 'You have the essentials.  ·  TAB to craft a building plan';return 'Find your footing.  ·  Gather wood and wild flax · TAB for crafting';}
  private frame(timestamp:number){
    const dt=Math.min((timestamp-(this.last||timestamp))/1000,.1);this.last=timestamp;if(!this.environment||this.loading)return;this.elapsed+=dt;this.frameMs=THREE.MathUtils.lerp(this.frameMs,dt*1000,.04);this.fps=1000/Math.max(this.frameMs,1);this.cooldown=Math.max(0,this.cooldown-dt);
    const playing=this.screen==='playing',running=playing||this.screen==='inventory'||this.screen==='station';
    if(this.pendingHit){if(!playing)this.pendingHit=null;else{this.pendingHit.remaining-=dt;if(this.pendingHit.remaining<=0){const {node,strike}=this.pendingHit;this.pendingHit=null;const p=this.simulation.state.player.position;if(Math.hypot(p.x-node.position.x,p.z-node.position.z)<=PLAYER.INTERACT_DISTANCE+node.scale){this.cooldown=0;this.gather(node,false,strike);}}}}
    if(running&&this.activeWorld){
      this.accumulator+=this.capturePaused?0:dt;let steps=0;while(this.accumulator>=1/60&&steps<6){if(this.flyMode)this.tickFly(1/60,playing);else this.player.tick(1/60,this.simulation.state,playing);this.simulation.tick(1/60,this.flyMode?false:this.player.sprinting);if(this.godMode){const stats=this.simulation.state.player.stats;stats.health=stats.hunger=stats.thirst=stats.stamina=100;}this.accumulator-=1/60;steps++;}
      if(this.timeMultiplier!==1)this.simulation.state.timeOfDay=(this.simulation.state.timeOfDay+dt*(this.timeMultiplier-1)*24/1800)%24;
      if(this.player.grounded&&this.environment.heightAt(this.simulation.state.player.position.x,this.simulation.state.player.position.z)>.12)this.lastSafeGrounded={...this.simulation.state.player.position};
      if(this.simulation.state.player.position.y<-.5)this.simulation.damagePlayer(dt*3,'deep-water');
      if(this.simulation.state.player.position.y<-9){this.player.teleport(this.environment.spawn);this.ui.notify('The current carried you back to shore');}
      if(this.simulation.state.player.stats.health<=0)this.handleDeathLifecycle('survival');
      this.player.renderCamera(this.accumulator/(1/60));
      this.autoSave+=dt;if(this.autoSave>60){if(this.activeSaveSlot!==null)this.save(false,false);this.autoSave=0;}
      if(this.screen==='playing'){this.updateBuild();this.interactions.update(this.camera,PLAYER.INTERACT_DISTANCE,[this.groundMesh,...this.structures.objects.values()].filter(o=>o!==this.interactions.current?.object));if(this.leftDown&&!this.building&&this.interactions.current?.kind==='resource'&&this.cooldown<=0)this.use();}
      else this.structures.preview(null);
      this.held.update(dt,this.player.speed,this.player.sprinting,this.player.crouching);
    } else if(this.screen==='menu'||(this.screen==='settings'&&!this.activeWorld)){
      const p=this.environment.spawn;this.camera.position.set(p.x+29,this.environment.heightAt(p.x+29,p.z+25)+9,p.z+25);this.camera.lookAt(p.x-25,10,p.z-60);
    }
    this.projection.update(dt,playing&&this.player.sprinting);
    const hour=this.activeWorld?this.simulation.state.timeOfDay:9.4;
    this.environment.update(dt,hour,this.camera.position);const weather=this.weather.update(running?dt:0,this.simulation.state,this.environment.atmosphere,this.camera.position,this.settings.quality);this.environment.windStrength=weather.wind;this.audio.setWeather(weather.rain);if(this.islandMap.isOpen){const progress=ensureProgression(this.simulation.state);this.islandMap.update(this.simulation.state.player.position,this.player.yaw,progress.waypoint,activeLostPacks(this.simulation.state).map(pack=>pack.position));}this.stationRenderer.update(ensureProgression(this.simulation.state).stations,this.elapsed,this.camera.position);if(this.openStation){const s=this.station(this.openStation);if(s)this.stationUI.update(s,this.simulation.state.inventory);}this.impactFx.update(dt);this.gatheringFeedback.update(dt,this.camera);this.updateTorchLight(this.screen==='playing');this.debug.update(this.physics,this.simulation.state.structures);
    // Keep diagnostics for the complete frame, including the separate viewmodel pass.
    this.renderer.info.autoReset=false;this.renderer.info.reset();
    const px=this.camera.position.x,py=this.camera.position.y,pz=this.camera.position.z,rx=this.camera.rotation.x,ry=this.camera.rotation.y,rz=this.camera.rotation.z;
    if(playing&&this.settings.cameraShake&&this.player.sprinting){const kick=.00115;this.camera.position.x+=Math.sin(this.elapsed*13.7)*kick;this.camera.position.y+=Math.sin(this.elapsed*19.1)*kick*.45;}
    const blur=this.settings.motionBlur&&playing?Math.min(.55,Math.max(0,(this.player.speed-2)*.09)):0;this.canvas.classList.toggle('motion-blur-active',blur>.02);this.canvas.style.setProperty('--motion-blur',`${blur.toFixed(2)}px`);
    this.postFX.update(hour,weather.blend,weather.storm);this.postFX.render();this.camera.position.set(px,py,pz);this.camera.rotation.set(rx,ry,rz,'YXZ');if(playing)this.held.render(this.renderer);
    this.uiTimer+=dt;if(this.uiTimer>=.1){this.uiTimer=0;const state=this.simulation.state,p=state.player.position;const stats=this.renderer.info.render;
      const c=this.candidate,slope=this.environment.terrain.slopeAt(p.x,p.z);const hud:HUDData={stats:state.player.stats,inventory:state.inventory,activeSlot:state.activeSlot,compass:-THREE.MathUtils.radToDeg(this.player.yaw),biome:this.environment.biomeAt(p.x,p.z),timeOfDay:hour,interaction:!this.building?this.interactions.current?.info()??null:null,build:this.building?{piece:this.buildPiece,valid:c?.valid??false,reason:c?.reason??'Aim at the ground',cost:Object.entries(PIECES[this.buildPiece].cost).map(([id,n])=>`${n} ${ITEMS[id as ItemId].displayName}`).join(' · ')}:null,fps:this.fps,diagnostics:`${this.player.debugText()}\n${this.fps.toFixed(0)} FPS  /  ${this.frameMs.toFixed(1)} MS\n${stats.calls} DRAW CALLS  /  ${stats.triangles.toLocaleString()} TRIANGLES\nPOSITION  ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\nWORLD GEN  ${state.worldGeneration??1} / ${this.environment.terrain.size} m / ${this.environment.terrain.resolution} GRID\nWORLD SEED  ${state.seed}\nBIOME  ${this.environment.biomeAt(p.x,p.z).toUpperCase()}\nHEIGHT ${p.y.toFixed(1)} m / SLOPE ${(slope*100).toFixed(0)}%\nLANDING ${this.player.lastLandingSpeed.toFixed(1)} m/s / ${this.player.lastFallDamage} DAMAGE\nENTITIES  ${this.environment.nodes.filter(n=>n.remaining>0).length} NODES / ${state.structures.length} STRUCTURES\nTIME  ${hour.toFixed(2)} / ×${this.timeMultiplier}\nDEV  FLY ${this.flyMode?'ON':'OFF'} / GOD ${this.godMode?'ON':'OFF'}`,tutorial:this.tutorial()};
      this.ui.update(hud,state);
    }
  }
  private tickFly(dt:number,active:boolean){const keys=this.settings.keybinds,state=this.simulation.state,p=state.player.position;const forward=new THREE.Vector3(-Math.sin(this.player.yaw),0,-Math.cos(this.player.yaw)),right=new THREE.Vector3(Math.cos(this.player.yaw),0,-Math.sin(this.player.yaw)),move=new THREE.Vector3();if(active){move.addScaledVector(forward,Number(this.input.down(keys.forward))-Number(this.input.down(keys.backward)));move.addScaledVector(right,Number(this.input.down(keys.right))-Number(this.input.down(keys.left)));move.y+=Number(this.input.down(keys.jump))-Number(this.input.down(keys.crouch));}if(move.lengthSq()>1)move.normalize();const fast=active&&this.input.down(keys.sprint),speed=fast?34:14,next={x:p.x+move.x*speed*dt,y:p.y+move.y*speed*dt,z:p.z+move.z*speed*dt};this.player.sprinting=fast&&move.lengthSq()>0;this.player.teleport(next);state.player.position={...next};state.player.yaw=this.player.yaw;state.player.pitch=this.player.pitch;}
  private randomWorldSeed(){const data=new Uint32Array(1);crypto.getRandomValues(data);return data[0]!%1_000_000_000;}
  private refreshSaveSlots(){this.ui?.setSaveSlots(listSaveSlots());}
  private firstFreeSaveSlot(){return listSaveSlots().find(save=>!save.exists)?.slot??1;}
  private deleteSaveSlot(slot:number){deleteSave(slot);const removed=!listSaveSlots().find(save=>save.slot===slot)?.exists;if(removed&&this.activeSaveSlot===slot)this.activeSaveSlot=null;this.refreshSaveSlots();this.ui.notify(removed?`Save slot ${slot} deleted${this.activeWorld&&this.activeSaveSlot===null?' · autosave disabled for this session':''}.`:`Save slot ${slot} could not be deleted. Browser storage may be unavailable.`);}
  private save(notify=true,allowCreate=true){if(!this.activeWorld)return;if(this.activeSaveSlot===null){if(!allowCreate)return;this.activeSaveSlot=this.firstFreeSaveSlot();}const success=saveGame(this.simulation.state,this.activeSaveSlot);if(notify)this.ui.notify(success?`World saved to slot ${this.activeSaveSlot}.`:'Storage is full or unavailable. Save could not be written.');this.refreshSaveSlots();}
  private applySettings(s:Settings){this.settings={...s,keybinds:{...s.keybinds}};this.projection.setBaseFov(s.fov);this.renderer.toneMappingExposure=s.brightness;saveSettings(s);this.ui?.setSettings(s);this.audio?.setSettings(s);this.player?.setSettings(s);this.held.setFov(s.viewmodelFov);const qualityDpr=s.quality==='low'?1:s.quality==='medium'?Math.min(devicePixelRatio,1.25):s.quality==='high'?Math.min(devicePixelRatio,1.6):Math.min(devicePixelRatio,2);this.renderer.setPixelRatio(Math.max(.5,qualityDpr*s.renderScale));this.renderer.shadowMap.enabled=s.shadows;this.postFX.setQuality(s.quality);this.postFX.setUserSettings(s.postProcessing,s.ambientOcclusion,s.bloom);this.environment?.setQuality(s.quality);this.environment?.setFoliageDensity(s.foliageDensity);this.environment?.atmosphere.setShadowSettings(s.shadows,s.shadowQuality,s.shadowDistance);if(this.loopStarted)this.configureFrameLoop();this.resize();}
  private resize(){const w=window.innerWidth,h=window.innerHeight;this.projection.resize(w/Math.max(1,h));this.renderer.setSize(w,h);this.postFX.resize(w,h,this.renderer.getPixelRatio());this.held.resize(w,h);}
  private dev(action:string,value?:number){if(!this.simulation)return;if(action==='resources'){for(const id of ['wood','stone','fiber','ore','metal','sulfurOre','hqMetalOre','berries'] as ItemId[])this.simulation.addItem(id,id==='berries'?30:id==='hqMetalOre'?200:2000);this.ui.notify('Development resources added');}if(action==='plan'){this.simulation.addItem('plan',1);this.ui.notify('Development building plan added');this.syncHeld();}if(action==='spawn'){this.player.teleport(this.environment.spawn);this.simulation.state.player.position={...this.environment.spawn};}if(action==='fly'){this.flyMode=!this.flyMode;this.ui.notify(`Fly mode ${this.flyMode?'ON':'OFF'} · WASD + Space/Crouch · Shift fast`);}if(action==='god'){this.godMode=!this.godMode;this.ui.notify(`God mode ${this.godMode?'ON':'OFF'}`);}this.ui.setDevModes(this.flyMode,this.godMode);if(action==='heal'){const stats=this.simulation.state.player.stats;stats.health=stats.hunger=stats.thirst=stats.stamina=100;this.ui.notify('Vitals restored');}if(action==='day')this.simulation.state.timeOfDay=10;if(action==='night')this.simulation.state.timeOfDay=0;if(action==='speed')this.timeMultiplier=20;if(action==='normal')this.timeMultiplier=1;if(action==='time'&&value!==undefined)this.simulation.state.timeOfDay=value;if(action==='collisions')this.debug.collisions=!this.debug.collisions;if(action==='sockets')this.debug.sockets=!this.debug.sockets;}
  private installDevAPI(){
    // The bridge is intentionally tiny and local-only. It powers deterministic browser smoke tests
    // and the in-game F3 diagnostics without changing simulation ownership.
    (window as unknown as {__TIDELAND:unknown}).__TIDELAND={
      setCapturePaused:(paused:boolean)=>{this.capturePaused=paused;},
      stationCandidate:()=>this.stationPlacement,
      landmarks:()=>this.worldSurvival.pois,
      stationPlace:(kind:StationKind,p:Vec3)=>this.placeStation(kind,new THREE.Vector3(p.x,p.y,p.z),0,true),stationOpen:(id:string)=>{const s=ensureProgression(this.simulation.state).stations.find(x=>x.id===id);if(s){this.openStation=id;this.setScreen('station');this.stationUI.open(s,this.simulation.state.inventory);}},command:(line:string)=>this.terminal.execute(line),
      cameraDebug:()=>this.player.cameraDebug(),
      cameraState:()=>({settings:{...this.settings},world:{fov:this.camera.fov,horizontalFov:horizontalFov(this.camera.fov,this.camera.aspect),aspect:this.camera.aspect,near:this.camera.near,far:this.camera.far,projection:this.camera.projectionMatrix.toArray(),position:this.camera.position.toArray(),rotation:[this.camera.rotation.x,this.camera.rotation.y,this.camera.rotation.z]},viewmodel:{...this.held.diagnostics(),fov:this.held.camera.fov,aspect:this.held.camera.aspect,projection:this.held.camera.projectionMatrix.toArray()},sprinting:this.player.sprinting}),
      snapshot:()=>structuredClone(this.simulation.state),nodes:()=>this.environment.nodes.map(n=>({...n})),getScreen:()=>this.screen,dev:(a:string,v?:number)=>this.dev(a,v),teleport:(p:Vec3)=>{this.player.teleport(p);this.simulation.state.player.position={...p};this.camera.position.set(p.x,p.y+PLAYER.EYE_HEIGHT,p.z);},fallFrom:(height:number)=>{const p=this.simulation.state.player.position,ground=this.environment.heightAt(p.x,p.z),target={x:p.x,y:ground+Math.max(.5,Math.min(40,height)),z:p.z};this.player.teleport(target,false);this.simulation.state.player.position={...target};},lookAt:(p:Vec3)=>{const d=new THREE.Vector3(p.x,p.y,p.z).sub(this.camera.position);this.player.yaw=Math.atan2(-d.x,-d.z);this.player.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));},candidate:()=>this.candidate,interaction:()=>this.interactions.current?.info()??null,physics:()=>({position:this.physics.position(),grounded:this.player.grounded}),hasStructureCollider:(id:string)=>this.physics.hasStructure(id),hasInteraction:(id:string)=>this.interactions.entries.has(id),setPiece:(p:PieceType)=>{this.buildPiece=p;this.building=true;},save:()=>this.save(),stats:()=>({fps:this.fps,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,postFX:this.postFX.diagnostics(),worldGeneration:this.simulation.state.worldGeneration??1,worldSize:this.environment.terrain.size,terrainResolution:this.environment.terrain.resolution,lastLandingSpeed:this.player.lastLandingSpeed,lastFallDamage:this.player.lastFallDamage}),world:()=>({generation:this.simulation.state.worldGeneration??1,size:this.environment.terrain.size,resolution:this.environment.terrain.resolution,bounds:{...this.environment.terrain.bounds},spawn:{...this.environment.spawn},satellites:this.environment.terrain.satellites.map(x=>({...x})),pois:this.worldSurvival.pois.map(x=>({...x,position:{...x.position}})),trails:this.worldSurvival.trails.map(x=>x.map(p=>({...p}))),nodes:this.environment.nodes.length}),height:(x:number,z:number)=>this.environment.heightAt(x,z),biome:(x:number,z:number)=>this.environment.biomeAt(x,z),fallDamage:(speed:number)=>fallDamageForSpeed(speed),gather:(id:string)=>{const n=this.environment.nodes.find(n=>n.id===id);if(n){this.cooldown=0;this.gather(n);}},sim:()=>this.simulation,damagePlayer:(amount:number,cause?:string)=>this.damagePlayer(amount,cause),damageStructure:(id:string,amount:number)=>this.damageStructure(id,amount),placeAt:(piece:PieceType,p:Vec3,rotation=0)=>{const c=findBuildCandidate(piece,p,rotation,this.simulation.state.structures,(x,z)=>this.environment.heightAt(x,z),id=>this.simulation.count(id),this.simulation.state.player.position);const s=this.simulation.place(c);if(s)this.syncStructures();return {candidate:c,structure:s};},toggleDoor:(id:string)=>{this.simulation.toggleDoor(id);this.syncStructures();}
    };
  }
}
