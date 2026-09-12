from pathlib import Path
import re

ROOT=Path('.')

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def replace(path,old,new,count=1):
    text=read(path)
    if old not in text: raise SystemExit(f'missing marker in {path}: {old[:120]!r}')
    text=text.replace(old,new,count)
    write(path,text)

def regex(path,pattern,repl,count=0):
    text=read(path)
    text2,n=re.subn(pattern,repl,text,count=count,flags=re.M)
    if n==0: raise SystemExit(f'pattern not found in {path}: {pattern}')
    write(path,text2)

# Version/package metadata.
for path in ['package.json','package-lock.json']:
    text=read(path).replace('"version": "0.7.1"','"version": "0.7.2"')
    write(path,text)
replace('README.md','v0.7.1','v0.7.2')
replace('src/config/version.ts',"export const GAME_VERSION='0.7.1';\nexport const GAME_BUILD='EA-07.1';\nexport const GAME_RELEASE_DATE='2026-09-12';", "export const GAME_VERSION='0.7.2';\nexport const GAME_BUILD='EA-07.2';\nexport const GAME_RELEASE_DATE='2026-09-12';")
replace('src/config/version.ts','export const CHANGELOG:ChangeEntry[]=[\n',"export const CHANGELOG:ChangeEntry[]=[\n  {version:'0.7.2',date:'2026-09-12',title:'Settings navigation & telemetry polish',changes:[\n    'Reworked Settings navigation with a compact themed back control and Escape fallback so the player cannot get trapped in Settings.',\n    'Standardized Settings action buttons so Manage Saves and other controls no longer fall back to bright browser-default styling.',\n    'Redesigned the F3 developer telemetry into separate Performance, Player, Camera and World modules.',\n    'Added telemetry size, opacity and per-module visibility controls while keeping the lightweight FPS chip independently configurable.',\n    'Improved the FPS chip with frame time and clearer visual hierarchy without changing world rendering.'\n  ]},\n")

# Settings model and defaults.
replace('src/core/types.ts',
"brightness:number; showCompass:boolean; showFps:boolean; showTutorialHints:boolean; keybinds:Keybinds}",
"brightness:number; showCompass:boolean; showFps:boolean; showTutorialHints:boolean; telemetryScale:number; telemetryOpacity:number; telemetryPerformance:boolean; telemetryPlayer:boolean; telemetryCamera:boolean; telemetryWorld:boolean; keybinds:Keybinds}")
replace('src/config/balance.ts',
"brightness:1.08,showCompass:true,showFps:false,showTutorialHints:true,keybinds:{...DEFAULT_KEYBINDS}};",
"brightness:1.08,showCompass:true,showFps:false,showTutorialHints:true,telemetryScale:1,telemetryOpacity:.92,telemetryPerformance:true,telemetryPlayer:true,telemetryCamera:false,telemetryWorld:true,keybinds:{...DEFAULT_KEYBINDS}};")
replace('src/save/storage.ts',
"    showTutorialHints: typeof value.showTutorialHints === 'boolean' ? value.showTutorialHints : DEFAULT_SETTINGS.showTutorialHints,\n    keybinds",
"    showTutorialHints: typeof value.showTutorialHints === 'boolean' ? value.showTutorialHints : DEFAULT_SETTINGS.showTutorialHints,\n    telemetryScale: finite(value.telemetryScale, 0.7, 1.4) ? value.telemetryScale : DEFAULT_SETTINGS.telemetryScale,\n    telemetryOpacity: finite(value.telemetryOpacity, 0.55, 1) ? value.telemetryOpacity : DEFAULT_SETTINGS.telemetryOpacity,\n    telemetryPerformance: typeof value.telemetryPerformance === 'boolean' ? value.telemetryPerformance : DEFAULT_SETTINGS.telemetryPerformance,\n    telemetryPlayer: typeof value.telemetryPlayer === 'boolean' ? value.telemetryPlayer : DEFAULT_SETTINGS.telemetryPlayer,\n    telemetryCamera: typeof value.telemetryCamera === 'boolean' ? value.telemetryCamera : DEFAULT_SETTINGS.telemetryCamera,\n    telemetryWorld: typeof value.telemetryWorld === 'boolean' ? value.telemetryWorld : DEFAULT_SETTINGS.telemetryWorld,\n    keybinds")

