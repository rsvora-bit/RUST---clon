from pathlib import Path
import re

ROOT=Path('.')

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old,new,1)
def sub_once(text,pattern,repl,label,flags=0):
    new,count=re.subn(pattern,repl,text,count=1,flags=flags)
    if count!=1: raise RuntimeError(f'{label}: expected 1 regex match, found {count}')
    return new

# ---------- core types ----------
p='src/core/types.ts'; s=read(p)
s=replace_once(s,
"export interface Settings {language:Language; sensitivityX:number; sensitivityY:number; fov:number; viewmodelFov:number; invertY:boolean; headBob:boolean; cameraShake:boolean; motionBlur:boolean; masterVolume:number; musicVolume:number; effectsVolume:number; ambientVolume:number; quality:GraphicsQuality; renderScale:number; shadows:boolean; crosshairOpacity:number; showCompass:boolean; keybinds:Keybinds}",
"export interface SaveSlotSummary {slot:number; exists:boolean; seed?:number; savedAt?:number; elapsed?:number; timeOfDay?:number; structures?:number; worldGeneration?:1|2}\nexport interface Settings {language:Language; sensitivityX:number; sensitivityY:number; fov:number; viewmodelFov:number; invertY:boolean; headBob:boolean; cameraShake:boolean; motionBlur:boolean; masterVolume:number; musicVolume:number; effectsVolume:number; ambientVolume:number; quality:GraphicsQuality; renderScale:number; shadows:boolean; crosshairOpacity:number; crosshairScale:number; hudScale:number; hudOpacity:number; brightness:number; showCompass:boolean; showFps:boolean; showTutorialHints:boolean; keybinds:Keybinds}",
'core settings')
s=replace_once(s,"newGame:(seed?:number)=>void;continueGame:()=>void;","newGame:(seed?:number,slot?:number)=>void;continueGame:(slot?:number)=>void;",'ui actions slot signatures')
s=replace_once(s,"mainMenu:()=>void;resetSave:()=>void;settings:","mainMenu:()=>void;resetSave:()=>void;deleteSave:(slot:number)=>void;settings:",'ui actions delete save')
write(p,s)

# ---------- defaults / save config ----------
p='src/config/balance.ts'; s=read(p)
s=replace_once(s,
"quality:'high' as const,renderScale:1,shadows:true,crosshairOpacity:1,showCompass:true,keybinds:{...DEFAULT_KEYBINDS}",
"quality:'high' as const,renderScale:1,shadows:true,crosshairOpacity:1,crosshairScale:1,hudScale:1.12,hudOpacity:1,brightness:1.08,showCompass:true,showFps:false,showTutorialHints:true,keybinds:{...DEFAULT_KEYBINDS}",
'default settings')
write(p,s)

p='src/config/gameplay.ts'; s=read(p)
s=replace_once(s,
"export const SAVE = { GAME_KEY: 'tideland:save:v1', SETTINGS_KEY: 'tideland:settings:v1', MAX_DROPS: 500, MAX_NODE_CHANGES: 50000 } as const;",
"export const SAVE = { GAME_KEY: 'tideland:save:v1', SETTINGS_KEY: 'tideland:settings:v1', SLOT_COUNT: 5, MAX_DROPS: 500, MAX_NODE_CHANGES: 50000 } as const;",
'save config')
write(p,s)

# ---------- save slots / migration ----------
p='src/save/storage.ts'; s=read(p)
s=s.replace("import type { GameState, ItemStack, PlayerStats, Settings, Structure, Vec3 } from '../core/types';","import type { GameState, ItemStack, PlayerStats, SaveSlotSummary, Settings, Structure, Vec3 } from '../core/types';")
new_save_block=r'''interface SaveEnvelope {savedAt:number; state:GameState}
const slotKey=(slot:number):string=>`${SAVE.GAME_KEY}:slot:${Math.max(1,Math.min(SAVE.SLOT_COUNT,Math.trunc(slot)))}`;
function decodeSave(raw:string|null):SaveEnvelope|null {
  if(!raw||raw.length>12_000_000)return null;
  try {
    const parsed:unknown=JSON.parse(raw);
    if(validateGameState(parsed))return {savedAt:0,state:parsed};
    if(record(parsed)&&finite(parsed.savedAt,0,Number.MAX_SAFE_INTEGER)&&validateGameState(parsed.state))return {savedAt:parsed.savedAt,state:parsed.state};
  } catch { /* Invalid or partial browser storage entry. */ }
  return null;
}
function migrateLegacySave():void {
  try {
    const legacy=localStorage.getItem(SAVE.GAME_KEY);if(!legacy)return;
    if(Array.from({length:SAVE.SLOT_COUNT},(_,i)=>localStorage.getItem(slotKey(i+1))).some(Boolean))return;
    const decoded=decodeSave(legacy);if(!decoded)return;
    localStorage.setItem(slotKey(1),JSON.stringify({savedAt:decoded.savedAt||Date.now(),state:decoded.state} satisfies SaveEnvelope));
    localStorage.removeItem(SAVE.GAME_KEY);
  } catch { /* Storage can be unavailable in private sessions. */ }
}
export function saveGame(state: GameState, slot=1): boolean {
  try {
    if (!validateGameState(state)) return false;
    migrateLegacySave();
    localStorage.setItem(slotKey(slot), JSON.stringify({savedAt:Date.now(),state} satisfies SaveEnvelope));
    return true;
  } catch { return false; }
}

export function loadGame(slot=1): GameState | null {
  try {migrateLegacySave();return decodeSave(localStorage.getItem(slotKey(slot)))?.state??null;} catch { return null; }
}

export function listSaveSlots():SaveSlotSummary[] {
  try {
    migrateLegacySave();
    return Array.from({length:SAVE.SLOT_COUNT},(_,index)=>{
      const slot=index+1,decoded=decodeSave(localStorage.getItem(slotKey(slot)));
      if(!decoded)return {slot,exists:false};
      const state=decoded.state;
      return {slot,exists:true,seed:state.seed,savedAt:decoded.savedAt,elapsed:state.elapsed,timeOfDay:state.timeOfDay,structures:state.structures.length,worldGeneration:state.worldGeneration};
    });
  } catch { return Array.from({length:SAVE.SLOT_COUNT},(_,index)=>({slot:index+1,exists:false})); }
}
export function latestSaveSlot():number|null {
  const saves=listSaveSlots().filter(save=>save.exists);
  if(!saves.length)return null;
  saves.sort((a,b)=>(b.savedAt??0)-(a.savedAt??0)||a.slot-b.slot);
  return saves[0]!.slot;
}
export function hasSave(slot?:number): boolean {return slot===undefined?listSaveSlots().some(save=>save.exists):loadGame(slot)!==null;}
export function deleteSave(slot:number):void {try{migrateLegacySave();localStorage.removeItem(slotKey(slot));if(slot===1)localStorage.removeItem(SAVE.GAME_KEY);}catch{/* Storage can be unavailable. */}}
export function resetSave(): void {try{localStorage.removeItem(SAVE.GAME_KEY);for(let slot=1;slot<=SAVE.SLOT_COUNT;slot++)localStorage.removeItem(slotKey(slot));}catch{/* Storage can be unavailable. */}}
'''
s=sub_once(s,r"export function saveGame\(state: GameState\): boolean \{.*?export function resetSave\(\): void \{.*?\}\n\n(?=const defaultSettings)",new_save_block+'\n','save function block',re.S)
# normalize additional settings
needle="    crosshairOpacity: finite(value.crosshairOpacity, 0, 1) ? value.crosshairOpacity : DEFAULT_SETTINGS.crosshairOpacity,\n    showCompass: typeof value.showCompass === 'boolean' ? value.showCompass : DEFAULT_SETTINGS.showCompass,"
replacement="    crosshairOpacity: finite(value.crosshairOpacity, 0, 1) ? value.crosshairOpacity : DEFAULT_SETTINGS.crosshairOpacity,\n    crosshairScale: finite(value.crosshairScale, 0.6, 2) ? value.crosshairScale : DEFAULT_SETTINGS.crosshairScale,\n    hudScale: finite(value.hudScale, 0.8, 1.45) ? value.hudScale : DEFAULT_SETTINGS.hudScale,\n    hudOpacity: finite(value.hudOpacity, 0.55, 1) ? value.hudOpacity : DEFAULT_SETTINGS.hudOpacity,\n    brightness: finite(value.brightness, 0.75, 1.35) ? value.brightness : DEFAULT_SETTINGS.brightness,\n    showCompass: typeof value.showCompass === 'boolean' ? value.showCompass : DEFAULT_SETTINGS.showCompass,\n    showFps: typeof value.showFps === 'boolean' ? value.showFps : DEFAULT_SETTINGS.showFps,\n    showTutorialHints: typeof value.showTutorialHints === 'boolean' ? value.showTutorialHints : DEFAULT_SETTINGS.showTutorialHints,"
s=replace_once(s,needle,replacement,'normalize UI settings')
write(p,s)

