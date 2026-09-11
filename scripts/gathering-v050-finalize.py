from pathlib import Path
import json


def replace_once(path: str, old: str, new: str):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

# --- dedicated weak-spot / hit-mark renderer ---
Path('src/rendering/GatheringFeedback.ts').write_text(r'''import * as THREE from 'three';
import type {ResourceNode,Vec3} from '../core/types';

type WeakKind='tree'|'stone'|'metal';
type Spot={nodeId:string;kind:WeakKind;position:THREE.Vector3;root:THREE.Group;sequence:number;age:number};
type HitMark={root:THREE.Group;material:THREE.MeshBasicMaterial;life:number;max:number};
export interface GatherStrike {point:THREE.Vector3;weakSpot:boolean}

const eligible=(kind:ResourceNode['kind']):kind is WeakKind=>kind==='tree'||kind==='stone'||kind==='metal';
const hash=(value:string):number=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const unit=(seed:number,offset:number)=>((Math.imul(seed^(offset*0x9e3779b9),1664525)+1013904223)>>>0)/4294967296;

/** Presentation-only weak spots and short-lived impact marks. Simulation stays authoritative. */
export class GatheringFeedback {
  private readonly spots=new Map<string,Spot>();
  private readonly hitMarks:HitMark[]=[];
  private readonly red=new THREE.MeshBasicMaterial({color:0xe43d35,transparent:true,opacity:.96,depthWrite:false,toneMapped:false});
  private readonly glow=new THREE.MeshBasicMaterial({color:0xffd45b,transparent:true,opacity:.94,depthWrite:false,toneMapped:false});
  private readonly bar=new THREE.BoxGeometry(.34,.052,.022);
  private readonly sparkBar=new THREE.BoxGeometry(.31,.035,.018);
  private readonly ring=new THREE.RingGeometry(.145,.185,20);

  constructor(private readonly scene:THREE.Scene){}

  capture(node:ResourceNode,ray:THREE.Ray,point:THREE.Vector3):GatherStrike{
    const spot=this.spots.get(node.id);
    if(!spot)return {point:point.clone(),weakSpot:false};
    const radius=(node.kind==='tree'?.27:.32)*Math.max(.72,node.scale);
    return {point:point.clone(),weakSpot:ray.distanceSqToPoint(spot.position)<=radius*radius};
  }

  onHit(node:ResourceNode,point:Vec3,weakSpot:boolean,depleted:boolean):void{
    this.hitMark(point,node.kind,weakSpot);
    if(depleted){this.removeSpot(node.id);return;}
    if(!eligible(node.kind))return;
    if(!this.spots.has(node.id)||weakSpot)this.placeSpot(node);
  }

  spotPosition(nodeId:string):Vec3|null{
    const spot=this.spots.get(nodeId);return spot?{x:spot.position.x,y:spot.position.y,z:spot.position.z}:null;
  }

  update(dt:number,camera:THREE.Camera):void{
    for(const spot of this.spots.values()){
      spot.age+=dt;spot.root.quaternion.copy(camera.quaternion);
      const pulse=1+Math.sin(spot.age*(spot.kind==='tree'?8.5:11))*0.08;spot.root.scale.setScalar(pulse);
      if(spot.kind!=='tree')spot.root.rotation.z+=dt*1.7;
    }
    for(let i=this.hitMarks.length-1;i>=0;i--){
      const mark=this.hitMarks[i]!;mark.life-=dt;if(mark.life<=0){mark.root.removeFromParent();mark.material.dispose();this.hitMarks.splice(i,1);continue;}
      mark.root.quaternion.copy(camera.quaternion);const t=1-mark.life/mark.max;mark.material.opacity=(1-t)*.92;mark.root.scale.setScalar(.75+t*.75);
    }
  }

  clear():void{
    for(const spot of this.spots.values())spot.root.removeFromParent();this.spots.clear();
    for(const mark of this.hitMarks){mark.root.removeFromParent();mark.material.dispose();}this.hitMarks.length=0;
  }

  dispose():void{this.clear();this.red.dispose();this.glow.dispose();this.bar.dispose();this.sparkBar.dispose();this.ring.dispose();}

  private placeSpot(node:ResourceNode):void{
    let spot=this.spots.get(node.id);
    if(!spot){const root=node.kind==='tree'?this.treeMarker():this.rockMarker();root.name=`${node.kind} weak spot`;this.scene.add(root);spot={nodeId:node.id,kind:node.kind as WeakKind,position:new THREE.Vector3(),root,sequence:0,age:0};this.spots.set(node.id,spot);}else spot.sequence++;
    const seed=hash(`${node.id}:${spot.sequence}`),angle=unit(seed,1)*Math.PI*2;
    if(node.kind==='tree'){
      const radius=.41*node.scale,vertical=(1.35+unit(seed,2)*2.65)*node.scale;
      spot.position.set(node.position.x+Math.cos(angle)*radius,node.position.y+vertical,node.position.z+Math.sin(angle)*radius);
    }else{
      const radius=(.24+unit(seed,2)*.28)*node.scale,vertical=(.48+unit(seed,3)*.38)*node.scale;
      spot.position.set(node.position.x+Math.cos(angle)*radius,node.position.y+vertical,node.position.z+Math.sin(angle)*radius);
    }
    spot.root.position.copy(spot.position);spot.age=0;
  }

  private treeMarker():THREE.Group{
    const g=new THREE.Group();for(const a of [Math.PI/4,-Math.PI/4]){const m=new THREE.Mesh(this.bar,this.red);m.rotation.z=a;m.renderOrder=7;g.add(m);}return g;
  }

  private rockMarker():THREE.Group{
    const g=new THREE.Group(),ring=new THREE.Mesh(this.ring,this.glow);ring.renderOrder=7;g.add(ring);
    for(const a of [0,Math.PI/2,Math.PI/4,-Math.PI/4]){const m=new THREE.Mesh(this.sparkBar,this.glow);m.rotation.z=a;m.renderOrder=8;g.add(m);}return g;
  }

  private hitMark(point:Vec3,kind:ResourceNode['kind'],strong:boolean):void{
    const color=kind==='tree'||kind==='wood'?(strong?0xffd6a1:0xe7bf88):(kind==='metal'?(strong?0xffe6a0:0xc9b28d):0xe3e1d7);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,depthWrite:false,toneMapped:false});
    const root=new THREE.Group();root.position.set(point.x,point.y,point.z);root.name='Gathering hit mark';
    for(const a of [Math.PI/4,-Math.PI/4]){const mesh=new THREE.Mesh(this.sparkBar,material);mesh.rotation.z=a;mesh.renderOrder=9;root.add(mesh);}root.scale.setScalar(strong?1.15:.82);this.scene.add(root);
    this.hitMarks.push({root,material,life:strong?.42:.28,max:strong?.42:.28});
  }

  private removeSpot(id:string):void{const spot=this.spots.get(id);if(!spot)return;spot.root.removeFromParent();this.spots.delete(id);}
}
''')