# i18n strings for telemetry controls.
replace('src/ui/i18n.ts',
"showFps:'FPS COUNTER',showFpsDetail:'Show a small live frame-rate counter.',tutorialHints:'TUTORIAL HINTS',tutorialHintsDetail:'Show contextual onboarding tips during gameplay.'",
"showFps:'FPS COUNTER',showFpsDetail:'Show a small live frame-rate counter.',tutorialHints:'TUTORIAL HINTS',tutorialHintsDetail:'Show contextual onboarding tips during gameplay.',performanceOverlay:'PERFORMANCE OVERLAY',performanceOverlayDetail:'Choose how the F3 telemetry panel looks and which modules it shows.',telemetryScale:'TELEMETRY SIZE',telemetryScaleDetail:'Scale the F3 telemetry panel without covering more of the center view.',telemetryOpacity:'TELEMETRY OPACITY',telemetryOpacityDetail:'Adjust the panel background and text transparency.',telemetryPerformance:'PERFORMANCE MODULE',telemetryPerformanceDetail:'FPS, frame time, draw calls and triangle count.',telemetryPlayer:'PLAYER MODULE',telemetryPlayerDetail:'Movement, velocity and player-state diagnostics.',telemetryCamera:'CAMERA MODULE',telemetryCameraDetail:'Detailed camera basis, FOV and orientation diagnostics.',telemetryWorld:'WORLD MODULE',telemetryWorldDetail:'Seed, biome, world time, nodes and structures.'")
replace('src/ui/i18n.ts',
"showFps:'POČÍTADLO FPS',showFpsDetail:'Zobrazí malé živé počítadlo snímků.',tutorialHints:'HERNÍ NÁPOVĚDY',tutorialHintsDetail:'Zobrazí kontextové rady během hraní.'",
"showFps:'POČÍTADLO FPS',showFpsDetail:'Zobrazí malé živé počítadlo snímků.',tutorialHints:'HERNÍ NÁPOVĚDY',tutorialHintsDetail:'Zobrazí kontextové rady během hraní.',performanceOverlay:'PŘEHLED VÝKONU',performanceOverlayDetail:'Nastaví vzhled panelu F3 a vybere, které moduly se v něm zobrazí.',telemetryScale:'VELIKOST TELEMETRIE',telemetryScaleDetail:'Změní velikost panelu F3 bez zakrytí středu obrazu.',telemetryOpacity:'PRŮHLEDNOST TELEMETRIE',telemetryOpacityDetail:'Nastaví průhlednost panelu a diagnostického textu.',telemetryPerformance:'MODUL VÝKONU',telemetryPerformanceDetail:'FPS, čas snímku, draw calls a počet trojúhelníků.',telemetryPlayer:'MODUL HRÁČE',telemetryPlayerDetail:'Pohyb, rychlost a stav hráče.',telemetryCamera:'MODUL KAMERY',telemetryCameraDetail:'Detailní orientace kamery, FOV a směrové údaje.',telemetryWorld:'MODUL SVĚTA',telemetryWorldDetail:'Seed, biom, herní čas, uzly a stavby.'")

