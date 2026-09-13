from pathlib import Path
import re

ROOT=Path('.')

def read(path):
    return (ROOT/path).read_text()

def write(path,text):
    (ROOT/path).write_text(text)

def replace_once(text,old,new,label):
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old,new,1)

# Settings model + persistence -------------------------------------------------
p=Path('src/core/types.ts'); s=read(p)
s=replace_once(s,"quality:GraphicsQuality; renderScale:number; shadows:boolean;","quality:GraphicsQuality; renderScale:number; vsync:boolean; shadows:boolean;","Settings.vsync")
write(p,s)

p=Path('src/config/balance.ts'); s=read(p)
s=replace_once(s,"quality:'high' as const,renderScale:1,shadows:true,","quality:'high' as const,renderScale:1,vsync:true,shadows:true,","DEFAULT_SETTINGS.vsync")
write(p,s)

p=Path('src/save/storage.ts'); s=read(p)
s=replace_once(s,"    renderScale: finite(value.renderScale, 0.5, 1) ? value.renderScale : DEFAULT_SETTINGS.renderScale,\n    shadows:","    renderScale: finite(value.renderScale, 0.5, 1) ? value.renderScale : DEFAULT_SETTINGS.renderScale,\n    vsync: typeof value.vsync === 'boolean' ? value.vsync : DEFAULT_SETTINGS.vsync,\n    shadows:","normalizeSettings.vsync")
write(p,s)

# EN/CZ strings ----------------------------------------------------------------
p=Path('src/ui/i18n.ts'); s=read(p)
s=replace_once(s,"renderScale:'RENDER SCALE',renderScaleDetail:'Lower this first if GPU performance is low.',shadows:","renderScale:'RENDER SCALE',renderScaleDetail:'Lower this first if GPU performance is low.',vsync:'V-SYNC',vsyncDetail:'Synchronize rendering to display refresh. OFF uncaps game-loop submissions; the browser compositor can still present on refresh.',shadows:","i18n en vsync")
s=replace_once(s,"renderScale:'MĚŘÍTKO RENDERU',renderScaleDetail:'Při nízkém FPS sniž nejdřív tuto hodnotu.',shadows:","renderScale:'MĚŘÍTKO RENDERU',renderScaleDetail:'Při nízkém FPS sniž nejdřív tuto hodnotu.',vsync:'V-SYNC',vsyncDetail:'Synchronizuje vykreslování s obnovovací frekvencí displeje. VYP odemkne herní smyčku; prohlížeč může obraz dál zobrazovat podle obnovování displeje.',shadows:","i18n cs vsync")
write(p,s)

# UI: VSync setting + save modal reliability ----------------------------------
p=Path('src/ui/UI.ts'); s=read(p)
s=replace_once(s,"${this.slider('brightness','brightness','brightnessDetail',0.75,1.35,0.05)}${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}${this.slider('foliageDensity','foliageDensity','foliageDensityDetail',0.25,1,0.05)}","${this.slider('brightness','brightness','brightnessDetail',0.75,1.35,0.05)}${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}${this.toggle('vsync','vsync','vsyncDetail')}${this.slider('foliageDensity','foliageDensity','foliageDensityDetail',0.25,1,0.05)}","UI graphics vsync")
s=replace_once(s,"<div class=\"confirm-overlay new-game-confirm\" hidden><div class=\"confirm-card\"><span class=\"eyebrow\">SAVE SLOT</span>","<div class=\"confirm-overlay new-game-confirm\" hidden><div class=\"confirm-card\"><button class=\"confirm-close\" data-action=\"cancelNew\" aria-label=\"Close\">×</button><span class=\"eyebrow\">SAVE SLOT</span>","new confirm close")
s=replace_once(s,"<div class=\"confirm-overlay delete-slot-confirm\" hidden><div class=\"confirm-card\"><span class=\"eyebrow\">LOCAL SAVE</span>","<div class=\"confirm-overlay delete-slot-confirm\" hidden><div class=\"confirm-card\"><button class=\"confirm-close\" data-action=\"deleteSlotCancel\" aria-label=\"Close\">×</button><span class=\"eyebrow\">LOCAL SAVE</span>","delete confirm close")
s=s.replace("'postProcessing'|'ambientOcclusion'|'bloom'|'telemetryPerformance'", "'postProcessing'|'ambientOcclusion'|'bloom'|'vsync'|'telemetryPerformance'")
s=replace_once(s,"['invertY','headBob','cameraShake','motionBlur','shadows','showCompass','showFps','showTutorialHints','postProcessing','ambientOcclusion','bloom','telemetryPerformance'","['invertY','headBob','cameraShake','motionBlur','shadows','showCompass','showFps','showTutorialHints','postProcessing','ambientOcclusion','bloom','vsync','telemetryPerformance'","setSettings vsync")
write(p,s)