# ---------- GameApp slot-aware autosave ----------
p='src/app/GameApp.ts'; s=read(p)
s=s.replace("import {saveGame,loadGame,hasSave,resetSave,loadSettings,saveSettings} from '../save/storage';","import {saveGame,loadGame,listSaveSlots,latestSaveSlot,deleteSave,resetSave,loadSettings,saveSettings} from '../save/storage';")
s=replace_once(s,"private settings:Settings=loadSettings();private screen:Screen='menu';private activeWorld=false;","private settings:Settings=loadSettings();private screen:Screen='menu';private activeWorld=false;private activeSaveSlot:number|null=null;",'active save slot')
old_actions="newGame:seed=>{void this.start(seed??WORLD.SEED);},continueGame:()=>{const saved=loadGame();if(saved)void this.start(saved.seed,saved);else this.ui.notify('No valid save was found. Start a new island.');},resume:()=>this.setScreen('playing'),save:()=>this.save(),mainMenu:()=>{if(this.activeWorld)this.save();this.setScreen('menu');},resetSave:()=>{resetSave();this.ui.setSaveAvailable(false);this.ui.notify('Saved world removed');},settings:s=>this.applySettings(s),setScreen:s=>this.setScreen(s),"
new_actions="newGame:(seed,slot)=>{const target=slot??this.firstFreeSaveSlot();deleteSave(target);this.refreshSaveSlots();void this.start(seed??WORLD.SEED,undefined,target);},continueGame:slot=>{const target=slot??latestSaveSlot();const saved=target!==null?loadGame(target):null;if(saved&&target!==null)void this.start(saved.seed,saved,target);else this.ui.notify('No valid save was found. Start a new island.');},resume:()=>this.setScreen('playing'),save:()=>this.save(),mainMenu:()=>{if(this.activeWorld&&this.activeSaveSlot!==null)this.save(false,false);this.setScreen('menu');},resetSave:()=>{resetSave();this.activeSaveSlot=null;this.refreshSaveSlots();this.ui.notify('All saved worlds removed');},deleteSave:slot=>this.deleteSaveSlot(slot),settings:s=>this.applySettings(s),setScreen:s=>this.setScreen(s),"
s=replace_once(s,old_actions,new_actions,'game app UI actions')
s=replace_once(s,"window.addEventListener('beforeunload',()=>{if(this.activeWorld&&this.simulation.state.player.stats.health>0)saveGame(this.simulation.state);});","window.addEventListener('beforeunload',()=>{if(this.activeWorld&&this.activeSaveSlot!==null&&this.simulation.state.player.stats.health>0)saveGame(this.simulation.state,this.activeSaveSlot);});",'beforeunload slot')
s=replace_once(s,"this.ui.setSettings(this.settings);this.ui.setSaveAvailable(hasSave());this.ui.setLoading(true);","this.ui.setSettings(this.settings);this.refreshSaveSlots();this.ui.setLoading(true);",'initial slots')
s=replace_once(s,"private async start(seed:number,saved?:GameState){","private async start(seed:number,saved?:GameState,slot=1){",'start slot signature')
s=replace_once(s,"this.activeWorld=true;this.screen='playing';this.ui.setScreen('playing');this.ui.notify(saved?'Welcome back to your island.':'Washed ashore. Everything begins here.');","this.activeWorld=true;this.activeSaveSlot=slot;this.refreshSaveSlots();this.screen='playing';this.ui.setScreen('playing');this.ui.notify(saved?`Welcome back · save slot ${slot}.`:`Washed ashore · save slot ${slot}.`);",'activate slot')
s=replace_once(s,"private setScreen(screen:Screen){if(screen==='playing'&&!this.activeWorld)return;this.screen=screen;this.ui.setScreen(screen);this.input.keys.clear();this.leftDown=false;if(screen==='playing'){void this.audio.start();void this.input.lock();}else{this.input.release();this.structures?.preview(null);}this.ui.setSaveAvailable(hasSave());}","private setScreen(screen:Screen){if(screen==='playing'&&!this.activeWorld)return;this.screen=screen;this.ui.setScreen(screen);this.input.keys.clear();this.leftDown=false;if(screen==='playing'){void this.audio.start();void this.input.lock();}else{this.input.release();this.structures?.preview(null);}this.refreshSaveSlots();}",'setScreen refresh saves')
s=replace_once(s,"this.autoSave+=dt;if(this.autoSave>60){this.save(false);this.autoSave=0;}","this.autoSave+=dt;if(this.autoSave>60){if(this.activeSaveSlot!==null)this.save(false,false);this.autoSave=0;}",'autosave slot guard')
old_save="private save(notify=true){if(!this.activeWorld)return;const success=saveGame(this.simulation.state);if(notify)this.ui.notify(success?'World saved. Your progress is safe.':'Storage is full or unavailable. Save could not be written.');this.ui.setSaveAvailable(hasSave());}"
new_save="private refreshSaveSlots(){this.ui?.setSaveSlots(listSaveSlots());}\n  private firstFreeSaveSlot(){return listSaveSlots().find(save=>!save.exists)?.slot??1;}\n  private deleteSaveSlot(slot:number){deleteSave(slot);if(this.activeSaveSlot===slot)this.activeSaveSlot=null;this.refreshSaveSlots();this.ui.notify(`Save slot ${slot} deleted${this.activeWorld&&this.activeSaveSlot===null?' · autosave disabled for this session':''}.`);}\n  private save(notify=true,allowCreate=true){if(!this.activeWorld)return;if(this.activeSaveSlot===null){if(!allowCreate)return;this.activeSaveSlot=this.firstFreeSaveSlot();}const success=saveGame(this.simulation.state,this.activeSaveSlot);if(notify)this.ui.notify(success?`World saved to slot ${this.activeSaveSlot}.`:'Storage is full or unavailable. Save could not be written.');this.refreshSaveSlots();}"
s=replace_once(s,old_save,new_save,'slot save method')
s=replace_once(s,"private applySettings(s:Settings){this.settings={...s,keybinds:{...s.keybinds}};this.projection.setBaseFov(s.fov);saveSettings(s);","private applySettings(s:Settings){this.settings={...s,keybinds:{...s.keybinds}};this.projection.setBaseFov(s.fov);this.renderer.toneMappingExposure=s.brightness;saveSettings(s);",'brightness exposure')
write(p,s)

