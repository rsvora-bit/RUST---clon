from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    write(path, text)

def regex_once(path, pattern, repl):
    text = read(path)
    out, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'pattern count {count} in {path}: {pattern[:120]!r}')
    write(path, out)

# --- Settings model -------------------------------------------------------
replace_once('src/core/types.ts',
"export type GraphicsQuality = 'low'|'medium'|'high'|'ultra';",
"export type GraphicsQuality = 'low'|'medium'|'high'|'ultra';\nexport type ShadowQuality = 'low'|'medium'|'high';")
replace_once('src/core/types.ts',
"export interface Settings {language:Language; sensitivityX:number; sensitivityY:number; fov:number; viewmodelFov:number; invertY:boolean; headBob:boolean; cameraShake:boolean; motionBlur:boolean; masterVolume:number; musicVolume:number; effectsVolume:number; ambientVolume:number; quality:GraphicsQuality; renderScale:number; shadows:boolean; crosshairOpacity:number; crosshairScale:number; hudScale:number; hudOpacity:number; brightness:number; showCompass:boolean; showFps:boolean; showTutorialHints:boolean; keybinds:Keybinds}",
"export interface Settings {language:Language; sensitivityX:number; sensitivityY:number; fov:number; viewmodelFov:number; invertY:boolean; headBob:boolean; cameraShake:boolean; motionBlur:boolean; masterVolume:number; musicVolume:number; effectsVolume:number; ambientVolume:number; quality:GraphicsQuality; renderScale:number; shadows:boolean; shadowQuality:ShadowQuality; shadowDistance:number; foliageDensity:number; postProcessing:boolean; ambientOcclusion:boolean; bloom:boolean; crosshairOpacity:number; crosshairScale:number; hudScale:number; hudOpacity:number; brightness:number; showCompass:boolean; showFps:boolean; showTutorialHints:boolean; keybinds:Keybinds}")

replace_once('src/config/balance.ts',
"quality:'high' as const,renderScale:1,shadows:true,crosshairOpacity:1",
"quality:'high' as const,renderScale:1,shadows:true,shadowQuality:'medium' as const,shadowDistance:72,foliageDensity:.72,postProcessing:true,ambientOcclusion:true,bloom:true,crosshairOpacity:1")

replace_once('src/save/storage.ts',
"    shadows: typeof value.shadows === 'boolean' ? value.shadows : DEFAULT_SETTINGS.shadows,\n    crosshairOpacity:",
"    shadows: typeof value.shadows === 'boolean' ? value.shadows : DEFAULT_SETTINGS.shadows,\n    shadowQuality: value.shadowQuality === 'low' || value.shadowQuality === 'medium' || value.shadowQuality === 'high' ? value.shadowQuality : DEFAULT_SETTINGS.shadowQuality,\n    shadowDistance: finite(value.shadowDistance, 35, 120) ? value.shadowDistance : DEFAULT_SETTINGS.shadowDistance,\n    foliageDensity: finite(value.foliageDensity, 0.25, 1) ? value.foliageDensity : DEFAULT_SETTINGS.foliageDensity,\n    postProcessing: typeof value.postProcessing === 'boolean' ? value.postProcessing : DEFAULT_SETTINGS.postProcessing,\n    ambientOcclusion: typeof value.ambientOcclusion === 'boolean' ? value.ambientOcclusion : DEFAULT_SETTINGS.ambientOcclusion,\n    bloom: typeof value.bloom === 'boolean' ? value.bloom : DEFAULT_SETTINGS.bloom,\n    crosshairOpacity:")

