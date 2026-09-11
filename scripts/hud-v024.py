from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)

ui_path='src/ui/UI.ts'
ui=read(ui_path)
ui=replace_once(ui,
"import type { GameState, HUDData, ItemId, ItemStack, PieceType, Screen, Settings, UIActions } from '../core/types';",
"import type { GameState, HUDData, ItemId, ItemStack, PieceType, ResourceNode, Screen, Settings, UIActions } from '../core/types';",
'UI resource node import')

ui=replace_once(ui,
"  private hud: HUDData | null = null;",
"  private hud: HUDData | null = null;\n  private lastHealth: number | null = null;\n  private craftHudHash = '';\n  private resourceFeedbackTimer = 0;",
'UI HUD state fields')

ui=replace_once(ui,
'        <div class="crosshair"><i></i></div><div class="interaction-prompt"></div>',
'        <div class="crosshair"><i></i></div><div class="interaction-prompt"></div><div class="resource-feedback" aria-live="polite"></div><div class="damage-vignette" aria-hidden="true"></div>',
'gameplay feedback overlays')

ui=replace_once(ui,
'        <div class="hotbar-wrap"><div class="active-item-name"></div><div class="hotbar"></div><div class="hotbar-caption"><span><kbd>TAB</kbd> INVENTORY & CRAFTING</span><span><kbd>ESC</kbd> PAUSE</span></div></div>',
'        <div class="hotbar-wrap"><div class="active-item-name"></div><div class="hotbar"></div><div class="hotbar-caption"><span><kbd>TAB</kbd> INVENTORY</span><span><kbd>ESC</kbd> MENU</span></div></div><div class="hud-craft-queue" hidden></div>',
'hotbar and HUD craft queue')

old_vitals='        <div class="vitals"><div class="vital health"><span class="vital-icon">+</span><div><i></i><span>HEALTH</span><b>100</b></div></div><div class="vital thirst"><span class="vital-icon droplet">◊</span><div><i></i><span>HYDRATION</span><b>100</b></div></div><div class="vital hunger"><span class="vital-icon food-icon">×</span><div><i></i><span>NOURISHMENT</span><b>100</b></div></div><div class="stamina"><i></i><span>STAMINA</span></div></div>'
new_vitals='        <div class="vitals"><div class="vital health"><span class="vital-symbol">✚</span><div><i></i><span>HEALTH</span><b>100</b></div></div><div class="vital thirst"><span class="vital-symbol water-symbol">●</span><div><i></i><span>WATER</span><b>100</b></div></div><div class="vital hunger"><span class="vital-symbol food-symbol">◆</span><div><i></i><span>FOOD</span><b>100</b></div></div><div class="stamina"><i></i><span>STAMINA</span></div><div class="survival-status"><span class="status-pill wet" hidden>WET</span><span class="status-pill cold" hidden>COLD</span></div></div>'
ui=replace_once(ui,old_vitals,new_vitals,'compact vitals')

# Replace notification implementation with icon-aware pickup notices.
notify_pattern=re.compile(r"  notify\(message: string\): void \{.*?\n  \}\n\n  setDiagnostics",re.S)
notify_new="""  notify(message: string): void {
    const item = document.createElement('div');
    const match = /^\\+\\s*(\\d+)\\s+(.+?)[.!]?$/.exec(message.trim());
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

  resourceHit(kind: ResourceNode['kind'], amount: number, depleted = false): void {
    const feedback=this.find<HTMLElement>('.resource-feedback');
    const resourceLabels:Record<ResourceNode['kind'],string>={tree:'WOOD',wood:'WOOD',stone:'STONE',metal:'METAL ORE',fiber:'CLOTH FIBER',berries:'BERRIES'};
    feedback.className=`resource-feedback ${kind}${depleted?' depleted':''}`;
    feedback.innerHTML=`<span class="resource-hit-mark"><i></i><i></i></span><div><strong>+${amount}</strong><small>${resourceLabels[kind]}${depleted?' · DEPLETED':''}</small></div>`;
    void feedback.offsetWidth;
    feedback.classList.add('show');
    window.clearTimeout(this.resourceFeedbackTimer);
    this.resourceFeedbackTimer=window.setTimeout(()=>feedback.classList.remove('show'),depleted?1050:620);
  }

  setDiagnostics"""
ui,count=notify_pattern.subn(notify_new,ui,count=1)
if count!=1: raise SystemExit('failed to replace notify implementation')

ui=replace_once(ui,
"      this.updateStats(hud);",
"      this.updateStats(hud);\n      this.renderCraftHud(state);\n      this.updateEnvironmentStatus(state,hud);",
'playing HUD updates')