# ---------- UI markup / save manager / HUD options ----------
p='src/ui/UI.ts'; s=read(p)
s=s.replace("import type { GameState, HUDData, ItemId, ItemStack, KeybindAction, PieceType, ResourceNode, Screen, Settings, UIActions } from '../core/types';","import type { GameState, HUDData, ItemId, ItemStack, KeybindAction, PieceType, ResourceNode, SaveSlotSummary, Screen, Settings, UIActions } from '../core/types';")
s=replace_once(s,"  private saveAvailable=false;\n  private settingsTab", "  private saveAvailable=false;\n  private saveSlots:SaveSlotSummary[]=[];\n  private saveBrowserMode:'load'|'new'|'manage'='load';\n  private pendingSaveSlot:number|null=null;\n  private pendingDeleteSlot:number|null=null;\n  private settingsTab",'UI slot fields')
classic_menu='''      <section class="screen menu-screen menu-classic-v7" data-view="menu" aria-label="Main menu">
        <header class="menu-masthead"><span class="brand-mark">${mark}</span><div><div class="eyebrow">TIDELAND PROJECT</div><b>PROCEDURAL SURVIVAL</b></div><div class="edition"><i></i><span>EARLY ACCESS</span><b>${GAME_BUILD}</b></div></header>
        <main class="menu-content"><div class="eyebrow"><span></span><b data-i18n="survivalExperience">OPEN WORLD SURVIVAL</b></div><h1>TIDELAND<span class="title-period">.</span></h1><p class="menu-description" data-i18n="menuTagline">Build, survive and make the island yours.</p>
          <nav class="main-nav">
            <button class="menu-link continue-game" data-action="continue" disabled><span class="nav-index">01</span><strong data-i18n="continue">CONTINUE</strong><small class="menu-meta continue-meta" data-i18n="noSave">NO SAVED WORLD</small>${chevron}</button>
            <button class="menu-link new-game" data-action="new"><span class="nav-index">02</span><strong data-i18n="newGame">NEW GAME</strong><small class="menu-meta">CHOOSE SLOT</small>${chevron}</button>
            <button class="menu-link load-game" data-action="load" disabled><span class="nav-index">03</span><strong data-i18n="load">LOAD</strong><small class="menu-meta save-count">0 / 5 SAVES</small>${chevron}</button>
            <button class="menu-link" data-action="settings"><span class="nav-index">04</span><strong data-i18n="settings">SETTINGS</strong><small class="menu-meta">GAME / UI / AUDIO</small>${chevron}</button>
            <button class="menu-link" data-action="history"><span class="nav-index">05</span><strong data-i18n="history">HISTORY</strong><small class="menu-meta">v${GAME_VERSION}</small>${chevron}</button>
          </nav>
          <div class="seed-control"><label for="world-seed" data-i18n="worldSeed">WORLD SEED</label><input id="world-seed" type="text" inputmode="numeric" maxlength="10" placeholder="731942" aria-label="World seed"><span data-i18n="proceduralIsland">PROCEDURAL ISLAND</span></div>
        </main>
        <div class="menu-location"><span class="location-line"></span><div>WESTERN SHORE<small>LOCAL SOLO SESSION</small></div><span class="coordinate">5 SAVE SLOTS<br>AUTOSAVE · 60 SEC</span></div>
        <footer class="menu-footer"><span>v${GAME_VERSION}<i>•</i>${GAME_BUILD}<i>•</i>LOCAL BROWSER SAVE</span><div class="local-save-status"><i></i><span class="save-footer-status">NO LOCAL WORLDS</span></div><button class="text-button" data-action="help"><span data-i18n="controls">CONTROLS</span></button></footer>
      </section>'''
s=sub_once(s,r'      <section class="screen menu-screen menu-v3".*?</section>\n\n(?=      <section class="screen game-screen")',classic_menu+'\n\n','classic main menu',re.S)
s=replace_once(s,'<div class="compass-wrap"><div class="compass-value">N</div><div class="compass-line"></div><div class="compass-needle"></div><div class="biome-label">WESTERN SHORE</div></div>','<div class="compass-wrap"><div class="compass-value">N</div><div class="compass-line"></div><div class="compass-needle"></div><div class="biome-label">WESTERN SHORE</div></div><div class="fps-counter" hidden>60 FPS</div>','fps counter markup')
# Expand gameplay settings and save controls.
old_gameplay="""              <div class=\"setting-row toggle-row\"><label><span data-i18n=\"language\">LANGUAGE</span><small data-i18n=\"languageDetail\">Switch the interface between English and Czech.</small></label><div class=\"language-options\"><button data-language=\"en\">EN</button><button data-language=\"cs\">CZ</button></div></div>
              ${this.slider('crosshairOpacity','crosshair','crosshairDetail',0,1,0.05)}${this.toggle('showCompass','compass','compassDetail')}
              <div class=\"setting-row setting-buttons\"><label><span data-i18n=\"localSettings\">LOCAL SETTINGS</span><small data-i18n=\"localSettingsDetail\">Reset device-specific controls and presentation.</small></label><div><button data-action=\"resetSettings\" data-i18n=\"resetSettings\">RESET SETTINGS</button><button data-action=\"reloadBuild\" data-i18n=\"reloadBuild\">RELOAD LATEST BUILD</button></div></div>
              <div class=\"save-reset-row\"><span><b data-i18n=\"localSaveData\">LOCAL SAVE DATA</b><small data-i18n=\"localSaveDataDetail\">Remove your saved island and progress.</small></span><button class=\"danger-button\" data-action=\"reset\" data-i18n=\"resetSave\">RESET SAVE</button></div><div class=\"reset-confirm\" hidden><span data-i18n=\"localSaveDataDetail\">Remove your saved island and progress.</span><button data-action=\"resetConfirm\" data-i18n=\"deleteSave\">DELETE SAVE</button><button data-action=\"resetCancel\" data-i18n=\"cancel\">CANCEL</button></div>"""