# --- UI: pause menu, settings, toggles and save confirm -------------------
replace_once('src/ui/UI.ts',
'''      <section class="screen modal-screen pause-screen pause-v3" data-view="pause" aria-label="Pause menu"><div class="pause-v3-panel"><div class="eyebrow">TIDELAND · ${GAME_BUILD}</div><h2 data-i18n="paused">PAUSED</h2><p data-i18n="pauseDesc">The island can wait.</p><nav class="pause-nav"><button class="primary-button" data-action="resume"><span data-i18n="returnWorld">RETURN TO WORLD</span>${chevron}</button><button data-action="save"><span data-i18n="saveWorld">SAVE WORLD</span><small data-i18n="localSave">LOCAL SAVE</small></button><button data-action="settings"><span data-i18n="settings">SETTINGS</span>${chevron}</button><button data-action="menu"><span data-i18n="mainMenu">MAIN MENU</span>${chevron}</button></nav><div class="pause-footnote"><i></i><span data-i18n="simulationPaused">Simulation paused</span></div></div></section>''',
'''      <section class="screen modal-screen pause-screen pause-v4" data-view="pause" aria-label="Pause menu"><div class="pause-v4-panel"><header class="pause-v4-header"><div><div class="eyebrow">TIDELAND · ${GAME_BUILD}</div><h2 data-i18n="paused">PAUSED</h2><p data-i18n="pauseDesc">The island can wait.</p></div><div class="pause-v4-status"><i></i><span>LOCAL SOLO</span><small>AUTOSAVE · 60 SEC</small></div></header><nav class="pause-nav"><button class="primary-button" data-action="resume"><span><b data-i18n="returnWorld">RETURN TO WORLD</b><small>ESC</small></span>${chevron}</button><button data-action="save"><span><b data-i18n="saveWorld">SAVE WORLD</b><small data-i18n="localSave">LOCAL SAVE</small></span><span class="pause-action-icon">↓</span></button><button data-action="manageSaves"><span><b data-i18n="manageSaves">MANAGE SAVES</b><small>5 LOCAL SLOTS</small></span>${chevron}</button><button data-action="settings"><span><b data-i18n="settings">SETTINGS</b><small>GAMEPLAY · CONTROLS · GRAPHICS · AUDIO</small></span>${chevron}</button><button data-action="menu"><span><b data-i18n="mainMenu">MAIN MENU</b><small>SAVE BEFORE LEAVING</small></span>${chevron}</button></nav><footer class="pause-v4-footer"><div class="pause-footnote"><i></i><span data-i18n="simulationPaused">Simulation paused</span></div><span>v${GAME_VERSION} · ${GAME_BUILD}</span></footer></div></section>''')

replace_once('src/ui/UI.ts',
'''              <div class="setting-row quality-row"><label><span data-i18n="quality">GRAPHICS PRESET</span><small data-i18n="qualityDetail">One-click rendering quality profile.</small></label><div class="quality-options"><button data-preset="low" data-i18n="low">LOW</button><button data-preset="medium" data-i18n="medium">MEDIUM</button><button data-preset="high" data-i18n="high">HIGH</button><button data-preset="ultra" data-i18n="ultra">ULTRA</button></div></div>
              ${this.slider('brightness','brightness','brightnessDetail',0.75,1.35,0.05)}${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}${this.toggle('shadows','shadows','shadowsDetail')}${this.toggle('motionBlur','motionBlur','motionBlurDetail')}''',
'''              <div class="setting-row quality-row"><label><span data-i18n="quality">GRAPHICS PRESET</span><small data-i18n="qualityDetail">One-click rendering quality profile.</small></label><div class="quality-options"><button data-preset="low" data-i18n="low">LOW</button><button data-preset="medium" data-i18n="medium">MEDIUM</button><button data-preset="high" data-i18n="high">HIGH</button><button data-preset="ultra" data-i18n="ultra">ULTRA</button></div></div>
              <div class="settings-subheading graphics-group"><span data-i18n="displayCamera">DISPLAY & CAMERA</span><small>VIEW</small></div>
              ${this.slider('brightness','brightness','brightnessDetail',0.75,1.35,0.05)}${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}${this.slider('foliageDensity','foliageDensity','foliageDensityDetail',0.25,1,0.05)}
              <div class="settings-subheading graphics-group"><span data-i18n="lightingShadows">LIGHTING & SHADOWS</span><small>GPU</small></div>
              ${this.toggle('shadows','shadows','shadowsDetail')}<div class="setting-row quality-row"><label><span data-i18n="shadowQuality">SHADOW QUALITY</span><small data-i18n="shadowQualityDetail">Controls shadow-map resolution independently from the global preset.</small></label><div class="shadow-quality-options"><button data-shadow-quality="low" data-i18n="low">LOW</button><button data-shadow-quality="medium" data-i18n="medium">MEDIUM</button><button data-shadow-quality="high" data-i18n="high">HIGH</button></div></div>${this.slider('shadowDistance','shadowDistance','shadowDistanceDetail',35,120,5)}
              <div class="settings-subheading graphics-group"><span data-i18n="postEffects">POST PROCESSING</span><small>HIGH / ULTRA</small></div>
              ${this.toggle('postProcessing','postProcessing','postProcessingDetail')}${this.toggle('ambientOcclusion','ambientOcclusion','ambientOcclusionDetail')}${this.toggle('bloom','bloom','bloomDetail')}${this.toggle('motionBlur','motionBlur','motionBlurDetail')}''')