prompt_old="      const promptHTML = interaction ? `<kbd>${esc(interaction.key)}</kbd><div><strong>${esc(interaction.title)}</strong><span>${esc(interaction.action)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class=\"interaction-progress\" style=\"width:${interaction.progress*100}%\"></i>` : ''}</div>` : '';"
prompt_new="      const promptHTML = interaction ? `<span class=\"interaction-key\"><kbd>${esc(interaction.key)}</kbd></span><div class=\"interaction-copy\"><strong>${esc(interaction.action)}</strong><span>${esc(interaction.title)}${interaction.detail ? ` <i>·</i> ${esc(interaction.detail)}` : ''}</span>${interaction.progress !== undefined ? `<i class=\"interaction-progress\" style=\"width:${interaction.progress*100}%\"></i>` : ''}</div>` : '';"
ui=replace_once(ui,prompt_old,prompt_new,'interaction prompt hierarchy')

stats_pattern=re.compile(r"  private updateStats\(hud: HUDData\): void \{.*?\n  \}\n\n  private renderHotbar",re.S)
stats_new="""  private updateStats(hud: HUDData): void {
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
    queue.innerHTML=`<div class="hud-craft-title"><span>CRAFTING</span><b>${state.craftQueue.length}</b></div><div class="hud-craft-items">${state.craftQueue.slice(0,4).map(job=>{const recipe=RECIPES[job.recipeId];if(!recipe)return '';const progress=Math.max(0,Math.min(100,(1-job.remaining/job.total)*100));return `<div class="hud-craft-item" title="${esc(ITEMS[recipe.resultItemId].displayName)}">${icon(recipe.resultItemId)}<span><b>${esc(ITEMS[recipe.resultItemId].displayName)}</b><small>${job.remaining<=0?'READY':`${Math.ceil(job.remaining)}s`}</small></span><i style="width:${progress}%"></i></div>`;}).join('')}</div>`;
  }

  private updateEnvironmentStatus(state:GameState,hud:HUDData):void {
    const weather=state.progression?.weather;
    const wet=weather?.kind==='rain'||weather?.kind==='storm'||(weather?.rain??0)>.2;
    const cold=hud.timeOfDay<5.5||hud.timeOfDay>21;
    this.find<HTMLElement>('.status-pill.wet').hidden=!wet;
    this.find<HTMLElement>('.status-pill.cold').hidden=!cold;
  }

  private renderHotbar"""
ui,count=stats_pattern.subn(stats_new,ui,count=1)
if count!=1: raise SystemExit('failed to replace HUD stat block')

slot_pattern=re.compile(r"  private slotHTML\(stack: ItemStack \| null, index: number, selected: boolean, hotbar = false\): string \{.*?\n  \}\n\n  private renderInventory",re.S)
slot_new="""  private slotHTML(stack: ItemStack | null, index: number, selected: boolean, hotbar = false): string {
    const item = stack && ITEMS[stack.itemId];
    const tool=Boolean(item?.category==='tool');
    return `<button class="item-slot ${selected?'selected':''} ${stack?'occupied':''} ${tool?'tool-slot':''}" data-slot="${index}" ${hotbar?'data-hotbar="true"':''} draggable="${Boolean(stack)}" title="${item?esc(`${item.displayName} · ${stack!.count}`):'Empty slot'}" aria-label="${item?esc(item.displayName):'Empty slot'}${index < 6?` · quick slot ${index+1}`:''}">${index<6?`<span class="slot-key">${index+1}</span>`:''}${stack?`${icon(stack.itemId)}<span class="stack-count">${stack.count > 1 ? `×${stack.count}` : ''}</span>${tool?'<i class="slot-condition" title="Tool condition"></i>':''}`:''}</button>`;
  }

  private renderInventory"""
ui,count=slot_pattern.subn(slot_new,ui,count=1)
if count!=1: raise SystemExit('failed to replace slotHTML')
write(ui_path,ui)

# Wire real gathering hits into the center feedback layer.
app_path='src/app/GameApp.ts'
app=read(app_path)
old="this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');if(result.depleted&&node.kind==='tree')"
new="this.impactFx.burst(node.position,node.kind==='tree'||node.kind==='wood'?'wood':node.kind==='stone'?'stone':node.kind==='metal'?'metal':node.kind as 'fiber'|'berries');this.ui.resourceHit(node.kind,result.amount,result.depleted);if(result.depleted&&node.kind==='tree')"
app=replace_once(app,old,new,'resource hit HUD hook')
write(app_path,app)