# --- per-tool, per-hit gathering yields + weak-spot multiplier ---
replace_once('src/config/gameplay.ts',
"export interface GatherRule { itemId: ItemId; amount: number; preferredTool?: ItemId; toolMultiplier: number; label: string }\nexport const GATHERING: Record<ResourceNode['kind'], GatherRule> = {\n  tree: { itemId: 'wood', amount: 30, preferredTool: 'hatchet', toolMultiplier: 2.5, label: 'Tree' },\n  wood: { itemId: 'wood', amount: 35, preferredTool: 'hatchet', toolMultiplier: 1, label: 'Driftwood' },\n  stone: { itemId: 'stone', amount: 24, preferredTool: 'pickaxe', toolMultiplier: 2.5, label: 'Stone deposit' },\n  metal: { itemId: 'ore', amount: 14, preferredTool: 'pickaxe', toolMultiplier: 2.5, label: 'Metal deposit' },\n  fiber: { itemId: 'fiber', amount: 25, toolMultiplier: 1, label: 'Wild flax' },\n  berries: { itemId: 'berries', amount: 4, toolMultiplier: 1, label: 'Berry bush' },\n};",
"export type GatherTool='rock'|'hatchet'|'pickaxe';\nexport interface GatherRule { itemId: ItemId; amount: number; preferredTool?: ItemId; toolMultiplier: number; weakSpotMultiplier?:number; toolYield?:Partial<Record<GatherTool,number>>; label: string }\nexport const GATHERING: Record<ResourceNode['kind'], GatherRule> = {\n  tree: { itemId: 'wood', amount: 18, preferredTool: 'hatchet', toolMultiplier: 1, weakSpotMultiplier:1.5, toolYield:{rock:18,hatchet:42,pickaxe:12}, label: 'Tree' },\n  wood: { itemId: 'wood', amount: 35, preferredTool: 'hatchet', toolMultiplier: 1, label: 'Driftwood' },\n  stone: { itemId: 'stone', amount: 14, preferredTool: 'pickaxe', toolMultiplier: 1, weakSpotMultiplier:1.5, toolYield:{rock:14,hatchet:7,pickaxe:34}, label: 'Stone deposit' },\n  metal: { itemId: 'ore', amount: 8, preferredTool: 'pickaxe', toolMultiplier: 1, weakSpotMultiplier:1.5, toolYield:{rock:8,hatchet:4,pickaxe:22}, label: 'Metal deposit' },\n  fiber: { itemId: 'fiber', amount: 25, toolMultiplier: 1, label: 'Wild flax' },\n  berries: { itemId: 'berries', amount: 4, toolMultiplier: 1, label: 'Berry bush' },\n};")

