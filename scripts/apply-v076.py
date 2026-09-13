from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:90]!r}')
    write(path, text.replace(old, new, 1))


def sub_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'pattern matched {count} times in {path}: {pattern[:90]!r}')
    write(path, updated)


# Version metadata.
for path in ['package.json', 'package-lock.json']:
    text = read(path)
    if '"version": "0.7.5"' not in text:
        raise SystemExit(f'missing 0.7.5 package version in {path}')
    write(path, text.replace('"version": "0.7.5"', '"version": "0.7.6"'))

version_path = 'src/config/version.ts'
text = read(version_path)
text = text.replace("export const GAME_VERSION='0.7.5';", "export const GAME_VERSION='0.7.6';", 1)
text = text.replace("export const GAME_BUILD='EA-07.5';", "export const GAME_BUILD='EA-07.6';", 1)
anchor = "export const CHANGELOG:ChangeEntry[]=[\n"
if anchor not in text:
    raise SystemExit('missing changelog anchor')
entry = """  {version:'0.7.6',date:'2026-09-13',title:'Loot cache breakup & harvesting interaction fixes',changes:[\n    'Emptied salvage caches now break apart into visible pieces, collapse and disappear after the final item is removed, and the depleted cache is removed from the saved world.',\n    'Harvestable trees and mineral nodes keep their clean target names while restoring remaining / maximum HP and a compact durability bar.',\n    'Interact/E is now reserved for pickups and world interactions; trees and mineral nodes can only be harvested with the primary attack input.',\n    'Reworked tree/resource hit wobble to animate from the immutable base instance matrix so trees no longer blink out or temporarily vanish after a strike.',\n    'Station synchronization now cleans stale interaction and physics entries when disposable loot caches are consumed.'\n  ]},\n"""
text = text.replace(anchor, anchor + entry, 1)
write(version_path, text)

# GameApp: station take-all/last-item handling, hard-resource E behavior, HP prompt and stale station cleanup.
path = 'src/app/GameApp.ts'
text = read(path)
station_pattern = r"    this\.stationUI=new StationUI\(uiRoot,\{move:.*?\}\);\n    this\.terminal="
station_replacement = """    this.stationUI=new StationUI(uiRoot,{move:(id,a,b,split)=>{const station=this.station(id);if(!station)return;const moved=transfer(this.simulation.state.inventory,station,a,b,split,p=>this.simulation.fitsQueue(p));if(!moved){this.ui.notify('Transfer blocked: slot type, capacity or reserved crafting space');return;}this.consumeEmptyLoot(station);},takeAll:id=>{const s=this.station(id);if(!s)return;const hadLoot=s.inventory.some(Boolean),moved=takeAll(this.simulation.state.inventory,s,p=>this.simulation.fitsQueue(p));if(hadLoot&&moved>0)this.consumeEmptyLoot(s);},toggle:id=>{const s=this.station(id);if(s)s.active=!s.active;},spawn:id=>{ensureProgression(this.simulation.state).spawnId=id;this.ui.notify('Respawn point set');},close:()=>{this.stationUI.close();this.openStation=null;this.setScreen('playing');}});\n    this.terminal="""
updated, count = re.subn(station_pattern, station_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'failed to replace StationUI action bridge: {count}')
text = updated
register_pattern = r"  private registerNodes\(\)\{.*?\n  \}\n  private resourceStrike"
register_replacement = """  private registerNodes(){\n    for(const node of this.environment.nodes){const object=this.environment.nodeObjects.get(node.id);if(!object)continue;const pickup=['fiber','berries','wood'].includes(node.kind);\n      this.interactions.register({id:node.id,kind:'resource',object,position:()=>node.position,enabled:()=>node.remaining>0,info:()=>pickup?{title:GATHERING[node.kind].label,action:'PICK UP',key:keyLabel(this.settings.keybinds.interact),detail:`${ITEMS[GATHERING[node.kind].itemId].displayName.toUpperCase()} · ${Math.ceil(node.remaining)} REMAINING`,progress:node.remaining/node.capacity}:{title:GATHERING[node.kind].label,action:'',key:'',detail:`${Math.ceil(node.remaining)} / ${Math.ceil(node.capacity)} HP`,progress:node.remaining/node.capacity},interact:()=>{if(pickup)this.gather(node,true,this.resourceStrike(node,object));}});\n    }\n  }\n  private resourceStrike"""
updated, count = re.subn(register_pattern, register_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'failed to replace registerNodes: {count}')
text = updated
station_sync_pattern = r"  private station\(id:string\)\{return ensureProgression\(this\.simulation\.state\)\.stations\.find\(s=>s\.id===id\);\}\n  private syncStations\(\)\{.*?\}\n  private updateStationPreview"
station_sync_replacement = """  private station(id:string){return ensureProgression(this.simulation.state).stations.find(s=>s.id===id);}\n  private consumeEmptyLoot(s:Station):void{\n    if(s.kind!=='loot'||s.inventory.some(Boolean))return;\n    const progress=ensureProgression(this.simulation.state),index=progress.stations.findIndex(station=>station.id===s.id);\n    if(index<0)return;\n    this.stationUI.close();this.openStation=null;this.stationRenderer.collapseLoot(s.id);progress.stations.splice(index,1);this.syncStations();this.audio.play('pickup');this.ui.notify('Salvage cache emptied');\n    if(this.screen==='station')this.setScreen('playing');\n  }\n  private syncStations(){const stations=ensureProgression(this.simulation.state).stations,ids=new Set(stations.map(s=>s.id));for(const id of [...this.stationIds])if(!ids.has(id)){this.stationIds.delete(id);this.interactions.remove(id);this.physics?.removeStructure(id);}this.stationRenderer.sync(stations);for(const s of stations)if(!this.stationIds.has(s.id)){this.stationIds.add(s.id);const size=STATIONS[s.kind].size;this.environment.coverArea(s.id,s.position,size[0]+.25,size[2]+.25,s.rotation);this.physics.setStructure(s.id,this.stationRenderer.boxes(s));this.interactions.register({id:s.id,kind:'station',object:this.stationRenderer.objects.get(s.id)!,position:()=>s.position,enabled:()=>true,info:()=>({title:STATIONS[s.kind].name,action:'OPEN',key:keyLabel(this.settings.keybinds.interact)}),interact:()=>{this.openStation=s.id;this.setScreen('station');this.stationUI.open(s,this.simulation.state.inventory);}});}}\n  private updateStationPreview"""
updated, count = re.subn(station_sync_pattern, station_sync_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'failed to replace station sync block: {count}')
write(path, updated)