replace_once('src/ui/UI.ts',
"for (const name of ['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','crosshairOpacity','crosshairScale','hudScale','hudOpacity','brightness'] as const)",
"for (const name of ['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','foliageDensity','shadowDistance','crosshairOpacity','crosshairScale','hudScale','hudOpacity','brightness'] as const)")
replace_once('src/ui/UI.ts',
"for(const name of ['invertY','headBob','cameraShake','motionBlur','shadows','showCompass'] as const)",
"for(const name of ['invertY','headBob','cameraShake','motionBlur','shadows','showCompass','showFps','showTutorialHints','postProcessing','ambientOcclusion','bloom'] as const)")
replace_once('src/ui/UI.ts',
"    this.root.querySelectorAll<HTMLElement>('[data-language]').forEach(button=>button.classList.toggle('active',button.dataset.language===settings.language));",
"    this.root.querySelectorAll<HTMLElement>('[data-language]').forEach(button=>button.classList.toggle('active',button.dataset.language===settings.language));\n    this.root.querySelectorAll<HTMLElement>('[data-shadow-quality]').forEach(button=>button.classList.toggle('active',button.dataset.shadowQuality===settings.shadowQuality));")
replace_once('src/ui/UI.ts',
"      if(target.dataset.preset)this.setPreset(target.dataset.preset as Settings['quality']);",
"      if(target.dataset.preset)this.setPreset(target.dataset.preset as Settings['quality']);\n      if(target.dataset.shadowQuality){this.settings.shadowQuality=target.dataset.shadowQuality as Settings['shadowQuality'];this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}")
replace_once('src/ui/UI.ts',
"const name=target.dataset.toggle as 'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints';",
"const name=target.dataset.toggle as 'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom';")
replace_once('src/ui/UI.ts',
"const name=input.dataset.setting as 'sensitivityX'|'sensitivityY'|'fov'|'viewmodelFov'|'masterVolume'|'musicVolume'|'effectsVolume'|'ambientVolume'|'renderScale'|'crosshairOpacity'|'crosshairScale'|'hudScale'|'hudOpacity'|'brightness'|undefined;",
"const name=input.dataset.setting as 'sensitivityX'|'sensitivityY'|'fov'|'viewmodelFov'|'masterVolume'|'musicVolume'|'effectsVolume'|'ambientVolume'|'renderScale'|'foliageDensity'|'shadowDistance'|'crosshairOpacity'|'crosshairScale'|'hudScale'|'hudOpacity'|'brightness'|undefined;")
replace_once('src/ui/UI.ts',
"case 'deleteSlotConfirm':{const slot=this.pendingDeleteSlot;this.find<HTMLElement>('.delete-slot-confirm').hidden=true;this.pendingDeleteSlot=null;if(slot!==null)this.actions.deleteSave(slot);break;}",
"case 'deleteSlotConfirm':{const slot=this.pendingDeleteSlot;if(slot===null)break;this.actions.deleteSave(slot);this.pendingDeleteSlot=null;this.find<HTMLElement>('.delete-slot-confirm').hidden=true;this.renderSaveBrowser();break;}")
replace_once('src/ui/UI.ts',
"private setPreset(quality:Settings['quality']):void{const presets={low:{renderScale:.7,shadows:false,motionBlur:false},medium:{renderScale:.85,shadows:true,motionBlur:false},high:{renderScale:1,shadows:true,motionBlur:false},ultra:{renderScale:1,shadows:true,motionBlur:true}} as const;Object.assign(this.settings,{quality,...presets[quality]});",
"private setPreset(quality:Settings['quality']):void{const presets={low:{renderScale:.7,shadows:false,shadowQuality:'low',shadowDistance:45,foliageDensity:.38,postProcessing:false,ambientOcclusion:false,bloom:false,motionBlur:false},medium:{renderScale:.85,shadows:true,shadowQuality:'low',shadowDistance:58,foliageDensity:.55,postProcessing:false,ambientOcclusion:false,bloom:false,motionBlur:false},high:{renderScale:1,shadows:true,shadowQuality:'medium',shadowDistance:72,foliageDensity:.72,postProcessing:true,ambientOcclusion:true,bloom:true,motionBlur:false},ultra:{renderScale:1,shadows:true,shadowQuality:'high',shadowDistance:92,foliageDensity:.88,postProcessing:true,ambientOcclusion:true,bloom:true,motionBlur:true}} as const;Object.assign(this.settings,{quality,...presets[quality]});")
replace_once('src/ui/UI.ts',
"private toggle(name:'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints',label:TranslationKey,detail:TranslationKey):string",
"private toggle(name:'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom',label:TranslationKey,detail:TranslationKey):string")
replace_once('src/ui/UI.ts',
"if(name==='renderScale'||name==='hudScale'||name==='crosshairScale'||name==='brightness')return `${Math.round(value*100)}%`;",
"if(name==='renderScale'||name==='hudScale'||name==='crosshairScale'||name==='brightness'||name==='foliageDensity')return `${Math.round(value*100)}%`;if(name==='shadowDistance')return `${Math.round(value)} m`;")