new_gameplay="""              <div class=\"setting-row toggle-row\"><label><span data-i18n=\"language\">LANGUAGE</span><small data-i18n=\"languageDetail\">Switch the interface between English and Czech.</small></label><div class=\"language-options\"><button data-language=\"en\">EN</button><button data-language=\"cs\">CZ</button></div></div>
              ${this.slider('hudScale','hudScale','hudScaleDetail',0.8,1.45,0.05)}${this.slider('hudOpacity','hudOpacity','hudOpacityDetail',0.55,1,0.05)}${this.slider('crosshairOpacity','crosshair','crosshairDetail',0,1,0.05)}${this.slider('crosshairScale','crosshairScale','crosshairScaleDetail',0.6,2,0.05)}${this.toggle('showCompass','compass','compassDetail')}${this.toggle('showFps','showFps','showFpsDetail')}${this.toggle('showTutorialHints','tutorialHints','tutorialHintsDetail')}
              <div class=\"setting-row setting-buttons\"><label><span data-i18n=\"localSettings\">LOCAL SETTINGS</span><small data-i18n=\"localSettingsDetail\">Reset device-specific controls and presentation.</small></label><div><button data-action=\"resetSettings\" data-i18n=\"resetSettings\">RESET SETTINGS</button><button data-action=\"reloadBuild\" data-i18n=\"reloadBuild\">RELOAD LATEST BUILD</button></div></div>
              <div class=\"save-reset-row\"><span><b data-i18n=\"localSaveData\">LOCAL SAVE DATA</b><small data-i18n=\"localSaveDataDetail\">Manage individual local worlds or remove all save data.</small></span><div><button data-action=\"manageSaves\" data-i18n=\"manageSaves\">MANAGE SAVES</button><button class=\"danger-button\" data-action=\"reset\" data-i18n=\"deleteAllSaves\">DELETE ALL SAVES</button></div></div><div class=\"reset-confirm\" hidden><span data-i18n=\"localSaveDataDetail\">Remove your saved island and progress.</span><button class=\"danger-button\" data-action=\"resetConfirm\" data-i18n=\"deleteAllSaves\">DELETE ALL SAVES</button><button data-action=\"resetCancel\" data-i18n=\"cancel\">CANCEL</button></div>"""
