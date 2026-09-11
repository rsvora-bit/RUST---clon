from pathlib import Path
import json


def read(path:str)->str:
    return Path(path).read_text()

def write(path:str,text:str)->None:
    Path(path).write_text(text)

def replace_once(text:str,old:str,new:str,path:str)->str:
    if old not in text:
        raise SystemExit(f'missing marker in {path}: {old[:100]!r}')
    return text.replace(old,new,1)

def replace_between(text:str,start:str,end:str,replacement:str,path:str)->str:
    a=text.find(start)
    b=text.find(end,a+len(start))
    if a<0 or b<0:
        raise SystemExit(f'missing range in {path}: {start!r} -> {end!r}')
    return text[:a]+replacement+text[b:]

# --- core settings model ----------------------------------------------------
p='src/core/types.ts'
s=read(p)
s=replace_once(s,
"export type ItemCategory = 'resource'|'tool'|'food'|'building'|'utility';",
"export type ItemCategory = 'resource'|'tool'|'food'|'building'|'utility';\nexport type Language = 'en'|'cs';\nexport type GraphicsQuality = 'low'|'medium'|'high'|'ultra';\nexport type KeybindAction = 'forward'|'backward'|'left'|'right'|'sprint'|'jump'|'crouch'|'interact'|'inventory'|'build'|'rotate'|'cycleBuild'|'use'|'map'|'maintenance';\nexport type Keybinds = Record<KeybindAction,string>;",
p)
s=replace_once(s,
"export interface Settings {sensitivity:number; fov:number; viewmodelFov:number; invertY:boolean; headBob:boolean; masterVolume:number; effectsVolume:number; quality:'low'|'medium'|'high'; renderScale:number; shadows:boolean; crosshairOpacity:number; showCompass:boolean}",
"export interface Settings {language:Language; sensitivityX:number; sensitivityY:number; fov:number; viewmodelFov:number; invertY:boolean; headBob:boolean; cameraShake:boolean; motionBlur:boolean; masterVolume:number; musicVolume:number; effectsVolume:number; ambientVolume:number; quality:GraphicsQuality; renderScale:number; shadows:boolean; crosshairOpacity:number; showCompass:boolean; keybinds:Keybinds}",p)
write(p,s)

# --- defaults ---------------------------------------------------------------
p='src/config/balance.ts'
s=read(p)
s=replace_once(s,
"export const DEFAULT_SETTINGS = {sensitivity:1,fov:90,viewmodelFov:50,invertY:false,headBob:false,masterVolume:0.65,effectsVolume:0.7,quality:'high' as const,renderScale:1,shadows:true,crosshairOpacity:1,showCompass:true};",
"export const DEFAULT_KEYBINDS={forward:'KeyW',backward:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',jump:'Space',crouch:'ControlLeft',interact:'KeyE',inventory:'Tab',build:'KeyB',rotate:'KeyR',cycleBuild:'KeyQ',use:'KeyF',map:'KeyM',maintenance:'KeyG'} as const;\nexport const DEFAULT_SETTINGS = {language:'en' as const,sensitivityX:1,sensitivityY:1,fov:90,viewmodelFov:50,invertY:false,headBob:false,cameraShake:true,motionBlur:false,masterVolume:0.65,musicVolume:0.45,effectsVolume:0.7,ambientVolume:0.65,quality:'high' as const,renderScale:1,shadows:true,crosshairOpacity:1,showCompass:true,keybinds:{...DEFAULT_KEYBINDS}};",
p)
write(p,s)

# --- settings migration/persistence ----------------------------------------
p='src/save/storage.ts'
s=read(p)
s=replace_once(s,"import { DEFAULT_SETTINGS } from '../config/balance';","import { DEFAULT_KEYBINDS, DEFAULT_SETTINGS } from '../config/balance';",p)
start="function normalizeSettings(value: unknown): Settings {"
end="export function saveSettings(settings: Settings): void {"
new_normalize=r'''const defaultSettings=():Settings=>({...DEFAULT_SETTINGS,keybinds:{...DEFAULT_KEYBINDS}});
function normalizeSettings(value: unknown): Settings {
  if (!record(value)) return defaultSettings();
  const legacySensitivity=finite(value.sensitivity,0.05,3)?value.sensitivity:1;
  const source=record(value.keybinds)?value.keybinds:{};
  const keybinds={...DEFAULT_KEYBINDS} as Settings['keybinds'];
  for(const action of Object.keys(DEFAULT_KEYBINDS) as (keyof Settings['keybinds'])[]){
    const code=source[action];
    if(typeof code==='string'&&code.length>0&&code.length<=32)keybinds[action]=code;
  }
  return {
    language:value.language==='cs'?'cs':'en',
    sensitivityX:finite(value.sensitivityX,0.05,3)?value.sensitivityX:legacySensitivity,
    sensitivityY:finite(value.sensitivityY,0.05,3)?value.sensitivityY:legacySensitivity,
    fov: finite(value.fov, 55, 110) ? normalizeFov(value.fov) : DEFAULT_SETTINGS.fov,
    viewmodelFov: finite(value.viewmodelFov, 40, 75) ? value.viewmodelFov : DEFAULT_SETTINGS.viewmodelFov,
    invertY: typeof value.invertY === 'boolean' ? value.invertY : DEFAULT_SETTINGS.invertY,
    headBob: typeof value.headBob === 'boolean' ? value.headBob : DEFAULT_SETTINGS.headBob,
    cameraShake: typeof value.cameraShake === 'boolean' ? value.cameraShake : DEFAULT_SETTINGS.cameraShake,
    motionBlur: typeof value.motionBlur === 'boolean' ? value.motionBlur : DEFAULT_SETTINGS.motionBlur,
    masterVolume: finite(value.masterVolume, 0, 1) ? value.masterVolume : DEFAULT_SETTINGS.masterVolume,
    musicVolume: finite(value.musicVolume, 0, 1) ? value.musicVolume : DEFAULT_SETTINGS.musicVolume,
    effectsVolume: finite(value.effectsVolume, 0, 1) ? value.effectsVolume : DEFAULT_SETTINGS.effectsVolume,
    ambientVolume: finite(value.ambientVolume, 0, 1) ? value.ambientVolume : DEFAULT_SETTINGS.ambientVolume,
    quality: ['low','medium','high','ultra'].includes(String(value.quality)) ? value.quality as Settings['quality'] : DEFAULT_SETTINGS.quality,
    renderScale: finite(value.renderScale, 0.5, 1) ? value.renderScale : DEFAULT_SETTINGS.renderScale,
    shadows: typeof value.shadows === 'boolean' ? value.shadows : DEFAULT_SETTINGS.shadows,
    crosshairOpacity: finite(value.crosshairOpacity, 0, 1) ? value.crosshairOpacity : DEFAULT_SETTINGS.crosshairOpacity,
    showCompass: typeof value.showCompass === 'boolean' ? value.showCompass : DEFAULT_SETTINGS.showCompass,
    keybinds
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SAVE.SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch { return defaultSettings(); }
}

'''
s=replace_between(s,start,end,new_normalize,p)
write(p,s)

# --- first person controls --------------------------------------------------
p='src/player/PlayerController.ts'
s=read(p)
s=replace_once(s,
"  look(dx:number,dy:number){const scale=0.0009*this.settings.sensitivity;this.yaw-=dx*scale;const ySign=this.settings.invertY?1:-1;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*scale*ySign,-1.48,1.48);this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);}",
"  look(dx:number,dy:number){const sx=0.0009*this.settings.sensitivityX,sy=0.0009*this.settings.sensitivityY;this.yaw-=dx*sx;const ySign=this.settings.invertY?1:-1;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*sy*ySign,-1.48,1.48);this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);}",p)
s=replace_once(s,
"    const forward=active?Number(this.input.down('KeyW','ArrowUp'))-Number(this.input.down('KeyS','ArrowDown')):0;\n    const side=active?Number(this.input.down('KeyD','ArrowRight'))-Number(this.input.down('KeyA','ArrowLeft')):0;\n    const crouching=active&&this.input.down('ControlLeft','ControlRight','KeyC');\n    this.sprinting=active&&forward>0&&this.input.down('ShiftLeft','ShiftRight')&&state.player.stats.stamina>2&&!crouching;",
"    const keys=this.settings.keybinds;\n    const forward=active?Number(this.input.down(keys.forward))-Number(this.input.down(keys.backward)):0;\n    const side=active?Number(this.input.down(keys.right))-Number(this.input.down(keys.left)):0;\n    const crouching=active&&this.input.down(keys.crouch);\n    this.sprinting=active&&forward>0&&this.input.down(keys.sprint)&&state.player.stats.stamina>2&&!crouching;",p)
write(p,s)