# --- i18n ---------------------------------------------------------------
replace_once('src/ui/i18n.ts',
"shadows:'DYNAMIC SHADOWS',shadowsDetail:'Disable for a large GPU performance gain.',low:'LOW'",
"shadows:'DYNAMIC SHADOWS',shadowsDetail:'Disable for a large GPU performance gain.',shadowQuality:'SHADOW QUALITY',shadowQualityDetail:'Controls shadow-map resolution independently from the global preset.',shadowDistance:'SHADOW DISTANCE',shadowDistanceDetail:'How far high-detail dynamic shadows extend around the player.',foliageDensity:'FOLIAGE DENSITY',foliageDensityDetail:'Adjust grass and small vegetation density without changing resources.',postProcessing:'POST PROCESSING',postProcessingDetail:'Master switch for world-only post-processing.',ambientOcclusion:'AMBIENT OCCLUSION',ambientOcclusionDetail:'Adds soft contact shading around terrain and objects.',bloom:'BLOOM',bloomDetail:'Adds restrained glow to bright highlights.',displayCamera:'DISPLAY & CAMERA',lightingShadows:'LIGHTING & SHADOWS',postEffects:'POST PROCESSING',low:'LOW'")
replace_once('src/ui/i18n.ts',
"shadows:'DYNAMICKÉ STÍNY',shadowsDetail:'Vypnutí výrazně uleví grafické kartě.',low:'NÍZKÁ'",
"shadows:'DYNAMICKÉ STÍNY',shadowsDetail:'Vypnutí výrazně uleví grafické kartě.',shadowQuality:'KVALITA STÍNŮ',shadowQualityDetail:'Nastaví rozlišení stínů nezávisle na celkovém profilu.',shadowDistance:'VZDÁLENOST STÍNŮ',shadowDistanceDetail:'Určuje dosah detailních dynamických stínů kolem hráče.',foliageDensity:'HUSTOTA VEGETACE',foliageDensityDetail:'Nastaví množství trávy a drobné vegetace bez změny surovin.',postProcessing:'POSTPROCESSING',postProcessingDetail:'Hlavní přepínač obrazových efektů světa.',ambientOcclusion:'AMBIENTNÍ STÍNOVÁNÍ',ambientOcclusionDetail:'Přidá jemné kontaktní stíny kolem terénu a objektů.',bloom:'BLOOM',bloomDetail:'Přidá jemnou záři nejjasnějším částem obrazu.',displayCamera:'OBRAZ & KAMERA',lightingShadows:'SVĚTLO & STÍNY',postEffects:'OBRAZOVÉ EFEKTY',low:'NÍZKÁ'")

