import {nearbyWorkbench} from '../survival/stations';
import type { GameState, HUDData, ItemId, ItemStack, PieceType, Screen, Settings, UIActions } from '../core/types';
import {INVENTORY} from '../config/gameplay';
import { DEFAULT_SETTINGS } from '../config/balance';
import {CHANGELOG,GAME_BUILD,GAME_RELEASE_DATE,GAME_VERSION} from '../config/version';
import { ITEMS } from '../items/definitions';
import { RECIPES } from '../crafting/recipes';
import { PIECES } from '../building/rules';
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
  private settings: Settings = {...DEFAULT_SETTINGS};
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

  constructor(container: HTMLElement, actions: UIActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'tide-ui';
    this.root.dataset.screen = 'menu';
    this.root.innerHTML = `
      <section class="screen menu-screen" data-view="menu" aria-label="Main menu">
        <header class="menu-masthead"><a class="brand-mark" href="#" aria-label="Tideland home">${mark}</a><span>AN OPEN WORLD<br>SURVIVAL EXPERIENCE</span><div class="edition"><i></i> EARLY ACCESS <b>02</b></div></header>
        <div class="menu-content"><div class="eyebrow"><span></span> NOTHING GIVEN. EVERYTHING EARNED.</div><h1>TIDELAND<span class="title-period">.</span></h1><p class="menu-description">The tide brings you here.<br>What you make of it is yours.</p>
        <nav class="main-nav" aria-label="Game actions"><button class="new-game menu-link" data-action="new"><span class="nav-index">01</span><strong>NEW GAME</strong>${chevron}</button><button class="menu-link continue-game" data-action="continue" disabled><span class="nav-index">02</span><strong>CONTINUE</strong><span class="menu-meta">NO SAVED WORLD</span>${chevron}</button><button class="menu-link" data-action="settings"><span class="nav-index">03</span><strong>SETTINGS</strong>${chevron}</button><button class="menu-link" data-action="history"><span class="nav-index">04</span><strong>HISTORY</strong><span class="menu-meta">v${GAME_VERSION}</span>${chevron}</button></nav>
        <div class="seed-control"><label for="world-seed">WORLD SEED</label><input id="world-seed" type="text" inputmode="numeric" maxlength="10" placeholder="731942" aria-label="World seed"><span>PROCEDURAL ISLAND</span></div></div>
        <div class="menu-location"><span class="location-line"></span><span>THE WESTERN SHORE<small>A new beginning awaits.</small></span><span class="coordinate">47° 36′ N<br>122° 20′ W</span></div>
        <footer class="menu-footer"><span>INDEPENDENT SURVIVAL SANDBOX <i>/</i> VERSION ${GAME_VERSION} <i>/</i> ${GAME_BUILD}</span><button data-action="help" class="text-button">CONTROLS <span>↗</span></button><span class="local-save-status"><i></i> LOCAL WORLD · SOLO</span></footer>
      </section>

      <section class="screen game-screen" data-view="playing" aria-label="Gameplay interface">
        <div class="compass-wrap"><div class="compass-value">N</div><div class="compass-line"></div><div class="compass-needle"></div><div class="biome-label">WESTERN SHORE</div></div>
        <div class="crosshair"><i></i></div><div class="interaction-prompt"></div>
        <div class="onboarding"><span class="hint-rule"></span><span class="tutorial-copy"></span><button class="help-shortcut" data-action="help" title="View controls">?</button></div>
        <div class="build-panel"></div>
        <div class="hotbar-wrap"><div class="active-item-name"></div><div class="hotbar"></div><div class="hotbar-caption"><span><kbd>TAB</kbd> INVENTORY & CRAFTING</span><span><kbd>ESC</kbd> PAUSE</span></div></div>
        <div class="vitals"><div class="vital health"><span class="vital-icon">+</span><div><i></i><span>HEALTH</span><b>100</b></div></div><div class="vital thirst"><span class="vital-icon droplet">◊</span><div><i></i><span>HYDRATION</span><b>100</b></div></div><div class="vital hunger"><span class="vital-icon food-icon">×</span><div><i></i><span>NOURISHMENT</span><b>100</b></div></div><div class="stamina"><i></i><span>STAMINA</span></div></div>
      </section>

      <section class="screen inventory-screen" data-view="inventory" aria-label="Inventory and crafting">
        <header class="overlay-header"><div class="small-brand">${mark}<span>TIDELAND</span><i>/</i><span class="muted">FIELD INVENTORY</span></div><button class="close-button" data-action="resume"><kbd>TAB</kbd> BACK TO WORLD <span>×</span></button></header>
        <div class="inventory-layout"><aside class="survivor-panel"><div class="eyebrow">WASHED ASHORE</div><h2>THE SURVIVOR</h2><div class="survivor-figure">${this.character()}</div><div class="survivor-tag"><span>UNCLAIMED TERRITORY</span><b>Make a place for yourself.</b></div><div class="survivor-vitals"></div></aside>
        <main class="inventory-main"><div class="section-heading"><h2>INVENTORY</h2><span class="slot-usage">0 / 30 SLOTS</span></div><div class="inventory-backpack inventory-grid"></div><div class="quickbelt-heading"><h3>QUICK BELT</h3><span>PRESS 1–6 TO EQUIP</span></div><div class="inventory-belt inventory-grid"></div><div class="inventory-instructions"><span>DRAG TO MOVE</span><span>SHIFT + DRAG TO SPLIT</span><span>RIGHT CLICK FOR HALF STACK</span></div><div class="item-detail"></div></main>
        <aside class="crafting-panel"><div class="section-heading"><h2>CRAFTING</h2><span class="crafting-label">BY HAND</span></div><div class="craft-tabs"><button data-category="all" class="active">ALL</button><button data-category="tool">TOOLS</button><button data-category="building">BUILDING</button><button data-category="utility">SURVIVAL</button></div><div class="recipe-grid"></div><div class="recipe-detail"></div><div class="craft-queue"></div></aside></div>
        <footer class="inventory-footer"><span>Everything you carry is a possibility.</span><span class="inventory-world-info"></span></footer>
      </section>

      <section class="screen modal-screen pause-screen" data-view="pause" aria-label="Pause menu"><div class="modal-content"><div class="eyebrow">TAKE A BREATH</div><h2>PAUSED<span>.</span></h2><p>The island can wait.</p><nav class="pause-nav"><button class="primary-button" data-action="resume">RETURN TO WORLD ${chevron}</button><button data-action="save">SAVE WORLD <span>LOCAL SAVE</span></button><button data-action="settings">SETTINGS ${chevron}</button><button data-action="menu">MAIN MENU ${chevron}</button></nav><div class="pause-footnote"><i></i> Simulation paused</div></div></section>

      <section class="screen settings-screen" data-view="settings" aria-label="Settings"><header class="overlay-header"><div class="small-brand">${mark}<span>TIDELAND</span><i>/</i><span class="muted">SETTINGS</span></div><button class="close-button" data-action="settingsBack">BACK <span>×</span></button></header><div class="settings-content"><div class="settings-intro"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>LIVE<br>PREVIEW<span>.</span></h2><p>Changes apply immediately and save automatically.<br><small>BUILD v${GAME_VERSION} · ${GAME_BUILD}</small></p></div><div class="settings-controls"><h3>CONTROLS & CAMERA</h3>${this.slider('sensitivity','Mouse sensitivity <small>Buffered and normalized across high-DPI displays</small>',0.05,2.5,0.05)}${this.slider('fov','World field of view <small>Uses the current proven camera behaviour</small>',60,100,1)}${this.slider('viewmodelFov','Held-item field of view <small>Changes only hands and equipped tools</small>',40,75,1)}${this.toggle('invertY','Invert vertical look','Reverse mouse Y movement')}${this.toggle('headBob','Head bob','Subtle walking camera motion')}<div class="settings-actions"><button data-action="resetCamera">RESET CAMERA</button></div><h3>AUDIO</h3>${this.slider('masterVolume','Master volume',0,1,0.01)}${this.slider('effectsVolume','Effects volume',0,1,0.01)}<h3>GRAPHICS & HUD</h3><div class="setting-row quality-row"><label>Graphics quality<small>Vegetation and environment detail</small></label><div class="quality-options"><button data-quality="low">LOW</button><button data-quality="medium">MEDIUM</button><button data-quality="high">HIGH</button></div></div>${this.slider('renderScale','Render scale <small>Lower this first if FPS is low</small>',0.5,1,0.05)}${this.toggle('shadows','Dynamic shadows','Disable for a large GPU performance gain')}${this.slider('crosshairOpacity','Crosshair opacity',0,1,0.05)}${this.toggle('showCompass','Compass','Show the navigation strip at the top')}<h3>TROUBLESHOOTING</h3><div class="setting-row setting-buttons"><label>Local settings<small>Useful when two devices behave differently.</small></label><div><button data-action="resetSettings">RESET SETTINGS</button><button data-action="reloadBuild">RELOAD LATEST BUILD</button></div></div><div class="save-reset-row"><span>LOCAL SAVE DATA<small>Remove your saved island and progress.</small></span><button class="danger-button" data-action="reset">RESET SAVE</button></div><div class="reset-confirm" hidden><span>This permanently removes the saved world.</span><button data-action="resetConfirm">DELETE SAVE</button><button data-action="resetCancel">CANCEL</button></div></div></div></section>

      <section class="screen dead-screen modal-screen" data-view="dead" aria-label="Death screen"><div class="modal-content"><div class="eyebrow">THE ISLAND REMAINS</div><h2>WASHED<br>AWAY<span>.</span></h2><p>Every shore is another beginning.</p><button class="primary-button" data-action="respawn">RESPAWN ${chevron}</button><button class="text-button" data-action="menu">RETURN TO MAIN MENU</button></div></section>

      <aside class="history-panel" hidden aria-label="Update history"><div class="section-heading"><div><div class="eyebrow">EARLY ACCESS DEVELOPMENT</div><h2>TIDELAND HISTORY</h2></div><button class="close-button" data-action="history">×</button></div><div class="history-current"><span>CURRENT VERSION</span><strong>${GAME_VERSION}</strong><small>${GAME_BUILD} · ${GAME_RELEASE_DATE}</small></div><div class="history-list">${CHANGELOG.map(entry=>`<article class="history-entry"><header><strong>v${esc(entry.version)}</strong><span>${esc(entry.date)}</span></header><h3>${esc(entry.title)}</h3><ul>${entry.changes.map(change=>`<li>${esc(change)}</li>`).join('')}</ul></article>`).join('')}</div></aside>\n\n      <aside class="help-panel" hidden><div class="section-heading"><h2>FIELD GUIDE</h2><button class="close-button" data-action="help">×</button></div><p>Learn the island. Build something that lasts.</p><dl><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>Move</dd><dt><kbd>MOUSE</kbd></dt><dd>Look around</dd><dt><kbd>SHIFT</kbd> / <kbd>SPACE</kbd></dt><dd>Sprint / jump</dd><dt><kbd>C</kbd> / <kbd>CTRL</kbd></dt><dd>Crouch</dd><dt><kbd>LMB</kbd></dt><dd>Gather / use equipped item</dd><dt><kbd>E</kbd></dt><dd>Pick up / open door</dd><dt><kbd>TAB</kbd></dt><dd>Inventory & crafting</dd><dt><kbd>1</kbd> — <kbd>6</kbd></dt><dd>Equip quick belt item</dd><dt><kbd>B</kbd></dt><dd>Building plan</dd><dt><kbd>R</kbd></dt><dd>Rotate building piece</dd><dt><kbd>Q</kbd></dt><dd>Cycle building piece</dd><dt><kbd>LMB</kbd> / <kbd>RMB</kbd></dt><dd>Place / cancel build</dd><dt><kbd>ESC</kbd></dt><dd>Pause / release cursor</dd></dl><div class="field-guide-tip">Start with loose wood and stone. Equip your rock to gather from trees and nodes. Craft a building plan to begin your shelter.</div></aside>
      <div class="notifications" aria-live="polite"></div>
      <aside class="diagnostics" hidden><strong>DEVELOPER TELEMETRY <span>F3</span></strong><pre></pre><div><button data-dev="resources">GIVE RESOURCES</button><button data-dev="plan">GIVE PLAN</button><button data-dev="spawn">RESET POSITION</button><button data-dev="day">DAYTIME</button><button data-dev="night">NIGHT</button><button data-dev="speed">TIME ×20</button><button data-dev="normal">TIME ×1</button><button data-dev="sockets">SNAP SOCKETS</button><button data-dev="collisions">COLLISIONS</button></div></aside>
      <div class="loading-screen" hidden><div class="loading-mark">${mark}</div><h2>FINDING YOUR SHORE</h2><div class="loading-bar"><i class="loading-bar-fill"></i></div><div class="loading-meta"><span class="loading-status">Preparing engine</span><b class="loading-percent">0%</b></div><p>Shaping the land. Letting the wild in.</p></div>
    `;
    container.append(this.root);
    this.bindEvents();
    this.setSettings(this.settings);
  }

  private find<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }

  setScreen(screen: Screen): void {
    if (screen === 'settings' && this.screen !== 'settings') this.lastSettingsScreen = this.screen === 'menu' ? 'menu' : 'pause';
    if(screen!==this.screen)this.endDrag();
    this.screen = screen;
    this.root.dataset.screen = screen;
    this.find('.help-panel').hidden = true;
    this.find('.reset-confirm').hidden = true;
    if (screen === 'inventory' && this.state) { this.inventoryHash = ''; this.renderInventory(this.state); }
  }

  setSettings(settings: Settings): void {
    this.settings = {...settings};
    for (const name of ['sensitivity','fov','viewmodelFov','masterVolume','effectsVolume','renderScale','crosshairOpacity'] as const) {
      const input = this.find<HTMLInputElement>(`input[data-setting="${name}"]`);
      input.value = String(settings[name]);
      this.find(`[data-setting-value="${name}"]`).textContent = this.settingValue(name, settings[name]);
      input.style.setProperty('--range',`${(settings[name] - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`);
    }
    this.root.querySelectorAll<HTMLElement>('[data-quality]').forEach(button => button.classList.toggle('active',button.dataset.quality === settings.quality));
    for(const name of ['invertY','headBob','shadows','showCompass'] as const)this.root.querySelectorAll<HTMLElement>(`[data-toggle="${name}"]`).forEach(button=>button.classList.toggle('active',String(settings[name])===button.dataset.value));
    this.root.classList.toggle('hide-compass',!settings.showCompass);
    this.root.style.setProperty('--crosshair-opacity',String(settings.crosshairOpacity));
  }

  setSaveAvailable(available: boolean): void {
    this.find<HTMLButtonElement>('.continue-game').disabled = !available;
    this.find('.menu-meta').textContent = available ? 'RETURN TO YOUR ISLAND' : 'NO SAVED WORLD';
  }

  setLoading(loading: boolean): void { this.find('.loading-screen').hidden = !loading; if(loading)this.setLoadingProgress(0,'Preparing engine'); }
  setLoadingProgress(progress:number,status:string):void{const value=Math.max(0,Math.min(100,progress));this.find<HTMLElement>('.loading-bar-fill').style.width=`${value}%`;this.find('.loading-percent').textContent=`${Math.round(value)}%`;this.find('.loading-status').textContent=status;}

  notify(message: string): void {
    const item = document.createElement('div');
    item.className = 'notification';
    item.innerHTML = `<span class="notification-mark"></span><span>${esc(message)}</span>`;
    const notifications = this.find('.notifications');
    notifications.append(item);
    while (notifications.children.length > 5) notifications.firstElementChild?.remove();
    window.setTimeout(() => {item.classList.add('leaving'); window.setTimeout(() => item.remove(),300);},3400);
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
      const degrees = ((Math.round(hud.compass) % 360) + 360) % 360;
      const dirs = ['N','NE','E','SE','S','SW','W','NW'];
      this.find('.compass-value').textContent = `${dirs[Math.round(degrees/45)%8]}  ${String(degrees).padStart(3,'0')}°`;
      this.find('.compass-line').style.backgroundPositionX = `${-degrees*2}px`;
      this.find('.biome-label').textContent = hud.biome.toUpperCase();
      const interaction = hud.interaction;
      const promptHTML = interaction ? `<kbd>${esc(interaction.key)}</kbd><div><strong>${esc(interaction.title)}</strong><span>${esc(interaction.action)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class="interaction-progress" style="width:${interaction.progress*100}%"></i>` : ''}</div>` : '';
      const prompt = this.find('.interaction-prompt');
      if(prompt.innerHTML !== promptHTML) prompt.innerHTML = promptHTML;
      const gameScreen=this.find('.game-screen');
      gameScreen.classList.toggle('targeted',Boolean(interaction));
      gameScreen.classList.toggle('building',Boolean(hud.build));
      this.find('.tutorial-copy').textContent = hud.tutorial;
      this.find('.onboarding').classList.toggle('empty',!hud.tutorial);
      const buildHash = JSON.stringify(hud.build);
      if(buildHash !== this.buildHash) { this.buildHash = buildHash; this.renderBuild(hud); }
    }
    if (this.screen === 'inventory') {
      const hash = JSON.stringify([state.inventory,state.craftQueue.map(job => [job.recipeId,Math.ceil(job.remaining)]),this.selectedSlot,this.selectedRecipe,this.recipeCategory]);
      if (hash !== this.inventoryHash && this.dragSlot < 0) { this.inventoryHash = hash; this.renderInventory(state); }
    }
    if(this.diagnosticVisible) this.find('.diagnostics pre').textContent = `BUILD        v${GAME_VERSION} / ${GAME_BUILD}\nFPS          ${Math.round(hud.fps)}\nFRAME        ${(1000/Math.max(hud.fps,1)).toFixed(1)} ms\nSEED         ${state.seed}\nBIOME        ${hud.biome}\nPOSITION     ${state.player.position.x.toFixed(1)}, ${state.player.position.y.toFixed(1)}, ${state.player.position.z.toFixed(1)}\nSTRUCTURES   ${state.structures.length}\nWORLD TIME   ${state.timeOfDay.toFixed(2)}\n${hud.diagnostics}`;
  }

  private updateStats(hud: HUDData): void {
    for (const [className, stat] of [['health','health'],['thirst','thirst'],['hunger','hunger']] as const) {
      const value = Math.max(0,Math.min(100,hud.stats[stat]));
      this.find(`.vital.${className} i`).style.width = `${value}%`;
      this.find(`.vital.${className} b`).textContent = String(Math.ceil(value));
      this.find(`.vital.${className}`).classList.toggle('critical',value < 20);
    }
    this.find('.stamina i').style.width = `${hud.stats.stamina}%`;
    this.find('.stamina').classList.toggle('full',hud.stats.stamina > 99);
  }

  private renderHotbar(hud: HUDData): void {
    const hash = JSON.stringify([hud.inventory.slice(0,6),hud.activeSlot]);
    if (hash === this.hotbarHash) return;
    this.hotbarHash = hash;
    this.find('.hotbar').innerHTML = Array.from({length:6},(_,index) => this.slotHTML(hud.inventory[index] ?? null,index,index === hud.activeSlot,true)).join('');
    const active = hud.inventory[hud.activeSlot];
    this.find('.active-item-name').textContent = active ? ITEMS[active.itemId].displayName : 'EMPTY HANDS';
  }

  private slotHTML(stack: ItemStack | null, index: number, selected: boolean, hotbar = false): string {
    const item = stack && ITEMS[stack.itemId];
    return `<button class="item-slot ${selected?'selected':''} ${stack?'occupied':''}" data-slot="${index}" ${hotbar?'data-hotbar="true"':''} draggable="${Boolean(stack)}" title="${item?esc(`${item.displayName} · ${stack!.count}`):'Empty slot'}" aria-label="${item?esc(item.displayName):'Empty slot'}${index < 6?` · quick slot ${index+1}`:''}">${index<6?`<span class="slot-key">${index+1}</span>`:''}${stack?`${icon(stack.itemId)}<span class="stack-count">${stack.count > 1 ? `×${stack.count}` : ''}</span><i class="slot-condition"></i>`:''}</button>`;
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
    this.root.addEventListener('keydown',event => { const target=event.target; if(target instanceof HTMLElement && target.matches('input,select,textarea')) event.stopPropagation(); });
    this.root.addEventListener('click',event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('button,a');
      if(!target || (target instanceof HTMLButtonElement && target.disabled)) return;
      event.preventDefault();
      if(target.dataset.action) this.handleAction(target.dataset.action);
      if(target.dataset.slot !== undefined) {
        const slot = Number(target.dataset.slot);
        if(target.dataset.hotbar) {
          this.selectedSlot=slot;
          this.actions.selectSlot(slot);
          this.inventoryHash='';
          if(this.state)this.renderInventory(this.state);
        } else {
          this.selectedSlot=slot;
          this.inventoryHash='';
          if(this.state)this.renderInventory(this.state);
        }
      }
      if(target.dataset.category) {this.recipeCategory=target.dataset.category;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}
      if(target.dataset.recipe) {this.selectedRecipe=target.dataset.recipe;this.inventoryHash='';if(this.state)this.renderInventory(this.state);}
      if(target.dataset.piece) this.actions.selectPiece(target.dataset.piece as PieceType);
      if(target.dataset.quality) {this.settings.quality=target.dataset.quality as Settings['quality'];this.actions.settings({...this.settings});this.setSettings(this.settings);}
      if(target.dataset.toggle) {const name=target.dataset.toggle as 'invertY'|'headBob'|'shadows'|'showCompass';this.settings[name]=target.dataset.value==='true';this.actions.settings({...this.settings});this.setSettings(this.settings);}
      if(target.dataset.dev) this.actions.dev(target.dataset.dev);
    });
    this.root.addEventListener('input',event => {
      const input = event.target as HTMLInputElement;
      const name = input.dataset.setting as 'sensitivity'|'fov'|'viewmodelFov'|'masterVolume'|'effectsVolume'|'renderScale'|'crosshairOpacity'|undefined;
      if(!name) return;
      this.settings[name] = Number(input.value);
      this.actions.settings({...this.settings});
      this.setSettings(this.settings);
    });
    this.root.addEventListener('dragstart',event => {
      const slot = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if(!slot || !this.state?.inventory[Number(slot.dataset.slot)]) return;
      this.dragSlot=Number(slot.dataset.slot);this.dragSplit=event.shiftKey;
      event.dataTransfer?.setData('text/plain',String(this.dragSlot));
      if(event.dataTransfer) event.dataTransfer.effectAllowed='move';
      slot.classList.add('dragging');
    });
    this.root.addEventListener('dragover',event => {
      const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if(slot && this.dragSlot>=0) {event.preventDefault();slot.classList.add('drag-over');}
    });
    this.root.addEventListener('dragleave',event => (event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.classList.remove('drag-over'));
    this.root.addEventListener('drop',event => {
      const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if(slot && this.dragSlot>=0) {event.preventDefault();this.actions.moveItem(this.dragSlot,Number(slot.dataset.slot),this.dragSplit || event.shiftKey);}
      this.endDrag();
    });
    this.root.addEventListener('dragend',()=>this.endDrag());
    this.root.addEventListener('contextmenu',event => {
      const slot=(event.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if(slot && this.screen==='inventory') {event.preventDefault();this.selectedSlot=Number(slot.dataset.slot);this.splitSelected();}
    });
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

  private handleAction(action: string): void {
    switch(action) {
      case 'respawn': this.actions.respawn(); break;
      case 'new': {const seedText=this.find<HTMLInputElement>('#world-seed').value.trim();const seed=seedText?Number(seedText):undefined;this.actions.newGame(seed!==undefined && Number.isFinite(seed)?Math.floor(seed):undefined);break;}
      case 'continue':this.actions.continueGame();break;
      case 'settings':this.actions.setScreen('settings');break;
      case 'settingsBack':this.actions.setScreen(this.lastSettingsScreen);break;
      case 'resume':this.actions.resume();break;
      case 'save':this.actions.save();break;
      case 'menu':this.actions.mainMenu();break;
      case 'reset':this.find('.reset-confirm').hidden=false;break;
      case 'resetCancel':this.find('.reset-confirm').hidden=true;break;
      case 'resetConfirm':this.actions.resetSave();this.find('.reset-confirm').hidden=true;this.setSaveAvailable(false);break;
      case 'resetCamera':this.settings={...this.settings,sensitivity:DEFAULT_SETTINGS.sensitivity,fov:DEFAULT_SETTINGS.fov,viewmodelFov:DEFAULT_SETTINGS.viewmodelFov,invertY:DEFAULT_SETTINGS.invertY,headBob:DEFAULT_SETTINGS.headBob};this.actions.settings({...this.settings});this.setSettings(this.settings);this.notify('Camera settings restored');break;
      case 'resetSettings':this.settings={...DEFAULT_SETTINGS};this.actions.settings({...this.settings});this.setSettings(this.settings);this.notify('Settings restored to defaults');break;
      case 'reloadBuild':{const url=new URL(window.location.href);url.searchParams.set('build',`${GAME_VERSION}-${GAME_BUILD}`);window.location.replace(url.toString());break;}
      case 'drop':this.actions.dropItem(this.selectedSlot);break;
      case 'consume':this.actions.consume(this.selectedSlot);break;
      case 'equip':this.actions.selectSlot(this.selectedSlot);this.actions.resume();break;
      case 'split':this.splitSelected();break;
      case 'craft':this.actions.craft(this.selectedRecipe);break;
      case 'history':{const panel=this.find('.history-panel');panel.hidden=!panel.hidden;if(!panel.hidden)this.find('.help-panel').hidden=true;break;}
      case 'help':{const panel=this.find('.help-panel');panel.hidden=!panel.hidden;if(!panel.hidden)this.find('.history-panel').hidden=true;break;}
    }
  }

  private slider(name: string, label: string, min: number, max: number, step: number): string {return `<div class="setting-row"><label for="setting-${name}">${label}</label><div class="setting-slider"><input id="setting-${name}" data-setting="${name}" type="range" min="${min}" max="${max}" step="${step}"><output data-setting-value="${name}"></output></div></div>`;}
  private toggle(name:'invertY'|'headBob'|'shadows'|'showCompass',label:string,detail:string):string{return `<div class="setting-row toggle-row"><label>${label}<small>${detail}</small></label><div class="toggle-options"><button data-toggle="${name}" data-value="false">OFF</button><button data-toggle="${name}" data-value="true">ON</button></div></div>`;}
  private settingValue(name: string, value: number): string {if(name.includes('Volume')||name==='crosshairOpacity')return `${Math.round(value*100)}%`;if(name==='fov'||name==='viewmodelFov')return `${Math.round(value)}°`;if(name==='renderScale')return `${Math.round(value*100)}%`;if(name==='sensitivity')return `${value.toFixed(2)}×`;return `${value.toFixed(1)}×`;}
  private pieceIcon(piece: PieceType): string {const shapes:Record<PieceType,string>={foundation:'<path d="m3 12 9-5 9 5-9 5zM3 12v4l9 5 9-5v-4M12 17v4"/>',wall:'<path d="M5 4h14v17H5zM8 4v17M12 4v17M16 4v17"/>',doorway:'<path d="M4 3h16v18h-5V9H9v12H4z"/>',floor:'<path d="m3 12 9-6 9 6-9 6zM6 10l9 6M10 8l9 6"/>',roof:'<path d="m2 15 10-10 10 10M5 12v8h14v-8M12 5v15"/>',door:'<path d="M6 3h12v18H6zM15 12v2M9 3v18M4 21h16"/>'};return `<svg viewBox="0 0 24 24">${shapes[piece]}</svg>`;}
  private character(): string {return `<svg class="character-art" viewBox="0 0 240 470" aria-label="Survivor illustration"><defs><linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#aaa492"/><stop offset="1" stop-color="#4e5249"/></linearGradient><linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#737a6d"/><stop offset="1" stop-color="#343d34"/></linearGradient></defs><ellipse cx="122" cy="450" rx="68" ry="9" fill="#0b1513" opacity=".45"/><g stroke="#2c342d" stroke-width="1.5"><path d="m99 80-3 19-28 16-14 44-16 78 9 11 13-12 15-65 10-12 1 89 65 2 7-88 10 20 13 57 13 13 10-9-17-94-15-29-35-19-2-26" fill="url(#skin)"/><path d="m87 237-4 72 5 49-1 66 23 4 9-66 4-48 5 48 7 66 23-3-1-70 2-41-9-76" fill="url(#cloth)"/><path d="m87 419-4 20-17 7v8h43l4-31m22 0 1 30h40l-1-9-19-10-2-15" fill="#3c4138"/><path d="m83 114 17-11 22 14 19-16 15 12-1 58-8 48-60-1-6-52z" fill="url(#cloth)"/><path d="m99 46 1-13 9-12 17-4 17 10 6 23-7 31-11 11-16-4-14-15z" fill="url(#skin)"/><path d="m99 47-2-10 5-13 13-8 18 2 11 11 4 16-9-5-8-14-11 9-20 7" fill="#393f36"/><path d="m110 56 8-2m13 0 8 2m-16 1-3 11 8 1m-12 8 15-1" fill="none"/><path d="m89 231 60 1 4 11-65 1z" fill="#80745b"/><path d="m110 231 17 1v14h-17z" fill="#303930"/><path d="m85 160 8 44m57-39-13 37m-48 97 24 2m19-2 22-1m-63 52 18 4m27-2 18-4" stroke="#959982" opacity=".35"/><path d="m46 238-4 9 2 16 7 5 7-9-1-17m127 1-1 18 8 10 7-4 3-15-7-13" fill="url(#skin)"/><path d="m96 100 17 10m15-1 16-10m-21 17 1 107" fill="none" opacity=".6"/></g><path d="M36 101h-9v306h9M207 101h9v306h-9" stroke="#c9cfb9" stroke-opacity=".15" fill="none"/><path d="M18 168h23M201 168h23M18 318h23M201 318h23" stroke="#c9cfb9" stroke-opacity=".15"/></svg>`;}
}
