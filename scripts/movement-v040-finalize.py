from pathlib import Path
import json


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, path: str) -> str:
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:120]!r}")
    return text.replace(old, new, 1)

# GameApp integration
p='src/app/GameApp.ts'
s=read(p)
s=replace_once(s,"import {AudioMixer} from '../audio/AudioMixer';","import {AudioMixer,type FootstepSurface} from '../audio/AudioMixer';",p)
s=replace_once(s,
"    this.input.onLook=(x,y)=>{if(this.screen==='playing'&&this.player)this.player.look(x,y);};this.input.onKey=code=>this.onKey(code);",
"    this.input.onLook=(x,y)=>{if(this.screen==='playing'&&this.player){this.player.look(x,y);this.held.look(x,y);}};this.input.onKey=code=>this.onKey(code);",p)
s=replace_once(s,
"    this.player=new PlayerController(this.physics,this.camera,this.input,this.settings,this.simulation.state);this.player.onStep=()=>this.audio.play('step');",
"    this.player=new PlayerController(this.physics,this.camera,this.input,this.settings,this.simulation.state);this.player.onStep=speed=>this.audio.footstep(this.footstepSurface(),speed);",p)
s=replace_once(s,
"    if(code===keys.jump)this.player.jump();\n    if(code===keys.interact)this.interactions.trigger();",
"    if(code===keys.jump)this.player.jump();\n    if(code===keys.autoRun){const enabled=this.player.toggleAutoRun();this.ui.notify(this.settings.language==='cs'?(enabled?'Automatický běh zapnut':'Automatický běh vypnut'):(enabled?'Auto-run enabled':'Auto-run disabled'));}\n    if(code===keys.inspect)this.held.inspect();\n    if(code===keys.interact)this.interactions.trigger();",p)
s=replace_once(s,
"  private gather(node:ResourceNode,animate=true){if(this.cooldown>0)return;const result=this.simulation.gather(node);if(result.amount>0){this.cooldown=['fiber','berries','wood'].includes(node.kind)?.22:.62;if(animate)this.held.hit();this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');",
"  private gather(node:ResourceNode,animate=true){if(this.cooldown>0)return;const result=this.simulation.gather(node);if(result.amount>0){this.cooldown=['fiber','berries','wood'].includes(node.kind)?.22:.62;if(animate)this.held.hit();if(['tree','stone','metal','wood'].includes(node.kind))this.held.impact();this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');",p)
s=replace_once(s,
"      this.held.update(dt,this.player.speed);",
"      this.held.update(dt,this.player.speed,this.player.sprinting,this.player.crouching);",p)
old_shake="""    if(playing&&this.settings.cameraShake){const speed=Math.min(1,this.player.speed/7.1),kick=this.player.sprinting?.0045:.0015;this.camera.position.x+=Math.sin(this.elapsed*13.7)*kick*speed;this.camera.position.y+=Math.sin(this.elapsed*19.1)*kick*.55*speed;this.camera.rotation.z+=Math.sin(this.elapsed*10.3)*kick*.6*speed;}"""
new_shake="""    if(playing&&this.settings.cameraShake&&this.player.sprinting){const kick=.00115;this.camera.position.x+=Math.sin(this.elapsed*13.7)*kick;this.camera.position.y+=Math.sin(this.elapsed*19.1)*kick*.45;}"""
s=replace_once(s,old_shake,new_shake,p)
marker="  private tutorial(){"
footstep_method="""  private footstepSurface():FootstepSurface{\n    const p=this.simulation.state.player.position;\n    // Player-built floors/foundations get a dry timber transient; natural ground\n    // maps the procedural biome to distinct sand/grass/forest/rock profiles.\n    const onTimber=this.simulation.state.structures.some(s=>{if(!['foundation','floor','roof'].includes(s.pieceType))return false;const dx=Math.abs(s.position.x-p.x),dz=Math.abs(s.position.z-p.z);return dx<1.55&&dz<1.55&&Math.abs(p.y-s.position.y)<1.25;});\n    if(onTimber)return 'wood';\n    const biome=this.environment.biomeAt(p.x,p.z);\n    if(biome==='COAST')return 'sand';\n    if(biome==='ROCKY UPLAND')return 'rock';\n    if(biome==='FOREST')return 'forest';\n    return 'grass';\n  }\n"""
if marker not in s: raise SystemExit('tutorial marker missing')
s=s.replace(marker,footstep_method+marker,1)
write(p,s)

# UI keybind rows
p='src/ui/UI.ts'
s=read(p)
old="['use','use'],['map','map'],['maintenance','maintenance']"
new="['use','use'],['map','map'],['maintenance','maintenance'],['autoRun','autoRun'],['inspect','inspect']"
s=replace_once(s,old,new,p)
write(p,s)

# Camera projection tests
p='tests/camera-projection.test.ts'
s=read(p)
s=replace_once(s,
"  projection.update(1/60,true);expect(camera.fov).toBeGreaterThan(75);expect(camera.fov).toBeLessThan(77);\n  for(let i=0;i<120;i++)projection.update(1/60,true);expect(camera.fov).toBeCloseTo(77,8);",
"  projection.update(1/60,true);expect(camera.fov).toBeGreaterThan(75);expect(camera.fov).toBeLessThan(76);\n  for(let i=0;i<120;i++)projection.update(1/60,true);expect(camera.fov).toBeCloseTo(75.85,8);",p)
write(p,s)