# --- Stable vegetation and independent quality controls ------------------
replace_once('src/rendering/environment.ts',
"  private quality:'low'|'medium'|'high'|'ultra'='high';",
"  private quality:'low'|'medium'|'high'|'ultra'='high';\n  private foliageDensity=.72;")
replace_once('src/rendering/environment.ts',
'''    for(const map of [textureA,textureB]){
      const mat=new THREE.MeshLambertMaterial({map,alphaTest:.45,side:THREE.DoubleSide,emissive:0x253017,emissiveIntensity:.2});
      mat.onBeforeCompile=shader=>{
        shader.uniforms.windTime=this.windUniform;shader.uniforms.grassCamera=this.cameraUniform;shader.uniforms.grassDistance=this.grassDistanceUniform;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\\nuniform float windTime; uniform vec3 grassCamera; uniform float grassDistance; varying float vGrassFade;');
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\\nvec3 worldGrass=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;float dist=distance(worldGrass.xz,grassCamera.xz);vGrassFade=1.-smoothstep(grassDistance*.62,grassDistance,dist);float wind=sin(windTime*1.45+worldGrass.x*.21+worldGrass.z*.14)*.07+sin(windTime*.74+worldGrass.z*.33)*.03;transformed.x+=wind*position.y*position.y;transformed.y*=max(.0,vGrassFade);`);
      };this.grassMaterials.push(mat);this.materials.add(mat);
    }''',
'''    for(const map of [textureA,textureB]){
      // Keep meadow cards on the stable material path. The previous custom
      // vertex-distance fade could collapse blades into dark/black strips on
      // some ANGLE/WebGL drivers. Chunk culling still keeps the GPU cost bounded.
      const mat=new THREE.MeshLambertMaterial({map,color:0xd3d8ba,alphaTest:.5,side:THREE.DoubleSide,emissive:0x1b2415,emissiveIntensity:.12});
      this.grassMaterials.push(mat);this.materials.add(mat);
    }''')
replace_once('src/rendering/environment.ts',"    const total=WORLD.GRASS_DENSITY;","    const total=Math.floor(WORLD.GRASS_DENSITY*.72);")
replace_once('src/rendering/environment.ts',
"mesh.setColorAt(i,new THREE.Color().setHSL(.19+rand()*.04,.11,.80+rand()*.2));",
"mesh.setColorAt(i,new THREE.Color().setHSL(.20+rand()*.035,.24,.58+rand()*.16));")
replace_once('src/rendering/environment.ts',
"const fraction=quality==='low'?.30:quality==='medium'?.58:quality==='high'?.82:1;for(const c of this.grassChunks)c.mesh.count=Math.floor(c.fullCount*fraction);",
"const fraction=(quality==='low'?.30:quality==='medium'?.58:quality==='high'?.82:1)*this.foliageDensity;for(const c of this.grassChunks)c.mesh.count=Math.floor(c.fullCount*fraction);")
replace_once('src/rendering/environment.ts',
"  syncNodes(nodeChanges:Record<string,number>):void {",
"  setFoliageDensity(value:number):void {this.foliageDensity=Math.max(.25,Math.min(1,value));this.setQuality(this.quality);}\n  syncNodes(nodeChanges:Record<string,number>):void {")

# --- Shadow controls ------------------------------------------------------
replace_once('src/world/atmosphere.ts',
"import type {GraphicsQuality} from '../core/types';",
"import type {GraphicsQuality,ShadowQuality} from '../core/types';")
replace_once('src/world/atmosphere.ts',
'''  setQuality(q:GraphicsQuality):void{
    this.sun.castShadow=q!=='low';const size=q==='ultra'?3072:q==='high'?2048:q==='medium'?1024:768;this.sun.shadow.radius=q==='ultra'?4:q==='high'?3:2;
    if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
  }''',
'''  setQuality(q:GraphicsQuality):void{
    this.sun.castShadow=q!=='low';const size=q==='ultra'?3072:q==='high'?2048:q==='medium'?1024:768;this.sun.shadow.radius=q==='ultra'?4:q==='high'?3:2;
    if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
  }
  setShadowSettings(enabled:boolean,quality:ShadowQuality,distance:number):void{
    this.sun.castShadow=enabled;const size=quality==='high'?3072:quality==='medium'?2048:1024,d=Math.max(35,Math.min(120,distance));this.sun.shadow.radius=quality==='high'?4:quality==='medium'?3:2;
    this.sun.shadow.camera.left=this.sun.shadow.camera.bottom=-d;this.sun.shadow.camera.right=this.sun.shadow.camera.top=d;this.sun.shadow.camera.far=Math.max(150,d*3.1);this.sun.shadow.camera.updateProjectionMatrix();
    if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
  }''')