# Append the v0.2.4 HUD visual language after existing rules so it is authoritative.
css_path='src/ui/style.css'
css=read(css_path)
css += r'''

/* ========================================================================== */
/* TIDELAND HUD v0.2.4 — survival-game HUD pass                              */
/* ========================================================================== */
.game-screen{--hud-bg:rgba(15,20,17,.72);--hud-border:rgba(235,238,222,.13);--hud-shadow:0 8px 28px rgba(0,0,0,.22)}
.game-screen:after{content:'';position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 48%,transparent 52%,rgba(111,17,10,.32) 100%);transition:opacity .35s;z-index:2}.game-screen.low-health:after{opacity:.42;animation:hud-low-health 1.8s ease-in-out infinite}
.damage-vignette{position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0;background:radial-gradient(circle at 50% 47%,transparent 42%,rgba(127,13,9,.74) 100%)}.damage-vignette.flash{animation:hud-damage .42s ease-out}
.crosshair{z-index:8;width:4px;height:4px;background:rgba(245,243,228,.86);box-shadow:0 0 0 1px rgba(0,0,0,.28),0 0 4px rgba(0,0,0,.45)}.crosshair i{inset:-4px;border-color:rgba(245,243,228,.2)}.game-screen.targeted .crosshair{background:#f2e1b5;box-shadow:0 0 0 1px #0006,0 0 9px rgba(226,194,137,.4)}
.interaction-prompt{top:calc(50% + 38px);gap:9px;min-height:42px;padding:7px 10px 7px 7px;background:rgba(12,17,14,.72);border:1px solid rgba(239,237,218,.13);border-radius:2px;box-shadow:var(--hud-shadow);backdrop-filter:blur(5px);text-shadow:none;z-index:9}.interaction-prompt:empty{display:none}.interaction-key kbd{width:31px;height:31px;background:rgba(230,232,214,.09);border:1px solid rgba(238,239,223,.35);font-family:var(--title-font);font-size:11px;font-weight:600}.interaction-copy{min-width:110px}.interaction-prompt strong{font-size:16px;line-height:1;letter-spacing:.09em;color:#f0eee0}.interaction-prompt span{font-size:7px;margin-top:4px;color:#b9c1af;letter-spacing:.09em}.interaction-progress{height:2px;margin-top:6px;background:#d8b67c;box-shadow:0 0 7px #d8b67c66}
.resource-feedback{position:absolute;left:50%;top:calc(50% - 4px);transform:translate(-50%,-50%) scale(.92);display:flex;align-items:center;gap:11px;opacity:0;pointer-events:none;z-index:10;text-shadow:0 2px 8px #000c}.resource-feedback.show{animation:hud-resource-pop .62s cubic-bezier(.2,.8,.2,1)}.resource-feedback.depleted.show{animation-duration:1.05s}.resource-feedback>div{display:flex;flex-direction:column;transform:translateY(34px)}.resource-feedback strong{font-family:var(--title-font);font-size:18px;line-height:1;font-weight:600;color:#efe8d4}.resource-feedback small{font-family:var(--title-font);font-size:7px;letter-spacing:.12em;color:#cfc9b7;margin-top:3px}.resource-hit-mark{position:relative;width:20px;height:20px;transform:translateY(34px)}.resource-hit-mark i{position:absolute;left:9px;top:1px;width:2px;height:18px;background:#e4d7bb;border-radius:1px}.resource-hit-mark i:first-child{transform:rotate(45deg)}.resource-hit-mark i:last-child{transform:rotate(-45deg)}.resource-feedback.tree .resource-hit-mark i,.resource-feedback.wood .resource-hit-mark i{background:#c8a16b}.resource-feedback.stone .resource-hit-mark i{background:#c8c5b9}.resource-feedback.metal .resource-hit-mark i{background:#d2aa70}.resource-feedback.depleted small{color:#d27a54}
.hotbar-wrap{bottom:24px;width:438px;z-index:6}.active-item-name{font-size:9px;letter-spacing:.16em;margin-bottom:7px;color:rgba(238,238,219,.74)}.hotbar{gap:3px}.hotbar .item-slot{aspect-ratio:1.04;background:linear-gradient(180deg,rgba(37,43,36,.72),rgba(21,26,22,.82));border:1px solid rgba(231,234,216,.1);box-shadow:0 5px 16px rgba(0,0,0,.12);padding:6px}.hotbar .item-slot.selected{transform:translateY(-4px);background:linear-gradient(180deg,rgba(107,92,61,.88),rgba(67,59,42,.92));border-color:rgba(226,198,139,.76);box-shadow:0 6px 20px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,230,175,.08)}.hotbar .item-slot.selected:after{height:3px;background:#d5ad6f}.hotbar .item-slot .item-art{padding:2px;filter:drop-shadow(0 4px 4px rgba(0,0,0,.48))}.slot-key{left:5px;top:4px;font-size:9px;color:rgba(239,238,219,.62)}.stack-count{right:5px;bottom:5px;font-size:12px;color:#f1eedf}.slot-condition{position:absolute;left:5px;right:5px;bottom:3px;top:auto;width:auto;height:2px;background:linear-gradient(90deg,#79a65d 0 100%);box-shadow:0 0 5px rgba(121,166,93,.25)}.hotbar-caption{margin-top:7px;font-size:6px;color:rgba(211,216,198,.55)}.hotbar-caption kbd{opacity:.7}
.vitals{right:24px;bottom:25px;width:173px;gap:3px;z-index:6}.vital{height:28px;gap:5px;background:rgba(15,20,17,.18)}.vital-symbol{width:24px;height:28px;display:grid;place-items:center;font-family:Arial,sans-serif;font-size:14px;color:#e9eadc;background:rgba(13,18,15,.68);border:1px solid rgba(231,234,216,.07);text-shadow:0 1px 3px #0008}.water-symbol{font-size:11px;color:#a7d1df;transform:none}.food-symbol{font-size:11px;color:#d8af7a}.vital>div{height:28px;background:rgba(14,19,16,.76);border:1px solid rgba(233,236,218,.08);padding:0 7px;box-shadow:0 4px 14px rgba(0,0,0,.12)}.vital>div>i{opacity:.64}.vital>div>span{font-family:var(--title-font);font-size:7px;letter-spacing:.11em}.vital b{font-size:17px}.vital.warning>div{border-color:rgba(211,156,87,.32)}.vital.critical>div{outline:0;border-color:rgba(213,78,54,.68);animation:hud-critical 1.3s ease-in-out infinite}.stamina{height:3px;margin:5px 0 0 29px;background:rgba(10,15,12,.65)}.stamina i{background:#d5d8c8}.stamina span{font-size:5px;top:6px;opacity:.72}.survival-status{display:flex;justify-content:flex-end;gap:4px;margin-top:8px}.status-pill{font-family:var(--title-font);font-size:7px;letter-spacing:.12em;padding:4px 6px;border:1px solid rgba(224,229,213,.13);background:rgba(12,17,14,.72);box-shadow:0 3px 10px rgba(0,0,0,.15)}.status-pill.wet{color:#a9d1dc;border-color:rgba(105,171,192,.32)}.status-pill.cold{color:#c8d9da;border-color:rgba(162,194,200,.28)}
.hud-craft-queue{position:absolute;right:24px;bottom:154px;width:173px;z-index:6;padding:8px;background:rgba(13,18,15,.72);border:1px solid rgba(229,234,214,.09);box-shadow:var(--hud-shadow);backdrop-filter:blur(4px)}.hud-craft-title{height:15px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(231,236,216,.08);margin-bottom:6px;font-family:var(--title-font);font-size:7px;letter-spacing:.12em;color:#aeb8a7}.hud-craft-title b{font-size:9px;color:#d8c39a}.hud-craft-items{display:flex;flex-direction:column;gap:4px}.hud-craft-item{position:relative;height:34px;display:flex;align-items:center;gap:7px;padding:4px 5px;background:rgba(231,235,216,.035);overflow:hidden}.hud-craft-item .item-art{width:27px;height:27px;object-fit:contain;filter:drop-shadow(0 2px 2px #0007)}.hud-craft-item>span{min-width:0;display:flex;flex:1;align-items:center;justify-content:space-between;gap:5px}.hud-craft-item b{font-family:var(--title-font);font-size:8px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#d4d9ca}.hud-craft-item small{font-family:var(--title-font);font-size:8px;color:#bba87d}.hud-craft-item>i{position:absolute;left:0;bottom:0;height:2px;background:#c7a468;transition:width .1s linear}
.notifications{right:24px;bottom:188px;gap:4px;max-width:280px}.notification{min-width:150px;min-height:39px;padding:7px 10px;background:rgba(14,20,16,.82);border:1px solid rgba(229,234,214,.09);border-left:2px solid rgba(174,198,133,.58);box-shadow:0 7px 22px rgba(0,0,0,.2);backdrop-filter:blur(5px);font-size:11px}.notification.pickup{min-width:122px;padding:5px 9px 5px 6px;border-left-color:#c7a96d}.notification-art{width:31px;height:31px;object-fit:contain;filter:drop-shadow(0 2px 2px #0007)}.notification-copy{display:flex;align-items:baseline;gap:6px}.notification-copy b{font-family:var(--title-font);font-size:15px;color:#e9e2cd}.notification-copy small{font-family:var(--title-font);font-size:8px;letter-spacing:.08em;color:#b7bcae;text-transform:uppercase}.notification-message{font-family:var(--title-font);font-size:11px;letter-spacing:.035em}.notification-mark{width:4px;height:4px}
.onboarding{bottom:29px;color:rgba(226,230,213,.72)}.help-shortcut{background:rgba(14,20,16,.68)}
.diagnostics{z-index:30}
@keyframes hud-damage{0%{opacity:0}18%{opacity:var(--damage,.5)}100%{opacity:0}}@keyframes hud-low-health{50%{opacity:.62}}@keyframes hud-critical{50%{border-color:rgba(213,78,54,.2)}}@keyframes hud-resource-pop{0%{opacity:0;transform:translate(-50%,-50%) scale(.7)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}68%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-58%) scale(.96)}}
@media(max-width:850px){.hotbar-wrap{width:340px}.vitals{right:15px;width:148px}.hud-craft-queue{right:15px;width:148px;bottom:149px}.notifications{right:15px;bottom:180px}.vital-symbol{width:20px}.interaction-prompt{max-width:82vw}.onboarding{bottom:112px}}
@media(max-width:640px){.hotbar-wrap{width:296px;bottom:15px}.vitals{bottom:103px;right:12px;width:139px}.hud-craft-queue{right:12px;bottom:232px;width:139px}.notifications{right:12px;bottom:365px;max-width:210px}.interaction-prompt{top:calc(50% + 31px)}.resource-feedback>div,.resource-hit-mark{transform:translateY(30px)}.hotbar-caption{display:none}}
'''
write(css_path,css)