# --- audio channels ---------------------------------------------------------
p='src/audio/AudioMixer.ts'
write(p,r'''import type {Settings} from '../core/types';
export class AudioMixer {
  private ctx:AudioContext|null=null;private master:GainNode|null=null;private sfx:GainNode|null=null;private ambience:GainNode|null=null;private music:GainNode|null=null;private buffer:AudioBuffer|null=null;private lastRain=0;
  constructor(private settings:Settings){}
  async start(){
    if(this.ctx){await this.ctx.resume();return;}
    this.ctx=new AudioContext();const ctx=this.ctx;
    this.master=ctx.createGain();this.master.connect(ctx.destination);
    this.sfx=ctx.createGain();this.sfx.connect(this.master);
    this.ambience=ctx.createGain();this.ambience.connect(this.master);
    this.music=ctx.createGain();this.music.connect(this.master);
    this.buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=this.buffer.getChannelData(0);let prev=0;for(let i=0;i<data.length;i++){prev=(prev+Math.random()*.08-.04)/1.025;data[i]=prev;}
    const wind=ctx.createBufferSource();wind.buffer=this.buffer;wind.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=680;wind.connect(filter);filter.connect(this.ambience);wind.start();
    const pad=ctx.createGain();pad.gain.value=.24;pad.connect(this.music);const low=ctx.createOscillator(),high=ctx.createOscillator(),padFilter=ctx.createBiquadFilter();padFilter.type='lowpass';padFilter.frequency.value=260;low.type='sine';high.type='sine';low.frequency.value=82.4;high.frequency.value=123.5;low.connect(padFilter);high.connect(padFilter);padFilter.connect(pad);low.start();high.start();
    this.setSettings(this.settings);
  }
  setSettings(s:Settings){this.settings=s;if(this.master)this.master.gain.value=s.masterVolume;if(this.sfx)this.sfx.gain.value=s.effectsVolume;if(this.music)this.music.gain.value=s.musicVolume*.045;this.updateAmbience();}
  setWeather(rain:number){this.lastRain=rain;this.updateAmbience();}
  private updateAmbience(){if(this.ambience&&this.ctx)this.ambience.gain.setTargetAtTime((.038+this.lastRain*.075)*this.settings.ambientVolume,this.ctx.currentTime,.4);}
  play(kind:'step'|'wood'|'stone'|'pickup'|'build'|'ui'|'door'|'eat'|'error'){
    if(!this.ctx||!this.sfx||!this.buffer)return;const ctx=this.ctx,t=ctx.currentTime;
    const noise=ctx.createBufferSource();noise.buffer=this.buffer;const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='lowpass';filter.frequency.value=kind==='stone'?2400:kind==='step'?450:kind==='wood'?1000:700;
    noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime(kind==='step'?.12:.45,t);gain.gain.exponentialRampToValueAtTime(.001,t+(kind==='build'?.25:.11));noise.start(t);noise.stop(t+.28);
    if(['pickup','build','ui','error','eat'].includes(kind)){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(kind==='error'?100:kind==='build'?180:720,t);o.frequency.exponentialRampToValueAtTime(kind==='error'?75:kind==='build'?80:1120,t+.12);g.gain.setValueAtTime(.075,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(this.sfx);o.start(t);o.stop(t+.16);}
  }
}
''')