# CSS: modal was inheriting pointer-events:none from .tide-ui ------------------
p=Path('src/ui/style.css'); s=read(p)
s=replace_once(s,".confirm-overlay{position:fixed;inset:0;z-index:900;display:grid;place-items:center;background:rgba(1,5,5,.72);backdrop-filter:blur(10px)}",".confirm-overlay{position:fixed;inset:0;z-index:900;display:grid;place-items:center;background:rgba(1,5,5,.72);backdrop-filter:blur(10px);pointer-events:auto}","confirm pointer events")
s=replace_once(s,".confirm-card{width:min(480px,88vw);padding:32px;background:#0d1614;",".confirm-card{position:relative;width:min(480px,88vw);padding:32px;background:#0d1614;","confirm position")
s=replace_once(s,".confirm-card button{min-height:44px;padding:0 16px}",".confirm-card button{min-height:44px;padding:0 16px;pointer-events:auto}.confirm-close{position:absolute;right:14px;top:14px!important;width:36px;min-height:36px!important;padding:0!important;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#e9ecdf;font-size:20px;line-height:1}.confirm-close:hover{background:rgba(255,255,255,.10)}", "confirm close styles")
write(p,s)

# Game loop: browser-safe frame sync toggle -----------------------------------
p=Path('src/app/GameApp.ts'); s=read(p)
s=replace_once(s,"private last=0;private accumulator=0;private uiTimer=0;private elapsed=0;private autoSave=0;private cooldown=0;private fps=60;private frameMs=16.7;private timeMultiplier=1;private loading=false;private leftDown=false;","private last=0;private accumulator=0;private uiTimer=0;private elapsed=0;private autoSave=0;private cooldown=0;private fps=60;private frameMs=16.7;private timeMultiplier=1;private loading=false;private leftDown=false;private loopStarted=false;private frameTimer:number|undefined;private loopMode:'vsync'|'uncapped'|null=null;","frame loop fields")
s=replace_once(s,"this.setScreen('menu');this.installDevAPI();this.renderer.setAnimationLoop(t=>this.frame(t));}","this.setScreen('menu');this.installDevAPI();this.loopStarted=true;this.configureFrameLoop();}","init frame loop")
anchor="  private async makeWorld(seed:number,saved?:GameState){"
method="""  private configureFrameLoop(){
    const mode=this.settings.vsync?'vsync':'uncapped';if(this.loopMode===mode)return;this.loopMode=mode;
    if(this.frameTimer!==undefined){window.clearTimeout(this.frameTimer);this.frameTimer=undefined;}
    this.renderer.setAnimationLoop(null);this.last=performance.now();this.accumulator=0;
    if(mode==='vsync'){this.renderer.setAnimationLoop(t=>this.frame(t));return;}
    const tick=()=>{if(this.loopMode!=='uncapped'||this.settings.vsync)return;this.frame(performance.now());this.frameTimer=window.setTimeout(tick,0);};
    this.frameTimer=window.setTimeout(tick,0);
  }
"""
s=replace_once(s,anchor,method+anchor,"configureFrameLoop")
s=replace_once(s,"this.environment?.atmosphere.setShadowSettings(s.shadows,s.shadowQuality,s.shadowDistance);this.resize();}","this.environment?.atmosphere.setShadowSettings(s.shadows,s.shadowQuality,s.shadowDistance);if(this.loopStarted)this.configureFrameLoop();this.resize();}","applySettings frame loop")
write(p,s)