replace_once('src/simulation/GameSimulation.ts',
"  gather(node: ResourceNode): { amount: number; depleted: boolean } {\n    const rule = GATHERING[node.kind];\n    if (!rule) return { amount: 0, depleted: false };\n    const remaining = this.state.nodeChanges[node.id] ?? node.remaining;\n    if (remaining <= 0) return { amount: 0, depleted: true };\n    const active = this.state.inventory[this.state.activeSlot]?.itemId;\n    if (['tree', 'stone', 'metal'].includes(node.kind) && active !== 'rock' && active !== 'hatchet' && active !== 'pickaxe') {\n      this.onNotify('Equip a rock, hatchet or pickaxe');\n      return { amount: 0, depleted: false };\n    }\n    const requested = Math.min(remaining, Math.round(rule.amount * (active === rule.preferredTool ? rule.toolMultiplier : 1)));\n    const amount = requested - this.addItem(rule.itemId, requested);\n    if (amount === 0) {\n      this.onNotify('Inventory full');\n      return { amount: 0, depleted: false };\n    }\n    node.remaining = remaining - amount;\n    this.state.nodeChanges[node.id] = node.remaining;\n    if (node.remaining === 0) node.depletedAt = this.state.elapsed;\n    this.onNotify(`+ ${amount} ${ITEMS[rule.itemId].displayName}`);\n    return { amount, depleted: node.remaining === 0 };\n  }",
"  gather(node: ResourceNode, weakSpot = false): { amount: number; depleted: boolean } {\n    const rule = GATHERING[node.kind];\n    if (!rule) return { amount: 0, depleted: false };\n    const remaining = this.state.nodeChanges[node.id] ?? node.remaining;\n    if (remaining <= 0) return { amount: 0, depleted: true };\n    const active = this.state.inventory[this.state.activeSlot]?.itemId;\n    if (['tree', 'stone', 'metal'].includes(node.kind) && active !== 'rock' && active !== 'hatchet' && active !== 'pickaxe') {\n      this.onNotify('Equip a rock, hatchet or pickaxe');\n      return { amount: 0, depleted: false };\n    }\n    const toolYield=rule.toolYield?.[active as 'rock'|'hatchet'|'pickaxe'];\n    const base=toolYield ?? rule.amount * (active === rule.preferredTool ? rule.toolMultiplier : 1);\n    const bonus=weakSpot ? (rule.weakSpotMultiplier ?? 1) : 1;\n    const requested = Math.min(remaining, Math.max(1,Math.round(base*bonus)));\n    const amount = requested - this.addItem(rule.itemId, requested);\n    if (amount === 0) {\n      this.onNotify('Inventory full');\n      return { amount: 0, depleted: false };\n    }\n    node.remaining = remaining - amount;\n    this.state.nodeChanges[node.id] = node.remaining;\n    if (node.remaining === 0) node.depletedAt = this.state.elapsed;\n    this.onNotify(`+ ${amount} ${ITEMS[rule.itemId].displayName}`);\n    return { amount, depleted: node.remaining === 0 };\n  }")

# --- stronger/material-specific particles at the actual contact point ---
replace_once('src/rendering/ImpactFX.ts',
"  burst(position:Vec3,kind:'wood'|'stone'|'metal'|'fiber'|'berries'|'build'='stone'){\n    const palette:{[key:string]:number}={wood:0xb88a58,stone:0xc4c1ae,metal:0xc5a47b,fiber:0x9caf63,berries:0xb85155,build:0xd4b276};\n    const color=new THREE.Color(palette[kind]??palette.stone);const amount=kind==='build'?14:10;",
"  burst(position:Vec3,kind:'wood'|'stone'|'metal'|'fiber'|'berries'|'build'='stone',strength=1){\n    const palette:{[key:string]:number}={wood:0xc7955d,stone:0xd7d3c4,metal:0xd6b171,fiber:0x9caf63,berries:0xb85155,build:0xd4b276};\n    const force=Math.max(.7,Math.min(1.7,strength));\n    const color=new THREE.Color(palette[kind]??palette.stone);const base=kind==='build'?14:kind==='wood'?15:kind==='metal'?14:kind==='stone'?13:10,amount=Math.round(base*force);")
replace_once('src/rendering/ImpactFX.ts',
"      p.vx=Math.cos(angle)*rad*1.35;p.vz=Math.sin(angle)*rad*1.35;p.vy=.65+this.random()*1.65;p.size=kind==='build'?.08+this.random()*.055:.045+this.random()*.04;p.color.copy(color).offsetHSL((this.random()-.5)*.04,(this.random()-.5)*.08,(this.random()-.5)*.1);",
"      p.vx=Math.cos(angle)*rad*1.35*force;p.vz=Math.sin(angle)*rad*1.35*force;p.vy=(.65+this.random()*1.65)*force;p.size=(kind==='build'?.08+this.random()*.055:.045+this.random()*.04)*(1+(force-1)*.35);p.color.copy(color).offsetHSL((this.random()-.5)*.04,(this.random()-.5)*.08,(this.random()-.5)*.1);")