# --- UI translations --------------------------------------------------------
p='src/ui/i18n.ts'
write(p,r'''import type {Language} from '../core/types';
const en={
play:'PLAY',playGame:'PLAY GAME',newGame:'NEW GAME',continue:'CONTINUE',load:'LOAD',settings:'SETTINGS',history:'HISTORY',controls:'CONTROLS',survivalExperience:'OPEN WORLD SURVIVAL',menuTagline:'Build, survive and make the island yours.',worldSeed:'WORLD SEED',proceduralIsland:'PROCEDURAL ISLAND',noSave:'NO SAVED WORLD',returnIsland:'RETURN TO YOUR ISLAND',localSave:'LOCAL SAVE',back:'BACK',returnWorld:'RETURN TO WORLD',saveWorld:'SAVE WORLD',mainMenu:'MAIN MENU',paused:'PAUSED',pauseDesc:'The island can wait.',simulationPaused:'Simulation paused',gameplay:'GAMEPLAY',graphics:'GRAPHICS',audio:'AUDIO',settingsTitle:'GAME SETTINGS',settingsSubtitle:'Changes apply immediately and save automatically.',language:'LANGUAGE',languageDetail:'Switch the interface between English and Czech.',english:'ENGLISH',czech:'CZECH',crosshair:'CROSSHAIR OPACITY',crosshairDetail:'Adjust the center reticle visibility.',compass:'COMPASS',compassDetail:'Show the navigation strip at the top.',sensitivityX:'HORIZONTAL SENSITIVITY',sensitivityXDetail:'Mouse look speed on the X axis.',sensitivityY:'VERTICAL SENSITIVITY',sensitivityYDetail:'Mouse look speed on the Y axis.',invertY:'INVERT Y',invertYDetail:'Reverse vertical mouse movement.',headBob:'HEAD BOB',headBobDetail:'Subtle walking camera movement.',cameraShake:'CAMERA SHAKE',cameraShakeDetail:'Small sprint and movement camera feedback.',keybinds:'KEY BINDINGS',forward:'MOVE FORWARD',backward:'MOVE BACKWARD',left:'MOVE LEFT',right:'MOVE RIGHT',sprint:'SPRINT',jump:'JUMP',crouch:'CROUCH',interact:'INTERACT',inventory:'INVENTORY',build:'BUILD MODE',rotate:'ROTATE BUILD',cycleBuild:'NEXT BUILD PIECE',use:'USE ITEM',map:'MAP',maintenance:'STRUCTURE MAINTENANCE',fov:'WORLD FOV',fovDetail:'Field of view for the world camera.',viewmodelFov:'VIEWMODEL FOV',viewmodelFovDetail:'Field of view for hands and held tools.',motionBlur:'MOTION BLUR',motionBlurDetail:'Lightweight blur while moving quickly.',quality:'GRAPHICS PRESET',qualityDetail:'One-click rendering quality profile.',renderScale:'RENDER SCALE',renderScaleDetail:'Lower this first if GPU performance is low.',shadows:'DYNAMIC SHADOWS',shadowsDetail:'Disable for a large GPU performance gain.',low:'LOW',medium:'MEDIUM',high:'HIGH',ultra:'ULTRA',masterVolume:'MASTER VOLUME',masterVolumeDetail:'Overall game audio level.',musicVolume:'MUSIC VOLUME',musicVolumeDetail:'Procedural atmospheric music layer.',effectsVolume:'EFFECTS VOLUME',effectsVolumeDetail:'Tools, footsteps, UI and interactions.',ambientVolume:'AMBIENT VOLUME',ambientVolumeDetail:'Wind, rain and world ambience.',resetCamera:'RESET CAMERA',resetSettings:'RESET SETTINGS',reloadBuild:'RELOAD LATEST BUILD',localSettings:'LOCAL SETTINGS',localSettingsDetail:'Reset device-specific controls and presentation.',localSaveData:'LOCAL SAVE DATA',localSaveDataDetail:'Remove your saved island and progress.',resetSave:'RESET SAVE',deleteSave:'DELETE SAVE',cancel:'CANCEL',newGameWarning:'START A NEW WORLD?',newGameWarningDetail:'Your current local world will be replaced the next time the new world is saved.',newGameConfirm:'START NEW WORLD',health:'HEALTH',water:'WATER',food:'FOOD',stamina:'STAMINA',wet:'WET',cold:'COLD',crafting:'CRAFTING',ready:'READY',emptyHands:'EMPTY HANDS',pressKey:'PRESS A KEY…',open:'OPEN',close:'CLOSE',pickUp:'PICK UP',authorize:'AUTHORIZE',useAction:'USE',gather:'GATHER',drink:'DRINK',depleted:'DEPLETED',menu:'MENU',on:'ON',off:'OFF'
} as const;
export type TranslationKey=keyof typeof en;
const cs:Record<TranslationKey,string>={
play:'HRÁT',playGame:'HRÁT HRU',newGame:'NOVÁ HRA',continue:'POKRAČOVAT',load:'NAČÍST',settings:'NASTAVENÍ',history:'HISTORIE',controls:'OVLÁDÁNÍ',survivalExperience:'SURVIVAL V OTEVŘENÉM SVĚTĚ',menuTagline:'Stav, přežij a udělej si ostrov podle sebe.',worldSeed:'SEED SVĚTA',proceduralIsland:'PROCEDURÁLNÍ OSTROV',noSave:'ŽÁDNÝ ULOŽENÝ SVĚT',returnIsland:'NÁVRAT NA TVŮJ OSTROV',localSave:'MÍSTNÍ ULOŽENÍ',back:'ZPĚT',returnWorld:'ZPĚT DO SVĚTA',saveWorld:'ULOŽIT SVĚT',mainMenu:'HLAVNÍ MENU',paused:'POZASTAVENO',pauseDesc:'Ostrov počká.',simulationPaused:'Simulace pozastavena',gameplay:'HRATELNOST',graphics:'GRAFIKA',audio:'ZVUK',settingsTitle:'NASTAVENÍ HRY',settingsSubtitle:'Změny se použijí ihned a automaticky uloží.',language:'JAZYK',languageDetail:'Přepnutí rozhraní mezi angličtinou a češtinou.',english:'ANGLIČTINA',czech:'ČEŠTINA',crosshair:'PRŮHLEDNOST ZAMĚŘOVAČE',crosshairDetail:'Nastavení viditelnosti zaměřovače uprostřed.',compass:'KOMPAS',compassDetail:'Zobrazí navigační lištu nahoře.',sensitivityX:'HORIZONTÁLNÍ CITLIVOST',sensitivityXDetail:'Rychlost pohledu myší na ose X.',sensitivityY:'VERTIKÁLNÍ CITLIVOST',sensitivityYDetail:'Rychlost pohledu myší na ose Y.',invertY:'INVERTOVAT Y',invertYDetail:'Obrátí vertikální pohyb myši.',headBob:'POHYB HLAVY',headBobDetail:'Jemný pohyb kamery při chůzi.',cameraShake:'OTŘES KAMERY',cameraShakeDetail:'Jemná odezva kamery při sprintu a pohybu.',keybinds:'KLÁVESOVÉ ZKRATKY',forward:'POHYB VPŘED',backward:'POHYB VZAD',left:'POHYB VLEVO',right:'POHYB VPRAVO',sprint:'SPRINT',jump:'SKOK',crouch:'PŘIKRČENÍ',interact:'INTERAKCE',inventory:'INVENTÁŘ',build:'REŽIM STAVĚNÍ',rotate:'OTOČIT STAVBU',cycleBuild:'DALŠÍ DÍL STAVBY',use:'POUŽÍT PŘEDMĚT',map:'MAPA',maintenance:'ÚDRŽBA STAVBY',fov:'FOV SVĚTA',fovDetail:'Zorné pole hlavní kamery.',viewmodelFov:'FOV RUKOU',viewmodelFovDetail:'Zorné pole rukou a držených nástrojů.',motionBlur:'ROZMAZÁNÍ POHYBU',motionBlurDetail:'Lehké rozmazání při rychlém pohybu.',quality:'GRAFICKÝ PROFIL',qualityDetail:'Rychlé nastavení kvality vykreslování.',renderScale:'MĚŘÍTKO RENDERU',renderScaleDetail:'Při nízkém FPS sniž nejdřív tuto hodnotu.',shadows:'DYNAMICKÉ STÍNY',shadowsDetail:'Vypnutí výrazně uleví grafické kartě.',low:'NÍZKÁ',medium:'STŘEDNÍ',high:'VYSOKÁ',ultra:'ULTRA',masterVolume:'HLAVNÍ HLASITOST',masterVolumeDetail:'Celková hlasitost hry.',musicVolume:'HLASITOST HUDBY',musicVolumeDetail:'Atmosférická hudební vrstva.',effectsVolume:'HLASITOST EFEKTŮ',effectsVolumeDetail:'Nástroje, kroky, UI a interakce.',ambientVolume:'HLASITOST PROSTŘEDÍ',ambientVolumeDetail:'Vítr, déšť a zvuky světa.',resetCamera:'RESET KAMERY',resetSettings:'RESET NASTAVENÍ',reloadBuild:'NAČÍST NEJNOVĚJŠÍ VERZI',localSettings:'MÍSTNÍ NASTAVENÍ',localSettingsDetail:'Reset ovládání a vzhledu pro toto zařízení.',localSaveData:'MÍSTNÍ ULOŽENÍ',localSaveDataDetail:'Odstraní uložený ostrov a postup.',resetSave:'SMAZAT ULOŽENÍ',deleteSave:'SMAZAT SVĚT',cancel:'ZRUŠIT',newGameWarning:'SPUSTIT NOVÝ SVĚT?',newGameWarningDetail:'Aktuální místní svět bude nahrazen při příštím uložení nové hry.',newGameConfirm:'SPUSTIT NOVÝ SVĚT',health:'ZDRAVÍ',water:'VODA',food:'JÍDLO',stamina:'VÝDRŽ',wet:'MOKRO',cold:'ZIMA',crafting:'VÝROBA',ready:'HOTOVO',emptyHands:'PRÁZDNÉ RUCE',pressKey:'STISKNĚTE KLÁVESU…',open:'OTEVŘÍT',close:'ZAVŘÍT',pickUp:'SEBRAT',authorize:'AUTORIZOVAT',useAction:'POUŽÍT',gather:'TĚŽIT',drink:'NAPÍT SE',depleted:'VYTĚŽENO',menu:'MENU',on:'ZAP',off:'VYP'
};
export function t(language:Language,key:TranslationKey):string{return (language==='cs'?cs:en)[key];}
export function keyLabel(code:string):string{const names:Record<string,string>={Space:'SPACE',Tab:'TAB',ShiftLeft:'L SHIFT',ShiftRight:'R SHIFT',ControlLeft:'L CTRL',ControlRight:'R CTRL',Escape:'ESC',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Backquote:'`'};if(names[code])return names[code];if(code.startsWith('Key'))return code.slice(3);if(code.startsWith('Digit'))return code.slice(5);return code.replace(/Left$/,' L').replace(/Right$/,' R').toUpperCase();}
''')

# --- UI: menu, pause, tabbed settings, language, remapping -----------------
p='src/ui/UI.ts'
s=read(p)
s=replace_once(s,
"import type { GameState, HUDData, ItemId, ItemStack, PieceType, ResourceNode, Screen, Settings, UIActions } from '../core/types';",
"import type { GameState, HUDData, ItemId, ItemStack, KeybindAction, PieceType, ResourceNode, Screen, Settings, UIActions } from '../core/types';",p)
s=replace_once(s,"import './style.css';","import {keyLabel,t,type TranslationKey} from './i18n';\nimport './style.css';",p)
s=replace_once(s,"  private settings: Settings = {...DEFAULT_SETTINGS};","  private settings: Settings = {...DEFAULT_SETTINGS,keybinds:{...DEFAULT_SETTINGS.keybinds}};",p)
s=replace_once(s,"  private resourceFeedbackTimer = 0;","  private resourceFeedbackTimer = 0;\n  private saveAvailable=false;\n  private settingsTab:'gameplay'|'controls'|'graphics'|'audio'='gameplay';\n  private rebinding:KeybindAction|null=null;",p)

menu=r'''      <section class="screen menu-screen menu-v3" data-view="menu" aria-label="Main menu">
        <div class="menu-v3-scrim"></div>
        <header class="menu-v3-top"><div class="menu-v3-brand">${mark}<span>TIDELAND<small>EARLY ACCESS · ${GAME_BUILD}</small></span></div><div class="menu-language"><button data-language="en">EN</button><button data-language="cs">CZ</button></div></header>
        <main class="menu-v3-panel"><div class="eyebrow"><span></span><b data-i18n="survivalExperience">OPEN WORLD SURVIVAL</b></div><h1>TIDELAND<span>.</span></h1><p class="menu-v3-tagline" data-i18n="menuTagline">Build, survive and make the island yours.</p>
          <button class="hero-play" data-action="play"><span data-i18n="play">PLAY</span>${chevron}</button>
          <div class="play-panel" hidden><div class="play-panel-head"><strong data-i18n="playGame">PLAY GAME</strong><small>LOCAL · SOLO</small></div>
            <button class="play-choice" data-action="new"><span>01</span><strong data-i18n="newGame">NEW GAME</strong>${chevron}</button>
            <button class="play-choice continue-game" data-action="continue" disabled><span>02</span><strong data-i18n="continue">CONTINUE</strong><small class="continue-meta" data-i18n="noSave">NO SAVED WORLD</small>${chevron}</button>
            <button class="play-choice load-game" data-action="load" disabled><span>03</span><strong data-i18n="load">LOAD</strong><small data-i18n="localSave">LOCAL SAVE</small>${chevron}</button>
            <div class="seed-control menu-v3-seed"><label for="world-seed" data-i18n="worldSeed">WORLD SEED</label><input id="world-seed" type="text" inputmode="numeric" maxlength="10" placeholder="731942" aria-label="World seed"><span data-i18n="proceduralIsland">PROCEDURAL ISLAND</span></div>
          </div>
          <nav class="menu-v3-secondary"><button data-action="settings"><span data-i18n="settings">SETTINGS</span></button><button data-action="history"><span data-i18n="history">HISTORY</span><small>v${GAME_VERSION}</small></button><button data-action="help"><span data-i18n="controls">CONTROLS</span></button></nav>
        </main>
        <footer class="menu-v3-footer"><span>v${GAME_VERSION} · ${GAME_BUILD}</span><span>LOCAL WORLD · SOLO</span></footer>
      </section>

'''
start='      <section class="screen menu-screen" data-view="menu" aria-label="Main menu">'
end='      <section class="screen game-screen" data-view="playing" aria-label="Gameplay interface">'
s=replace_between(s,start,end,menu+end,p)

