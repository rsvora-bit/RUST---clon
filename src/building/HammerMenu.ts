import type {GameState,Structure} from '../core/types';
import {BUILDING_GRADES,nextGrade,repairCost,resourceCount,structureCurrentHealth,structureGrade,structureMaxHealth,upgradeCost,type StructureActionResult} from './grades';

interface HammerMenuActions {
  state:()=>GameState;
  structure:(id:string)=>Structure|undefined;
  upgrade:(id:string)=>StructureActionResult;
  repair:(id:string)=>StructureActionResult;
  rotate:(id:string)=>StructureActionResult;
  demolish:(id:string)=>StructureActionResult;
  notify:(message:string)=>void;
  close:()=>void;
}

const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const pieceName=(structure:Structure)=>structure.pieceType.toUpperCase();
const costLabel=(state:GameState,cost:ReturnType<typeof upgradeCost>)=>{if(!cost)return '';const quote=resourceCount(state,cost);return `${quote.required} ${quote.item.toUpperCase()} <small>YOU HAVE ${quote.have}</small>`;};

export class HammerMenu {
  private root=document.createElement('section');private targetId:string|null=null;private holdTimer=0;
  constructor(container:HTMLElement,private actions:HammerMenuActions){
    this.root.className='hammer-overlay';this.root.hidden=true;container.append(this.root);
    this.root.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLElement>('[data-hammer-action]');const action=button?.dataset.hammerAction;if(!action||action==='demolish'||!this.targetId)return;if(action==='close'){this.close();return;}const result=action==='upgrade'?this.actions.upgrade(this.targetId):action==='repair'?this.actions.repair(this.targetId):this.actions.rotate(this.targetId);this.report(action,result);this.refresh();});
    this.root.addEventListener('pointerdown',event=>{const button=(event.target as HTMLElement).closest<HTMLElement>('[data-hammer-action="demolish"]');if(!button||!this.targetId)return;event.preventDefault();this.startDemolish(button);});
    for(const type of ['pointerup','pointercancel','pointerleave'] as const)this.root.addEventListener(type,()=>this.cancelDemolish());
    window.addEventListener('keydown',event=>{if(!this.isOpen)return;if(event.code==='Escape'){this.close();return;}const map:Record<string,string>={Digit1:'upgrade',Digit2:'repair',Digit3:'rotate'};const action=map[event.code];if(action)this.root.querySelector<HTMLElement>(`[data-hammer-action="${action}"]`)?.click();if(event.code==='Digit4'){const button=this.root.querySelector<HTMLElement>('[data-hammer-action="demolish"]');if(button)this.startDemolish(button);}});
    window.addEventListener('keyup',event=>{if(event.code==='Digit4')this.cancelDemolish();});
  }
  get isOpen(){return !this.root.hidden;}
  open(structure:Structure){this.targetId=structure.id;this.root.hidden=false;this.refresh();}
  close(){this.cancelDemolish();this.root.hidden=true;this.targetId=null;this.actions.close();}
  private report(action:string,result:StructureActionResult){
    if(result.ok){this.actions.notify(action==='upgrade'?'Structure upgraded':action==='repair'?'Structure repaired':action==='rotate'?'Door hinge rotated':'Structure removed');return;}
    const messages:Record<StructureActionResult['reason'],string>={ok:'Done','missing-resources':'Not enough resources','max-grade':'MAX GRADE','full-health':'Structure is already fully repaired','not-found':'Structure no longer exists','has-dependents':'Remove attached pieces first','rotation-unavailable':'ROTATION NOT AVAILABLE','invalid':'Action unavailable'};this.actions.notify(messages[result.reason]);
  }
  private startDemolish(button:HTMLElement){if(this.holdTimer)return;button.classList.add('holding');this.holdTimer=window.setTimeout(()=>{this.holdTimer=0;button.classList.remove('holding');if(!this.targetId)return;const result=this.actions.demolish(this.targetId);this.report('demolish',result);if(result.ok)this.close();else this.refresh();},1000);}
  private cancelDemolish(){if(this.holdTimer){window.clearTimeout(this.holdTimer);this.holdTimer=0;}this.root.querySelector('[data-hammer-action="demolish"]')?.classList.remove('holding');}
  refresh(){
    if(!this.targetId)return;const structure=this.actions.structure(this.targetId);if(!structure){this.close();return;}const state=this.actions.state(),grade=structureGrade(structure),max=structureMaxHealth(structure),current=structureCurrentHealth(structure),next=nextGrade(structure),upgrade=upgradeCost(structure),repair=repairCost(structure);
    this.root.innerHTML=`<div class="hammer-card"><header><div><span>TIDELAND / FIELD MAINTENANCE</span><h2>${esc(pieceName(structure))}</h2></div><button data-hammer-action="close" aria-label="Close hammer menu">×</button></header><section class="hammer-status"><div><small>GRADE</small><strong data-grade="${grade}">${BUILDING_GRADES[grade].label.toUpperCase()}</strong></div><div><small>INTEGRITY</small><strong>${Math.ceil(current)} / ${max}</strong></div><i><b style="width:${current/max*100}%"></b></i></section><nav><button data-hammer-action="upgrade" ${next?'':'disabled'}><kbd>1</kbd><span><b>${next?`UPGRADE TO ${next.toUpperCase()}`:'MAX GRADE'}</b><small>${next?costLabel(state,upgrade):'NO HIGHER TIER'}</small></span></button><button data-hammer-action="repair" ${repair?'':'disabled'}><kbd>2</kbd><span><b>REPAIR +${repair?repair.amount:0} HP</b><small>${repair?costLabel(state,repair.cost):'FULL HEALTH'}</small></span></button><button data-hammer-action="rotate" ${structure.pieceType==='door'?'':'disabled'}><kbd>3</kbd><span><b>ROTATE</b><small>${structure.pieceType==='door'?'FLIP DOOR HINGE':'ROTATION NOT AVAILABLE'}</small></span></button><button class="hammer-demolish" data-hammer-action="demolish"><kbd>4</kbd><span><b>HOLD TO DEMOLISH</b><small>1 SECOND · NO REFUND</small></span><i></i></button></nav><footer>ESC CLOSE · SUPPORTS REQUIRE DEPENDENTS REMOVED</footer></div>`;
  }
}