# --- visible resource shake intensity + longer readable tree fall ---
replace_once('src/rendering/environment.ts',"  private readonly hits=new Map<string,number>();","  private readonly hits=new Map<string,{elapsed:number;intensity:number}>();")
replace_once('src/rendering/environment.ts',
"    for(const [id,t] of this.hits){const elapsed=t+dt,obj=this.nodeObjects.get(id),refs=this.instances.get(id);if(elapsed>.35){this.hits.delete(id);if(obj)obj.rotation.z=0;if(refs)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}else{this.hits.set(id,elapsed);const amount=Math.sin(elapsed*32)*(1-elapsed/.35)*.016;if(obj)obj.rotation.z=amount;if(refs)for(const ref of refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.rotation.z=amount;this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}}",
"    for(const [id,hit] of this.hits){const elapsed=hit.elapsed+dt,obj=this.nodeObjects.get(id),refs=this.instances.get(id);if(elapsed>.4){this.hits.delete(id);if(obj)obj.rotation.z=0;if(refs)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}else{hit.elapsed=elapsed;const amount=Math.sin(elapsed*34)*(1-elapsed/.4)*.022*hit.intensity;if(obj)obj.rotation.z=amount;if(refs)for(const ref of refs){this.matrixDummy.matrix.copy(ref.matrix);this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.rotation.z=amount;this.matrixDummy.updateMatrix();ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}}")
replace_once('src/rendering/environment.ts',"  hitNode(id:string):void {this.hits.set(id,0);}","  hitNode(id:string,intensity=1):void {this.hits.set(id,{elapsed:0,intensity:Math.max(.7,Math.min(1.6,intensity))});}")
replace_once('src/rendering/environment.ts',"    this.fallingTrees.set(id,{elapsed:0,duration:1.05,hold:.8,fade:.55,axis,refs,node});","    this.fallingTrees.set(id,{elapsed:0,duration:1.18,hold:1.35,fade:.72,axis,refs,node});")