pause=r'''      <section class="screen modal-screen pause-screen pause-v3" data-view="pause" aria-label="Pause menu"><div class="pause-v3-panel"><div class="eyebrow">TIDELAND · ${GAME_BUILD}</div><h2 data-i18n="paused">PAUSED</h2><p data-i18n="pauseDesc">The island can wait.</p><nav class="pause-nav"><button class="primary-button" data-action="resume"><span data-i18n="returnWorld">RETURN TO WORLD</span>${chevron}</button><button data-action="save"><span data-i18n="saveWorld">SAVE WORLD</span><small data-i18n="localSave">LOCAL SAVE</small></button><button data-action="settings"><span data-i18n="settings">SETTINGS</span>${chevron}</button><button data-action="menu"><span data-i18n="mainMenu">MAIN MENU</span>${chevron}</button></nav><div class="pause-footnote"><i></i><span data-i18n="simulationPaused">Simulation paused</span></div></div></section>

'''
start='      <section class="screen modal-screen pause-screen" data-view="pause" aria-label="Pause menu">'
end='      <section class="screen settings-screen" data-view="settings" aria-label="Settings">'
s=replace_between(s,start,end,pause+end,p)

settings=r'''      <section class="screen settings-screen settings-v3" data-view="settings" aria-label="Settings">
        <header class="overlay-header settings-v3-header"><div class="small-brand">${mark}<span>TIDELAND</span><i>/</i><span class="muted" data-i18n="settings">SETTINGS</span></div><button class="close-button" data-action="settingsBack"><span data-i18n="back">BACK</span> <b>×</b></button></header>
        <div class="settings-v3-shell"><aside class="settings-sidebar"><div><span class="eyebrow">TIDELAND</span><h2 data-i18n="settingsTitle">GAME SETTINGS</h2><p data-i18n="settingsSubtitle">Changes apply immediately and save automatically.</p></div><nav><button class="active" data-settings-tab="gameplay"><span>01</span><b data-i18n="gameplay">GAMEPLAY</b></button><button data-settings-tab="controls"><span>02</span><b data-i18n="controls">CONTROLS</b></button><button data-settings-tab="graphics"><span>03</span><b data-i18n="graphics">GRAPHICS</b></button><button data-settings-tab="audio"><span>04</span><b data-i18n="audio">AUDIO</b></button></nav><small>v${GAME_VERSION} · ${GAME_BUILD}</small></aside>
          <main class="settings-pages">
            <section class="settings-page active" data-settings-page="gameplay"><div class="settings-page-title"><span>01</span><h3 data-i18n="gameplay">GAMEPLAY</h3></div>
              <div class="setting-row toggle-row"><label><span data-i18n="language">LANGUAGE</span><small data-i18n="languageDetail">Switch the interface between English and Czech.</small></label><div class="language-options"><button data-language="en">EN</button><button data-language="cs">CZ</button></div></div>
              ${this.slider('crosshairOpacity','crosshair','crosshairDetail',0,1,0.05)}${this.toggle('showCompass','compass','compassDetail')}
              <div class="setting-row setting-buttons"><label><span data-i18n="localSettings">LOCAL SETTINGS</span><small data-i18n="localSettingsDetail">Reset device-specific controls and presentation.</small></label><div><button data-action="resetSettings" data-i18n="resetSettings">RESET SETTINGS</button><button data-action="reloadBuild" data-i18n="reloadBuild">RELOAD LATEST BUILD</button></div></div>
              <div class="save-reset-row"><span><b data-i18n="localSaveData">LOCAL SAVE DATA</b><small data-i18n="localSaveDataDetail">Remove your saved island and progress.</small></span><button class="danger-button" data-action="reset" data-i18n="resetSave">RESET SAVE</button></div><div class="reset-confirm" hidden><span data-i18n="localSaveDataDetail">Remove your saved island and progress.</span><button data-action="resetConfirm" data-i18n="deleteSave">DELETE SAVE</button><button data-action="resetCancel" data-i18n="cancel">CANCEL</button></div>
            </section>
            <section class="settings-page" data-settings-page="controls"><div class="settings-page-title"><span>02</span><h3 data-i18n="controls">CONTROLS</h3></div>
              ${this.slider('sensitivityX','sensitivityX','sensitivityXDetail',0.05,2.5,0.05)}${this.slider('sensitivityY','sensitivityY','sensitivityYDetail',0.05,2.5,0.05)}${this.toggle('invertY','invertY','invertYDetail')}${this.toggle('headBob','headBob','headBobDetail')}${this.toggle('cameraShake','cameraShake','cameraShakeDetail')}
              <div class="settings-subheading"><span data-i18n="keybinds">KEY BINDINGS</span><small>CLICK A KEY TO REMAP</small></div><div class="keybind-grid">${this.keybindRows()}</div><div class="settings-actions"><button data-action="resetCamera" data-i18n="resetCamera">RESET CAMERA</button></div>
            </section>
            <section class="settings-page" data-settings-page="graphics"><div class="settings-page-title"><span>03</span><h3 data-i18n="graphics">GRAPHICS</h3></div>
              <div class="setting-row quality-row"><label><span data-i18n="quality">GRAPHICS PRESET</span><small data-i18n="qualityDetail">One-click rendering quality profile.</small></label><div class="quality-options"><button data-preset="low" data-i18n="low">LOW</button><button data-preset="medium" data-i18n="medium">MEDIUM</button><button data-preset="high" data-i18n="high">HIGH</button><button data-preset="ultra" data-i18n="ultra">ULTRA</button></div></div>
              ${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}${this.toggle('shadows','shadows','shadowsDetail')}${this.toggle('motionBlur','motionBlur','motionBlurDetail')}
            </section>
            <section class="settings-page" data-settings-page="audio"><div class="settings-page-title"><span>04</span><h3 data-i18n="audio">AUDIO</h3></div>
              ${this.slider('masterVolume','masterVolume','masterVolumeDetail',0,1,0.01)}${this.slider('musicVolume','musicVolume','musicVolumeDetail',0,1,0.01)}${this.slider('effectsVolume','effectsVolume','effectsVolumeDetail',0,1,0.01)}${this.slider('ambientVolume','ambientVolume','ambientVolumeDetail',0,1,0.01)}
            </section>
          </main>
        </div>
      </section>

      <div class="confirm-overlay new-game-confirm" hidden><div class="confirm-card"><span class="eyebrow">LOCAL SAVE</span><h2 data-i18n="newGameWarning">START A NEW WORLD?</h2><p data-i18n="newGameWarningDetail">Your current local world will be replaced the next time the new world is saved.</p><div><button class="danger-button" data-action="confirmNew" data-i18n="newGameConfirm">START NEW WORLD</button><button data-action="cancelNew" data-i18n="cancel">CANCEL</button></div></div></div>

'''
start='      <section class="screen settings-screen" data-view="settings" aria-label="Settings">'
end='      <section class="screen dead-screen modal-screen" data-view="dead" aria-label="Death screen">'
s=replace_between(s,start,end,settings+end,p)

s=replace_once(s,"    this.bindEvents();\n    this.setSettings(this.settings);","    this.bindEvents();\n    this.setSettings(this.settings);\n    this.applyLanguage();",p)

