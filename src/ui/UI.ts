import {nearbyWorkbench} from '../survival/stations';
import type { GameState, HUDData, ItemId, ItemStack, KeybindAction, PieceType, ResourceNode, SaveSlotSummary, Screen, Settings, UIActions } from '../core/types';
import {INVENTORY} from '../config/gameplay';
import { DEFAULT_SETTINGS } from '../config/balance';
import {CHANGELOG,GAME_BUILD,GAME_RELEASE_DATE,GAME_VERSION} from '../config/version';
import { ITEMS } from '../items/definitions';
import { RECIPES } from '../crafting/recipes';
import { PIECES } from '../building/rules';
import {keyLabel,t,type TranslationKey} from './i18n';
import './style.css';

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const icon = (id: ItemId, cls = ''): string => `<img class="item-art ${cls}" src="${ITEMS[id].icon}" alt="${esc(ITEMS[id].displayName)}" draggable="false">`;
const mark = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 9h16v9H4zM28 9h16v9H28zM4 30h16v9H4zM28 30h16v9H28z"/><path d="m24 3 5 21-5 21-5-21z"/><path d="m3 24 21-5 21 5-21 5z"/></svg>';
const chevron = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 4 6 6-6 6"/></svg>';
const labels: Record<PieceType, string> = { foundation:'Foundation',wall:'Wall',doorway:'Doorway',floor:'Floor',roof:'Roof',door:'Door' };

export class UI {
  screen: Screen = 'menu';
  private root: HTMLDivElement;
  private actions: UIActions;
  private state: GameState | null = null;
  private settings: Settings = {...DEFAULT_SETTINGS,keybinds:{...DEFAULT_SETTINGS.keybinds}};
  private selectedSlot = 0;
  private selectedRecipe = 'hatchet';
  private recipeCategory = 'all';
  private dragSlot = -1;
  private dragSplit = false;
  private inventoryHash = '';
  private hotbarHash = '';
  private buildHash = '';
  private diagnosticVisible = false;
  private lastSettingsScreen: Screen = 'menu';
  private hud: HUDData | null = null;
  private lastHealth: number | null = null;
  private craftHudHash = '';
  private resourceFeedbackTimer = 0;
  private saveAvailable=false;
  private saveSlots:SaveSlotSummary[]=[];
  private saveBrowserMode:'load'|'new'|'manage'='load';
  private pendingSaveSlot:number|null=null;
  private pendingDeleteSlot:number|null=null;
  private settingsTab:'gameplay'|'controls'|'graphics'|'audio'='gameplay';
  private rebinding:KeybindAction|null=null;