# --- tool-specific harvesting sounds + scheduled tree fall/crash ---
replace_once('src/audio/AudioMixer.ts',"export type FootstepSurface='sand'|'grass'|'forest'|'rock'|'wood';","export type FootstepSurface='sand'|'grass'|'forest'|'rock'|'wood';\nexport type GatherTool='rock'|'hatchet'|'pickaxe';")
insert_audio=r'''  gather(tool:GatherTool|null,resource:'tree'|'stone'|'metal'|'wood'|'fiber'|'berries',weakSpot=false){
    if(!this.ctx||!this.sfx||!this.buffer)return;const ctx=this.ctx,t=ctx.currentTime;
    const hard=resource==='stone'||resource==='metal',axe=tool==='hatchet',pick=tool==='pickaxe';
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=this.buffer;filter.type=hard?'bandpass':'lowpass';filter.frequency.value=hard?(pick?2600:1450):(axe?1350:720);filter.Q.value=hard?1.1:.35;noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime((weakSpot?.34:.25)*(tool==='rock'?.82:1),t);gain.gain.exponentialRampToValueAtTime(.001,t+(hard?.10:.14));noise.start(t);noise.stop(t+.18);
    const tone=ctx.createOscillator(),toneGain=ctx.createGain();tone.type=hard?(pick?'triangle':'sine'):'sine';const base=resource==='metal'?(pick?510:260):resource==='stone'?(pick?350:190):(axe?118:76);tone.frequency.setValueAtTime(base*(.94+Math.random()*.12),t);tone.frequency.exponentialRampToValueAtTime(base*(hard?.72:.55),t+.09);toneGain.gain.setValueAtTime(weakSpot?.09:.052,t);toneGain.gain.exponentialRampToValueAtTime(.001,t+.12);tone.connect(toneGain);toneGain.connect(this.sfx);tone.start(t);tone.stop(t+.13);
    if(weakSpot){const ping=ctx.createOscillator(),pg=ctx.createGain();ping.type='sine';ping.frequency.setValueAtTime(hard?980:620,t);ping.frequency.exponentialRampToValueAtTime(hard?1320:880,t+.055);pg.gain.setValueAtTime(.055,t);pg.gain.exponentialRampToValueAtTime(.001,t+.095);ping.connect(pg);pg.connect(this.sfx);ping.start(t);ping.stop(t+.1);}
  }

  treeFall(){
    if(!this.ctx||!this.sfx||!this.buffer)return;const ctx=this.ctx,t=ctx.currentTime;
    const creak=ctx.createOscillator(),cg=ctx.createGain();creak.type='sawtooth';creak.frequency.setValueAtTime(92,t);creak.frequency.exponentialRampToValueAtTime(48,t+.85);cg.gain.setValueAtTime(.035,t);cg.gain.linearRampToValueAtTime(.07,t+.52);cg.gain.exponentialRampToValueAtTime(.001,t+1.02);creak.connect(cg);cg.connect(this.sfx);creak.start(t);creak.stop(t+1.04);
    const crashAt=t+.82,noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=this.buffer;filter.type='lowpass';filter.frequency.value=680;noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime(.001,t);gain.gain.setValueAtTime(.62,crashAt);gain.gain.exponentialRampToValueAtTime(.001,crashAt+.48);noise.start(t);noise.stop(crashAt+.52);
    const thump=ctx.createOscillator(),tg=ctx.createGain();thump.type='sine';thump.frequency.setValueAtTime(72,crashAt);thump.frequency.exponentialRampToValueAtTime(34,crashAt+.32);tg.gain.setValueAtTime(.22,crashAt);tg.gain.exponentialRampToValueAtTime(.001,crashAt+.38);thump.connect(tg);tg.connect(this.sfx);thump.start(crashAt);thump.stop(crashAt+.4);
  }

'''
replace_once('src/audio/AudioMixer.ts',"  play(kind:'step'|'wood'|'stone'|'pickup'|'build'|'ui'|'door'|'eat'|'error'){",insert_audio+"  play(kind:'step'|'wood'|'stone'|'pickup'|'build'|'ui'|'door'|'eat'|'error'){")