# replace setSettings through setSaveAvailable boundary
start='  setSettings(settings: Settings): void {'
end='  setSaveAvailable(available: boolean): void {'
new_set=r'''  setSettings(settings: Settings): void {
    this.settings={...settings,keybinds:{...settings.keybinds}};
    for (const name of ['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','crosshairOpacity'] as const) {
      const input=this.root.querySelector<HTMLInputElement>(`input[data-setting="${name}"]`);if(!input)continue;
      input.value=String(settings[name]);const output=this.root.querySelector<HTMLElement>(`[data-setting-value="${name}"]`);if(output)output.textContent=this.settingValue(name,settings[name]);
      input.style.setProperty('--range',`${(settings[name]-Number(input.min))/(Number(input.max)-Number(input.min))*100}%`);
    }
    this.root.querySelectorAll<HTMLElement>('[data-preset]').forEach(button=>button.classList.toggle('active',button.dataset.preset===settings.quality));
    for(const name of ['invertY','headBob','cameraShake','motionBlur','shadows','showCompass'] as const)this.root.querySelectorAll<HTMLElement>(`[data-toggle="${name}"]`).forEach(button=>button.classList.toggle('active',String(settings[name])===button.dataset.value));
    this.root.querySelectorAll<HTMLElement>('[data-language]').forEach(button=>button.classList.toggle('active',button.dataset.language===settings.language));
    for(const [action,code] of Object.entries(settings.keybinds)) {const button=this.root.querySelector<HTMLButtonElement>(`[data-keybind="${action}"]`);if(button&&!button.classList.contains('rebinding'))button.textContent=keyLabel(code);}
    this.root.classList.toggle('hide-compass',!settings.showCompass);this.root.style.setProperty('--crosshair-opacity',String(settings.crosshairOpacity));this.applyLanguage();
  }

'''
s=replace_between(s,start,end,new_set+end,p)

# replace setSaveAvailable body
old="""  setSaveAvailable(available: boolean): void {\n    this.find<HTMLButtonElement>('.continue-game').disabled = !available;\n    this.find('.menu-meta').textContent = available ? 'RETURN TO YOUR ISLAND' : 'NO SAVED WORLD';\n  }"""
new="""  setSaveAvailable(available: boolean): void {\n    this.saveAvailable=available;\n    const continueButton=this.root.querySelector<HTMLButtonElement>('.continue-game'),loadButton=this.root.querySelector<HTMLButtonElement>('.load-game');if(continueButton)continueButton.disabled=!available;if(loadButton)loadButton.disabled=!available;\n    const meta=this.root.querySelector<HTMLElement>('.continue-meta');if(meta)meta.textContent=this.tx(available?'returnIsland':'noSave');\n  }"""
s=replace_once(s,old,new,p)

# translate interaction action and resource labels / crafting / empty hands
s=replace_once(s,"const promptHTML = interaction ? `<span class=\"interaction-key\"><kbd>${esc(interaction.key)}</kbd></span><div class=\"interaction-copy\"><strong>${esc(interaction.action)}</strong>","const promptHTML = interaction ? `<span class=\"interaction-key\"><kbd>${esc(interaction.key)}</kbd></span><div class=\"interaction-copy\"><strong>${esc(this.interactionAction(interaction.action))}</strong>",p)
s=replace_once(s,"const resourceLabels:Record<ResourceNode['kind'],string>={tree:'WOOD',wood:'WOOD',stone:'STONE',metal:'METAL ORE',fiber:'CLOTH FIBER',berries:'BERRIES'};","const resourceLabels:Record<ResourceNode['kind'],string>=this.settings.language==='cs'?{tree:'DŘEVO',wood:'DŘEVO',stone:'KÁMEN',metal:'KOVOVÁ RUDA',fiber:'VLÁKNO',berries:'BOBULE'}:{tree:'WOOD',wood:'WOOD',stone:'STONE',metal:'METAL ORE',fiber:'CLOTH FIBER',berries:'BERRIES'};",p)
s=s.replace("${resourceLabels[kind]}${depleted?' · DEPLETED':''}","${resourceLabels[kind]}${depleted?` · ${this.tx('depleted')}`:''}",1)
s=s.replace("<span>CRAFTING</span>","<span>${this.tx('crafting')}</span>",1)
s=s.replace("job.remaining<=0?'READY':", "job.remaining<=0?this.tx('ready'):",1)
s=s.replace("active ? ITEMS[active.itemId].displayName : 'EMPTY HANDS'", "active ? ITEMS[active.itemId].displayName : this.tx('emptyHands')",1)

# replace bindEvents block
start='  private bindEvents(): void {'
end='  private endDrag(): void {'
new_bind=r'''  private bindEvents(): void {
    this.root.addEventListener('keydown',event=>{
      if(this.rebinding){event.preventDefault();event.stopPropagation();const action=this.rebinding;if(event.code==='Escape'){this.finishRebind();return;}const previous=this.settings.keybinds[action];const duplicate=(Object.keys(this.settings.keybinds) as KeybindAction[]).find(key=>key!==action&&this.settings.keybinds[key]===event.code);if(duplicate)this.settings.keybinds[duplicate]=previous;this.settings.keybinds[action]=event.code;this.finishRebind(false);this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);return;}
      const target=event.target;if(target instanceof HTMLElement&&target.matches('input,select,textarea'))event.stopPropagation();
    });
    this.root.addEventListener('click',event=>{
      const target=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(!target||(target instanceof HTMLButtonElement&&target.disabled))return;event.preventDefault();
      if(target.dataset.action)this.handleAction(target.dataset.action);
      if(target.dataset.settingsTab)this.selectSettingsTab(target.dataset.settingsTab as typeof this.settingsTab);
      if(target.dataset.language)this.setLanguage(target.dataset.language==='cs'?'cs':'en');
      if(target.dataset.preset)this.setPreset(target.dataset.preset as Settings['quality']);
      if(target.dataset.keybind)this.beginRebind(target.dataset.keybind as KeybindAction,target as HTMLButtonElement);
      if(target.dataset.slot!==undefined){const slot=Number(target.dataset.slot);if(target.dataset.hotbar){this.selectedSlot=slot;this.actions.selectSlot(slot);this.inventoryHash='';if(this.state)this.renderInventory(this.state);}else{this.selectedSlot=slot;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}}
      if(target.dataset.category){this.recipeCategory=target.dataset.category;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}
      if(target.dataset.recipe){this.selectedRecipe=target.dataset.recipe;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}
      if(target.dataset.piece)this.actions.selectPiece(target.dataset.piece as PieceType);
      if(target.dataset.toggle){const name=target.dataset.toggle as 'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass';this.settings[name]=target.dataset.value==='true';this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}
      if(target.dataset.dev)this.actions.dev(target.dataset.dev);
    });
    this.root.addEventListener('input',event=>{const input=event.target as HTMLInputElement;const name=input.dataset.setting as 'sensitivityX'|'sensitivityY'|'fov'|'viewmodelFov'|'masterVolume'|'musicVolume'|'effectsVolume'|'ambientVolume'|'renderScale'|'crosshairOpacity'|undefined;if(!name)return;this.settings[name]=Number(input.value);this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);});
    this.root.addEventListener('dragstart',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(!slot||!this.state?.inventory[Number(slot.dataset.slot)])return;this.dragSlot=Number(slot.dataset.slot);this.dragSplit=event.shiftKey;event.dataTransfer?.setData('text/plain',String(this.dragSlot));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';slot.classList.add('dragging');});
    this.root.addEventListener('dragover',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(slot&&this.dragSlot>=0){event.preventDefault();slot.classList.add('drag-over');}});
    this.root.addEventListener('dragleave',event=>(event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.classList.remove('drag-over'));
    this.root.addEventListener('drop',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(slot&&this.dragSlot>=0){event.preventDefault();this.actions.moveItem(this.dragSlot,Number(slot.dataset.slot),this.dragSplit||event.shiftKey);}this.endDrag();});
    this.root.addEventListener('dragend',()=>this.endDrag());
    this.root.addEventListener('contextmenu',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(slot&&this.screen==='inventory'){event.preventDefault();this.selectedSlot=Number(slot.dataset.slot);this.splitSelected();}});
  }

'''
s=replace_between(s,start,end,new_bind+end,p)