# Mouse filter tests: preserve burst protection but assert render-frame batching independence.
p='tests/mouse-look-filter.test.ts'
s=read(p)
insert="""  it('keeps total physical mouse motion identical across render-frame batching',()=>{\n    const slow=new MouseLookFilter(),fast=new MouseLookFilter();\n    for(let i=0;i<24;i++)slow.add(2,-1);const a=slow.consume();\n    let x=0,y=0;for(let frame=0;frame<6;frame++){for(let i=0;i<4;i++)fast.add(2,-1);const d=fast.consume();x+=d.x;y+=d.y;}\n    expect({x,y}).toEqual(a);\n  });\n"""
needle="  it('ignores non-finite browser deltas'"
idx=s.find(needle)
if idx<0: raise SystemExit('mouse test marker missing')
s=s[:idx]+insert+s[idx:]
write(p,s)

# Version history
p='src/config/version.ts'
s=read(p)
s=replace_once(s,"export const GAME_VERSION='0.3.0';\nexport const GAME_BUILD='EA-03';","export const GAME_VERSION='0.4.0';\nexport const GAME_BUILD='EA-04';",p)
entry="""  {version:'0.4.0',date:'2026-09-11',title:'Movement & first-person animation overhaul',changes:[\n    'Added tuned acceleration, deceleration, reverse response and restrained in-air steering instead of instant ground-speed changes.',\n    'Reduced the sprint FOV kick to a subtle 0.85 degrees and added smooth crouch, landing bob and walking camera sway.',\n    'Made mouse-look accumulation independent of render-frame batching while keeping per-event burst protection.',\n    'Added jump cooldown, survival-FPS crouch/sprint restrictions and remappable auto-run.',\n    'Added speed- and surface-aware procedural footsteps for sand, grass, forest, rock and timber structures.',\n    'Rebuilt the procedural first-person rig with persistent hands, item-specific rock/hatchet/pickaxe poses and torch motion.',\n    'Added equip/unequip transitions, mouse-driven tool sway, sprint lowering, contact recoil and a remappable inspect animation.'\n  ]},\n"""
s=replace_once(s,"export const CHANGELOG:ChangeEntry[]=[\n", "export const CHANGELOG:ChangeEntry[]=[\n"+entry,p)
write(p,s)

# Package versions
for p in ['package.json','package-lock.json']:
    s=read(p)
    s=s.replace('"version": "0.3.0"','"version": "0.4.0"',2 if p.endswith('lock.json') else 1)
    write(p,s)

# Markdown changelog
p='CHANGELOG.md'
s=read(p)
entry_md="""## 0.4.0 — 2026-09-11\n\nMovement, camera feel and first-person animation overhaul.\n\n- Added tuned acceleration/deceleration, stronger reverse braking and restrained air control.\n- Reduced sprint FOV kick to a subtle `0.85°`, with smooth crouch transitions, landing bob and light walking sway.\n- Made mouse-look accumulation independent of render-frame batching while retaining burst protection.\n- Added jump cooldown, survival-FPS crouch/sprint restrictions and remappable auto-run (`Caps Lock` by default).\n- Added speed- and surface-aware footsteps for coast sand, grassland, forest, rocky terrain and timber structures.\n- Rebuilt the procedural first-person rig with persistent hands and more physical rock, hatchet, pickaxe and torch presentation.\n- Added item-specific swing arcs, equip/unequip transitions, mouse-driven tool sway, sprint pose, hit recoil and inspect (`X` by default).\n\n"""
s=replace_once(s,"# Tideland changelog\n\n","# Tideland changelog\n\n"+entry_md,p)
write(p,s)

# README current release and focus
p='README.md'
s=read(p)
s=s.replace('version-v0.2.4%20%7C%20EA--02.4','version-v0.4.0%20%7C%20EA--04')
s=s.replace('**Current release:** `v0.2.4 / EA-02.4` · **11 September 2026**','**Current release:** `v0.4.0 / EA-04` · **11 September 2026**')
s=s.replace('- First-person held items','- First-person hands with animated held tools, equip transitions, sway, sprint pose and inspect')
s=s.replace('- Mouse sensitivity, invert Y and head bob settings','- Frame-rate independent mouse look, separate X/Y sensitivity, auto-run, invert Y and head bob settings')
s=s.replace('**v0.2.x** is focused on making the foundation reliable before larger content expansion.','**v0.4.x** is focused on first-person game feel, movement and viewmodel presentation.')
s=s.replace('- ✅ Stable yaw-based first-person movement','- ✅ Tuned acceleration/deceleration, air control, crouch transitions and landing response')
s=s.replace('- ✅ Cross-device mouse-look filtering and burst protection','- ✅ Frame-rate independent mouse-look accumulation and burst protection')
s=s.replace('- 🎨 Next major focus: graphics, environment and atmosphere overhaul','- ✅ Animated hands/tools with swing, recoil, sway, sprint pose and inspect')
s=s.replace('- 🔊 Planned: improved ambience, footsteps, harvesting, weather and interaction audio','- ✅ Speed- and surface-aware procedural footsteps')
write(p,s)

print('v0.4.0 final integration patch applied')