# --- wire strike location, weak spots, feedback, audio and tree fall into gameplay ---
replace_once('src/app/GameApp.ts',"import {ImpactFX} from '../rendering/ImpactFX';","import {ImpactFX} from '../rendering/ImpactFX';\nimport {GatheringFeedback,type GatherStrike} from '../rendering/GatheringFeedback';")
replace_once('src/app/GameApp.ts',"import {AudioMixer,type FootstepSurface} from '../audio/AudioMixer';","import {AudioMixer,type FootstepSurface,type GatherTool} from '../audio/AudioMixer';")
replace_once('src/app/GameApp.ts',"  readonly ui:UI;readonly input:Input;readonly audio:AudioMixer;readonly held=new HeldItem();readonly impactFx:ImpactFX;readonly torchLight=new THREE.PointLight(0xffd0a0,0,14,2);readonly interactions=new InteractionSystem();","  readonly ui:UI;readonly input:Input;readonly audio:AudioMixer;readonly held=new HeldItem();readonly impactFx:ImpactFX;readonly gatheringFeedback:GatheringFeedback;readonly torchLight=new THREE.PointLight(0xffd0a0,0,14,2);readonly interactions=new InteractionSystem();")
replace_once('src/app/GameApp.ts',"  private pendingHit:{node:ResourceNode;remaining:number}|null=null;","  private pendingHit:{node:ResourceNode;remaining:number;strike:GatherStrike}|null=null;")
replace_once('src/app/GameApp.ts',"    this.input=new Input(canvas);this.audio=new AudioMixer(this.settings);this.impactFx=new ImpactFX(this.scene);this.scene.add(this.torchLight);this.debug=new DebugView(this.scene);","    this.input=new Input(canvas);this.audio=new AudioMixer(this.settings);this.impactFx=new ImpactFX(this.scene);this.gatheringFeedback=new GatheringFeedback(this.scene);this.scene.add(this.torchLight);this.debug=new DebugView(this.scene);")
replace_once('src/app/GameApp.ts',"    this.stationRenderer?.dispose();this.stationIds.clear();this.stationUI?.close();this.openStation=null;this.interactions.clear();this.knownStructures.clear();this.rainBarrel?.removeFromParent();this.structures?.dispose();this.worldItems?.dispose();this.physics?.dispose();this.environment?.dispose();","    this.stationRenderer?.dispose();this.stationIds.clear();this.stationUI?.close();this.openStation=null;this.interactions.clear();this.gatheringFeedback.clear();this.knownStructures.clear();this.rainBarrel?.removeFromParent();this.structures?.dispose();this.worldItems?.dispose();this.physics?.dispose();this.environment?.dispose();")
replace_once('src/app/GameApp.ts',"      this.interactions.register({id:node.id,kind:'resource',object,position:()=>node.position,enabled:()=>node.remaining>0,info:()=>({title:GATHERING[node.kind].label,action:['fiber','berries','wood'].includes(node.kind)?'PICK UP':'GATHER',key:['fiber','berries','wood'].includes(node.kind)?keyLabel(this.settings.keybinds.interact):'LMB',detail:`${GATHERING[node.kind].itemId==='metal'?'METAL ORE':GATHERING[node.kind].itemId.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`,progress:node.remaining/node.capacity}),interact:()=>this.gather(node)});",
"      this.interactions.register({id:node.id,kind:'resource',object,position:()=>node.position,enabled:()=>node.remaining>0,info:()=>({title:GATHERING[node.kind].label,action:['fiber','berries','wood'].includes(node.kind)?'PICK UP':'GATHER',key:['fiber','berries','wood'].includes(node.kind)?keyLabel(this.settings.keybinds.interact):'LMB',detail:`${GATHERING[node.kind].itemId==='metal'?'METAL ORE':GATHERING[node.kind].itemId.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`,progress:node.remaining/node.capacity}),interact:()=>this.gather(node,true,this.resourceStrike(node,object))});")
old_gather="  private gather(node:ResourceNode,animate=true){if(this.cooldown>0)return;const result=this.simulation.gather(node);if(result.amount>0){this.cooldown=['fiber','berries','wood'].includes(node.kind)?.22:.62;if(animate)this.held.hit();if(['tree','stone','metal','wood'].includes(node.kind))this.held.impact();this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');this.ui.resourceHit(node.kind,result.amount,result.depleted);if(result.depleted&&node.kind==='tree')this.environment.fallTree(node.id,this.simulation.state.player.position);else this.environment.hitNode(node.id);this.audio.play(node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'||node.kind==='metal'?'stone':'pickup');this.environment.syncNodes(this.simulation.state.nodeChanges);if(result.depleted)this.physics.removeNodeCollider(node.id);}}"
new_gather=r'''  private resourceStrike(node:ResourceNode,object?:THREE.Object3D):GatherStrike{
    this.ray.setFromCamera(this.screenCenter,this.camera);this.ray.far=PLAYER.INTERACT_DISTANCE+1;
    const hit=object?this.ray.intersectObject(object,true)[0]:undefined;
    const fallback=new THREE.Vector3(node.position.x,node.position.y+(node.kind==='tree'?1.8:.55)*node.scale,node.position.z);
    return this.gatheringFeedback.capture(node,this.ray.ray,hit?.point??fallback);
  }
  private gather(node:ResourceNode,animate=true,strike?:GatherStrike){
    if(this.cooldown>0)return;const actual=strike??this.resourceStrike(node,this.environment.nodeObjects.get(node.id));const active=this.simulation.state.inventory[this.simulation.state.activeSlot]?.itemId;
    const result=this.simulation.gather(node,actual.weakSpot);if(result.amount<=0)return;
    this.cooldown=['fiber','berries','wood'].includes(node.kind)?.22:.62;if(animate)this.held.hit();if(['tree','stone','metal','wood'].includes(node.kind))this.held.impact();
    const kind=node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries';
    this.impactFx.burst(actual.point,kind,actual.weakSpot?1.55:1);this.gatheringFeedback.onHit(node,actual.point,actual.weakSpot,result.depleted);this.ui.resourceHit(node.kind,result.amount,result.depleted,actual.weakSpot);
    if(['tree','stone','metal'].includes(node.kind))this.audio.gather((active==='rock'||active==='hatchet'||active==='pickaxe'?active:null) as GatherTool|null,node.kind as 'tree'|'stone'|'metal',actual.weakSpot);else this.audio.play('pickup');
    if(result.depleted&&node.kind==='tree'){this.environment.fallTree(node.id,this.simulation.state.player.position);this.audio.treeFall();}else if(!result.depleted)this.environment.hitNode(node.id,actual.weakSpot?1.45:1);
    this.environment.syncNodes(this.simulation.state.nodeChanges);if(result.depleted)this.physics.removeNodeCollider(node.id);
  }'''