# --- Post FX controls -----------------------------------------------------
replace_once('src/rendering/WorldPostFX.ts',
"  private enabled=false;\n  private quality:GraphicsQuality='high';",
"  private enabled=false;\n  private quality:GraphicsQuality='high';\n  private userEnabled=true;\n  private userSsao=true;\n  private userBloom=true;")
replace_once('src/rendering/WorldPostFX.ts',
'''  setQuality(q:GraphicsQuality):void{
    this.quality=q;this.enabled=q==='high'||q==='ultra';
    this.ssao.enabled=this.enabled;this.bloom.enabled=this.enabled;this.grade.enabled=this.enabled;this.output.enabled=this.enabled;
    this.ssao.kernelRadius=q==='ultra'?10:7;this.ssao.minDistance=q==='ultra'?.002:.0025;this.ssao.maxDistance=q==='ultra'?.09:.07;
    this.bloom.strength=q==='ultra'?.19:.12;this.bloom.radius=q==='ultra'?.46:.34;this.bloom.threshold=q==='ultra'?.91:.95;
  }''',
'''  private syncPasses():void{
    const qualityAllows=this.quality!=='low';this.enabled=this.userEnabled&&qualityAllows;this.ssao.enabled=this.enabled&&this.userSsao;this.bloom.enabled=this.enabled&&this.userBloom;this.grade.enabled=this.enabled;this.output.enabled=this.enabled;
  }
  setQuality(q:GraphicsQuality):void{
    this.quality=q;this.ssao.kernelRadius=q==='ultra'?10:7;this.ssao.minDistance=q==='ultra'?.002:.0025;this.ssao.maxDistance=q==='ultra'?.09:.07;this.bloom.strength=q==='ultra'?.19:.12;this.bloom.radius=q==='ultra'?.46:.34;this.bloom.threshold=q==='ultra'?.91:.95;this.syncPasses();
  }
  setUserSettings(enabled:boolean,ssao:boolean,bloom:boolean):void{this.userEnabled=enabled;this.userSsao=ssao;this.userBloom=bloom;this.syncPasses();}''')
replace_once('src/rendering/WorldPostFX.ts',
"diagnostics(){return {enabled:this.enabled,quality:this.quality,ssao:this.ssao.enabled,bloom:this.bloom.enabled,bloomStrength:this.bloom.strength};}",
"diagnostics(){return {enabled:this.enabled,quality:this.quality,ssao:this.ssao.enabled,bloom:this.bloom.enabled,bloomStrength:this.bloom.strength,userEnabled:this.userEnabled};}")

# --- Game wiring ----------------------------------------------------------
replace_once('src/app/GameApp.ts',
"  private deleteSaveSlot(slot:number){deleteSave(slot);if(this.activeSaveSlot===slot)this.activeSaveSlot=null;this.refreshSaveSlots();this.ui.notify(`Save slot ${slot} deleted${this.activeWorld&&this.activeSaveSlot===null?' · autosave disabled for this session':''}.`);}",
"  private deleteSaveSlot(slot:number){deleteSave(slot);const removed=!listSaveSlots().find(save=>save.slot===slot)?.exists;if(removed&&this.activeSaveSlot===slot)this.activeSaveSlot=null;this.refreshSaveSlots();this.ui.notify(removed?`Save slot ${slot} deleted${this.activeWorld&&this.activeSaveSlot===null?' · autosave disabled for this session':''}.`:`Save slot ${slot} could not be deleted. Browser storage may be unavailable.`);}")
replace_once('src/app/GameApp.ts',
"this.renderer.shadowMap.enabled=s.shadows&&s.quality!=='low';this.postFX.setQuality(s.quality);this.environment?.setQuality(s.quality);this.resize();",
"this.renderer.shadowMap.enabled=s.shadows;this.postFX.setQuality(s.quality);this.postFX.setUserSettings(s.postProcessing,s.ambientOcclusion,s.bloom);this.environment?.setQuality(s.quality);this.environment?.setFoliageDensity(s.foliageDensity);this.environment?.atmosphere.setShadowSettings(s.shadows,s.shadowQuality,s.shadowDistance);this.resize();")