# Settings and telemetry markup.
replace('src/ui/UI.ts',
'<header class="overlay-header settings-v3-header"><div class="small-brand">${mark}<span>TIDELAND</span><i>/</i><span class="muted" data-i18n="settings">SETTINGS</span></div><button class="close-button" data-action="settingsBack"><span data-i18n="back">BACK</span> <b>×</b></button></header>',
'<header class="overlay-header settings-v3-header settings-v4-header"><div class="small-brand">${mark}<span>TIDELAND</span><i>/</i><span class="muted" data-i18n="settings">SETTINGS</span></div><button class="settings-back-button" data-action="settingsBack"><span data-i18n="back">BACK</span><small class="settings-back-context">TO MENU</small><kbd>ESC</kbd></button></header>')
replace('src/ui/UI.ts',
"${this.slider('hudScale','hudScale','hudScaleDetail',0.8,1.45,0.05)}${this.slider('hudOpacity','hudOpacity','hudOpacityDetail',0.55,1,0.05)}${this.slider('crosshairOpacity','crosshair','crosshairDetail',0,1,0.05)}${this.slider('crosshairScale','crosshairScale','crosshairScaleDetail',0.6,2,0.05)}${this.toggle('showCompass','compass','compassDetail')}${this.toggle('showFps','showFps','showFpsDetail')}${this.toggle('showTutorialHints','tutorialHints','tutorialHintsDetail')}",
"${this.slider('hudScale','hudScale','hudScaleDetail',0.8,1.45,0.05)}${this.slider('hudOpacity','hudOpacity','hudOpacityDetail',0.55,1,0.05)}${this.slider('crosshairOpacity','crosshair','crosshairDetail',0,1,0.05)}${this.slider('crosshairScale','crosshairScale','crosshairScaleDetail',0.6,2,0.05)}${this.toggle('showCompass','compass','compassDetail')}${this.toggle('showFps','showFps','showFpsDetail')}${this.toggle('showTutorialHints','tutorialHints','tutorialHintsDetail')}<div class=\"settings-subheading telemetry-settings-heading\"><span data-i18n=\"performanceOverlay\">PERFORMANCE OVERLAY</span><small>F3</small></div>${this.slider('telemetryScale','telemetryScale','telemetryScaleDetail',0.7,1.4,0.05)}${this.slider('telemetryOpacity','telemetryOpacity','telemetryOpacityDetail',0.55,1,0.05)}${this.toggle('telemetryPerformance','telemetryPerformance','telemetryPerformanceDetail')}${this.toggle('telemetryPlayer','telemetryPlayer','telemetryPlayerDetail')}${this.toggle('telemetryCamera','telemetryCamera','telemetryCameraDetail')}${this.toggle('telemetryWorld','telemetryWorld','telemetryWorldDetail')}")
replace('src/ui/UI.ts',
'<aside class="diagnostics" hidden><strong>DEVELOPER TELEMETRY <span>F3</span></strong><pre></pre><div><button data-dev="resources">GIVE RESOURCES</button><button data-dev="plan">GIVE PLAN</button><button data-dev="spawn">RESET POSITION</button><button data-dev="day">DAYTIME</button><button data-dev="night">NIGHT</button><button data-dev="speed">TIME ×20</button><button data-dev="normal">TIME ×1</button><button data-dev="sockets">SNAP SOCKETS</button><button data-dev="collisions">COLLISIONS</button></div></aside>',
'<aside class="diagnostics telemetry-panel" hidden><header class="telemetry-header"><div><span>DEVELOPER TELEMETRY</span><strong>TIDELAND <i>F3</i></strong></div><button data-action="telemetryClose" aria-label="Close telemetry">×</button></header><div class="telemetry-sections"><section data-telemetry-section="performance"><header><span>01</span><b>PERFORMANCE</b></header><div class="telemetry-metrics" data-telemetry-body="performance"></div></section><section data-telemetry-section="player"><header><span>02</span><b>PLAYER</b></header><div class="telemetry-lines" data-telemetry-body="player"></div></section><section data-telemetry-section="camera"><header><span>03</span><b>CAMERA</b></header><div class="telemetry-lines" data-telemetry-body="camera"></div></section><section data-telemetry-section="world"><header><span>04</span><b>WORLD</b></header><div class="telemetry-metrics" data-telemetry-body="world"></div></section></div><footer class="telemetry-actions"><button data-dev="resources">GIVE RESOURCES</button><button data-dev="plan">GIVE PLAN</button><button data-dev="spawn">RESET POSITION</button><button data-dev="day">DAY</button><button data-dev="night">NIGHT</button><button data-dev="speed">TIME ×20</button><button data-dev="normal">TIME ×1</button><button data-dev="sockets">SOCKETS</button><button data-dev="collisions">COLLISIONS</button></footer></aside>')