# Stronger material-specific gathering particles -------------------------------
p=Path('src/rendering/ImpactFX.ts'); s=read(p)
s=replace_once(s,"private readonly maxParticles=96;","private readonly maxParticles=160;","impact pool")
pattern=r"  burst\(position:Vec3,kind:'wood'\|'stone'\|'metal'\|'fiber'\|'berries'\|'build'='stone',strength=1\)\{.*?\n  \}\n\n  update\(dt:number\)\{"
replacement="""  burst(position:Vec3,kind:'wood'|'stone'|'metal'|'fiber'|'berries'|'build'='stone',strength=1){
    const palettes:Record<string,number[]>={wood:[0xc7955d,0x9c6234,0xe0b77a],stone:[0xd7d3c4,0xa9a69d,0xede8dc],metal:[0xd6b171,0x8f877c,0xf1d08a],fiber:[0x9caf63,0x6e8748,0xc2ca7d],berries:[0xb85155,0x7f2937,0xd77673],build:[0xd4b276,0xa17d4c]};
    const force=Math.max(.7,Math.min(1.85,strength)),base=kind==='build'?18:kind==='wood'?25:kind==='metal'?23:kind==='stone'?21:kind==='berries'?16:14,amount=Math.round(base*force),colors=palettes[kind]??palettes.stone!;
    for(let i=0;i<amount;i++){
      const index=this.next++%this.maxParticles,p=this.particles[index],angle=this.random()*Math.PI*2,rad=.38+this.random()*.82,color=new THREE.Color(colors[Math.floor(this.random()*colors.length)]!);
      const lift=kind==='wood'?1.35:kind==='metal'?1.15:kind==='stone'?.95:1.05;
      p.life=p.max=.28+this.random()*(kind==='wood'?.42:.30);p.x=position.x+(this.random()-.5)*.20;p.y=position.y+.18+this.random()*.28;p.z=position.z+(this.random()-.5)*.20;
      p.vx=Math.cos(angle)*rad*1.5*force;p.vz=Math.sin(angle)*rad*1.5*force;p.vy=(.55+this.random()*1.85)*force*lift;p.size=(kind==='wood'?.065+this.random()*.055:kind==='metal'?.05+this.random()*.045:.045+this.random()*.04)*(1+(force-1)*.4);p.color.copy(color).offsetHSL((this.random()-.5)*.035,(this.random()-.5)*.07,(this.random()-.5)*.08);
      this.write(index,p);
    }
    this.positionAttribute.needsUpdate=true;this.colorAttribute.needsUpdate=true;this.sizeAttribute.needsUpdate=true;
  }

  update(dt:number){"""
s2,n=re.subn(pattern,replacement,s,flags=re.S)
if n!=1: raise SystemExit(f'impact burst replacement count={n}')
write(p,s2)

# More gatherable loose wood + berry bushes -----------------------------------
p=Path('src/rendering/environment.ts'); s=read(p)
s=replace_once(s,"for(let i=0,count=0;i<1900&&count<150;i++){","for(let i=0,count=0;i<3400&&count<260;i++){","resource node count")
s=replace_once(s,"if(rand()>.55)continue;create(rand()<.28?'wood':rand()<.34?'berries':'fiber',x,z,.75+rand()*.45);count++;","if(rand()>.62)continue;const roll=rand();create(roll<.40?'wood':roll<.70?'berries':'fiber',x,z,.75+rand()*.45);count++;","resource node weights")
write(p,s)

# Version/history --------------------------------------------------------------
p=Path('src/config/version.ts'); s=read(p)
s=s.replace("export const GAME_VERSION='0.7.2';","export const GAME_VERSION='0.7.3';",1).replace("export const GAME_BUILD='EA-07.2';","export const GAME_BUILD='EA-07.3';",1).replace("export const GAME_RELEASE_DATE='2026-09-12';","export const GAME_RELEASE_DATE='2026-09-13';",1)
entry="""  {version:'0.7.3',date:'2026-09-13',title:'Save controls, frame sync & gathering polish',changes:[
    'Fixed save-slot confirmation overlays inheriting disabled pointer events; Delete, Cancel and the new close button now work reliably.',
    'Added a persistent V-Sync setting: ON uses display-synchronized animation frames, while OFF uncaps game-loop submissions within browser limits.',
    'Strengthened material-specific harvesting particles for wood, stone, metal, fiber and berries with a larger pooled effect budget.',
    'Increased procedural gatherable loose-wood and berry-bush availability while keeping decorative foliage density separate.',
    'Documented the current rendering-stability foundation already on main: depth-based AO, lower vegetation draw/triangle load and corrected Render Scale canvas sizing.'
  ]},
"""
s=replace_once(s,"export const CHANGELOG:ChangeEntry[]=[\n","export const CHANGELOG:ChangeEntry[]=[\n"+entry,"version changelog entry")
write(p,s)