# replace handleAction and helper block
start='  private handleAction(action: string): void {'
end='  private pieceIcon(piece: PieceType): string {'
new_helpers=r'''  private handleAction(action:string):void {
    switch(action){
      case 'respawn':this.actions.respawn();break;
      case 'play':{const panel=this.find<HTMLElement>('.play-panel');panel.hidden=!panel.hidden;break;}
      case 'new':if(this.saveAvailable)this.find<HTMLElement>('.new-game-confirm').hidden=false;else this.startNewGame();break;
      case 'confirmNew':this.find<HTMLElement>('.new-game-confirm').hidden=true;this.startNewGame();break;
      case 'cancelNew':this.find<HTMLElement>('.new-game-confirm').hidden=true;break;
      case 'continue':case 'load':this.actions.continueGame();break;
      case 'settings':this.actions.setScreen('settings');break;
      case 'settingsBack':this.actions.setScreen(this.lastSettingsScreen);break;
      case 'resume':this.actions.resume();break;case 'save':this.actions.save();break;case 'menu':this.actions.mainMenu();break;
      case 'reset':this.find('.reset-confirm').hidden=false;break;case 'resetCancel':this.find('.reset-confirm').hidden=true;break;case 'resetConfirm':this.actions.resetSave();this.find('.reset-confirm').hidden=true;this.setSaveAvailable(false);break;
      case 'resetCamera':this.settings={...this.settings,sensitivityX:DEFAULT_SETTINGS.sensitivityX,sensitivityY:DEFAULT_SETTINGS.sensitivityY,fov:DEFAULT_SETTINGS.fov,viewmodelFov:DEFAULT_SETTINGS.viewmodelFov,invertY:DEFAULT_SETTINGS.invertY,headBob:DEFAULT_SETTINGS.headBob,cameraShake:DEFAULT_SETTINGS.cameraShake,motionBlur:DEFAULT_SETTINGS.motionBlur,keybinds:{...DEFAULT_SETTINGS.keybinds}};this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);break;
      case 'resetSettings':{const language=this.settings.language;this.settings={...DEFAULT_SETTINGS,language,keybinds:{...DEFAULT_SETTINGS.keybinds}};this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);break;}
      case 'reloadBuild':{const url=new URL(window.location.href);url.searchParams.set('build',`${GAME_VERSION}-${GAME_BUILD}`);window.location.replace(url.toString());break;}
      case 'drop':this.actions.dropItem(this.selectedSlot);break;case 'consume':this.actions.consume(this.selectedSlot);break;case 'equip':this.actions.selectSlot(this.selectedSlot);this.actions.resume();break;case 'split':this.splitSelected();break;case 'craft':this.actions.craft(this.selectedRecipe);break;
      case 'history':{const panel=this.find('.history-panel');panel.hidden=!panel.hidden;if(!panel.hidden)this.find('.help-panel').hidden=true;break;}case 'help':{const panel=this.find('.help-panel');panel.hidden=!panel.hidden;if(!panel.hidden)this.find('.history-panel').hidden=true;break;}
    }
  }
  private startNewGame():void{const seedText=this.find<HTMLInputElement>('#world-seed').value.trim(),seed=seedText?Number(seedText):undefined;this.actions.newGame(seed!==undefined&&Number.isFinite(seed)?Math.floor(seed):undefined);}
  private tx(key:TranslationKey):string{return t(this.settings.language,key);}
  private applyLanguage():void{if(!this.root)return;document.documentElement.lang=this.settings.language==='cs'?'cs':'en';this.root.dataset.language=this.settings.language;this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el=>{const key=el.dataset.i18n as TranslationKey;if(key)el.textContent=this.tx(key);});this.root.querySelectorAll<HTMLElement>('[data-language]').forEach(button=>button.classList.toggle('active',button.dataset.language===this.settings.language));const h=this.root.querySelector<HTMLElement>('.vital.health div span'),w=this.root.querySelector<HTMLElement>('.vital.thirst div span'),f=this.root.querySelector<HTMLElement>('.vital.hunger div span'),st=this.root.querySelector<HTMLElement>('.stamina span');if(h)h.textContent=this.tx('health');if(w)w.textContent=this.tx('water');if(f)f.textContent=this.tx('food');if(st)st.textContent=this.tx('stamina');const wet=this.root.querySelector<HTMLElement>('.status-pill.wet'),cold=this.root.querySelector<HTMLElement>('.status-pill.cold');if(wet)wet.textContent=this.tx('wet');if(cold)cold.textContent=this.tx('cold');const caption=this.root.querySelector<HTMLElement>('.hotbar-caption');if(caption)caption.innerHTML=`<span><kbd>${keyLabel(this.settings.keybinds.inventory)}</kbd> ${this.tx('inventory')}</span><span><kbd>ESC</kbd> ${this.tx('menu')}</span>`;this.setSaveAvailable(this.saveAvailable);}
  private setLanguage(language:Settings['language']):void{if(this.settings.language===language)return;this.settings.language=language;this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}
  private selectSettingsTab(tab:typeof this.settingsTab):void{this.settingsTab=tab;this.root.querySelectorAll<HTMLElement>('[data-settings-tab]').forEach(button=>button.classList.toggle('active',button.dataset.settingsTab===tab));this.root.querySelectorAll<HTMLElement>('[data-settings-page]').forEach(page=>page.classList.toggle('active',page.dataset.settingsPage===tab));}
  private setPreset(quality:Settings['quality']):void{const presets={low:{renderScale:.7,shadows:false,motionBlur:false},medium:{renderScale:.85,shadows:true,motionBlur:false},high:{renderScale:1,shadows:true,motionBlur:false},ultra:{renderScale:1,shadows:true,motionBlur:true}} as const;Object.assign(this.settings,{quality,...presets[quality]});this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}
  private beginRebind(action:KeybindAction,button:HTMLButtonElement):void{this.finishRebind();this.rebinding=action;button.classList.add('rebinding');button.textContent=this.tx('pressKey');button.focus();}
  private finishRebind(restore=true):void{if(!this.rebinding)return;const button=this.root.querySelector<HTMLButtonElement>(`[data-keybind="${this.rebinding}"]`);if(button){button.classList.remove('rebinding');if(restore)button.textContent=keyLabel(this.settings.keybinds[this.rebinding]);}this.rebinding=null;}
  private keybindRows():string{const rows:[KeybindAction,TranslationKey][]=[['forward','forward'],['backward','backward'],['left','left'],['right','right'],['sprint','sprint'],['jump','jump'],['crouch','crouch'],['interact','interact'],['inventory','inventory'],['build','build'],['rotate','rotate'],['cycleBuild','cycleBuild'],['use','use'],['map','map'],['maintenance','maintenance']];return rows.map(([action,label])=>`<div class="keybind-row"><span data-i18n="${label}">${esc(this.tx(label))}</span><button data-keybind="${action}">${keyLabel(this.settings.keybinds[action])}</button></div>`).join('');}
  private interactionAction(action:string):string{const clean=action.toUpperCase();if(clean.startsWith('PICK UP'))return `${this.tx('pickUp')}${action.slice(7)}`;const map:Record<string,TranslationKey>={OPEN:'open',CLOSE:'close',AUTHORIZE:'authorize',USE:'useAction',GATHER:'gather','DRINK FRESH WATER':'drink'};return map[clean]?this.tx(map[clean]):action;}
  private slider(name:string,label:TranslationKey,detail:TranslationKey,min:number,max:number,step:number):string{return `<div class="setting-row"><label for="setting-${name}"><span data-i18n="${label}">${esc(this.tx(label))}</span><small data-i18n="${detail}">${esc(this.tx(detail))}</small></label><div class="setting-slider"><input id="setting-${name}" data-setting="${name}" type="range" min="${min}" max="${max}" step="${step}"><output data-setting-value="${name}"></output></div></div>`;}
  private toggle(name:'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass',label:TranslationKey,detail:TranslationKey):string{return `<div class="setting-row toggle-row"><label><span data-i18n="${label}">${esc(this.tx(label))}</span><small data-i18n="${detail}">${esc(this.tx(detail))}</small></label><div class="toggle-options"><button data-toggle="${name}" data-value="false"><span data-i18n="off">OFF</span></button><button data-toggle="${name}" data-value="true"><span data-i18n="on">ON</span></button></div></div>`;}
  private settingValue(name:string,value:number):string{if(name.includes('Volume')||name==='crosshairOpacity')return `${Math.round(value*100)}%`;if(name==='fov'||name==='viewmodelFov')return `${Math.round(value)}°`;if(name==='renderScale')return `${Math.round(value*100)}%`;if(name==='sensitivityX'||name==='sensitivityY')return `${value.toFixed(2)}×`;return `${value.toFixed(1)}×`;}

'''
s=replace_between(s,start,end,new_helpers+end,p)
write(p,s)