# UI: resource target keeps concise name, but restores HP and durability progress.
path = 'src/ui/UI.ts'
text = read(path)
old = """      const nameOnly=Boolean(interaction&&!interaction.action);\n      const promptHTML = interaction ? nameOnly?`<div class=\"interaction-copy resource-name-only\"><strong>${esc(interaction.title)}</strong></div>`:`<span class=\"interaction-key\"><kbd>${esc(interaction.key)}</kbd></span><div class=\"interaction-copy\"><strong>${esc(this.interactionAction(interaction.action))}</strong><span>${esc(interaction.title)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class=\"interaction-progress\" style=\"width:${interaction.progress*100}%\"></i>` : ''}</div>` : '';\n"""
new = """      const nameOnly=Boolean(interaction&&!interaction.action);\n      const promptHTML = interaction ? nameOnly?`<div class=\"interaction-copy resource-name-only\"><strong>${esc(interaction.title)}</strong>${interaction.detail?`<span class=\"resource-hp\">${esc(interaction.detail)}</span>`:''}${interaction.progress!==undefined?`<span class=\"resource-health-track\"><i style=\"width:${Math.max(0,Math.min(1,interaction.progress))*100}%\"></i></span>`:''}</div>`:`<span class=\"interaction-key\"><kbd>${esc(interaction.key)}</kbd></span><div class=\"interaction-copy\"><strong>${esc(this.interactionAction(interaction.action))}</strong><span>${esc(interaction.title)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class=\"interaction-progress\" style=\"width:${interaction.progress*100}%\"></i>` : ''}</div>` : '';\n"""
if old not in text:
    raise SystemExit('missing UI resource-target render anchor')
write(path, text.replace(old, new, 1))

# HUD CSS for restored resource HP.
path = 'src/ui/style.css'
text = read(path)
css = """
/* v0.7.6: concise harvest target with visible HP/durability. */
.interaction-prompt.resource-target .resource-name-only{min-width:150px;padding:7px 11px 8px;background:rgba(10,18,14,.72);border:1px solid rgba(226,234,205,.16);box-shadow:0 4px 18px rgba(0,0,0,.18)}
.interaction-prompt.resource-target .resource-name-only .resource-hp{display:block;margin-top:5px;font:600 9px var(--title-font);letter-spacing:.11em;color:#e8e5cfb8}
.interaction-prompt.resource-target .resource-health-track{display:block;width:100%;height:3px;margin-top:7px;background:rgba(228,233,211,.16);overflow:hidden}
.interaction-prompt.resource-target .resource-health-track i{display:block;height:100%;background:var(--sand);box-shadow:0 0 7px rgba(212,187,132,.22)}
"""
if 'v0.7.6: concise harvest target' in text:
    raise SystemExit('v0.7.6 CSS already present')
write(path, text.rstrip() + '\n' + css)