# Settings state sync / CSS variables.
replace('src/ui/UI.ts',
"['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','foliageDensity','shadowDistance','crosshairOpacity','crosshairScale','hudScale','hudOpacity','brightness']",
"['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','foliageDensity','shadowDistance','crosshairOpacity','crosshairScale','hudScale','hudOpacity','brightness','telemetryScale','telemetryOpacity']")
replace('src/ui/UI.ts',
"['invertY','headBob','cameraShake','motionBlur','shadows','showCompass','showFps','showTutorialHints','postProcessing','ambientOcclusion','bloom']",
"['invertY','headBob','cameraShake','motionBlur','shadows','showCompass','showFps','showTutorialHints','postProcessing','ambientOcclusion','bloom','telemetryPerformance','telemetryPlayer','telemetryCamera','telemetryWorld']")
replace('src/ui/UI.ts',
"this.root.style.setProperty('--hud-opacity',String(settings.hudOpacity));const fps=this.root.querySelector<HTMLElement>('.fps-counter');if(fps)fps.hidden=!settings.showFps;this.applyLanguage();",
"this.root.style.setProperty('--hud-opacity',String(settings.hudOpacity));this.root.style.setProperty('--telemetry-scale',String(settings.telemetryScale));this.root.style.setProperty('--telemetry-opacity',String(settings.telemetryOpacity));const fps=this.root.querySelector<HTMLElement>('.fps-counter');if(fps)fps.hidden=!settings.showFps;this.applyLanguage();")

# Settings back context and guaranteed Escape path.
replace('src/ui/UI.ts',
"    this.root.dataset.screen = screen;\n    this.closeSaveBrowser();",
"    this.root.dataset.screen = screen;\n    const backContext=this.root.querySelector<HTMLElement>('.settings-back-context');if(backContext)backContext.textContent=this.lastSettingsScreen==='menu'?(this.settings.language==='cs'?'DO MENU':'TO MENU'):(this.settings.language==='cs'?'DO PAUZY':'TO PAUSE');\n    this.closeSaveBrowser();")
replace('src/ui/UI.ts',
"  setSettings(settings: Settings): void {",
"  backFromSettings():void {if(this.screen==='settings')this.actions.setScreen(this.lastSettingsScreen);}\n\n  setSettings(settings: Settings): void {")

# Rich compact FPS chip.
replace('src/ui/UI.ts',
"const fpsCounter=this.root.querySelector<HTMLElement>('.fps-counter');if(fpsCounter&&this.settings.showFps)fpsCounter.textContent=`${Math.round(hud.fps)} FPS`;",
"const fpsCounter=this.root.querySelector<HTMLElement>('.fps-counter');if(fpsCounter&&this.settings.showFps)fpsCounter.innerHTML=`<b>${Math.round(hud.fps)}</b><span>FPS</span><i>${(1000/Math.max(hud.fps,1)).toFixed(1)} ms</i>`;")