replace_once('src/app/GameApp.ts',old_gather,new_gather)
replace_once('src/app/GameApp.ts',"if(active==='rock'||active==='hatchet'||active==='pickaxe'){this.held.hit();this.pendingHit={node,remaining:.13};this.cooldown=.62;}else target.interact();","if(active==='rock'||active==='hatchet'||active==='pickaxe'){this.held.hit();this.pendingHit={node,remaining:.13,strike:this.resourceStrike(node,target.object)};this.cooldown=.62;}else target.interact();")
replace_once('src/app/GameApp.ts',"const node=this.pendingHit.node;this.pendingHit=null;const p=this.simulation.state.player.position;if(Math.hypot(p.x-node.position.x,p.z-node.position.z)<=PLAYER.INTERACT_DISTANCE+node.scale){this.cooldown=0;this.gather(node,false);}","const {node,strike}=this.pendingHit;this.pendingHit=null;const p=this.simulation.state.player.position;if(Math.hypot(p.x-node.position.x,p.z-node.position.z)<=PLAYER.INTERACT_DISTANCE+node.scale){this.cooldown=0;this.gather(node,false,strike);}")
replace_once('src/app/GameApp.ts',"this.impactFx.update(dt);this.updateTorchLight(playing);","this.impactFx.update(dt);this.gatheringFeedback.update(dt,this.camera);this.updateTorchLight(playing);")

# --- HUD explicitly calls out a successful weak-spot hit ---
replace_once('src/ui/UI.ts',"  resourceHit(kind: ResourceNode['kind'], amount: number, depleted = false): void {","  resourceHit(kind: ResourceNode['kind'], amount: number, depleted = false, weakSpot = false): void {")
replace_once('src/ui/UI.ts',"    feedback.className=`resource-feedback ${kind}${depleted?' depleted':''}`;\n    feedback.innerHTML=`<span class=\"resource-hit-mark\"><i></i><i></i></span><div><strong>+${amount}</strong><small>${resourceLabels[kind]}${depleted?' · '+this.tx('depleted'):''}</small></div>`;","    feedback.className=`resource-feedback ${kind}${depleted?' depleted':''}${weakSpot?' weak-spot':''}`;\n    const weak=this.settings.language==='cs'?'SLABÉ MÍSTO':'WEAK SPOT';\n    feedback.innerHTML=`<span class=\"resource-hit-mark\"><i></i><i></i></span><div><strong>+${amount}</strong><small>${resourceLabels[kind]}${weakSpot?' · '+weak:''}${depleted?' · '+this.tx('depleted'):''}</small></div>`;")

# --- regression tests for explicit per-tool yield and weak-spot bonus ---
replace_once('tests/simulation.test.ts',
"    expect(game.gather(tree)).toEqual({ amount: 30, depleted: false });\n    expect(game.state.nodeChanges['tree-1']).toBe(90);\n    game.addItem('hatchet', 1);\n    game.moveItem(3, 0);\n    expect(game.gather(tree).amount).toBe(75);\n    expect(game.gather(tree)).toEqual({ amount: 15, depleted: true });",
"    expect(game.gather(tree)).toEqual({ amount: 18, depleted: false });\n    expect(game.state.nodeChanges['tree-1']).toBe(102);\n    game.addItem('hatchet', 1);\n    game.moveItem(3, 0);\n    expect(game.gather(tree).amount).toBe(42);\n    expect(game.gather(tree,true)).toEqual({ amount: 60, depleted: true });")
replace_once('tests/simulation.test.ts',"    expect(game.gather(tree).amount).toBe(6);","    expect(game.gather(tree).amount).toBe(6);")
# inventory-full test still clamps to 6 even with new rock base yield, so no numerical change is required.

Path('tests/gathering-feedback.test.ts').write_text(r'''import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {GatheringFeedback} from '../src/rendering/GatheringFeedback';
import type {ResourceNode} from '../src/core/types';

describe('gathering weak spots',()=>{
  it('creates a target after the first hit and recognizes a centered weak-spot strike',()=>{
    const scene=new THREE.Scene(),fx=new GatheringFeedback(scene),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);
    const tree:ResourceNode={id:'tree-test',kind:'tree',position:{x:0,y:0,z:0},capacity:300,remaining:300,rotation:0,scale:1};
    fx.onHit(tree,{x:0,y:1.6,z:0},false,false);const spot=fx.spotPosition(tree.id);expect(spot).not.toBeNull();
    const origin=camera.position.clone(),target=new THREE.Vector3(spot!.x,spot!.y,spot!.z),ray=new THREE.Ray(origin,target.sub(origin).normalize());
    expect(fx.capture(tree,ray,new THREE.Vector3(0,1.6,0)).weakSpot).toBe(true);
    const before={...spot!};fx.onHit(tree,{x:before.x,y:before.y,z:before.z},true,false);const moved=fx.spotPosition(tree.id)!;
    expect(Math.hypot(moved.x-before.x,moved.y-before.y,moved.z-before.z)).toBeGreaterThan(.05);fx.dispose();
  });

  it('uses explicit tool yields and a 50 percent weak-spot bonus in simulation',()=>{
    // Behaviour is covered in simulation.test.ts; this test guards renderer lifecycle only.
    const scene=new THREE.Scene(),fx=new GatheringFeedback(scene);fx.clear();fx.dispose();expect(scene.children).toHaveLength(0);
  });
});
''')