# --- CSS polish -----------------------------------------------------------
css = read('src/ui/style.css')
css += r'''

/* Tideland v0.7.1 — UI reliability, pause-menu polish and stable vegetation controls */
.pause-v4{background:linear-gradient(90deg,rgba(3,8,7,.70),rgba(3,8,7,.36) 50%,rgba(3,8,7,.18));backdrop-filter:blur(8px)}
.pause-v4-panel{position:absolute;left:5.5vw;top:50%;transform:translateY(-50%);width:min(610px,88vw);padding:42px 44px 34px;background:linear-gradient(145deg,rgba(9,17,15,.96),rgba(8,15,14,.89));border:1px solid rgba(229,237,219,.12);box-shadow:0 38px 120px rgba(0,0,0,.52);backdrop-filter:blur(18px)}
.pause-v4-header{display:flex;justify-content:space-between;gap:30px;align-items:flex-start;padding-bottom:24px;border-bottom:1px solid rgba(232,239,224,.10)}.pause-v4-header h2{font:700 clamp(68px,7vw,94px)/.86 var(--title-font);letter-spacing:-.02em;margin:14px 0 10px}.pause-v4-header p{color:rgba(235,239,227,.58);font-size:14px}.pause-v4-status{min-width:120px;display:grid;grid-template-columns:8px 1fr;gap:4px 8px;align-items:center;padding-top:7px;font:600 10px var(--title-font);letter-spacing:.10em;color:#dfe7d4a8;text-align:left}.pause-v4-status i{width:6px;height:6px;border-radius:50%;background:var(--health);box-shadow:0 0 12px #9fbd7766}.pause-v4-status small{grid-column:2;font-size:8px;opacity:.55}.pause-v4 .pause-nav{display:grid;gap:7px;margin-top:20px}.pause-v4 .pause-nav button{min-height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 19px;background:rgba(229,237,219,.045);border:1px solid rgba(229,237,219,.09);color:#eef1e7;text-align:left}.pause-v4 .pause-nav button:hover{background:rgba(229,237,219,.085);border-color:rgba(229,237,219,.18);transform:translateX(3px)}.pause-v4 .pause-nav button.primary-button{background:#cbd377;color:#111710;border-color:#dbe58b}.pause-v4 .pause-nav button>span:first-child{display:flex;flex-direction:column;gap:3px}.pause-v4 .pause-nav b{font:600 18px var(--title-font);letter-spacing:.07em}.pause-v4 .pause-nav small{font:500 8px var(--title-font);letter-spacing:.08em;opacity:.48}.pause-action-icon{font-size:18px;opacity:.65}.pause-v4 .pause-nav svg{width:18px;stroke:currentColor}.pause-v4-footer{display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:15px;border-top:1px solid rgba(232,239,224,.08);font:500 9px var(--title-font);letter-spacing:.08em;color:#dce4d17a}.pause-v4-footer .pause-footnote{display:flex;align-items:center;gap:8px}.pause-v4-footer .pause-footnote i{display:block}
.shadow-quality-options{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.shadow-quality-options button{min-height:38px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.62)}.shadow-quality-options button.active{background:#cad175;color:#101610}.graphics-group{margin-top:30px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.09);color:#dfe6d5}.settings-v3 .toggle-options{display:grid;grid-template-columns:repeat(2,minmax(70px,1fr));gap:4px}.settings-v3 .toggle-options button{background:rgba(255,255,255,.04);color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.07)}.settings-v3 .toggle-options button.active{background:#cad175!important;color:#101610!important;border-color:#cad175}.confirm-card .danger-button{background:#984739;color:#fff0e9;border:1px solid #d27b694f}.confirm-card .danger-button:hover{background:#b45444}.confirm-card>div>button:not(.danger-button){background:#202a27;color:#e6eadf;border:1px solid #dce6d322}.confirm-card>div>button:not(.danger-button):hover{background:#293632}.save-slot-delete:active,.confirm-card button:active{transform:translateY(1px)}
@media(max-width:760px){.pause-v4-panel{left:4vw;width:92vw;padding:28px 24px}.pause-v4-status{display:none}.pause-v4-header h2{font-size:64px}.pause-v4 .pause-nav button{min-height:56px}.shadow-quality-options{grid-template-columns:1fr}}
'''
write('src/ui/style.css', css)