# Replace raw telemetry dump with grouped rendering.
replace('src/ui/UI.ts',
"    if(this.diagnosticVisible) this.find('.diagnostics pre').textContent = `BUILD        v${GAME_VERSION} / ${GAME_BUILD}\\nFPS          ${Math.round(hud.fps)}\\nFRAME        ${(1000/Math.max(hud.fps,1)).toFixed(1)} ms\\nSEED         ${state.seed}\\nBIOME        ${hud.biome}\\nPOSITION     ${state.player.position.x.toFixed(1)}, ${state.player.position.y.toFixed(1)}, ${state.player.position.z.toFixed(1)}\\nSTRUCTURES   ${state.structures.length}\\nWORLD TIME   ${state.timeOfDay.toFixed(2)}\\n${hud.diagnostics}`;",
"    if(this.diagnosticVisible)this.renderDiagnostics(hud,state);")
marker="  private updateStats(hud: HUDData): void {"
method=r'''  private renderDiagnostics(hud:HUDData,state:GameState):void {
    const panel=this.find<HTMLElement>('.diagnostics'),raw=hud.diagnostics.split('\n').map(line=>line.trim()).filter(Boolean);
    const findLine=(token:string)=>raw.find(line=>line.includes(token));
    const metric=(label:string,value:string,wide=false)=>`<article class="telemetry-metric${wide?' wide':''}"><span>${esc(label)}</span><b>${esc(value)}</b></article>`;
    const lineRows=(lines:string[])=>lines.map(line=>{const split=line.search(/\s{2,}|\s\/\s/);const label=split>0?line.slice(0,split).trim():line,value=split>0?line.slice(split).trim():'';return `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`;}).join('');
    const draw=findLine('DRAW CALLS'),drawMatch=draw?.match(/([\d,]+)\s+DRAW CALLS\s+\/\s+([\d,]+)\s+TRIANGLES/i);
    const performance=panel.querySelector<HTMLElement>('[data-telemetry-body="performance"]');if(performance)performance.innerHTML=metric('FPS',String(Math.round(hud.fps)))+metric('FRAME',`${(1000/Math.max(hud.fps,1)).toFixed(1)} ms`)+metric('DRAW CALLS',drawMatch?.[1]??'—')+metric('TRIANGLES',drawMatch?.[2]??'—');
    const world=panel.querySelector<HTMLElement>('[data-telemetry-body="world"]'),entities=findLine('ENTITIES')?.replace(/^ENTITIES\s+/,'')??'—';if(world)world.innerHTML=metric('BUILD',`v${GAME_VERSION} / ${GAME_BUILD}`,true)+metric('SEED',String(state.seed))+metric('BIOME',hud.biome.toUpperCase())+metric('WORLD TIME',state.timeOfDay.toFixed(2))+metric('STRUCTURES',String(state.structures.length))+metric('ENTITIES',entities,true);
    const playerPrefixes=['POSITION','VELOCITY','MOVE FWD','AUTO-RUN','GROUND','SPEED','CROUCH'];const cameraPrefixes=['CAMERA BASIS','EYES','LOCAL','YAW','PITCH','QUAT','CAM FWD','ANGLE','EYE XZ OFFSET','FOV V'];
    const playerLines=raw.filter(line=>playerPrefixes.some(prefix=>line.startsWith(prefix))),cameraLines=raw.filter(line=>cameraPrefixes.some(prefix=>line.startsWith(prefix)));
    const player=panel.querySelector<HTMLElement>('[data-telemetry-body="player"]');if(player)player.innerHTML=lineRows(playerLines.length?playerLines:[`POSITION  ${state.player.position.x.toFixed(1)}, ${state.player.position.y.toFixed(1)}, ${state.player.position.z.toFixed(1)}`]);
    const camera=panel.querySelector<HTMLElement>('[data-telemetry-body="camera"]');if(camera)camera.innerHTML=lineRows(cameraLines.length?cameraLines:['CAMERA  diagnostics unavailable']);
    const visible={performance:this.settings.telemetryPerformance,player:this.settings.telemetryPlayer,camera:this.settings.telemetryCamera,world:this.settings.telemetryWorld};for(const [name,show] of Object.entries(visible)){const section=panel.querySelector<HTMLElement>(`[data-telemetry-section="${name}"]`);if(section)section.hidden=!show;}
    panel.classList.toggle('telemetry-empty',!Object.values(visible).some(Boolean));
  }

'''
text=read('src/ui/UI.ts')
if marker not in text: raise SystemExit('updateStats marker missing')
write('src/ui/UI.ts',text.replace(marker,method+marker,1))

# Click/input unions, close action and value formatting.
replace('src/ui/UI.ts',
"'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom';this.settings[name]",
"'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom'|'telemetryPerformance'|'telemetryPlayer'|'telemetryCamera'|'telemetryWorld';this.settings[name]")
replace('src/ui/UI.ts',
"'hudOpacity'|'brightness'|undefined;if(!name)return;",
"'hudOpacity'|'brightness'|'telemetryScale'|'telemetryOpacity'|undefined;if(!name)return;")
replace('src/ui/UI.ts',
"      case 'settingsBack':this.actions.setScreen(this.lastSettingsScreen);break;",
"      case 'settingsBack':this.backFromSettings();break;\n      case 'telemetryClose':this.toggleDiagnostics();break;")
replace('src/ui/UI.ts',
"'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom',label:TranslationKey",
"'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom'|'telemetryPerformance'|'telemetryPlayer'|'telemetryCamera'|'telemetryWorld',label:TranslationKey")
replace('src/ui/UI.ts',
"name==='brightness'||name==='foliageDensity')return `${Math.round(value*100)}%`;",
"name==='brightness'||name==='foliageDensity'||name==='telemetryScale'||name==='telemetryOpacity')return `${Math.round(value*100)}%`;")

# GameApp Escape fallback from Settings.
replace('src/app/GameApp.ts',
"    if(code==='F3'){this.ui.toggleDiagnostics();return;}",
"    if(code==='Escape'&&this.screen==='settings'){this.ui.backFromSettings();return;}\n    if(code==='F3'){this.ui.toggleDiagnostics();return;}")