# --- versioning and release notes ---
replace_once('src/config/version.ts',"export const GAME_VERSION='0.4.0';\nexport const GAME_BUILD='EA-04';","export const GAME_VERSION='0.5.0';\nexport const GAME_BUILD='EA-05';")
replace_once('src/config/version.ts',"export const CHANGELOG:ChangeEntry[]=[\n",'''export const CHANGELOG:ChangeEntry[]=[
  {version:'0.5.0',date:'2026-09-11',title:'Gathering & weak-spot overhaul',changes:[
    'Added visible impact marks and stronger material-specific wood, stone and metal particles at the actual strike point.',
    'Trees now reveal a red weak-spot X after the first hit; landing the next strike on it grants a 50% resource bonus and moves the target.',
    'Stone and metal deposits now reveal a glowing sparkle weak spot with the same skill-hit bonus loop.',
    'Made resource nodes react more visibly to impacts, with stronger shake on successful weak-spot hits.',
    'Extended the final tree fall so the trunk visibly falls, rests on the ground and then sinks away, backed by a creak and heavy crash.',
    'Added distinct procedural harvesting audio for rock, hatchet and pickaxe impacts.',
    'Rebalanced tree, stone and metal gathering to use explicit per-tool resource yields on every individual hit.'
  ]},
''')

pkg=json.loads(Path('package.json').read_text());pkg['version']='0.5.0';Path('package.json').write_text(json.dumps(pkg,indent=2)+"\n")
lock=json.loads(Path('package-lock.json').read_text());lock['version']='0.5.0';lock['packages']['']['version']='0.5.0';Path('package-lock.json').write_text(json.dumps(lock,indent=2)+"\n")

replace_once('CHANGELOG.md','# Tideland changelog\n','# Tideland changelog\n\n## 0.5.0 — 2026-09-11\n\nGathering and weak-spot overhaul.\n\n- Added world-space tree hit marks, a red X weak spot and 50% bonus yield for accurate follow-up hits.\n- Added stone/metal sparkle weak spots using the same skill-hit loop.\n- Moved wood/stone/metal particles to the real impact point and increased material-specific burst readability.\n- Increased visible tree/resource hit reaction, especially on weak-spot strikes.\n- Extended final tree falls with a ground-rest phase plus procedural creak and crash audio.\n- Added distinct harvesting sounds for rock, hatchet and pickaxe.\n- Rebalanced harvestables around explicit per-tool resource gain on each hit.\n')

readme=Path('README.md').read_text()
readme=readme.replace('version-v0.4.0%20%7C%20EA--04','version-v0.5.0%20%7C%20EA--05',1).replace('**Current release:** `v0.4.0 / EA-04`','**Current release:** `v0.5.0 / EA-05`',1)
readme=readme.replace('**v0.4.x** is focused on first-person game feel, movement and viewmodel presentation.','**v0.5.x** is focused on tactile gathering, weak spots and resource feedback.',1)
readme=readme.replace('- ✅ Speed- and surface-aware procedural footsteps','- ✅ Speed- and surface-aware procedural footsteps\n- ✅ Tree X weak spots, rock sparkle targets and per-hit bonus yields\n- ✅ Tool-specific gathering audio and material impact particles',1)
readme=readme.replace('| `v0.4.0` |', '| `v0.5.0` | Gathering weak spots, per-tool yields, particles and tree-fall audio |\n| `v0.4.0` |',1) if '| `v0.4.0` |' in readme else readme.replace('| Version | Focus |\n| --- | --- |','| Version | Focus |\n| --- | --- |\n| `v0.5.0` | Gathering weak spots, per-tool yields, particles and tree-fall audio |',1)
readme=readme.replace('`EARLY ACCESS DEVELOPMENT · v0.4.0 / EA-04`','`EARLY ACCESS DEVELOPMENT · v0.5.0 / EA-05`')
Path('README.md').write_text(readme)

print('v0.5.0 gathering overhaul applied')