# Station inventory: do not show TAKE ALL on an already-empty container.
replace_once('src/survival/StationUI.ts', "${s.inventory.length?'<button data-action=\"take\">TAKE ALL</button>':''}", "${s.inventory.some(Boolean)?'<button data-action=\"take\">TAKE ALL</button>':''}")

# Station renderer: breakup effect for consumed loot caches and delayed disposal while effect runs.
path = 'src/survival/StationRenderer.ts'
text = read(path)
field_anchor = " private interaction=new T.MeshBasicMaterial({visible:false});\n"
field_new = field_anchor + " private collapsing=new Map<string,{elapsed:number;group:T.Group;parts:{object:T.Object3D;position:T.Vector3;rotation:T.Euler;direction:T.Vector3;spin:T.Vector3}[]}>();\n"
if field_anchor not in text:
    raise SystemExit('missing StationRenderer interaction field anchor')
text = text.replace(field_anchor, field_new, 1)
text, count = re.subn(r" sync\(stations:Station\[\]\)\{[^\n]*\}\n", " sync(stations:Station[]){const ids=new Set(stations.map(s=>s.id));for(const [id,o]of this.objects)if(!ids.has(id)&&!this.collapsing.has(id)){this.disposeObject(o);this.objects.delete(id);}for(const s of stations)if(!this.objects.has(s.id)){const g=this.make(s);this.objects.set(s.id,g);this.group.add(g);}}\n", text, count=1)
if count != 1:
    raise SystemExit('failed StationRenderer sync replacement')
text, count = re.subn(r" update\(stations:Station\[\],time:number,p:T\.Vector3\)\{[^\n]*\}\n", """ update(stations:Station[],time:number,p:T.Vector3){this.fire.uniforms.time.value=time;let lit=0;for(const s of stations){const active=stationStatus(s)==='PROCESSING',g=this.objects.get(s.id);g?.traverse(o=>{if(o.name==='flame'){o.visible=active;o.scale.set(1+.12*Math.sin(time*8+o.id),.8+.24*Math.sin(time*5+o.id),1);o.rotation.y=time*.3+o.id;}});if(active&&lit<2&&p.distanceTo(new T.Vector3(s.position.x,s.position.y,s.position.z))<18){const l=this.lights[lit++];l.position.set(s.position.x,s.position.y+.65,s.position.z);l.intensity=5+Math.sin(time*4)*.4;}}for(let i=lit;i<2;i++)this.lights[i].intensity=0;for(const [id,fx] of [...this.collapsing]){fx.elapsed+=Math.max(0,dtSafe(time,fx.elapsed));const t=Math.min(1,fx.elapsed/.72),burst=1-Math.pow(1-t,2),shrink=Math.max(.025,1-Math.pow(t,2.35));for(const part of fx.parts){part.object.position.copy(part.position).addScaledVector(part.direction,burst);part.object.position.y+=Math.sin(Math.PI*t)*.28-t*t*.72;part.object.rotation.set(part.rotation.x+part.spin.x*t,part.rotation.y+part.spin.y*t,part.rotation.z+part.spin.z*t);part.object.scale.setScalar(shrink);}if(t>=1){this.collapsing.delete(id);this.disposeObject(fx.group);this.objects.delete(id);}}}\n""", text, count=1)
if count != 1:
    raise SystemExit('failed StationRenderer update replacement')
# The renderer update API has absolute time but no frame dt. Add a tiny helper that derives a bounded delta from the effect's own elapsed value.
# We replace that helper-based version immediately with an update signature that tracks effect time from the absolute render clock.
text = text.replace("private collapsing=new Map<string,{elapsed:number;group:T.Group;parts:{object:T.Object3D;position:T.Vector3;rotation:T.Euler;direction:T.Vector3;spin:T.Vector3}[]}>();", "private collapsing=new Map<string,{startedAt:number|null;group:T.Group;parts:{object:T.Object3D;position:T.Vector3;rotation:T.Euler;direction:T.Vector3;spin:T.Vector3}[]}>();", 1)
old_update_fragment = "for(const [id,fx] of [...this.collapsing]){fx.elapsed+=Math.max(0,dtSafe(time,fx.elapsed));const t=Math.min(1,fx.elapsed/.72),burst=1-Math.pow(1-t,2),shrink=Math.max(.025,1-Math.pow(t,2.35));"
new_update_fragment = "for(const [id,fx] of [...this.collapsing]){if(fx.startedAt===null)fx.startedAt=time;const elapsed=Math.max(0,time-fx.startedAt),t=Math.min(1,elapsed/.72),burst=1-Math.pow(1-t,2),shrink=Math.max(.025,1-Math.pow(t,2.35));"
if old_update_fragment not in text:
    raise SystemExit('missing collapse timing fragment')