s=replace_once(s,old_gameplay,new_gameplay,'expanded gameplay settings')
s=replace_once(s,"${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}", "${this.slider('brightness','brightness','brightnessDetail',0.75,1.35,0.05)}${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}",'brightness setting')
# Replace old overwrite confirm with slot-aware save browser + confirms.
overlays='''      <div class="save-browser" hidden><div class="save-browser-shell"><header><div><span class="eyebrow">LOCAL WORLDS</span><h2 class="save-browser-title">LOAD WORLD</h2><p class="save-browser-subtitle">Choose a local save slot.</p></div><button class="close-button" data-action="saveBrowserClose">×</button></header><div class="save-slot-grid"></div><footer><span>Autosave runs every 60 seconds while a world is attached to a slot.</span><span>5 LOCAL SLOTS</span></footer></div></div>
      <div class="confirm-overlay new-game-confirm" hidden><div class="confirm-card"><span class="eyebrow">SAVE SLOT</span><h2 data-i18n="newGameWarning">OVERWRITE THIS WORLD?</h2><p class="overwrite-slot-copy">The selected save slot will be permanently replaced.</p><div><button class="danger-button" data-action="confirmNew" data-i18n="newGameConfirm">START NEW WORLD</button><button data-action="cancelNew" data-i18n="cancel">CANCEL</button></div></div></div>
      <div class="confirm-overlay delete-slot-confirm" hidden><div class="confirm-card"><span class="eyebrow">LOCAL SAVE</span><h2>DELETE SAVE SLOT?</h2><p class="delete-slot-copy">This world will be removed from this browser.</p><div><button class="danger-button" data-action="deleteSlotConfirm" data-i18n="deleteSave">DELETE SAVE</button><button data-action="deleteSlotCancel" data-i18n="cancel">CANCEL</button></div></div></div>
'''
s=sub_once(s,r'      <div class="confirm-overlay new-game-confirm".*?</div></div>\n\n(?=      <section class="screen dead-screen)',overlays+'\n','save browser overlays',re.S)
# Settings input/toggle types.
s=replace_once(s,"const name=target.dataset.toggle as 'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass';","const name=target.dataset.toggle as 'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints';",'toggle click types')
s=replace_once(s,"const name=input.dataset.setting as 'sensitivityX'|'sensitivityY'|'fov'|'viewmodelFov'|'masterVolume'|'musicVolume'|'effectsVolume'|'ambientVolume'|'renderScale'|'crosshairOpacity'|undefined;","const name=input.dataset.setting as 'sensitivityX'|'sensitivityY'|'fov'|'viewmodelFov'|'masterVolume'|'musicVolume'|'effectsVolume'|'ambientVolume'|'renderScale'|'crosshairOpacity'|'crosshairScale'|'hudScale'|'hudOpacity'|'brightness'|undefined;",'slider input types')
# Route save-slot data attributes before regular actions.
s=replace_once(s,"const target=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(!target||(target instanceof HTMLButtonElement&&target.disabled))return;event.preventDefault();\n      if(target.dataset.action)this.handleAction(target.dataset.action);","const target=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(!target||(target instanceof HTMLButtonElement&&target.disabled))return;event.preventDefault();\n      if(target.dataset.saveAction){this.handleSaveSlotAction(target.dataset.saveAction,Number(target.dataset.saveSlot));return;}\n      if(target.dataset.action)this.handleAction(target.dataset.action);",'slot click routing')
# New actions.
s=s.replace("case 'play':{const panel=this.find<HTMLElement>('.play-panel');panel.hidden=!panel.hidden;break;}\n      case 'new':if(this.saveAvailable)this.find<HTMLElement>('.new-game-confirm').hidden=false;else this.startNewGame();break;\n      case 'confirmNew':this.find<HTMLElement>('.new-game-confirm').hidden=true;this.startNewGame();break;\n      case 'cancelNew':this.find<HTMLElement>('.new-game-confirm').hidden=true;break;\n      case 'continue':case 'load':this.actions.continueGame();break;",
"case 'play':case 'continue':{const latest=[...this.saveSlots].filter(slot=>slot.exists).sort((a,b)=>(b.savedAt??0)-(a.savedAt??0))[0];if(latest)this.actions.continueGame(latest.slot);break;}\n      case 'new':this.openSaveBrowser('new');break;\n      case 'load':this.openSaveBrowser('load');break;\n      case 'manageSaves':this.openSaveBrowser('manage');break;\n      case 'saveBrowserClose':this.closeSaveBrowser();break;\n      case 'confirmNew':{const slot=this.pendingSaveSlot;this.find<HTMLElement>('.new-game-confirm').hidden=true;this.pendingSaveSlot=null;if(slot!==null)this.startNewGame(slot);break;}\n      case 'cancelNew':this.find<HTMLElement>('.new-game-confirm').hidden=true;this.pendingSaveSlot=null;break;\n      case 'deleteSlotConfirm':{const slot=this.pendingDeleteSlot;this.find<HTMLElement>('.delete-slot-confirm').hidden=true;this.pendingDeleteSlot=null;if(slot!==null)this.actions.deleteSave(slot);break;}\n      case 'deleteSlotCancel':this.find<HTMLElement>('.delete-slot-confirm').hidden=true;this.pendingDeleteSlot=null;break;",1)
s=s.replace("private startNewGame():void{const seedText=this.find<HTMLInputElement>('#world-seed').value.trim(),seed=seedText?Number(seedText):undefined;this.actions.newGame(seed!==undefined&&Number.isFinite(seed)?Math.floor(seed):undefined);}",
'''private startNewGame(slot=1):void{const seedText=this.find<HTMLInputElement>('#world-seed').value.trim(),seed=seedText?Number(seedText):undefined;this.closeSaveBrowser();this.actions.newGame(seed!==undefined&&Number.isFinite(seed)?Math.floor(seed):undefined,slot);}
  private openSaveBrowser(mode:'load'|'new'|'manage'):void{this.saveBrowserMode=mode;this.renderSaveBrowser();this.find<HTMLElement>('.save-browser').hidden=false;}
  private closeSaveBrowser():void{const browser=this.root.querySelector<HTMLElement>('.save-browser');if(browser)browser.hidden=true;}
  private handleSaveSlotAction(action:string,slot:number):void{
    if(!Number.isInteger(slot)||slot<1||slot>5)return;const save=this.saveSlots.find(item=>item.slot===slot);
    if(action==='load'&&save?.exists){this.closeSaveBrowser();this.actions.continueGame(slot);return;}
    if(action==='new'){if(save?.exists){this.pendingSaveSlot=slot;this.find<HTMLElement>('.overwrite-slot-copy').textContent=this.settings.language==='cs'?`Slot ${slot} (seed ${save.seed}) bude trvale nahrazen novým světem.`:`Slot ${slot} (seed ${save.seed}) will be permanently replaced by the new world.`;this.find<HTMLElement>('.new-game-confirm').hidden=false;}else this.startNewGame(slot);return;}
    if(action==='delete'&&save?.exists){this.pendingDeleteSlot=slot;this.find<HTMLElement>('.delete-slot-copy').textContent=this.settings.language==='cs'?`Slot ${slot} · seed ${save.seed} bude odstraněn z tohoto prohlížeče.`:`Slot ${slot} · seed ${save.seed} will be removed from this browser.`;this.find<HTMLElement>('.delete-slot-confirm').hidden=false;}
  }
  private renderSaveBrowser():void{
    const grid=this.root.querySelector<HTMLElement>('.save-slot-grid');if(!grid)return;const cs=this.settings.language==='cs';
    const title=this.root.querySelector<HTMLElement>('.save-browser-title'),subtitle=this.root.querySelector<HTMLElement>('.save-browser-subtitle');
    if(title)title.textContent=this.saveBrowserMode==='new'?(cs?'NOVÝ SVĚT':'NEW WORLD'):this.saveBrowserMode==='manage'?(cs?'SPRÁVA ULOŽENÍ':'MANAGE SAVES'):(cs?'NAČÍST SVĚT':'LOAD WORLD');
    if(subtitle)subtitle.textContent=this.saveBrowserMode==='new'?(cs?'Vyber slot. Obsazený slot bude před přepsáním vyžadovat potvrzení.':'Choose a slot. Occupied slots require confirmation before overwrite.'):this.saveBrowserMode==='manage'?(cs?'Jednotlivé světy můžeš bezpečně odstranit.':'Delete individual local worlds without touching the others.'):(cs?'Vyber svět, do kterého se chceš vrátit.':'Choose the world you want to continue.');
    grid.innerHTML=this.saveSlots.map(save=>{const minutes=Math.max(0,Math.floor((save.elapsed??0)/60)),date=save.savedAt?new Date(save.savedAt).toLocaleString(cs?'cs-CZ':'en-GB',{dateStyle:'short',timeStyle:'short'}):'',status=save.exists?`${cs?'SEED':'SEED'} ${save.seed} · ${minutes} MIN`:(cs?'PRÁZDNÝ SLOT':'EMPTY SLOT');const action=this.saveBrowserMode==='new'?'new':'load';const actionLabel=this.saveBrowserMode==='new'?(save.exists?(cs?'PŘEPSAT':'OVERWRITE'):(cs?'VYTVOŘIT':'CREATE')):(cs?'NAČÍST':'LOAD');return `<article class="save-slot-card ${save.exists?'occupied':'empty'}"><header><span>SLOT ${save.slot}</span><i>${save.exists?(cs?'ULOŽENO':'SAVED'):(cs?'VOLNÝ':'FREE')}</i></header><div class="save-slot-body"><strong>${save.exists?`ISLAND ${esc(save.seed)}`:'—'}</strong><span>${status}</span>${save.exists?`<small>${date} · ${save.structures??0} ${cs?'STAVEB':'STRUCTURES'}</small>`:`<small>${cs?'Připraven pro nový svět.':'Ready for a new world.'}</small>`}</div><footer>${this.saveBrowserMode!=='manage'?`<button class="save-slot-primary" data-save-action="${action}" data-save-slot="${save.slot}" ${!save.exists&&this.saveBrowserMode==='load'?'disabled':''}>${actionLabel}${chevron}</button>`:''}${save.exists?`<button class="save-slot-delete" data-save-action="delete" data-save-slot="${save.slot}">${cs?'SMAZAT':'DELETE'}</button>`:''}</footer></article>`;}).join('');
  }''')