# --- Tests ---------------------------------------------------------------
settings_test = '''import {beforeEach,describe,expect,it,vi} from 'vitest';
import {DEFAULT_SETTINGS} from '../src/config/balance';
import {loadSettings,saveSettings} from '../src/save/storage';

class MemoryStorage {private data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}clear(){this.data.clear();}}

describe('v0.7.1 expanded graphics settings',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));
  it('persists independent graphics controls',()=>{
    saveSettings({...DEFAULT_SETTINGS,showFps:true,showTutorialHints:false,foliageDensity:.55,shadowQuality:'high',shadowDistance:95,postProcessing:true,ambientOcclusion:false,bloom:true,keybinds:{...DEFAULT_SETTINGS.keybinds}});
    const settings=loadSettings();
    expect(settings.showFps).toBe(true);expect(settings.showTutorialHints).toBe(false);expect(settings.foliageDensity).toBe(.55);expect(settings.shadowQuality).toBe('high');expect(settings.shadowDistance).toBe(95);expect(settings.ambientOcclusion).toBe(false);expect(settings.bloom).toBe(true);
  });
});
'''
write('tests/settings-v071.test.ts', settings_test)

# --- Version / changelog -------------------------------------------------
replace_once('src/config/version.ts',"export const GAME_VERSION='0.7.0';\nexport const GAME_BUILD='EA-07';\nexport const GAME_RELEASE_DATE='2026-09-11';",
"export const GAME_VERSION='0.7.1';\nexport const GAME_BUILD='EA-07.1';\nexport const GAME_RELEASE_DATE='2026-09-12';")
replace_once('src/config/version.ts',"export const CHANGELOG:ChangeEntry[]=[\n",
"export const CHANGELOG:ChangeEntry[]=[\n  {version:'0.7.1',date:'2026-09-12',title:'UI reliability & graphics controls patch',changes:[\n    'Fixed per-slot delete confirmation so the selected local world is removed, the save browser refreshes immediately and active autosave detaches safely.',\n    'Rebuilt the in-game pause surface into a larger survival-game menu with direct save management and clearer actions.',\n    'Fixed FPS counter and tutorial-hint toggles so ON/OFF state updates immediately and persists correctly.',\n    'Reverted grass to a stable material path to eliminate driver-dependent black/collapsed vegetation artifacts.',\n    'Expanded graphics settings with foliage density, independent shadow quality/distance and post-processing, ambient-occlusion and bloom controls.'\n  ]},\n")

for path in ['package.json','package-lock.json']:
    text=read(path).replace('"version": "0.7.0"','"version": "0.7.1"')
    write(path,text)

if Path('README.md').exists():
    text=read('README.md').replace('v0.7.0 / EA-07','v0.7.1 / EA-07.1').replace('`0.7.0`','`0.7.1`')
    write('README.md',text)
if Path('CHANGELOG.md').exists():
    text=read('CHANGELOG.md')
    entry='''## v0.7.1 / EA-07.1 — UI reliability & graphics controls\n\n- Fixed individual save-slot deletion and immediate save-browser refresh.\n- Rebuilt the pause menu into a larger, clearer in-game surface.\n- Fixed FPS/tutorial ON/OFF toggles and persistence.\n- Reverted unstable custom grass vertex fading and reduced default foliage density.\n- Added foliage density, shadow quality/distance and post-processing/SSAO/bloom controls.\n\n'''
    if '## v0.7.1' not in text:
        text=entry+text
    write('CHANGELOG.md',text)

print('v0.7.1 fixes applied')