text = text.replace(old_update_fragment, new_update_fragment, 1)
boxes_anchor = " boxes(s:Station):CollisionBox[]{"
collapse_method = """ collapseLoot(id:string):boolean{const group=this.objects.get(id);if(!group||this.collapsing.has(id))return false;const parts=group.children.filter((object):object is T.Mesh=>object instanceof T.Mesh&&object.material!==this.interaction).map((object,index)=>{const angle=.55+index*2.399963,direction=new T.Vector3(Math.cos(angle),.48+(index%3)*.13,Math.sin(angle)).normalize().multiplyScalar(.72+(index%4)*.17),spin=new T.Vector3((index%2?1:-1)*(.45+(index%3)*.18),(.5+(index%4)*.22)*(index%2?-1:1),(.35+(index%5)*.13)*(index%3?-1:1));return {object,position:object.position.clone(),rotation:object.rotation.clone(),direction,spin};});if(!parts.length)return false;this.collapsing.set(id,{startedAt:null,group,parts});return true;}\n"""
if boxes_anchor not in text:
    raise SystemExit('missing StationRenderer boxes anchor')
text = text.replace(boxes_anchor, collapse_method + boxes_anchor, 1)
write(path, text)

# Environment: keep hit transforms stable by perturbing the immutable base instance matrix.
path = 'src/rendering/environment.ts'
text = read(path)
field_anchor = "  private readonly hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);\n"
if field_anchor not in text:
    raise SystemExit('missing Environment hiddenMatrix anchor')
text = text.replace(field_anchor, field_anchor + "  private readonly hitRotation=new THREE.Matrix4();\n", 1)
hit_pattern = r"    for\(const \[id,hit\] of this\.hits\)\{[^\n]*\}\n"
hit_replacement = """    for(const [id,hit] of this.hits){const elapsed=hit.elapsed+dt,obj=this.nodeObjects.get(id),refs=this.instances.get(id);if(elapsed>.4){this.hits.delete(id);if(obj)obj.rotation.z=0;if(refs)for(const ref of refs){ref.mesh.setMatrixAt(ref.index,ref.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}else{hit.elapsed=elapsed;const amount=Math.sin(elapsed*34)*(1-elapsed/.4)*.022*hit.intensity;if(obj)obj.rotation.z=amount;if(refs){this.hitRotation.makeRotationZ(amount);for(const ref of refs){this.matrixDummy.matrix.copy(ref.matrix).multiply(this.hitRotation);ref.mesh.setMatrixAt(ref.index,this.matrixDummy.matrix);ref.mesh.instanceMatrix.needsUpdate=true;}}}}\n"""
text, count = re.subn(hit_pattern, hit_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'failed Environment hit replacement: {count}')
write(path, text)

# Regression coverage.
test = r'''import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {StationRenderer} from '../src/survival/StationRenderer';
import {createStation} from '../src/survival/stations';

describe('v0.7.6 loot and harvesting interaction fixes',()=>{
  it('breaks an emptied loot cache apart before removing its render object',()=>{
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),loot=createStation('loot-test','loot',{x:0,y:0,z:0});
    renderer.sync([loot]);expect(renderer.objects.has(loot.id)).toBe(true);expect(renderer.collapseLoot(loot.id)).toBe(true);
    renderer.sync([]);renderer.update([],10,new THREE.Vector3());expect(renderer.objects.has(loot.id)).toBe(true);
    renderer.update([],10.8,new THREE.Vector3());expect(renderer.objects.has(loot.id)).toBe(false);renderer.dispose();
  });

  it('keeps hard-resource HP visible and does not bind Interact/E to harvesting',()=>{
    const app=readFileSync(new URL('../src/app/GameApp.ts',import.meta.url),'utf8'),ui=readFileSync(new URL('../src/ui/UI.ts',import.meta.url),'utf8');
    expect(app).toContain("detail:`${Math.ceil(node.remaining)} / ${Math.ceil(node.capacity)} HP`");
    expect(app).toContain("interact:()=>{if(pickup)this.gather(node,true,this.resourceStrike(node,object));}");
    expect(ui).toContain('resource-health-track');expect(ui).toContain('resource-hp');
  });

  it('uses a base-matrix perturbation for resource hit feedback instead of decomposing the tree transform',()=>{
    const environment=readFileSync(new URL('../src/rendering/environment.ts',import.meta.url),'utf8');
    expect(environment).toContain('this.matrixDummy.matrix.copy(ref.matrix).multiply(this.hitRotation)');
    expect(environment).not.toContain('this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.rotation.z=amount');
  });
});
'''
write('tests/v076-loot-interactions.test.ts', test)

print('Tideland v0.7.6 patch applied')