# CSS: only UI/telemetry polish, no world rendering changes.
css=r'''

/* Tideland v0.7.2 — settings navigation and telemetry polish */
.tide-ui{--telemetry-scale:1;--telemetry-opacity:.92}
.settings-v4-header{min-height:68px;padding:0 28px;background:rgba(5,11,10,.96);border-bottom:1px solid rgba(220,231,211,.09);box-shadow:0 12px 32px rgba(0,0,0,.18)}
.settings-v4-header .small-brand{gap:12px}.settings-v4-header .small-brand svg{width:24px;height:24px}
.settings-back-button{min-width:174px;height:44px;padding:0 12px 0 16px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;background:rgba(224,232,213,.045);border:1px solid rgba(224,232,213,.14);color:#e6eadf;font:600 12px var(--title-font);letter-spacing:.1em;text-align:left}
.settings-back-button:hover{background:rgba(224,232,213,.09);border-color:rgba(224,232,213,.25)}.settings-back-button small{font:500 8px var(--title-font);letter-spacing:.1em;color:#aab4a4;text-align:right}.settings-back-button kbd{height:22px;min-width:34px;color:#dfe6d7;border-color:#dfe6d743;background:#0b1411}
.settings-v3 .setting-buttons button,.settings-v3 .save-reset-row button,.settings-v3 .settings-actions button{min-height:40px;padding:0 14px;border:1px solid rgba(220,231,211,.16);background:#111a17;color:#dfe5d8;font:600 10px var(--title-font);letter-spacing:.08em;box-shadow:none}
.settings-v3 .setting-buttons button:hover,.settings-v3 .save-reset-row button:hover,.settings-v3 .settings-actions button:hover{background:#1a2520;border-color:rgba(220,231,211,.28);color:#fff}.settings-v3 .save-reset-row .danger-button,.settings-v3 .setting-buttons .danger-button{background:rgba(126,45,35,.18);border-color:rgba(205,101,82,.38);color:#e7a294}.settings-v3 .save-reset-row .danger-button:hover{background:rgba(145,51,39,.32)}
.telemetry-settings-heading{margin-top:31px!important;padding-top:20px;border-top:1px solid rgba(220,231,211,.1)}
.fps-counter{left:18px;top:17px;min-width:108px;height:34px;padding:0 9px;display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:5px;background:rgba(6,14,11,.82);border:1px solid rgba(202,209,117,.24);box-shadow:0 8px 24px rgba(0,0,0,.18);backdrop-filter:blur(10px);font-family:var(--title-font);letter-spacing:.06em}
.fps-counter b{font-size:17px;color:#dce795}.fps-counter span{font-size:8px;color:#dce795;opacity:.75}.fps-counter i{font-style:normal;font-size:8px;text-align:right;color:#d9e0d2;opacity:.58}
.diagnostics.telemetry-panel{position:absolute;left:14px;top:14px;width:min(430px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;padding:0;background:rgba(5,14,11,var(--telemetry-opacity));border:1px solid rgba(196,216,165,.22);box-shadow:0 24px 70px rgba(0,0,0,.38);backdrop-filter:blur(14px);scale:var(--telemetry-scale);transform-origin:top left;pointer-events:auto;color:#dfe7d8;font-family:var(--ui-font)}
.telemetry-header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:14px 15px;background:rgba(6,16,12,.96);border-bottom:1px solid rgba(196,216,165,.14)}.telemetry-header>div{display:grid;gap:3px}.telemetry-header span{font:600 8px var(--title-font);letter-spacing:.16em;color:#93a88a}.telemetry-header strong{font:700 15px var(--title-font);letter-spacing:.08em}.telemetry-header strong i{font-style:normal;margin-left:7px;padding:3px 5px;border:1px solid #c9d87547;color:#dfe79a;font-size:8px}.telemetry-header button{width:30px;height:30px;background:#111d17;border:1px solid rgba(220,231,211,.12);color:#dce5d7;font-size:18px}
.telemetry-sections{display:grid;gap:7px;padding:9px}.telemetry-sections>section{border:1px solid rgba(220,231,211,.08);background:rgba(220,231,211,.025)}.telemetry-sections>section>header{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(220,231,211,.07);font:600 9px var(--title-font);letter-spacing:.12em;color:#b8c6b0}.telemetry-sections>section>header span{color:#87947f;font-size:8px}
.telemetry-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:rgba(220,231,211,.05)}.telemetry-metric{min-height:48px;padding:9px 10px;display:flex;flex-direction:column;justify-content:center;background:rgba(5,14,11,.82)}.telemetry-metric.wide{grid-column:1/-1}.telemetry-metric span{font:500 7px var(--title-font);letter-spacing:.12em;color:#899b83}.telemetry-metric b{margin-top:3px;font:600 14px var(--title-font);letter-spacing:.035em;color:#dbe6cf;overflow-wrap:anywhere}.telemetry-metric:first-child b{color:#d6e489;font-size:19px}
.telemetry-lines{padding:6px 10px}.telemetry-lines>div{display:grid;grid-template-columns:minmax(88px,.8fr) minmax(0,1.6fr);gap:9px;padding:4px 0;border-bottom:1px solid rgba(220,231,211,.045)}.telemetry-lines>div:last-child{border-bottom:0}.telemetry-lines span{font:500 7px var(--title-font);letter-spacing:.09em;color:#87967f}.telemetry-lines b{font:500 8px/1.35 var(--ui-font);color:#cbd7c3;overflow-wrap:anywhere}
.telemetry-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:9px;border-top:1px solid rgba(220,231,211,.1);background:rgba(5,13,10,.88)}.telemetry-actions button{min-height:28px;padding:0 7px;background:#101b15;border:1px solid rgba(196,216,165,.13);color:#aebe9e;font:600 7px var(--title-font);letter-spacing:.07em}.telemetry-actions button:hover{background:#17251c;color:#e1e9d8;border-color:rgba(202,216,142,.3)}.telemetry-empty .telemetry-sections:after{content:'ALL TELEMETRY MODULES ARE HIDDEN — CHANGE THEM IN SETTINGS';display:block;padding:18px;text-align:center;font:600 8px var(--title-font);letter-spacing:.1em;color:#98a58f}
@media(max-width:760px){.settings-v4-header{padding:0 14px}.settings-back-button{min-width:126px}.settings-back-context{display:none}.diagnostics.telemetry-panel{width:min(360px,calc(100vw - 20px));left:10px;top:10px}.telemetry-actions{grid-template-columns:repeat(2,1fr)}}
'''
with open('src/ui/style.css','a') as f:f.write(css)