  constructor(container: HTMLElement, actions: UIActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'tide-ui';
    this.root.dataset.screen = 'menu';
    this.root.innerHTML = `
      <section class="screen menu-screen menu-classic-v7" data-view="menu" aria-label="Main menu">
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
      </section>

      <section class="screen game-screen" data-view="playing" aria-label="Gameplay interface">
        <div class="compass-wrap"><div class="compass-value">N</div><div class="compass-line"></div><div class="compass-needle"></div><div class="biome-label">WESTERN SHORE</div></div><div class="fps-counter" hidden>60 FPS</div>
        <div class="crosshair"><i></i></div><div class="interaction-prompt"></div><div class="resource-feedback" aria-live="polite"></div><div class="damage-vignette" aria-hidden="true"></div>
        <div class="onboarding"><span class="hint-rule"></span><span class="tutorial-copy"></span><button class="help-shortcut" data-action="help" title="View controls">?</button></div>
        <div class="build-panel"></div>
        <div class="hotbar-wrap"><div class="active-item-name"></div><div class="hotbar"></div><div class="hotbar-caption"><span><kbd>TAB</kbd> INVENTORY</span><span><kbd>ESC</kbd> MENU</span></div></div><div class="hud-craft-queue" hidden></div>
        <div class="vitals"><div class="vital health"><span class="vital-symbol">✚</span><div><i></i><span>HEALTH</span><b>100</b></div></div><div class="vital thirst"><span class="vital-symbol water-symbol">●</span><div><i></i><span>WATER</span><b>100</b></div></div><div class="vital hunger"><span class="vital-symbol food-symbol">◆</span><div><i></i><span>FOOD</span><b>100</b></div></div><div class="stamina"><i></i><span>STAMINA</span></div><div class="survival-status"><span class="status-pill wet" hidden>WET</span><span class="status-pill cold" hidden>COLD</span></div></div>
      </section>

      <section class="screen inventory-screen" data-view="inventory" aria-label="Inventory and crafting">
        <header class="overlay-header"><div class="small-brand">${mark}<span>TIDELAND</span><i>/</i><span class="muted">FIELD INVENTORY</span></div><button class="close-button" data-action="resume"><kbd>TAB</kbd> BACK TO WORLD <span>×</span></button></header>
        <div class="inventory-layout"><aside class="survivor-panel"><div class="eyebrow">WASHED ASHORE</div><h2>THE SURVIVOR</h2><div class="survivor-figure">${this.character()}</div><div class="survivor-tag"><span>UNCLAIMED TERRITORY</span><b>Make a place for yourself.</b></div><div class="survivor-vitals"></div></aside>
        <main class="inventory-main"><div class="section-heading"><h2>INVENTORY</h2><span class="slot-usage">0 / 30 SLOTS</span></div><div class="inventory-backpack inventory-grid"></div><div class="quickbelt-heading"><h3>QUICK BELT</h3><span>PRESS 1–6 TO EQUIP</span></div><div class="inventory-belt inventory-grid"></div><div class="inventory-instructions"><span>DRAG TO MOVE</span><span>SHIFT + DRAG TO SPLIT</span><span>RIGHT CLICK FOR HALF STACK</span></div><div class="item-detail"></div></main>
        <aside class="crafting-panel"><div class="section-heading"><h2>CRAFTING</h2><span class="crafting-label">BY HAND</span></div><div class="craft-tabs"><button data-category="all" class="active">ALL</button><button data-category="tool">TOOLS</button><button data-category="building">BUILDING</button><button data-category="utility">SURVIVAL</button></div><div class="recipe-grid"></div><div class="recipe-detail"></div><div class="craft-queue"></div></aside></div>
        <footer class="inventory-footer"><span>Everything you carry is a possibility.</span><span class="inventory-world-info"></span></footer>
      </section>

      <section class="screen modal-screen pause-screen pause-v4" data-view="pause" aria-label="Pause menu"><div class="pause-v4-panel"><header class="pause-v4-header"><div><div class="eyebrow">TIDELAND · ${GAME_BUILD}</div><h2 data-i18n="paused">PAUSED</h2><p data-i18n="pauseDesc">The island can wait.</p></div><div class="pause-v4-status"><i></i><span>LOCAL SOLO</span><small>AUTOSAVE · 60 SEC</small></div></header><nav class="pause-nav"><button class="primary-button" data-action="resume"><span><b data-i18n="returnWorld">RETURN TO WORLD</b><small>ESC</small></span>${chevron}</button><button data-action="save"><span><b data-i18n="saveWorld">SAVE WORLD</b><small data-i18n="localSave">LOCAL SAVE</small></span><span class="pause-action-icon">↓</span></button><button data-action="manageSaves"><span><b data-i18n="manageSaves">MANAGE SAVES</b><small>5 LOCAL SLOTS</small></span>${chevron}</button><button data-action="settings"><span><b data-i18n="settings">SETTINGS</b><small>GAMEPLAY · CONTROLS · GRAPHICS · AUDIO</small></span>${chevron}</button><button data-action="menu"><span><b data-i18n="mainMenu">MAIN MENU</b><small>SAVE BEFORE LEAVING</small></span>${chevron}</button></nav><footer class="pause-v4-footer"><div class="pause-footnote"><i></i><span data-i18n="simulationPaused">Simulation paused</span></div><span>v${GAME_VERSION} · ${GAME_BUILD}</span></footer></div></section>

      <section class="screen settings-screen settings-v3" data-view="settings" aria-label="Settings">
        <header class="overlay-header settings-v3-header settings-v4-header"><div class="small-brand">${mark}<span>TIDELAND</span><i>/</i><span class="muted" data-i18n="settings">SETTINGS</span></div><button class="settings-back-button" data-action="settingsBack"><span data-i18n="back">BACK</span><small class="settings-back-context">TO MENU</small><kbd>ESC</kbd></button></header>
        <div class="settings-v3-shell"><aside class="settings-sidebar"><div><span class="eyebrow">TIDELAND</span><h2 data-i18n="settingsTitle">GAME SETTINGS</h2><p data-i18n="settingsSubtitle">Changes apply immediately and save automatically.</p></div><nav><button class="active" data-settings-tab="gameplay"><span>01</span><b data-i18n="gameplay">GAMEPLAY</b></button><button data-settings-tab="controls"><span>02</span><b data-i18n="controls">CONTROLS</b></button><button data-settings-tab="graphics"><span>03</span><b data-i18n="graphics">GRAPHICS</b></button><button data-settings-tab="audio"><span>04</span><b data-i18n="audio">AUDIO</b></button></nav><small>v${GAME_VERSION} · ${GAME_BUILD}</small></aside>
          <main class="settings-pages">
            <section class="settings-page active" data-settings-page="gameplay"><div class="settings-page-title"><span>01</span><h3 data-i18n="gameplay">GAMEPLAY</h3></div>
              <div class="setting-row toggle-row"><label><span data-i18n="language">LANGUAGE</span><small data-i18n="languageDetail">Switch the interface between English and Czech.</small></label><div class="language-options"><button data-language="en">EN</button><button data-language="cs">CZ</button></div></div>
              ${this.slider('hudScale','hudScale','hudScaleDetail',0.8,1.45,0.05)}${this.slider('hudOpacity','hudOpacity','hudOpacityDetail',0.55,1,0.05)}${this.slider('crosshairOpacity','crosshair','crosshairDetail',0,1,0.05)}${this.slider('crosshairScale','crosshairScale','crosshairScaleDetail',0.6,2,0.05)}${this.toggle('showCompass','compass','compassDetail')}${this.toggle('showFps','showFps','showFpsDetail')}${this.toggle('showTutorialHints','tutorialHints','tutorialHintsDetail')}<div class="settings-subheading telemetry-settings-heading"><span data-i18n="performanceOverlay">PERFORMANCE OVERLAY</span><small>F3</small></div>${this.slider('telemetryScale','telemetryScale','telemetryScaleDetail',0.7,1.4,0.05)}${this.slider('telemetryOpacity','telemetryOpacity','telemetryOpacityDetail',0.55,1,0.05)}${this.toggle('telemetryPerformance','telemetryPerformance','telemetryPerformanceDetail')}${this.toggle('telemetryPlayer','telemetryPlayer','telemetryPlayerDetail')}${this.toggle('telemetryCamera','telemetryCamera','telemetryCameraDetail')}${this.toggle('telemetryWorld','telemetryWorld','telemetryWorldDetail')}
              <div class="setting-row setting-buttons"><label><span data-i18n="localSettings">LOCAL SETTINGS</span><small data-i18n="localSettingsDetail">Reset device-specific controls and presentation.</small></label><div><button data-action="resetSettings" data-i18n="resetSettings">RESET SETTINGS</button><button data-action="reloadBuild" data-i18n="reloadBuild">RELOAD LATEST BUILD</button></div></div>
              <div class="save-reset-row"><span><b data-i18n="localSaveData">LOCAL SAVE DATA</b><small data-i18n="localSaveDataDetail">Manage individual local worlds or remove all save data.</small></span><div><button data-action="manageSaves" data-i18n="manageSaves">MANAGE SAVES</button><button class="danger-button" data-action="reset" data-i18n="deleteAllSaves">DELETE ALL SAVES</button></div></div><div class="reset-confirm" hidden><span data-i18n="localSaveDataDetail">Remove your saved island and progress.</span><button class="danger-button" data-action="resetConfirm" data-i18n="deleteAllSaves">DELETE ALL SAVES</button><button data-action="resetCancel" data-i18n="cancel">CANCEL</button></div>
            </section>
            <section class="settings-page" data-settings-page="controls"><div class="settings-page-title"><span>02</span><h3 data-i18n="controls">CONTROLS</h3></div>
              ${this.slider('sensitivityX','sensitivityX','sensitivityXDetail',0.05,2.5,0.05)}${this.slider('sensitivityY','sensitivityY','sensitivityYDetail',0.05,2.5,0.05)}${this.toggle('invertY','invertY','invertYDetail')}${this.toggle('headBob','headBob','headBobDetail')}${this.toggle('cameraShake','cameraShake','cameraShakeDetail')}
              <div class="settings-subheading"><span data-i18n="keybinds">KEY BINDINGS</span><small>CLICK A KEY TO REMAP</small></div><div class="keybind-grid">${this.keybindRows()}</div><div class="settings-actions"><button data-action="resetCamera" data-i18n="resetCamera">RESET CAMERA</button></div>
            </section>
            <section class="settings-page" data-settings-page="graphics"><div class="settings-page-title"><span>03</span><h3 data-i18n="graphics">GRAPHICS</h3></div>
              <div class="setting-row quality-row"><label><span data-i18n="quality">GRAPHICS PRESET</span><small data-i18n="qualityDetail">One-click rendering quality profile.</small></label><div class="quality-options"><button data-preset="low" data-i18n="low">LOW</button><button data-preset="medium" data-i18n="medium">MEDIUM</button><button data-preset="high" data-i18n="high">HIGH</button><button data-preset="ultra" data-i18n="ultra">ULTRA</button></div></div>
              <div class="settings-subheading graphics-group"><span data-i18n="displayCamera">DISPLAY & CAMERA</span><small>VIEW</small></div>
              ${this.slider('brightness','brightness','brightnessDetail',0.75,1.35,0.05)}${this.slider('fov','fov','fovDetail',60,100,1)}${this.slider('viewmodelFov','viewmodelFov','viewmodelFovDetail',40,75,1)}${this.slider('renderScale','renderScale','renderScaleDetail',0.5,1,0.05)}${this.toggle('vsync','vsync','vsyncDetail')}${this.slider('foliageDensity','foliageDensity','foliageDensityDetail',0.25,1,0.05)}
              <div class="settings-subheading graphics-group"><span data-i18n="lightingShadows">LIGHTING & SHADOWS</span><small>GPU</small></div>
              ${this.toggle('shadows','shadows','shadowsDetail')}<div class="setting-row quality-row"><label><span data-i18n="shadowQuality">SHADOW QUALITY</span><small data-i18n="shadowQualityDetail">Controls shadow-map resolution independently from the global preset.</small></label><div class="shadow-quality-options"><button data-shadow-quality="low" data-i18n="low">LOW</button><button data-shadow-quality="medium" data-i18n="medium">MEDIUM</button><button data-shadow-quality="high" data-i18n="high">HIGH</button></div></div>${this.slider('shadowDistance','shadowDistance','shadowDistanceDetail',35,120,5)}
              <div class="settings-subheading graphics-group"><span data-i18n="postEffects">POST PROCESSING</span><small>HIGH / ULTRA</small></div>
              ${this.toggle('postProcessing','postProcessing','postProcessingDetail')}${this.toggle('ambientOcclusion','ambientOcclusion','ambientOcclusionDetail')}${this.toggle('bloom','bloom','bloomDetail')}${this.toggle('motionBlur','motionBlur','motionBlurDetail')}
            </section>
            <section class="settings-page" data-settings-page="audio"><div class="settings-page-title"><span>04</span><h3 data-i18n="audio">AUDIO</h3></div>
              ${this.slider('masterVolume','masterVolume','masterVolumeDetail',0,1,0.01)}${this.slider('musicVolume','musicVolume','musicVolumeDetail',0,1,0.01)}${this.slider('effectsVolume','effectsVolume','effectsVolumeDetail',0,1,0.01)}${this.slider('ambientVolume','ambientVolume','ambientVolumeDetail',0,1,0.01)}
            </section>
          </main>
        </div>
      </section>

      <div class="save-browser" hidden><div class="save-browser-shell"><header><div><span class="eyebrow">LOCAL WORLDS</span><h2 class="save-browser-title">LOAD WORLD</h2><p class="save-browser-subtitle">Choose a local save slot.</p></div><button class="close-button save-browser-back" data-action="saveBrowserClose"><span>← BACK</span><kbd>ESC</kbd></button></header><div class="save-slot-grid"></div><footer><span>Autosave runs every 60 seconds while a world is attached to a slot.</span><span>5 LOCAL SLOTS</span></footer></div></div>
      <div class="confirm-overlay new-game-confirm" hidden><div class="confirm-card"><button class="confirm-close" data-action="cancelNew" aria-label="Close">×</button><span class="eyebrow">SAVE SLOT</span><h2 data-i18n="newGameWarning">OVERWRITE THIS WORLD?</h2><p class="overwrite-slot-copy">The selected save slot will be permanently replaced.</p><div><button class="danger-button" data-action="confirmNew" data-i18n="newGameConfirm">START NEW WORLD</button><button data-action="cancelNew" data-i18n="cancel">CANCEL</button></div></div></div>
      <div class="confirm-overlay delete-slot-confirm" hidden><div class="confirm-card"><button class="confirm-close" data-action="deleteSlotCancel" aria-label="Close">×</button><span class="eyebrow">LOCAL SAVE</span><h2>DELETE SAVE SLOT?</h2><p class="delete-slot-copy">This world will be removed from this browser.</p><div><button class="danger-button" data-action="deleteSlotConfirm" data-i18n="deleteSave">DELETE SAVE</button><button data-action="deleteSlotCancel" data-i18n="cancel">CANCEL</button></div></div></div>

      <section class="screen dead-screen modal-screen" data-view="dead" aria-label="Death screen"><div class="modal-content"><div class="eyebrow">THE ISLAND REMAINS</div><h2>WASHED<br>AWAY<span>.</span></h2><p>Every shore is another beginning.</p><button class="primary-button" data-action="respawn">RESPAWN ${chevron}</button><button class="text-button" data-action="menu">RETURN TO MAIN MENU</button></div></section>

      <aside class="history-panel" hidden aria-label="Update history"><div class="section-heading"><div><div class="eyebrow">EARLY ACCESS DEVELOPMENT</div><h2>TIDELAND HISTORY</h2></div><button class="close-button" data-action="history">×</button></div><div class="history-current"><span>CURRENT VERSION</span><strong>${GAME_VERSION}</strong><small>${GAME_BUILD} · ${GAME_RELEASE_DATE}</small></div><div class="history-list">${CHANGELOG.map(entry=>`<article class="history-entry"><header><strong>v${esc(entry.version)}</strong><span>${esc(entry.date)}</span></header><h3>${esc(entry.title)}</h3><ul>${entry.changes.map(change=>`<li>${esc(change)}</li>`).join('')}</ul></article>`).join('')}</div></aside>\n\n      <aside class="help-panel" hidden><div class="section-heading"><h2>FIELD GUIDE</h2><button class="close-button" data-action="help">×</button></div><p>Learn the island. Build something that lasts.</p><dl><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>Move</dd><dt><kbd>MOUSE</kbd></dt><dd>Look around</dd><dt><kbd>SHIFT</kbd> / <kbd>SPACE</kbd></dt><dd>Sprint / jump</dd><dt><kbd>C</kbd> / <kbd>CTRL</kbd></dt><dd>Crouch</dd><dt><kbd>LMB</kbd></dt><dd>Gather / use equipped item</dd><dt><kbd>E</kbd></dt><dd>Pick up / open door</dd><dt><kbd>TAB</kbd></dt><dd>Inventory & crafting</dd><dt><kbd>1</kbd> — <kbd>6</kbd></dt><dd>Equip quick belt item</dd><dt><kbd>B</kbd></dt><dd>Building plan</dd><dt><kbd>R</kbd></dt><dd>Rotate building piece</dd><dt><kbd>Q</kbd></dt><dd>Cycle building piece</dd><dt><kbd>LMB</kbd> / <kbd>RMB</kbd></dt><dd>Place / cancel build</dd><dt><kbd>ESC</kbd></dt><dd>Pause / release cursor</dd></dl><div class="field-guide-tip">Start with loose wood and stone. Equip your rock to gather from trees and nodes. Craft a building plan to begin your shelter.</div></aside>
      <div class="notifications" aria-live="polite"></div>
      <aside class="diagnostics telemetry-panel" hidden><header class="telemetry-header"><div><span>DEVELOPER TELEMETRY</span><strong>TIDELAND <i>F3</i></strong></div><button data-action="telemetryClose" aria-label="Close telemetry">×</button></header><div class="telemetry-sections"><section data-telemetry-section="performance"><header><span>01</span><b>PERFORMANCE</b></header><div class="telemetry-metrics" data-telemetry-body="performance"></div></section><section data-telemetry-section="player"><header><span>02</span><b>PLAYER</b></header><div class="telemetry-lines" data-telemetry-body="player"></div></section><section data-telemetry-section="camera"><header><span>03</span><b>CAMERA</b></header><div class="telemetry-lines" data-telemetry-body="camera"></div></section><section data-telemetry-section="world"><header><span>04</span><b>WORLD</b></header><div class="telemetry-metrics" data-telemetry-body="world"></div></section></div><footer class="telemetry-actions"><button data-dev="fly">FLY MODE</button><button data-dev="god">GOD MODE</button><button data-dev="heal">HEAL / VITALS</button><button data-dev="resources">GIVE RESOURCES</button><button data-dev="plan">GIVE PLAN</button><button data-dev="spawn">RESET POSITION</button><button data-dev="day">DAY</button><button data-dev="night">NIGHT</button><button data-dev="speed">TIME ×20</button><button data-dev="normal">TIME ×1</button><button data-dev="sockets">SOCKETS</button><button data-dev="collisions">COLLISIONS</button></footer></aside>
      <div class="loading-screen" hidden><div class="loading-shell"><header class="loading-top"><div class="loading-mark">${mark}</div><div><span>WORLD INITIALIZATION</span><b>TIDELAND</b></div><small>v${GAME_VERSION} · ${GAME_BUILD}</small></header><div class="loading-heading"><div class="eyebrow"><span></span> PROCEDURAL SURVIVAL WORLD</div><h2>FINDING YOUR SHORE<span>.</span></h2><p>The world is built locally on this device. Heavy work stays behind this screen so the first playable frames stay smooth.</p></div><section class="loading-task"><span>CURRENT TASK</span><strong class="loading-status">Preparing engine</strong><p class="loading-detail">Starting the world pipeline</p></section><div class="loading-bar"><i class="loading-bar-fill"></i></div><div class="loading-meta"><span class="loading-phase">PHASE 1 / 6</span><b class="loading-percent">0%</b></div><div class="loading-pipeline"><div data-load-phase="engine"><i></i><span>ENGINE</span><b>WAITING</b></div><div data-load-phase="terrain"><i></i><span>TERRAIN</span><b>WAITING</b></div><div data-load-phase="world"><i></i><span>WORLD</span><b>WAITING</b></div><div data-load-phase="physics"><i></i><span>PHYSICS</span><b>WAITING</b></div><div data-load-phase="systems"><i></i><span>SYSTEMS</span><b>WAITING</b></div><div data-load-phase="gpu"><i></i><span>GPU WARM-UP</span><b>WAITING</b></div></div><footer class="loading-foot"><span>PREPARING FRAME PACING</span><small>Shaders, geometry and vegetation are warmed before control is handed to you.</small></footer></div></div>
    `;
    container.append(this.root);
    this.bindEvents();
    this.setSettings(this.settings);
    this.applyLanguage();
  }