# --- app: actual remapped controls, presets, shake and motion blur ----------
p='src/app/GameApp.ts'
s=read(p)
s=replace_once(s,"import {UI} from '../ui/UI';","import {UI} from '../ui/UI';\nimport {keyLabel} from '../ui/i18n';",p)
s=replace_once(s,"    if((code==='KeyM'||code==='Escape')&&this.islandMap?.isOpen){this.islandMap.close();this.setScreen('playing');return;}\n    if(code==='KeyM'&&this.screen==='playing'){this.islandMap.show();this.setScreen('station');return;}","    const keys=this.settings.keybinds;\n    if((code===keys.map||code==='Escape')&&this.islandMap?.isOpen){this.islandMap.close();this.setScreen('playing');return;}\n    if(code===keys.map&&this.screen==='playing'){this.islandMap.show();this.setScreen('station');return;}",p)
s=s.replace("if(code==='KeyG'&&this.screen==='playing')","if(code===keys.maintenance&&this.screen==='playing')",1)
s=s.replace("if(code==='Tab')","if(code===keys.inventory)",1)
s=s.replace("if(code==='Space')this.player.jump();","if(code===keys.jump)this.player.jump();",1)
s=s.replace("if(code==='KeyE')this.interactions.trigger();","if(code===keys.interact)this.interactions.trigger();",1)
s=s.replace("if(code==='KeyB')this.toggleBuild();","if(code===keys.build)this.toggleBuild();",1)
s=s.replace("if(code==='KeyR'&&(this.building||this.stationPlacement))","if(code===keys.rotate&&(this.building||this.stationPlacement))",1)
s=s.replace("if(code==='KeyQ'&&this.building)","if(code===keys.cycleBuild&&this.building)",1)
s=s.replace("if(code==='KeyF'){","if(code===keys.use){",1)
# dynamic key labels in interactions
s=s.replace("key:'E',detail:'A little kindness left behind.'","key:keyLabel(this.settings.keybinds.interact),detail:'A little kindness left behind.'",1)
s=s.replace("key:['fiber','berries','wood'].includes(node.kind)?'E':'LMB'","key:['fiber','berries','wood'].includes(node.kind)?keyLabel(this.settings.keybinds.interact):'LMB'",1)
s=s.replace("key:'E'}),interact:()=>{if(this.simulation.toggleDoor", "key:keyLabel(this.settings.keybinds.interact)}),interact:()=>{if(this.simulation.toggleDoor",1)
s=s.replace("key:'E'}),interact:()=>{if(this.simulation.pickup", "key:keyLabel(this.settings.keybinds.interact)}),interact:()=>{if(this.simulation.pickup",1)
s=s.replace("action:'OPEN',key:'E'}),interact:()=>{this.openStation", "action:'OPEN',key:keyLabel(this.settings.keybinds.interact)}),interact:()=>{this.openStation",1)
# weather quality mapping
s=s.replace("this.camera.position,this.settings.quality);","this.camera.position,this.settings.quality==='ultra'?'high':this.settings.quality);",1)
# applySettings whole line
old="  private applySettings(s:Settings){this.settings={...s};this.projection.setBaseFov(s.fov);saveSettings(s);this.ui?.setSettings(s);this.audio?.setSettings(s);this.player?.setSettings(s);this.held.setFov(s.viewmodelFov);const qualityDpr=s.quality==='low'?1:s.quality==='medium'?Math.min(devicePixelRatio,1.25):Math.min(devicePixelRatio,1.6);this.renderer.setPixelRatio(Math.max(.5,qualityDpr*s.renderScale));this.renderer.shadowMap.enabled=s.shadows&&s.quality!=='low';this.environment?.setQuality(s.quality);this.resize();}"
new="  private applySettings(s:Settings){this.settings={...s,keybinds:{...s.keybinds}};this.projection.setBaseFov(s.fov);saveSettings(s);this.ui?.setSettings(s);this.audio?.setSettings(s);this.player?.setSettings(s);this.held.setFov(s.viewmodelFov);const qualityDpr=s.quality==='low'?1:s.quality==='medium'?Math.min(devicePixelRatio,1.25):s.quality==='high'?Math.min(devicePixelRatio,1.6):Math.min(devicePixelRatio,2);this.renderer.setPixelRatio(Math.max(.5,qualityDpr*s.renderScale));this.renderer.shadowMap.enabled=s.shadows&&s.quality!=='low';this.environment?.setQuality(s.quality==='ultra'?'high':s.quality);this.resize();}"
s=replace_once(s,old,new,p)
# render-only camera shake / lightweight motion blur
old="    this.renderer.info.autoReset=false;this.renderer.info.reset();\n    this.renderer.render(this.scene,this.camera);if(playing)this.held.render(this.renderer);"
new="    this.renderer.info.autoReset=false;this.renderer.info.reset();\n    const px=this.camera.position.x,py=this.camera.position.y,pz=this.camera.position.z,rx=this.camera.rotation.x,ry=this.camera.rotation.y,rz=this.camera.rotation.z;\n    if(playing&&this.settings.cameraShake){const speed=Math.min(1,this.player.speed/7.1),kick=this.player.sprinting?.0045:.0015;this.camera.position.x+=Math.sin(this.elapsed*13.7)*kick*speed;this.camera.position.y+=Math.sin(this.elapsed*19.1)*kick*.55*speed;this.camera.rotation.z+=Math.sin(this.elapsed*10.3)*kick*.6*speed;}\n    const blur=this.settings.motionBlur&&playing?Math.min(.55,Math.max(0,(this.player.speed-2)*.09)):0;this.canvas.classList.toggle('motion-blur-active',blur>.02);this.canvas.style.setProperty('--motion-blur',`${blur.toFixed(2)}px`);\n    this.renderer.render(this.scene,this.camera);this.camera.position.set(px,py,pz);this.camera.rotation.set(rx,ry,rz,'YXZ');if(playing)this.held.render(this.renderer);"
s=replace_once(s,old,new,p)
write(p,s)