# Focused regression tests for migrated settings fields.
test=r'''import {beforeEach,describe,expect,it,vi} from 'vitest';
import {loadSettings,saveSettings} from '../src/save/storage';
import {DEFAULT_SETTINGS} from '../src/config/balance';

class MemoryStorage {private data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}clear(){this.data.clear();}}

describe('v0.7.2 telemetry settings',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));
  it('persists telemetry layout and falls back safely for older settings',()=>{
    saveSettings({...DEFAULT_SETTINGS,telemetryScale:1.25,telemetryOpacity:.73,telemetryPerformance:false,telemetryPlayer:true,telemetryCamera:true,telemetryWorld:false,keybinds:{...DEFAULT_SETTINGS.keybinds}});
    expect(loadSettings()).toMatchObject({telemetryScale:1.25,telemetryOpacity:.73,telemetryPerformance:false,telemetryPlayer:true,telemetryCamera:true,telemetryWorld:false});
    localStorage.setItem('tideland:settings:v1',JSON.stringify({language:'en'}));
    expect(loadSettings()).toMatchObject({telemetryScale:DEFAULT_SETTINGS.telemetryScale,telemetryOpacity:DEFAULT_SETTINGS.telemetryOpacity,telemetryPerformance:true,telemetryWorld:true});
  });
});
'''
write('tests/settings-v072.test.ts',test)

# Changelog markdown.
ch=read('CHANGELOG.md')
entry='''## v0.7.2 — Settings navigation & telemetry polish (2026-09-12)\n\n- Fixed Settings escape/back navigation and restyled utility buttons so browser-default white controls cannot leak into the UI.\n- Rebuilt F3 telemetry into modular Performance, Player, Camera and World panels.\n- Added telemetry size, opacity and per-module visibility settings.\n- Upgraded the compact FPS chip with frame time.\n- Intentionally leaves world graphics unchanged for the next dedicated graphics pass.\n\n'''
if '## v0.7.2' not in ch: write('CHANGELOG.md',entry+ch)

print('v0.7.2 settings/telemetry patch applied')