p=Path('CHANGELOG.md'); s=read(p)
md="""## v0.7.3 / EA-07.3 — Save controls, frame sync & gathering polish (2026-09-13)

- Fixed per-slot delete/overwrite confirmation overlays so their buttons receive pointer input; added an explicit close button.
- Added persistent V-Sync control. ON follows display-synchronized animation frames; OFF uncaps game-loop submissions within browser limits.
- Increased material-specific harvesting particle density and variation for wood, stone, metal, fiber and berries.
- Increased gatherable loose-wood and berry-bush spawns across procedural islands.
- Documented the rendering-stability foundation already merged to main: depth-based AO, substantially lower vegetation draw/triangle load and corrected Render Scale canvas sizing.

"""
write(p,md+s)

# README -----------------------------------------------------------------------
p=Path('README.md'); s=read(p)
s=s.replace('version-v0.7.2%20%7C%20EA--07.2','version-v0.7.3%20%7C%20EA--07.3')
s=s.replace('**Current release:** `v0.7.2 / EA-07.2` · **12 September 2026**','**Current release:** `v0.7.3 / EA-07.3` · **13 September 2026**')
s=s.replace('`EARLY ACCESS DEVELOPMENT · v0.7.2 / EA-07.2`','`EARLY ACCESS DEVELOPMENT · v0.7.3 / EA-07.3`')
s=replace_once(s,'- Render scale, brightness, shadows, compass and crosshair settings','- Render scale, brightness, V-Sync/frame pacing, shadows, compass and crosshair settings','README settings')
s=replace_once(s,'- ✅ Automated CI validation and GitHub Pages deployment','- ✅ Reliable multi-save confirmation controls, optional V-Sync/frame pacing and denser gatherable loose wood/berry resources\n- ✅ Current rendering-stability foundation with depth-based AO and reduced vegetation render cost\n- ✅ Automated CI validation and GitHub Pages deployment','README focus')
s=replace_once(s,'| `v0.6.0` | Environment rendering, water, vegetation, atmosphere and scalable post FX |','| `v0.7.3` | Save-dialog reliability, V-Sync/frame pacing, gathering FX and resource-density polish |\n| `v0.7.2` | Settings navigation and configurable performance telemetry |\n| `v0.7.1` | Save/UI reliability, pause-menu polish and expanded graphics controls |\n| `v0.6.0` | Environment rendering, water, vegetation, atmosphere and scalable post FX |','README release rows')
write(p,s)

# Package metadata -------------------------------------------------------------
for name in ['package.json','package-lock.json']:
    p=Path(name); s=read(p); s=s.replace('"version": "0.7.2"','"version": "0.7.3"',2); write(p,s)

# Regression test --------------------------------------------------------------
Path('tests/settings-v073.test.ts').write_text("""import {beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import {DEFAULT_SETTINGS} from '../src/config/balance';
import {loadSettings,saveSettings} from '../src/save/storage';

class MemoryStorage {private data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}clear(){this.data.clear();}}

describe('v0.7.3 small polish',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));
  it('persists V-Sync and defaults older settings to synchronized rendering',()=>{
    expect(DEFAULT_SETTINGS.vsync).toBe(true);
    saveSettings({...DEFAULT_SETTINGS,vsync:false,keybinds:{...DEFAULT_SETTINGS.keybinds}});
    expect(loadSettings().vsync).toBe(false);
    localStorage.setItem('tideland:settings:v1',JSON.stringify({language:'en'}));
    expect(loadSettings().vsync).toBe(true);
  });
  it('keeps save confirmations pointer-interactive and exposes a close action',()=>{
    const css=fs.readFileSync('src/ui/style.css','utf8'),ui=fs.readFileSync('src/ui/UI.ts','utf8');
    expect(css).toMatch(/\\.confirm-overlay\\{[^}]*pointer-events:auto/);
    expect(ui).toContain('class=\\"confirm-close\\" data-action=\\"deleteSlotCancel\\"');
    expect(ui).toContain("this.toggle('vsync','vsync','vsyncDetail')");
  });
  it('ships denser gatherable wood and berry resource placement',()=>{
    const env=fs.readFileSync('src/rendering/environment.ts','utf8');
    expect(env).toContain('count<260');
    expect(env).toContain("roll<.40?'wood':roll<.70?'berries':'fiber'");
  });
});
""")

print('v0.7.3 patch applied')