  private find<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }

  setScreen(screen: Screen): void {
    if (screen === 'settings' && this.screen !== 'settings') this.lastSettingsScreen = this.screen === 'menu' ? 'menu' : 'pause';
    if(screen!==this.screen)this.endDrag();
    this.screen = screen;
    this.root.dataset.screen = screen;
    const backContext=this.root.querySelector<HTMLElement>('.settings-back-context');if(backContext)backContext.textContent=this.lastSettingsScreen==='menu'?(this.settings.language==='cs'?'DO MENU':'TO MENU'):(this.settings.language==='cs'?'DO PAUZY':'TO PAUSE');
    this.closeSaveBrowser();
    this.find('.history-panel').hidden = true;
    this.find('.help-panel').hidden = true;
    this.find('.reset-confirm').hidden = true;
    if (screen === 'inventory' && this.state) { this.inventoryHash = ''; this.renderInventory(this.state); }
  }

  backFromSettings():void {if(this.screen==='settings')this.actions.setScreen(this.lastSettingsScreen);}

  setSettings(settings: Settings): void {
    this.settings={...settings,keybinds:{...settings.keybinds}};
    for (const name of ['sensitivityX','sensitivityY','fov','viewmodelFov','masterVolume','musicVolume','effectsVolume','ambientVolume','renderScale','foliageDensity','shadowDistance','crosshairOpacity','crosshairScale','hudScale','hudOpacity','brightness','telemetryScale','telemetryOpacity'] as const) {
      const input=this.root.querySelector<HTMLInputElement>(`input[data-setting="${name}"]`);if(!input)continue;
      input.value=String(settings[name]);const output=this.root.querySelector<HTMLElement>(`[data-setting-value="${name}"]`);if(output)output.textContent=this.settingValue(name,settings[name]);
      input.style.setProperty('--range',`${(settings[name]-Number(input.min))/(Number(input.max)-Number(input.min))*100}%`);
    }
    this.root.querySelectorAll<HTMLElement>('[data-preset]').forEach(button=>button.classList.toggle('active',button.dataset.preset===settings.quality));
    for(const name of ['invertY','headBob','cameraShake','motionBlur','shadows','showCompass','showFps','showTutorialHints','postProcessing','ambientOcclusion','bloom','vsync','telemetryPerformance','telemetryPlayer','telemetryCamera','telemetryWorld'] as const)this.root.querySelectorAll<HTMLElement>(`[data-toggle="${name}"]`).forEach(button=>button.classList.toggle('active',String(settings[name])===button.dataset.value));
    this.root.querySelectorAll<HTMLElement>('[data-language]').forEach(button=>button.classList.toggle('active',button.dataset.language===settings.language));
    this.root.querySelectorAll<HTMLElement>('[data-shadow-quality]').forEach(button=>button.classList.toggle('active',button.dataset.shadowQuality===settings.shadowQuality));
    for(const [action,code] of Object.entries(settings.keybinds)) {const button=this.root.querySelector<HTMLButtonElement>(`[data-keybind="${action}"]`);if(button&&!button.classList.contains('rebinding'))button.textContent=keyLabel(code);}
    this.root.classList.toggle('hide-compass',!settings.showCompass);this.root.classList.toggle('hide-tutorials',!settings.showTutorialHints);this.root.style.setProperty('--crosshair-opacity',String(settings.crosshairOpacity));this.root.style.setProperty('--crosshair-scale',String(settings.crosshairScale));this.root.style.setProperty('--hud-scale',String(settings.hudScale));this.root.style.setProperty('--hud-opacity',String(settings.hudOpacity));this.root.style.setProperty('--telemetry-scale',String(settings.telemetryScale));this.root.style.setProperty('--telemetry-opacity',String(settings.telemetryOpacity));const fps=this.root.querySelector<HTMLElement>('.fps-counter');if(fps)fps.hidden=!settings.showFps;this.applyLanguage();
  }

  setSaveSlots(slots:SaveSlotSummary[]):void{this.saveSlots=slots.map(slot=>({...slot}));this.setSaveAvailable(this.saveSlots.some(slot=>slot.exists));this.renderSaveBrowser();}
  setSaveAvailable(available: boolean): void {
    this.saveAvailable=available;
    const continueButton=this.root.querySelector<HTMLButtonElement>('.continue-game'),loadButton=this.root.querySelector<HTMLButtonElement>('.load-game');if(continueButton)continueButton.disabled=!available;if(loadButton)loadButton.disabled=!available;
    const latest=[...this.saveSlots].filter(slot=>slot.exists).sort((a,b)=>(b.savedAt??0)-(a.savedAt??0))[0];
    const meta=this.root.querySelector<HTMLElement>('.continue-meta');if(meta)meta.textContent=latest?`SLOT ${latest.slot} · SEED ${latest.seed}`:this.tx('noSave');
    const count=this.saveSlots.filter(slot=>slot.exists).length,countLabel=this.root.querySelector<HTMLElement>('.save-count'),footer=this.root.querySelector<HTMLElement>('.save-footer-status');if(countLabel)countLabel.textContent=`${count} / 5 SAVES`;if(footer)footer.textContent=count?`${count} LOCAL WORLD${count===1?'':'S'}`:'NO LOCAL WORLDS';
  }

  setLoading(loading: boolean): void { this.find('.loading-screen').hidden = !loading; if(loading)this.setLoadingProgress(0,'Preparing engine','Starting the world pipeline'); }
  setLoadingProgress(progress:number,status:string,detail='Working through the world pipeline'):void{
    const value=Math.max(0,Math.min(100,progress));this.find<HTMLElement>('.loading-bar-fill').style.width=`${value}%`;this.find('.loading-percent').textContent=`${Math.round(value)}%`;this.find('.loading-status').textContent=status;this.find('.loading-detail').textContent=detail;
    const phases=[{key:'engine',max:14},{key:'terrain',max:23},{key:'world',max:66},{key:'physics',max:77},{key:'systems',max:90},{key:'gpu',max:100}],current=Math.max(0,phases.findIndex(p=>value<=p.max));this.find('.loading-phase').textContent=value>=100?'READY':`PHASE ${current+1} / ${phases.length}`;
    phases.forEach((phase,index)=>{const row=this.find<HTMLElement>(`[data-load-phase="${phase.key}"]`),done=value>=100||index<current,active=value<100&&index===current;row.dataset.state=done?'done':active?'active':'pending';row.querySelector('b')!.textContent=done?'READY':active?'LOADING':'WAITING';});
  }

  notify(message: string): void {
    const item = document.createElement('div');
    const match = /^\+\s*(\d+)\s+(.+?)[.!]?$/.exec(message.trim());
    let pickup: ItemId | null = null;
    if(match) {
      const wanted=match[2].trim().toLowerCase();
      const found=Object.values(ITEMS).find(definition=>definition.displayName.toLowerCase()===wanted);
      if(found) pickup=found.id;
    }
    item.className = `notification${pickup?' pickup':''}`;
    item.innerHTML = pickup && match
      ? `${icon(pickup,'notification-art')}<span class="notification-copy"><b>+${esc(match[1])}</b><small>${esc(ITEMS[pickup].displayName)}</small></span>`
      : `<span class="notification-mark"></span><span class="notification-message">${esc(message)}</span>`;
    const notifications = this.find('.notifications');
    notifications.append(item);
    while (notifications.children.length > 5) notifications.firstElementChild?.remove();
    window.setTimeout(() => {item.classList.add('leaving'); window.setTimeout(() => item.remove(),260);},pickup?2200:3200);
  }

  resourceHit(kind: ResourceNode['kind'], amount: number, depleted = false, weakSpot = false): void {
    const feedback=this.find<HTMLElement>('.resource-feedback');
    const resourceLabels:Record<ResourceNode['kind'],string>=this.settings.language==='cs'?{tree:'DŘEVO',wood:'DŘEVO',stone:'KÁMEN',metal:'KOVOVÁ RUDA',sulfur:'SÍROVÁ RUDA',hqmetal:'HQ KOVOVÁ RUDA',fiber:'VLÁKNO',berries:'BOBULE'}:{tree:'WOOD',wood:'WOOD',stone:'STONE',metal:'METAL ORE',sulfur:'SULFUR ORE',hqmetal:'HIGH QUALITY METAL ORE',fiber:'CLOTH FIBER',berries:'BERRIES'};
    feedback.className=`resource-feedback ${kind}${depleted?' depleted':''}${weakSpot?' weak-spot':''}`;
    const weak=this.settings.language==='cs'?'SLABÉ MÍSTO':'WEAK SPOT';
    feedback.innerHTML=`<span class="resource-hit-mark"><i></i><i></i></span><div><strong>+${amount}</strong><small>${resourceLabels[kind]}${weakSpot?' · '+weak:''}${depleted?' · '+this.tx('depleted'):''}</small></div>`;
    void feedback.offsetWidth;
    feedback.classList.add('show');
    window.clearTimeout(this.resourceFeedbackTimer);
    this.resourceFeedbackTimer=window.setTimeout(()=>feedback.classList.remove('show'),depleted?1050:620);
  }

  setDiagnostics(visible:boolean){if(visible!==this.diagnosticVisible)this.toggleDiagnostics();}
  toggleDiagnostics(): void {
    this.diagnosticVisible = !this.diagnosticVisible;
    this.find('.diagnostics').hidden = !this.diagnosticVisible;
  }

  update(hud: HUDData, state: GameState): void {
    this.hud = hud;
    this.state = state;
    if (this.screen === 'playing') {
      this.renderHotbar(hud);
      this.updateStats(hud);
      this.renderCraftHud(state);
      this.updateEnvironmentStatus(state,hud);
      const degrees = ((Math.round(hud.compass) % 360) + 360) % 360;
      const dirs = ['N','NE','E','SE','S','SW','W','NW'];
      this.find('.compass-value').textContent = `${dirs[Math.round(degrees/45)%8]}  ${String(degrees).padStart(3,'0')}°`;
      this.find('.compass-line').style.backgroundPositionX = `${-degrees*2}px`;
      this.find('.biome-label').textContent = hud.biome.toUpperCase();
      const interaction = hud.interaction;
      const nameOnly=Boolean(interaction&&!interaction.action);
      const promptHTML = interaction ? nameOnly?`<div class="interaction-copy resource-name-only"><strong>${esc(interaction.title)}</strong></div>`:`<span class="interaction-key"><kbd>${esc(interaction.key)}</kbd></span><div class="interaction-copy"><strong>${esc(this.interactionAction(interaction.action))}</strong><span>${esc(interaction.title)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class="interaction-progress" style="width:${interaction.progress*100}%"></i>` : ''}</div>` : '';
      const prompt = this.find('.interaction-prompt');prompt.classList.toggle('resource-target',nameOnly);
      if(prompt.innerHTML !== promptHTML) prompt.innerHTML = promptHTML;
      const gameScreen=this.find('.game-screen');
      gameScreen.classList.toggle('targeted',Boolean(interaction));
      gameScreen.classList.toggle('building',Boolean(hud.build));
      this.find('.tutorial-copy').textContent = this.settings.showTutorialHints?hud.tutorial:'';
      this.find('.onboarding').classList.toggle('empty',!this.settings.showTutorialHints||!hud.tutorial);
      const fpsCounter=this.root.querySelector<HTMLElement>('.fps-counter');if(fpsCounter&&this.settings.showFps)fpsCounter.innerHTML=`<b>${Math.round(hud.fps)}</b><span>FPS</span><i>${(1000/Math.max(hud.fps,1)).toFixed(1)} ms</i>`;
      const buildHash = JSON.stringify(hud.build);
      if(buildHash !== this.buildHash) { this.buildHash = buildHash; this.renderBuild(hud); }
    }
    if (this.screen === 'inventory') {
      const hash = JSON.stringify([state.inventory,state.craftQueue.map(job => [job.recipeId,Math.ceil(job.remaining)]),this.selectedSlot,this.selectedRecipe,this.recipeCategory]);
      if (hash !== this.inventoryHash && this.dragSlot < 0) { this.inventoryHash = hash; this.renderInventory(state); }
    }
    if(this.diagnosticVisible)this.renderDiagnostics(hud,state);
  }

  private renderDiagnostics(hud:HUDData,state:GameState):void {
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

  private updateStats(hud: HUDData): void {
    const health=Math.max(0,Math.min(100,hud.stats.health));
    if(this.lastHealth!==null && health < this.lastHealth-.05) {
      const damage=Math.min(1,Math.max(.22,(this.lastHealth-health)/28));
      const vignette=this.find<HTMLElement>('.damage-vignette');
      vignette.style.setProperty('--damage',String(damage));
      vignette.classList.remove('flash');void vignette.offsetWidth;vignette.classList.add('flash');
    }
    this.lastHealth=health;
    for (const [className, stat] of [['health','health'],['thirst','thirst'],['hunger','hunger']] as const) {
      const value = Math.max(0,Math.min(100,hud.stats[stat]));
      this.find(`.vital.${className} i`).style.width = `${value}%`;
      this.find(`.vital.${className} b`).textContent = String(Math.ceil(value));
      this.find(`.vital.${className}`).classList.toggle('critical',value < 20);
      this.find(`.vital.${className}`).classList.toggle('warning',value >= 20 && value < 40);
    }
    this.find('.game-screen').classList.toggle('low-health',health < 28);
    this.find('.stamina i').style.width = `${hud.stats.stamina}%`;
    this.find('.stamina').classList.toggle('full',hud.stats.stamina > 99);
  }

  private renderCraftHud(state: GameState): void {
    const hash=JSON.stringify(state.craftQueue.map(job=>[job.recipeId,Math.ceil(job.remaining*10)/10]));
    if(hash===this.craftHudHash)return;
    this.craftHudHash=hash;
    const queue=this.find<HTMLElement>('.hud-craft-queue');
    queue.hidden=state.craftQueue.length===0;
    if(!state.craftQueue.length){queue.innerHTML='';return;}
    queue.innerHTML=`<div class="hud-craft-title"><span>${this.tx('crafting')}</span><b>${state.craftQueue.length}</b></div><div class="hud-craft-items">${state.craftQueue.slice(0,4).map(job=>{const recipe=RECIPES[job.recipeId];if(!recipe)return '';const progress=Math.max(0,Math.min(100,(1-job.remaining/job.total)*100));return `<div class="hud-craft-item" title="${esc(ITEMS[recipe.resultItemId].displayName)}">${icon(recipe.resultItemId)}<span><b>${esc(ITEMS[recipe.resultItemId].displayName)}</b><small>${job.remaining<=0?this.tx('ready'):`${Math.ceil(job.remaining)}s`}</small></span><i style="width:${progress}%"></i></div>`;}).join('')}</div>`;
  }

  private updateEnvironmentStatus(state:GameState,hud:HUDData):void {
    const weather=state.progression?.weather;
    const wet=weather?.kind==='rain'||weather?.kind==='storm'||(weather?.rain??0)>.2;
    const cold=hud.timeOfDay<5.5||hud.timeOfDay>21;
    this.find<HTMLElement>('.status-pill.wet').hidden=!wet;
    this.find<HTMLElement>('.status-pill.cold').hidden=!cold;
  }

  setDevModes(fly:boolean,god:boolean):void{for(const [mode,on] of [['fly',fly],['god',god]] as const){const button=this.root.querySelector<HTMLButtonElement>(`[data-dev="${mode}"]`);if(!button)continue;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));}}

  private renderHotbar(hud: HUDData): void {
    const hash = JSON.stringify([hud.inventory.slice(0,6),hud.activeSlot]);
    if (hash === this.hotbarHash) return;
    this.hotbarHash = hash;
    this.find('.hotbar').innerHTML = Array.from({length:6},(_,index) => this.slotHTML(hud.inventory[index] ?? null,index,index === hud.activeSlot,true)).join('');
    const active = hud.inventory[hud.activeSlot];
    this.find('.active-item-name').textContent = active ? ITEMS[active.itemId].displayName : this.tx('emptyHands');
  }

  private slotHTML(stack: ItemStack | null, index: number, selected: boolean, hotbar = false): string {
    const item = stack && ITEMS[stack.itemId];
    const tool=Boolean(item?.category==='tool');
    return `<button class="item-slot ${selected?'selected':''} ${stack?'occupied':''} ${tool?'tool-slot':''}" data-slot="${index}" ${hotbar?'data-hotbar="true"':''} draggable="${Boolean(stack)}" title="${item?esc(`${item.displayName} · ${stack!.count}`):'Empty slot'}" aria-label="${item?esc(item.displayName):'Empty slot'}${index < 6?` · quick slot ${index+1}`:''}">${index<6?`<span class="slot-key">${index+1}</span>`:''}${stack?`${icon(stack.itemId)}<span class="stack-count">${stack.count > 1 ? `×${stack.count}` : ''}</span>${tool?'<i class="slot-condition" title="Tool condition"></i>':''}`:''}</button>`;
  }

  private renderInventory(state: GameState): void {
    this.find('.inventory-backpack').innerHTML = Array.from({length:24},(_,index) => this.slotHTML(state.inventory[index+6] ?? null,index+6,this.selectedSlot === index+6)).join('');
    this.find('.inventory-belt').innerHTML = Array.from({length:6},(_,index) => this.slotHTML(state.inventory[index] ?? null,index,this.selectedSlot === index)).join('');
    this.find('.slot-usage').textContent = `${state.inventory.filter(Boolean).length} / 30 SLOTS`;
    this.find('.survivor-vitals').innerHTML = `<div><span>HEALTH</span><b>${Math.ceil(state.player.stats.health)}</b><i style="--value:${state.player.stats.health}%;--color:var(--health)"></i></div><div><span>HYDRATION</span><b>${Math.ceil(state.player.stats.thirst)}</b><i style="--value:${state.player.stats.thirst}%;--color:var(--water)"></i></div><div><span>NOURISHMENT</span><b>${Math.ceil(state.player.stats.hunger)}</b><i style="--value:${state.player.stats.hunger}%;--color:var(--food)"></i></div>`;
    this.find('.inventory-world-info').textContent = `ISLAND ${state.seed}  /  ${this.hud?.biome.toUpperCase() ?? 'WESTERN SHORE'}`;
    const selected = state.inventory[this.selectedSlot];
    const detail = this.find('.item-detail');
    if(selected) {
      const definition = ITEMS[selected.itemId];
      detail.innerHTML = `<div class="detail-art">${icon(selected.itemId)}</div><div class="detail-copy"><span class="eyebrow">${definition.category.toUpperCase()} <i>·</i> ${selected.count} CARRIED</span><h3>${esc(definition.displayName)}</h3><p>${esc(definition.description)}</p><div class="item-actions">${definition.consumable?'<button class="primary-button small" data-action="consume">USE ITEM</button>':''}${this.selectedSlot<6?'<button data-action="equip">EQUIP</button>':''}${selected.count>1?'<button data-action="split">SPLIT STACK</button>':''}<button data-action="drop">DROP ITEM</button></div></div>`;
    } else detail.innerHTML = '<div class="empty-detail"><span>+</span><h3>ROOM FOR POSSIBILITY</h3><p>Select an item to inspect, use or drop it.</p></div>';
    this.renderRecipes(state);
  }

  private owned(id: ItemId, state: GameState): number { return state.inventory.reduce((count,stack) => count + (stack?.itemId === id ? stack.count : 0),0); }

  private renderRecipes(state: GameState): void {
    const recipes = Object.values(RECIPES);
    const filtered = recipes.filter(recipe => this.recipeCategory === 'all' || ITEMS[recipe.resultItemId].category === this.recipeCategory || (this.recipeCategory === 'utility' && ['utility','food'].includes(ITEMS[recipe.resultItemId].category)));
    if(!filtered.some(recipe => recipe.id === this.selectedRecipe) && filtered[0]) this.selectedRecipe = filtered[0].id;
    this.root.querySelectorAll<HTMLElement>('[data-category]').forEach(button => button.classList.toggle('active', button.dataset.category === this.recipeCategory));
    this.find('.recipe-grid').innerHTML = filtered.map(recipe => {
      const possible = Object.entries(recipe.ingredients).every(([id,count]) => this.owned(id as ItemId,state) >= count!);
      return `<button class="recipe-item ${recipe.id === this.selectedRecipe?'selected':''} ${possible?'available':''}" data-recipe="${esc(recipe.id)}" title="${esc(ITEMS[recipe.resultItemId].displayName)}">${icon(recipe.resultItemId)}<span>${esc(ITEMS[recipe.resultItemId].displayName)}</span>${possible?'<i></i>':''}</button>`;
    }).join('');
    const recipe = RECIPES[this.selectedRecipe];
    if(!recipe) {this.find('.recipe-detail').innerHTML = '<p class="no-recipes">No recipes in this category.</p>';return;}
    const possible = Object.entries(recipe.ingredients).every(([id,count]) => this.owned(id as ItemId,state) >= count!);
    const result = ITEMS[recipe.resultItemId];
    const craftable=this.actions.canCraft(recipe.id);
    const blockedLabel=(recipe.requiredWorkbenchLevel??0)>nearbyWorkbench(state.progression?.stations??[],state.player.position)?`REQUIRES WORKBENCH LEVEL ${recipe.requiredWorkbenchLevel}`:!possible?'MISSING RESOURCES':state.craftQueue.length>=INVENTORY.MAX_CRAFT_QUEUE?'QUEUE FULL':'MAKE ROOM IN INVENTORY';
    this.find('.recipe-detail').innerHTML = `<div class="recipe-result"><div>${icon(recipe.resultItemId)}</div><span><small>${esc(recipe.category.toUpperCase())} <i>·</i> ${recipe.craftTime} SEC</small><h3>${esc(result.displayName)}</h3><p>${esc(result.description)}</p></span></div><div class="ingredients-heading"><span>REQUIRES</span><span>HAVE / NEED</span></div><div class="ingredients">${Object.entries(recipe.ingredients).map(([id,count]) => {const owned=this.owned(id as ItemId,state);return `<div class="ingredient ${owned<count!?'missing':''}">${icon(id as ItemId)}<span>${esc(ITEMS[id as ItemId].displayName)}</span><b>${owned}<i> / ${count}</i></b></div>`;}).join('')}</div><button class="primary-button craft-button" data-action="craft" ${craftable?'':'disabled'}>${craftable?`CRAFT ${recipe.resultCount>1?`×${recipe.resultCount}`:''}`:blockedLabel} ${craftable?chevron:'<span>⊖</span>'}</button>`;
    this.find('.craft-queue').innerHTML = `<div class="section-heading"><h3>CRAFTING QUEUE</h3><span>${state.craftQueue.length?state.craftQueue[0]?.remaining===0?'MAKE ROOM':`${state.craftQueue.length} IN PROGRESS`:'READY'}</span></div>${state.craftQueue.length?`<div class="queue-items">${state.craftQueue.map(job=>{const queuedRecipe=RECIPES[job.recipeId];return queuedRecipe?`<div class="queue-item" title="${esc(ITEMS[queuedRecipe.resultItemId].displayName)}">${icon(queuedRecipe.resultItemId)}<span>${job.remaining===0?'READY':`${Math.ceil(job.remaining)}s`}</span><i style="width:${Math.min(100,(1-job.remaining/job.total)*100)}%"></i></div>`:'';}).join('')}</div>`:'<p>Your next idea starts here.</p>'}`;
  }

  private renderBuild(hud: HUDData): void {
    const panel = this.find('.build-panel');
    if(!hud.build) {panel.innerHTML='';return;}
    const build = hud.build;
    panel.innerHTML = `<div class="build-mode-label"><span class="plan-symbol">⌑</span><span>BUILDING PLAN<small>${esc(build.cost)}</small></span></div><div class="piece-selector">${(Object.keys(PIECES) as PieceType[]).map(piece=>`<button data-piece="${piece}" class="${build.piece===piece?'active':''}" title="${labels[piece]}"><span>${this.pieceIcon(piece)}</span><small>${labels[piece]}</small></button>`).join('')}</div><div class="build-reason ${build.valid?'valid':'invalid'}"><i></i>${build.valid?'READY TO PLACE':esc(build.reason)}</div><div class="build-controls"><span><kbd>LMB</kbd> PLACE</span><span><kbd>R</kbd> ROTATE</span><span><kbd>Q</kbd> NEXT</span><span><kbd>RMB</kbd> CANCEL</span></div>`;
  }

  private bindEvents(): void {
    this.root.addEventListener('keydown',event=>{
      if(this.rebinding){event.preventDefault();event.stopPropagation();const action=this.rebinding;if(event.code==='Escape'){this.finishRebind();return;}const previous=this.settings.keybinds[action];const duplicate=(Object.keys(this.settings.keybinds) as KeybindAction[]).find(key=>key!==action&&this.settings.keybinds[key]===event.code);if(duplicate)this.settings.keybinds[duplicate]=previous;this.settings.keybinds[action]=event.code;this.finishRebind(false);this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);return;}
      const target=event.target;if(target instanceof HTMLElement&&target.matches('input,select,textarea'))event.stopPropagation();
    });
    this.root.addEventListener('click',event=>{
      const target=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(!target||(target instanceof HTMLButtonElement&&target.disabled))return;event.preventDefault();
      if(target.dataset.saveAction){this.handleSaveSlotAction(target.dataset.saveAction,Number(target.dataset.saveSlot));return;}
      if(target.dataset.action)this.handleAction(target.dataset.action);
      if(target.dataset.settingsTab)this.selectSettingsTab(target.dataset.settingsTab as typeof this.settingsTab);
      if(target.dataset.language)this.setLanguage(target.dataset.language==='cs'?'cs':'en');
      if(target.dataset.preset)this.setPreset(target.dataset.preset as Settings['quality']);
      if(target.dataset.shadowQuality){this.settings.shadowQuality=target.dataset.shadowQuality as Settings['shadowQuality'];this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}
      if(target.dataset.keybind)this.beginRebind(target.dataset.keybind as KeybindAction,target as HTMLButtonElement);
      if(target.dataset.slot!==undefined){const slot=Number(target.dataset.slot);if(target.dataset.hotbar){this.selectedSlot=slot;this.actions.selectSlot(slot);this.inventoryHash='';if(this.state)this.renderInventory(this.state);}else{this.selectedSlot=slot;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}}
      if(target.dataset.category){this.recipeCategory=target.dataset.category;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}
      if(target.dataset.recipe){this.selectedRecipe=target.dataset.recipe;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}
      if(target.dataset.piece)this.actions.selectPiece(target.dataset.piece as PieceType);
      if(target.dataset.toggle){const name=target.dataset.toggle as 'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom'|'vsync'|'telemetryPerformance'|'telemetryPlayer'|'telemetryCamera'|'telemetryWorld';this.settings[name]=target.dataset.value==='true';this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}
      if(target.dataset.dev)this.actions.dev(target.dataset.dev);
    });
    this.root.addEventListener('input',event=>{const input=event.target as HTMLInputElement;const name=input.dataset.setting as 'sensitivityX'|'sensitivityY'|'fov'|'viewmodelFov'|'masterVolume'|'musicVolume'|'effectsVolume'|'ambientVolume'|'renderScale'|'foliageDensity'|'shadowDistance'|'crosshairOpacity'|'crosshairScale'|'hudScale'|'hudOpacity'|'brightness'|'telemetryScale'|'telemetryOpacity'|undefined;if(!name)return;this.settings[name]=Number(input.value);this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);});
    this.root.addEventListener('dragstart',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(!slot||!this.state?.inventory[Number(slot.dataset.slot)])return;this.dragSlot=Number(slot.dataset.slot);this.dragSplit=event.shiftKey;event.dataTransfer?.setData('text/plain',String(this.dragSlot));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';slot.classList.add('dragging');});
    this.root.addEventListener('dragover',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(slot&&this.dragSlot>=0){event.preventDefault();slot.classList.add('drag-over');}});
    this.root.addEventListener('dragleave',event=>(event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.classList.remove('drag-over'));
    this.root.addEventListener('drop',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(slot&&this.dragSlot>=0){event.preventDefault();this.actions.moveItem(this.dragSlot,Number(slot.dataset.slot),this.dragSplit||event.shiftKey);}this.endDrag();});
    this.root.addEventListener('dragend',()=>this.endDrag());
    this.root.addEventListener('contextmenu',event=>{const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(slot&&this.screen==='inventory'){event.preventDefault();this.selectedSlot=Number(slot.dataset.slot);this.splitSelected();}});
  }

  private endDrag(): void {
    this.dragSlot=-1;this.dragSplit=false;this.inventoryHash='';
    this.root.querySelectorAll('.dragging,.drag-over').forEach(slot=>slot.classList.remove('dragging','drag-over'));
  }

  private splitSelected(): void {
    const stack=this.state?.inventory[this.selectedSlot];
    if(!stack || stack.count<2) return;
    const target=this.state!.inventory.findIndex((item,index)=>!item && index!==this.selectedSlot);
    if(target<0) this.notify('No free slot to split this stack.');
    else {this.actions.moveItem(this.selectedSlot,target,true);this.inventoryHash='';}
  }

  private handleAction(action:string):void {
    switch(action){
      case 'respawn':this.actions.respawn();break;
      case 'play':case 'continue':{const latest=[...this.saveSlots].filter(slot=>slot.exists).sort((a,b)=>(b.savedAt??0)-(a.savedAt??0))[0];if(latest)this.actions.continueGame(latest.slot);break;}
      case 'new':this.openSaveBrowser('new');break;
      case 'load':this.openSaveBrowser('load');break;
      case 'manageSaves':this.openSaveBrowser('manage');break;
      case 'saveBrowserClose':this.closeSaveBrowser();break;
      case 'confirmNew':{const slot=this.pendingSaveSlot;this.find<HTMLElement>('.new-game-confirm').hidden=true;this.pendingSaveSlot=null;if(slot!==null)this.startNewGame(slot);break;}
      case 'cancelNew':this.find<HTMLElement>('.new-game-confirm').hidden=true;this.pendingSaveSlot=null;break;
      case 'deleteSlotConfirm':{const slot=this.pendingDeleteSlot;if(slot===null)break;this.actions.deleteSave(slot);this.pendingDeleteSlot=null;this.find<HTMLElement>('.delete-slot-confirm').hidden=true;this.renderSaveBrowser();break;}
      case 'deleteSlotCancel':this.find<HTMLElement>('.delete-slot-confirm').hidden=true;this.pendingDeleteSlot=null;break;
      case 'settings':this.actions.setScreen('settings');break;
      case 'settingsBack':this.backFromSettings();break;
      case 'telemetryClose':this.toggleDiagnostics();break;
      case 'resume':this.actions.resume();break;case 'save':this.actions.save();break;case 'menu':this.actions.mainMenu();break;
      case 'reset':this.find('.reset-confirm').hidden=false;break;case 'resetCancel':this.find('.reset-confirm').hidden=true;break;case 'resetConfirm':this.actions.resetSave();this.find('.reset-confirm').hidden=true;this.setSaveAvailable(false);break;
      case 'resetCamera':this.settings={...this.settings,sensitivityX:DEFAULT_SETTINGS.sensitivityX,sensitivityY:DEFAULT_SETTINGS.sensitivityY,fov:DEFAULT_SETTINGS.fov,viewmodelFov:DEFAULT_SETTINGS.viewmodelFov,invertY:DEFAULT_SETTINGS.invertY,headBob:DEFAULT_SETTINGS.headBob,cameraShake:DEFAULT_SETTINGS.cameraShake,motionBlur:DEFAULT_SETTINGS.motionBlur,keybinds:{...DEFAULT_SETTINGS.keybinds}};this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);break;
      case 'resetSettings':{const language=this.settings.language;this.settings={...DEFAULT_SETTINGS,language,keybinds:{...DEFAULT_SETTINGS.keybinds}};this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);break;}
      case 'reloadBuild':{const url=new URL(window.location.href);url.searchParams.set('build',`${GAME_VERSION}-${GAME_BUILD}`);window.location.replace(url.toString());break;}
      case 'drop':this.actions.dropItem(this.selectedSlot);break;case 'consume':this.actions.consume(this.selectedSlot);break;case 'equip':this.actions.selectSlot(this.selectedSlot);this.actions.resume();break;case 'split':this.splitSelected();break;case 'craft':this.actions.craft(this.selectedRecipe);break;
      case 'history':{const panel=this.find('.history-panel');panel.hidden=!panel.hidden;if(!panel.hidden)this.find('.help-panel').hidden=true;break;}case 'help':{const panel=this.find('.help-panel');panel.hidden=!panel.hidden;if(!panel.hidden)this.find('.history-panel').hidden=true;break;}
    }
  }
  private startNewGame(slot=1):void{const seedText=this.find<HTMLInputElement>('#world-seed').value.trim(),seed=seedText?Number(seedText):undefined;this.closeSaveBrowser();this.actions.newGame(seed!==undefined&&Number.isFinite(seed)?Math.floor(seed):undefined,slot);}
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
  }
  private tx(key:TranslationKey):string{return t(this.settings.language,key);}
  private applyLanguage():void{if(!this.root)return;document.documentElement.lang=this.settings.language==='cs'?'cs':'en';this.root.dataset.language=this.settings.language;this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el=>{const key=el.dataset.i18n as TranslationKey;if(key)el.textContent=this.tx(key);});this.root.querySelectorAll<HTMLElement>('[data-language]').forEach(button=>button.classList.toggle('active',button.dataset.language===this.settings.language));const h=this.root.querySelector<HTMLElement>('.vital.health div span'),w=this.root.querySelector<HTMLElement>('.vital.thirst div span'),f=this.root.querySelector<HTMLElement>('.vital.hunger div span'),st=this.root.querySelector<HTMLElement>('.stamina span');if(h)h.textContent=this.tx('health');if(w)w.textContent=this.tx('water');if(f)f.textContent=this.tx('food');if(st)st.textContent=this.tx('stamina');const wet=this.root.querySelector<HTMLElement>('.status-pill.wet'),cold=this.root.querySelector<HTMLElement>('.status-pill.cold');if(wet)wet.textContent=this.tx('wet');if(cold)cold.textContent=this.tx('cold');const caption=this.root.querySelector<HTMLElement>('.hotbar-caption');if(caption)caption.innerHTML=`<span><kbd>${keyLabel(this.settings.keybinds.inventory)}</kbd> ${this.tx('inventory')}</span><span><kbd>ESC</kbd> ${this.tx('menu')}</span>`;this.setSaveAvailable(this.saveAvailable);this.renderSaveBrowser();}
  private setLanguage(language:Settings['language']):void{if(this.settings.language===language)return;this.settings.language=language;this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}
  private selectSettingsTab(tab:typeof this.settingsTab):void{this.settingsTab=tab;this.root.querySelectorAll<HTMLElement>('[data-settings-tab]').forEach(button=>button.classList.toggle('active',button.dataset.settingsTab===tab));this.root.querySelectorAll<HTMLElement>('[data-settings-page]').forEach(page=>page.classList.toggle('active',page.dataset.settingsPage===tab));}
  private setPreset(quality:Settings['quality']):void{const presets={low:{renderScale:.7,shadows:false,shadowQuality:'low',shadowDistance:45,foliageDensity:.38,postProcessing:false,ambientOcclusion:false,bloom:false,motionBlur:false},medium:{renderScale:.85,shadows:true,shadowQuality:'low',shadowDistance:58,foliageDensity:.55,postProcessing:false,ambientOcclusion:false,bloom:false,motionBlur:false},high:{renderScale:1,shadows:true,shadowQuality:'medium',shadowDistance:72,foliageDensity:.72,postProcessing:true,ambientOcclusion:true,bloom:true,motionBlur:false},ultra:{renderScale:1,shadows:true,shadowQuality:'high',shadowDistance:92,foliageDensity:.88,postProcessing:true,ambientOcclusion:true,bloom:true,motionBlur:true}} as const;Object.assign(this.settings,{quality,...presets[quality]});this.actions.settings({...this.settings,keybinds:{...this.settings.keybinds}});this.setSettings(this.settings);}
  private beginRebind(action:KeybindAction,button:HTMLButtonElement):void{this.finishRebind();this.rebinding=action;button.classList.add('rebinding');button.textContent=this.tx('pressKey');button.focus();}
  private finishRebind(restore=true):void{if(!this.rebinding)return;const button=this.root.querySelector<HTMLButtonElement>(`[data-keybind="${this.rebinding}"]`);if(button){button.classList.remove('rebinding');if(restore)button.textContent=keyLabel(this.settings.keybinds[this.rebinding]);}this.rebinding=null;}
  private keybindRows():string{const rows:[KeybindAction,TranslationKey][]=[['forward','forward'],['backward','backward'],['left','left'],['right','right'],['sprint','sprint'],['jump','jump'],['crouch','crouch'],['interact','interact'],['inventory','inventory'],['build','build'],['rotate','rotate'],['cycleBuild','cycleBuild'],['use','use'],['map','map'],['maintenance','maintenance'],['autoRun','autoRun'],['inspect','inspect']];return rows.map(([action,label])=>`<div class="keybind-row"><span data-i18n="${label}">${esc(this.tx(label))}</span><button data-keybind="${action}">${keyLabel(this.settings.keybinds[action])}</button></div>`).join('');}
  private interactionAction(action:string):string{const clean=action.toUpperCase();if(clean.startsWith('PICK UP'))return `${this.tx('pickUp')}${action.slice(7)}`;const map:Record<string,TranslationKey>={OPEN:'open',CLOSE:'close',AUTHORIZE:'authorize',USE:'useAction',GATHER:'gather','DRINK FRESH WATER':'drink'};return map[clean]?this.tx(map[clean]):action;}
  private slider(name:string,label:TranslationKey,detail:TranslationKey,min:number,max:number,step:number):string{return `<div class="setting-row"><label for="setting-${name}"><span data-i18n="${label}">${esc(this.tx(label))}</span><small data-i18n="${detail}">${esc(this.tx(detail))}</small></label><div class="setting-slider"><input id="setting-${name}" data-setting="${name}" type="range" min="${min}" max="${max}" step="${step}"><output data-setting-value="${name}"></output></div></div>`;}
  private toggle(name:'invertY'|'headBob'|'cameraShake'|'motionBlur'|'shadows'|'showCompass'|'showFps'|'showTutorialHints'|'postProcessing'|'ambientOcclusion'|'bloom'|'vsync'|'telemetryPerformance'|'telemetryPlayer'|'telemetryCamera'|'telemetryWorld',label:TranslationKey,detail:TranslationKey):string{return `<div class="setting-row toggle-row"><label><span data-i18n="${label}">${esc(this.tx(label))}</span><small data-i18n="${detail}">${esc(this.tx(detail))}</small></label><div class="toggle-options"><button data-toggle="${name}" data-value="false"><span data-i18n="off">OFF</span></button><button data-toggle="${name}" data-value="true"><span data-i18n="on">ON</span></button></div></div>`;}
  private settingValue(name:string,value:number):string{if(name.includes('Volume')||name==='crosshairOpacity'||name==='hudOpacity')return `${Math.round(value*100)}%`;if(name==='fov'||name==='viewmodelFov')return `${Math.round(value)}°`;if(name==='renderScale'||name==='hudScale'||name==='crosshairScale'||name==='brightness'||name==='foliageDensity'||name==='telemetryScale'||name==='telemetryOpacity')return `${Math.round(value*100)}%`;if(name==='shadowDistance')return `${Math.round(value)} m`;if(name==='sensitivityX'||name==='sensitivityY')return `${value.toFixed(2)}×`;return `${value.toFixed(1)}×`;}

  private pieceIcon(piece: PieceType): string {const shapes:Record<PieceType,string>={foundation:'<path d="m3 12 9-5 9 5-9 5zM3 12v4l9 5 9-5v-4M12 17v4"/>',wall:'<path d="M5 4h14v17H5zM8 4v17M12 4v17M16 4v17"/>',doorway:'<path d="M4 3h16v18h-5V9H9v12H4z"/>',floor:'<path d="m3 12 9-6 9 6-9 6zM6 10l9 6M10 8l9 6"/>',roof:'<path d="m2 15 10-10 10 10M5 12v8h14v-8M12 5v15"/>',door:'<path d="M6 3h12v18H6zM15 12v2M9 3v18M4 21h16"/>'};return `<svg viewBox="0 0 24 24">${shapes[piece]}</svg>`;}
  private character(): string {return `<svg class="character-art" viewBox="0 0 240 470" aria-label="Survivor illustration"><defs><linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#aaa492"/><stop offset="1" stop-color="#4e5249"/></linearGradient><linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#737a6d"/><stop offset="1" stop-color="#343d34"/></linearGradient></defs><ellipse cx="122" cy="450" rx="68" ry="9" fill="#0b1513" opacity=".45"/><g stroke="#2c342d" stroke-width="1.5"><path d="m99 80-3 19-28 16-14 44-16 78 9 11 13-12 15-65 10-12 1 89 65 2 7-88 10 20 13 57 13 13 10-9-17-94-15-29-35-19-2-26" fill="url(#skin)"/><path d="m87 237-4 72 5 49-1 66 23 4 9-66 4-48 5 48 7 66 23-3-1-70 2-41-9-76" fill="url(#cloth)"/><path d="m87 419-4 20-17 7v8h43l4-31m22 0 1 30h40l-1-9-19-10-2-15" fill="#3c4138"/><path d="m83 114 17-11 22 14 19-16 15 12-1 58-8 48-60-1-6-52z" fill="url(#cloth)"/><path d="m99 46 1-13 9-12 17-4 17 10 6 23-7 31-11 11-16-4-14-15z" fill="url(#skin)"/><path d="m99 47-2-10 5-13 13-8 18 2 11 11 4 16-9-5-8-14-11 9-20 7" fill="#393f36"/><path d="m110 56 8-2m13 0 8 2m-16 1-3 11 8 1m-12 8 15-1" fill="none"/><path d="m89 231 60 1 4 11-65 1z" fill="#80745b"/><path d="m110 231 17 1v14h-17z" fill="#303930"/><path d="m85 160 8 44m57-39-13 37m-48 97 24 2m19-2 22-1m-63 52 18 4m27-2 18-4" stroke="#959982" opacity=".35"/><path d="m46 238-4 9 2 16 7 5 7-9-1-17m127 1-1 18 8 10 7-4 3-15-7-13" fill="url(#skin)"/><path d="m96 100 17 10m15-1 16-10m-21 17 1 107" fill="none" opacity=".6"/></g><path d="M36 101h-9v306h9M207 101h9v306h-9" stroke="#c9cfb9" stroke-opacity=".15" fill="none"/><path d="M18 168h23M201 168h23M18 318h23M201 318h23" stroke="#c9cfb9" stroke-opacity=".15"/></svg>`;}
}