# Version metadata and history.
version_path='src/config/version.ts'
version=read(version_path)
version=version.replace("export const GAME_VERSION='0.2.3';","export const GAME_VERSION='0.2.4';",1).replace("export const GAME_BUILD='EA-02.3';","export const GAME_BUILD='EA-02.4';",1)
anchor="export const CHANGELOG:ChangeEntry[]=[\n"
entry="""export const CHANGELOG:ChangeEntry[]=[
  {version:'0.2.4',date:'2026-09-11',title:'Survival HUD overhaul',changes:[
    'Rebuilt the live vitals HUD into compact health, water and food panels with warning and critical states.',
    'Reworked the quick belt with a stronger active slot, cleaner numbering and tool-condition strips.',
    'Reframed world interactions around the action itself, with compact key prompts and progress feedback.',
    'Added center-screen resource hit feedback driven by real gathering results and depleted-node events.',
    'Added damage vignette, persistent low-health pressure and contextual wet/cold environment indicators.',
    'Added a live crafting queue to the gameplay HUD with item icons, timers and progress bars.',
    'Converted resource notifications into compact icon-based pickup toasts.',
    'Unified HUD spacing, typography, translucency and responsive behaviour for a more game-like presentation.'
  ]},
"""
version=replace_once(version,anchor,entry,'version changelog entry')
write(version_path,version)