# setScreen should close transient save UI on actual screen transitions.
s=replace_once(s,"    this.root.dataset.screen = screen;\n    this.find('.help-panel').hidden = true;","    this.root.dataset.screen = screen;\n    this.closeSaveBrowser();\n    this.find('.help-panel').hidden = true;",'close browser on screen change')
# setSettings: add ranges and CSS/toggles.
s=replace_once(s,"['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','crosshairOpacity'] as const","['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','crosshairOpacity','crosshairScale','hudScale','hudOpacity','brightness'] as const",'setSettings range list')
s=replace_once(s,"this.root.classList.toggle('hide-compass',!settings.showCompass);this.root.style.setProperty('--crosshair-opacity',String(settings.crosshairOpacity));this.applyLanguage();","this.root.classList.toggle('hide-compass',!settings.showCompass);this.root.classList.toggle('hide-tutorials',!settings.showTutorialHints);this.root.style.setProperty('--crosshair-opacity',String(settings.crosshairOpacity));this.root.style.setProperty('--crosshair-scale',String(settings.crosshairScale));this.root.style.setProperty('--hud-scale',String(settings.hudScale));this.root.style.setProperty('--hud-opacity',String(settings.hudOpacity));const fps=this.root.querySelector<HTMLElement>('.fps-counter');if(fps)fps.hidden=!settings.showFps;this.applyLanguage();",'setSettings HUD vars')
# Replace save availability method with summaries + richer menu metadata.
old_save_available='''  setSaveAvailable(available: boolean): void {
    this.saveAvailable=available;
    const continueButton=this.root.querySelector<HTMLButtonElement>('.continue-game'),loadButton=this.root.querySelector<HTMLButtonElement>('.load-game');if(continueButton)continueButton.disabled=!available;if(loadButton)loadButton.disabled=!available;
    const meta=this.root.querySelector<HTMLElement>('.continue-meta');if(meta)meta.textContent=this.tx(available?'returnIsland':'noSave');
  }'''
new_save_available='''  setSaveSlots(slots:SaveSlotSummary[]):void{this.saveSlots=slots.map(slot=>({...slot}));this.setSaveAvailable(this.saveSlots.some(slot=>slot.exists));this.renderSaveBrowser();}
  setSaveAvailable(available: boolean): void {
    this.saveAvailable=available;
    const continueButton=this.root.querySelector<HTMLButtonElement>('.continue-game'),loadButton=this.root.querySelector<HTMLButtonElement>('.load-game');if(continueButton)continueButton.disabled=!available;if(loadButton)loadButton.disabled=!available;
    const latest=[...this.saveSlots].filter(slot=>slot.exists).sort((a,b)=>(b.savedAt??0)-(a.savedAt??0))[0];
    const meta=this.root.querySelector<HTMLElement>('.continue-meta');if(meta)meta.textContent=latest?`SLOT ${latest.slot} · SEED ${latest.seed}`:this.tx('noSave');
    const count=this.saveSlots.filter(slot=>slot.exists).length,countLabel=this.root.querySelector<HTMLElement>('.save-count'),footer=this.root.querySelector<HTMLElement>('.save-footer-status');if(countLabel)countLabel.textContent=`${count} / 5 SAVES`;if(footer)footer.textContent=count?`${count} LOCAL WORLD${count===1?'':'S'}`:'NO LOCAL WORLDS';
  }'''
s=replace_once(s,old_save_available,new_save_available,'save slot summaries')
# applyLanguage rerenders slot labels.
s=replace_once(s,"this.setSaveAvailable(this.saveAvailable);}","this.setSaveAvailable(this.saveAvailable);this.renderSaveBrowser();}",'language save rerender')
# toggle helper type.
s=replace_once(s,"private toggle(name:'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass',","private toggle(name:'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints',",'toggle helper types')
# setting value formatting.
s=replace_once(s,"if(name.includes('Volume')||name==='crosshairOpacity')return `${Math.round(value*100)}%`;if(name==='fov'||name==='viewmodelFov')return `${Math.round(value)}°`;if(name==='renderScale')return `${Math.round(value*100)}%`;","if(name.includes('Volume')||name==='crosshairOpacity'||name==='hudOpacity')return `${Math.round(value*100)}%`;if(name==='fov'||name==='viewmodelFov')return `${Math.round(value)}°`;if(name==='renderScale'||name==='hudScale'||name==='crosshairScale'||name==='brightness')return `${Math.round(value*100)}%`;",'setting value formats')
# live FPS + tutorial toggle.
s=replace_once(s,"this.find('.tutorial-copy').textContent = hud.tutorial;\n      this.find('.onboarding').classList.toggle('empty',!hud.tutorial);","this.find('.tutorial-copy').textContent = this.settings.showTutorialHints?hud.tutorial:'';\n      this.find('.onboarding').classList.toggle('empty',!this.settings.showTutorialHints||!hud.tutorial);\n      const fpsCounter=this.root.querySelector<HTMLElement>('.fps-counter');if(fpsCounter&&this.settings.showFps)fpsCounter.textContent=`${Math.round(hud.fps)} FPS`;",'fps tutorial behavior')
write(p,s)