# --- CSS layer ---------------------------------------------------------------
p='src/ui/style.css'
s=read(p)
s += r'''

/* Tideland v0.3.0 — game menu/settings system */
#game-canvas{transition:filter .08s linear;will-change:filter}#game-canvas.motion-blur-active{filter:blur(var(--motion-blur,.25px));transform:scale(1.002)}
.menu-v3{background:linear-gradient(90deg,rgba(3,10,10,.72) 0%,rgba(3,10,10,.42) 42%,rgba(3,10,10,.08) 75%);overflow:hidden}.menu-v3-scrim{position:absolute;inset:0;background:radial-gradient(circle at 70% 45%,transparent 0 28%,rgba(3,9,9,.22) 60%,rgba(3,9,9,.7) 100%);pointer-events:none}.menu-v3-top{position:absolute;z-index:2;top:0;left:0;right:0;padding:30px 38px;display:flex;justify-content:space-between;align-items:center}.menu-v3-brand{display:flex;align-items:center;gap:14px;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.12em}.menu-v3-brand svg{width:34px;height:34px;fill:var(--accent,#c9cfb9)}.menu-v3-brand span{font-size:18px;line-height:1}.menu-v3-brand small{display:block;margin-top:5px;font-size:10px;opacity:.5;font-weight:500}.menu-language,.language-options{display:flex;gap:4px;background:rgba(4,10,10,.52);padding:4px;border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(14px)}.menu-language button,.language-options button{min-width:44px;padding:8px 10px;border:0;background:transparent;color:rgba(255,255,255,.55);font:600 12px 'Barlow Condensed';letter-spacing:.12em}.menu-language button.active,.language-options button.active{background:#d6d9ca;color:#111815}.menu-v3-panel{position:absolute;z-index:2;left:7vw;top:50%;transform:translateY(-48%);width:min(520px,78vw);padding:34px 38px 30px;background:linear-gradient(135deg,rgba(8,16,15,.88),rgba(8,16,15,.67));border:1px solid rgba(255,255,255,.1);box-shadow:0 32px 80px rgba(0,0,0,.34);backdrop-filter:blur(18px)}.menu-v3-panel h1{font:700 clamp(70px,9vw,132px)/.78 'Barlow Condensed';letter-spacing:-.045em;margin:18px 0 12px}.menu-v3-panel h1 span{color:#b6bf75}.menu-v3-tagline{max-width:370px;margin:0 0 28px;color:rgba(240,242,233,.7);font-size:15px}.hero-play{width:100%;height:74px;border:0;background:#cad175;color:#111710;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font:700 28px 'Barlow Condensed';letter-spacing:.1em;cursor:pointer;transition:.18s transform,.18s background}.hero-play:hover{transform:translateX(4px);background:#dde492}.hero-play svg{width:24px;stroke:currentColor;fill:none;stroke-width:2}.play-panel{margin-top:10px;background:rgba(4,10,10,.86);border:1px solid rgba(255,255,255,.08)}.play-panel[hidden]{display:none}.play-panel-head{padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;color:rgba(255,255,255,.55);font:600 11px 'Barlow Condensed';letter-spacing:.12em}.play-choice{width:100%;display:grid;grid-template-columns:34px 1fr auto 18px;align-items:center;gap:8px;padding:14px 15px;border:0;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;color:#eef0e7;text-align:left;cursor:pointer}.play-choice>span{opacity:.38}.play-choice strong{font:600 18px 'Barlow Condensed';letter-spacing:.06em}.play-choice small{opacity:.45;font-size:10px}.play-choice svg{width:17px;stroke:currentColor;fill:none}.play-choice:hover:not(:disabled){background:rgba(255,255,255,.07)}.play-choice:disabled{opacity:.34;cursor:not-allowed}.menu-v3-seed{margin:12px 14px 14px}.menu-v3-secondary{display:flex;gap:18px;margin-top:20px}.menu-v3-secondary button{border:0;background:none;color:rgba(255,255,255,.68);font:600 12px 'Barlow Condensed';letter-spacing:.12em;padding:0;cursor:pointer}.menu-v3-secondary button:hover{color:#fff}.menu-v3-secondary small{margin-left:5px;opacity:.45}.menu-v3-footer{position:absolute;z-index:2;left:38px;right:38px;bottom:25px;display:flex;justify-content:space-between;font:500 10px 'Barlow Condensed';letter-spacing:.13em;color:rgba(255,255,255,.4)}
.pause-v3{background:rgba(2,7,7,.42);backdrop-filter:blur(7px)}.pause-v3-panel{width:min(430px,86vw);padding:36px;background:rgba(8,15,14,.91);border:1px solid rgba(255,255,255,.1);box-shadow:0 30px 90px rgba(0,0,0,.4)}.pause-v3-panel h2{font:700 66px/.9 'Barlow Condensed';margin:14px 0 8px}.pause-v3-panel>p{color:rgba(255,255,255,.58);margin:0 0 25px}.pause-v3 .pause-nav{display:grid;gap:6px}.pause-v3 .pause-nav button{min-height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 17px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);color:#f2f3ed}.pause-v3 .pause-nav button.primary-button{background:#cad175;color:#111710}.pause-v3 .pause-nav small{font-size:9px;opacity:.5}.pause-v3 .pause-nav svg{width:17px;stroke:currentColor;fill:none}
.settings-v3{background:rgba(4,9,9,.88);backdrop-filter:blur(14px);overflow:auto}.settings-v3-header{position:sticky;top:0;z-index:5;background:rgba(4,9,9,.82);backdrop-filter:blur(16px)}.settings-v3-shell{min-height:calc(100vh - 74px);display:grid;grid-template-columns:290px minmax(0,1fr);max-width:1380px;margin:0 auto;padding:34px 34px 70px;gap:34px}.settings-sidebar{position:sticky;top:110px;height:fit-content;padding:28px 24px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}.settings-sidebar h2{font:700 38px/1 'Barlow Condensed';margin:10px 0}.settings-sidebar p{font-size:12px;line-height:1.45;color:rgba(255,255,255,.48)}.settings-sidebar nav{display:grid;gap:4px;margin:28px 0}.settings-sidebar nav button{display:grid;grid-template-columns:26px 1fr;text-align:left;padding:13px 12px;border:0;background:transparent;color:rgba(255,255,255,.55)}.settings-sidebar nav button span{opacity:.4}.settings-sidebar nav button b{font:600 14px 'Barlow Condensed';letter-spacing:.1em}.settings-sidebar nav button.active{background:rgba(202,209,117,.12);color:#e5e9bb;border-left:2px solid #cad175}.settings-sidebar>small{font:500 10px 'Barlow Condensed';letter-spacing:.1em;opacity:.35}.settings-pages{min-width:0}.settings-page{display:none}.settings-page.active{display:block}.settings-page-title{display:flex;align-items:end;gap:14px;padding:8px 0 20px;border-bottom:1px solid rgba(255,255,255,.09);margin-bottom:5px}.settings-page-title span{font:500 11px 'Barlow Condensed';opacity:.35}.settings-page-title h3{margin:0;font:700 34px 'Barlow Condensed';letter-spacing:.05em}.settings-v3 .setting-row{display:grid;grid-template-columns:minmax(220px,1fr) minmax(280px,1fr);align-items:center;gap:24px;padding:18px 4px;border-bottom:1px solid rgba(255,255,255,.065)}.settings-v3 .setting-row label>span,.settings-v3 .setting-row label{font:600 13px 'Barlow Condensed';letter-spacing:.08em}.settings-v3 .setting-row label small{display:block;margin-top:5px;font:400 12px 'Barlow',sans-serif;letter-spacing:0;color:rgba(255,255,255,.42)}.settings-subheading{display:flex;justify-content:space-between;align-items:center;margin:28px 0 10px;font:600 13px 'Barlow Condensed';letter-spacing:.1em}.settings-subheading small{font-size:9px;opacity:.35}.keybind-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.keybind-row{display:grid;grid-template-columns:1fr 110px;align-items:center;padding:10px 12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055)}.keybind-row span{font:500 11px 'Barlow Condensed';letter-spacing:.08em;color:rgba(255,255,255,.62)}.keybind-row button{height:34px;border:1px solid rgba(255,255,255,.14);background:#111a18;color:#e8eadf;font:600 11px 'Barlow Condensed';letter-spacing:.08em}.keybind-row button.rebinding{border-color:#cad175;color:#cad175;animation:keypulse .8s infinite alternate}@keyframes keypulse{to{box-shadow:0 0 0 3px rgba(202,209,117,.08)}}.quality-options{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.quality-options button,.toggle-options button{min-height:38px}.quality-options button.active,.toggle-options button.active{background:#cad175!important;color:#101610!important}.settings-v3 .settings-actions{margin:18px 0}.settings-v3 .save-reset-row{margin-top:22px}.confirm-overlay{position:fixed;inset:0;z-index:900;display:grid;place-items:center;background:rgba(1,5,5,.72);backdrop-filter:blur(10px)}.confirm-overlay[hidden]{display:none}.confirm-card{width:min(480px,88vw);padding:32px;background:#0d1614;border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 100px rgba(0,0,0,.5)}.confirm-card h2{font:700 42px 'Barlow Condensed';margin:12px 0}.confirm-card p{color:rgba(255,255,255,.55);line-height:1.55}.confirm-card>div{display:flex;gap:8px;margin-top:24px}.confirm-card button{min-height:44px;padding:0 16px}
@media(max-width:820px){.menu-v3-panel{left:4vw;width:92vw;padding:25px}.menu-v3-top{padding:20px}.menu-v3-footer{left:20px;right:20px}.settings-v3-shell{grid-template-columns:1fr;padding:18px}.settings-sidebar{position:static}.settings-sidebar nav{grid-template-columns:repeat(4,1fr)}.settings-sidebar nav button{display:block;text-align:center}.settings-sidebar nav button span{display:none}.settings-v3 .setting-row{grid-template-columns:1fr;gap:10px}.keybind-grid{grid-template-columns:1fr}.quality-options{grid-template-columns:repeat(2,1fr)}}
'''
write(p,s)

# --- version / changelog ----------------------------------------------------
p='src/config/version.ts'
s=read(p)
s=s.replace("export const GAME_VERSION='0.2.4';","export const GAME_VERSION='0.3.0';",1).replace("export const GAME_BUILD='EA-02.4';","export const GAME_BUILD='EA-03';",1)
marker="export const CHANGELOG:ChangeEntry[]=[\n"
entry="""export const CHANGELOG:ChangeEntry[]=[\n  {version:'0.3.0',date:'2026-09-11',title:'Game menu, settings & Czech localization',changes:[\n    'Rebuilt the main and pause menus as a full-screen game interface over the live world with a prominent Play flow.',\n    'Added Play Game with New Game, Continue and Load actions plus a confirmation step before replacing an existing world.',\n    'Split settings into Gameplay, Controls, Graphics and Audio pages.',\n    'Added real keybind remapping and separate horizontal/vertical mouse sensitivity.',\n    'Added camera shake and motion-blur toggles alongside world and viewmodel FOV and head bob.',\n    'Added Low, Medium, High and Ultra graphics presets.',\n    'Added independent Master, Music, Effects and Ambient audio channels.',\n    'Added persistent English/Czech interface switching across the main game menus and common HUD labels.'\n  ]},\n"""
s=replace_once(s,marker,entry,p)
write(p,s)

p='CHANGELOG.md';s=read(p);head="# Tideland changelog\n\n";section="""## 0.3.0 — 2026-09-11\n\nGame menu, settings and Czech localization update.\n\n- Rebuilt the main menu as a full-screen game surface over the live island with a dark translucent panel and prominent Play action.\n- Added `PLAY GAME → NEW GAME / CONTINUE / LOAD` and a safety confirmation before starting over an existing local world.\n- Split settings into Gameplay, Controls, Graphics and Audio pages.\n- Added functional keybind remapping and independent horizontal/vertical mouse sensitivity.\n- Added world/viewmodel FOV, head bob, camera shake and lightweight motion blur controls.\n- Added Low, Medium, High and Ultra graphics presets.\n- Added independent Master, Music, Effects and Ambient volume controls.\n- Added persistent EN/CZ language switching for the main menus, settings and common HUD labels/actions.\n\n""";s=replace_once(s,head,head+section,p);write(p,s)

# package versions
for p in ['package.json','package-lock.json']:
    data=json.loads(read(p));data['version']='0.3.0';
    if p.endswith('lock.json') and isinstance(data.get('packages'),dict) and '' in data['packages']:data['packages']['']['version']='0.3.0'
    write(p,json.dumps(data,indent=2)+"\n")

print('Tideland v0.3.0 menu/settings/i18n patch applied')