changelog_path='CHANGELOG.md'
changelog=read(changelog_path)
section="""## 0.2.4 — 2026-09-11

Survival HUD overhaul.

- Reworked health, water and food into compact survival-game status panels with warning/critical states.
- Rebuilt the quick belt with a stronger selected slot, cleaner numbering and condition strips for tools.
- Made interaction prompts action-first and added gathering hit feedback at the reticle.
- Added damage/low-health screen feedback plus contextual Wet and Cold indicators.
- Added a live gameplay crafting queue with progress and remaining time.
- Resource gains now use icon-based pickup notifications instead of generic text-only messages.
- Unified HUD typography, panel opacity, spacing and responsive layout while leaving developer telemetry behind F3.

"""
changelog=replace_once(changelog,'## 0.2.3 — 2026-09-11\n',section+'## 0.2.3 — 2026-09-11\n','markdown changelog')
write(changelog_path,changelog)

for path in ['package.json','package-lock.json']:
    text=read(path)
    text=text.replace('"version": "0.2.3"','"version": "0.2.4"',2 if path.endswith('lock.json') else 1)
    write(path,text)

readme_path='README.md'
readme=read(readme_path)
readme=readme.replace('version-v0.2.3%20%7C%20EA--02.3','version-v0.2.4%20%7C%20EA--02.4',1)
readme=readme.replace('**Current release:** `v0.2.3 / EA-02.3`','**Current release:** `v0.2.4 / EA-02.4`',1)
write(readme_path,readme)

print('Tideland v0.2.4 HUD patch applied')