# ---------- translations ----------
p='src/ui/i18n.ts'; s=read(p)
s=replace_once(s,"crosshair:'CROSSHAIR OPACITY',crosshairDetail:'Adjust the center reticle visibility.',compass:","crosshair:'CROSSHAIR OPACITY',crosshairDetail:'Adjust the center reticle visibility.',crosshairScale:'CROSSHAIR SIZE',crosshairScaleDetail:'Scale the center reticle without changing aim.',hudScale:'HUD SCALE',hudScaleDetail:'Scale the in-game HUD without changing the world view.',hudOpacity:'HUD OPACITY',hudOpacityDetail:'Adjust the transparency of gameplay HUD groups.',showFps:'FPS COUNTER',showFpsDetail:'Show a small live frame-rate counter.',tutorialHints:'TUTORIAL HINTS',tutorialHintsDetail:'Show contextual onboarding tips during gameplay.',compass:",'en HUD translations')
s=replace_once(s,"quality:'GRAPHICS PRESET',qualityDetail:'One-click rendering quality profile.',renderScale:","quality:'GRAPHICS PRESET',qualityDetail:'One-click rendering quality profile.',brightness:'BRIGHTNESS',brightnessDetail:'Adjust world exposure without changing HUD brightness.',renderScale:",'en brightness translations')
s=replace_once(s,"localSaveData:'LOCAL SAVE DATA',localSaveDataDetail:'Remove your saved island and progress.',resetSave:","localSaveData:'LOCAL SAVE DATA',localSaveDataDetail:'Manage individual local worlds or remove all save data.',manageSaves:'MANAGE SAVES',deleteAllSaves:'DELETE ALL SAVES',resetSave:",'en save translations')
s=replace_once(s,"crosshair:'PRŮHLEDNOST ZAMĚŘOVAČE',crosshairDetail:'Nastavení viditelnosti zaměřovače uprostřed.',compass:","crosshair:'PRŮHLEDNOST ZAMĚŘOVAČE',crosshairDetail:'Nastavení viditelnosti zaměřovače uprostřed.',crosshairScale:'VELIKOST ZAMĚŘOVAČE',crosshairScaleDetail:'Změní velikost zaměřovače bez změny míření.',hudScale:'VELIKOST HUD',hudScaleDetail:'Změní velikost herního HUD bez změny obrazu světa.',hudOpacity:'PRŮHLEDNOST HUD',hudOpacityDetail:'Nastaví průhlednost hlavních prvků HUD.',showFps:'POČÍTADLO FPS',showFpsDetail:'Zobrazí malé živé počítadlo snímků.',tutorialHints:'HERNÍ NÁPOVĚDY',tutorialHintsDetail:'Zobrazí kontextové rady během hraní.',compass:",'cs HUD translations')
s=replace_once(s,"quality:'GRAFICKÝ PROFIL',qualityDetail:'Rychlé nastavení kvality vykreslování.',renderScale:","quality:'GRAFICKÝ PROFIL',qualityDetail:'Rychlé nastavení kvality vykreslování.',brightness:'JAS',brightnessDetail:'Nastaví expozici světa bez změny jasu HUD.',renderScale:",'cs brightness translations')
s=replace_once(s,"localSaveData:'MÍSTNÍ ULOŽENÍ',localSaveDataDetail:'Odstraní uložený ostrov a postup.',resetSave:","localSaveData:'MÍSTNÍ ULOŽENÍ',localSaveDataDetail:'Správa jednotlivých světů nebo odstranění všech uložených dat.',manageSaves:'SPRAVOVAT ULOŽENÍ',deleteAllSaves:'SMAZAT VŠECHNA ULOŽENÍ',resetSave:",'cs save translations')
write(p,s)

# ---------- modernized original menu + scalable HUD CSS ----------
p='src/ui/style.css'; s=read(p)
css=r'''

/* Tideland v0.7.0 — restored classic menu language, save browser and scalable HUD */
.tide-ui{--hud-scale:1.12;--hud-opacity:1;--crosshair-scale:1}
.menu-classic-v7{overflow:hidden;background:linear-gradient(90deg,rgba(8,18,16,.83),rgba(8,18,16,.54) 35%,rgba(8,18,16,.12) 68%,rgba(8,18,16,.04)),linear-gradient(0deg,rgba(5,13,12,.72),transparent 33%,transparent 76%,rgba(5,13,12,.36))}
.menu-classic-v7:after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 72% 42%,transparent 0 24%,rgba(0,0,0,.08) 54%,rgba(0,0,0,.36) 100%)}
.menu-classic-v7 .menu-masthead,.menu-classic-v7 .menu-content,.menu-classic-v7 .menu-location,.menu-classic-v7 .menu-footer{z-index:2}
.menu-classic-v7 .menu-masthead>div:first-of-type b{display:block;margin-top:3px;font:500 10px var(--title-font);letter-spacing:.13em;color:#dce3d1b0}
.menu-classic-v7 .menu-content{top:21.5%;width:470px}.menu-classic-v7 .menu-content h1{margin-bottom:18px}.menu-classic-v7 .menu-description{max-width:390px}
.menu-classic-v7 .main-nav{max-width:365px;margin-top:28px}.menu-classic-v7 .menu-link{height:49px;border:1px solid transparent;border-bottom-color:#d3ddca1e;padding-right:10px;backdrop-filter:blur(3px)}
.menu-classic-v7 .menu-link:hover:not(:disabled){border-color:#dce7d327;background:#e7eddc12;transform:translateX(3px)}.menu-classic-v7 .menu-link.new-game{box-shadow:0 12px 34px #3c120c2a}
.menu-classic-v7 .menu-meta{font-size:8px;opacity:.72}.menu-classic-v7 .seed-control{margin-top:15px}.menu-classic-v7 .seed-control input{width:92px;height:28px;background:#0d1915a6}
.menu-classic-v7 .menu-footer{pointer-events:auto}.menu-classic-v7 .menu-footer .text-button{background:transparent}
.save-browser{position:fixed;inset:0;z-index:700;display:grid;place-items:center;padding:28px;background:rgba(2,8,7,.76);backdrop-filter:blur(14px);pointer-events:auto}.save-browser[hidden]{display:none}
.save-browser-shell{width:min(1080px,94vw);max-height:88vh;overflow:auto;background:linear-gradient(145deg,rgba(14,25,22,.98),rgba(8,15,14,.98));border:1px solid #dce6d31b;box-shadow:0 36px 120px #0009;padding:30px}
.save-browser-shell>header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:21px;border-bottom:1px solid #dbe5d216}.save-browser-shell h2{font:700 clamp(36px,5vw,58px)/.95 var(--title-font);letter-spacing:.02em;margin:8px 0}.save-browser-shell header p{color:#d1d9c89a;font-size:12px}.save-browser-shell .close-button{position:static}
.save-slot-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:20px}.save-slot-card{min-height:225px;display:flex;flex-direction:column;border:1px solid #dce6d313;background:#e2ead608}.save-slot-card.occupied{background:linear-gradient(160deg,#dce7d30d,#121f1a90);border-color:#dce6d323}.save-slot-card>header{display:flex;justify-content:space-between;padding:13px 14px;border-bottom:1px solid #dce6d313;font:600 10px var(--title-font);letter-spacing:.11em}.save-slot-card>header i{font-style:normal;color:#a9bd7d}.save-slot-card.empty>header i{color:#c4cbb66b}
.save-slot-body{padding:18px 14px;display:flex;flex-direction:column;gap:7px;flex:1}.save-slot-body strong{font:600 22px var(--title-font);letter-spacing:.04em}.save-slot-body span{font:500 10px var(--title-font);letter-spacing:.08em;color:#e3e7d5a8}.save-slot-body small{font-size:10px;line-height:1.45;color:#d6decd70}
.save-slot-card>footer{display:grid;gap:5px;padding:11px;border-top:1px solid #dce6d313}.save-slot-primary,.save-slot-delete{min-height:38px;padding:0 11px;display:flex;align-items:center;justify-content:space-between;font:600 11px var(--title-font);letter-spacing:.1em}.save-slot-primary{background:#c5b47e;color:#111814}.save-slot-primary:hover{background:#dbc98e}.save-slot-primary svg{width:15px}.save-slot-delete{background:#8f3b3026;border:1px solid #c8685845;color:#e49a8d;justify-content:center}.save-slot-delete:hover{background:#9d45373e}.save-browser-shell>footer{display:flex;justify-content:space-between;gap:20px;margin-top:18px;padding-top:14px;border-top:1px solid #dce6d313;color:#ced7c26f;font:500 9px var(--title-font);letter-spacing:.08em}
.settings-v3 .save-reset-row>div{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.game-screen .compass-wrap{scale:var(--hud-scale);transform-origin:top center}.game-screen .hotbar-wrap{scale:var(--hud-scale);transform-origin:bottom center}.game-screen .vitals,.game-screen .hud-craft-queue,.game-screen .notifications{scale:var(--hud-scale);transform-origin:bottom right}.game-screen .onboarding,.game-screen .build-panel{scale:var(--hud-scale);transform-origin:bottom left}.game-screen .interaction-prompt,.game-screen .resource-feedback{scale:var(--hud-scale);transform-origin:center}.game-screen .hotbar-wrap,.game-screen .vitals,.game-screen .hud-craft-queue,.game-screen .notifications,.game-screen .onboarding,.game-screen .build-panel,.game-screen .interaction-prompt,.game-screen .resource-feedback,.game-screen .compass-wrap{opacity:var(--hud-opacity)}
.crosshair{scale:var(--crosshair-scale);opacity:var(--crosshair-opacity,1)}.hide-tutorials .onboarding{display:none!important}.fps-counter{position:absolute;left:20px;top:18px;padding:5px 8px;background:#0b1511a8;border:1px solid #e0ead31b;font:600 10px var(--title-font);letter-spacing:.08em;color:#e7eadcba;text-shadow:0 1px 3px #0008;scale:var(--hud-scale);transform-origin:top left;opacity:var(--hud-opacity)}
@media(max-width:1100px){.save-slot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.menu-classic-v7 .menu-location{display:none}}
@media(max-width:640px){.menu-classic-v7 .menu-content{left:5%;top:19%;width:90%}.menu-classic-v7 .menu-content h1{font-size:92px}.menu-classic-v7 .menu-masthead{left:5%;right:5%}.menu-classic-v7 .edition{display:none}.save-browser{padding:12px}.save-browser-shell{padding:18px}.save-slot-grid{grid-template-columns:1fr}.save-slot-card{min-height:180px}}
'''
if 'Tideland v0.7.0 — restored classic menu language' not in s:s+=css
write(p,s)

# ---------- versioning / docs ----------
p='src/config/version.ts'; s=read(p)
s=s.replace("export const GAME_VERSION='0.6.0';","export const GAME_VERSION='0.7.0';").replace("export const GAME_BUILD='EA-06';","export const GAME_BUILD='EA-07';")
entry="""  {version:'0.7.0',date:'2026-09-11',title:'Classic menu, save slots & HUD settings',changes:[
    'Restored the original left-aligned Tideland menu language with a cleaner modern survival-game presentation.',
    'Added five independent local world save slots with timestamps, seed/playtime metadata, loading and per-slot deletion.',
    'Fixed deleted worlds being recreated by background autosave by detaching a deleted active slot from the live session.',
    'Added a save manager and explicit confirmations for overwriting one slot or deleting all local worlds.',
    'Added HUD scale and opacity controls plus crosshair size, optional FPS counter and tutorial-hint visibility.',
    'Added world brightness/exposure control while preserving the existing graphics quality and render-scale system.'
  ]},
"""
s=replace_once(s,"export const CHANGELOG:ChangeEntry[]=[\n", "export const CHANGELOG:ChangeEntry[]=[\n"+entry,'version changelog entry')
write(p,s)

for p in ['package.json','package-lock.json']:
    s=read(p);s=s.replace('"version": "0.6.0"','"version": "0.7.0"');write(p,s)

p='CHANGELOG.md'; s=read(p)
block="""## 0.7.0 — 2026-09-11

Classic menu, save-slot and interface settings overhaul.

- Restored the original left-aligned Tideland menu style, modernized with clearer state/meta information instead of the large dashboard-like v0.3 panel.
- Added five independent local save slots with seed, playtime, structure count and saved-time metadata.
- Added load/new/manage save flows with per-slot overwrite and deletion confirmation.
- Fixed deleted active saves being silently recreated by the 60-second autosave or main-menu transition.
- Added HUD scale, HUD opacity, crosshair size, FPS counter and tutorial-hint controls.
- Added world brightness/exposure control and kept all new interface preferences persistent per browser.

"""
s=replace_once(s,'# Tideland changelog\n\n','# Tideland changelog\n\n'+block,'markdown changelog')
write(p,s)

p='README.md'; s=read(p)
s=s.replace('version-v0.6.0%20%7C%20EA--06','version-v0.7.0%20%7C%20EA--07').replace('`v0.6.0 / EA-06`','`v0.7.0 / EA-07`')
s=s.replace('- Render scale, shadows, compass and crosshair settings','- Five local save slots with per-slot load/delete management\n- HUD scale/opacity, crosshair size, FPS counter and tutorial visibility settings\n- Render scale, brightness, shadows, compass and crosshair settings')
s=s.replace('**v0.6.x** is focused on environment rendering, atmosphere and scalable graphics quality.','**v0.7.x** is focused on menu usability, multi-save persistence and player-configurable interface scale.')
write(p,s)

# ---------- focused save-slot tests ----------
p='tests/save-slots.test.ts'
write(p,"""import {beforeEach,describe,expect,it,vi} from 'vitest';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {deleteSave,latestSaveSlot,listSaveSlots,loadGame,resetSave,saveGame} from '../src/save/storage';

class MemoryStorage {
  private data=new Map<string,string>();
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,String(value));}
  removeItem(key:string){this.data.delete(key);}
  clear(){this.data.clear();}
}

describe('multi-slot local saves',()=>{
  beforeEach(()=>{vi.stubGlobal('localStorage',new MemoryStorage());resetSave();});
  it('keeps independent worlds and deletes only the selected slot',()=>{
    const a=new GameSimulation(101,{x:0,y:2,z:0}),b=new GameSimulation(202,{x:0,y:2,z:0});
    expect(saveGame(a.state,1)).toBe(true);expect(saveGame(b.state,2)).toBe(true);
    expect(loadGame(1)?.seed).toBe(101);expect(loadGame(2)?.seed).toBe(202);
    expect(listSaveSlots().filter(slot=>slot.exists).map(slot=>slot.slot)).toEqual([1,2]);
    deleteSave(1);expect(loadGame(1)).toBeNull();expect(loadGame(2)?.seed).toBe(202);
  });
  it('reports a latest save and reset clears every slot',async()=>{
    const a=new GameSimulation(303,{x:0,y:2,z:0}),b=new GameSimulation(404,{x:0,y:2,z:0});
    saveGame(a.state,3);await new Promise(resolve=>setTimeout(resolve,2));saveGame(b.state,4);
    expect(latestSaveSlot()).toBe(4);resetSave();expect(listSaveSlots().every(slot=>!slot.exists)).toBe(true);
  });
});
""")

print('v0.7.0 menu/save/settings overhaul applied')
