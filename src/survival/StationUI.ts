import {ITEMS} from '../items/definitions';
import type {ItemStack} from '../core/types';
import {currentRecyclerRecipe,isStationOutputSlot,STATIONS,stationStatus,type Station,type SlotRef} from './stations';
import './survival.css';

export class StationUI {
  readonly root=document.createElement('section');private station:Station|null=null;private drag:SlotRef|null=null;private split=false;private hash='';
  constructor(parent:HTMLElement,private actions:{move:(id:string,a:SlotRef,b:SlotRef,split:boolean)=>void;takeAll:(id:string)=>void;toggle:(id:string)=>void;spawn:(id:string)=>void;close:()=>void}){
    this.root.className='survival-panel';this.root.hidden=true;parent.append(this.root);
    this.root.addEventListener('dragstart',e=>{const t=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(t){this.drag={container:t.dataset.container as SlotRef['container'],slot:Number(t.dataset.slot)};this.split=(e as DragEvent).shiftKey;(e as DragEvent).dataTransfer?.setData('text/plain',JSON.stringify(this.drag));}});
    this.root.addEventListener('dragover',e=>e.preventDefault());this.root.addEventListener('drop',e=>{e.preventDefault();const t=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(t&&this.drag&&this.station)this.actions.move(this.station.id,this.drag,{container:t.dataset.container as SlotRef['container'],slot:Number(t.dataset.slot)},this.split||(e as DragEvent).shiftKey);this.drag=null;this.hash='';});this.root.addEventListener('dragend',()=>this.drag=null);
    this.root.addEventListener('click',e=>{const a=(e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;if(a==='close')this.actions.close();if(!this.station)return;if(a==='take')this.actions.takeAll(this.station.id);if(a==='toggle')this.actions.toggle(this.station.id);if(a==='spawn')this.actions.spawn(this.station.id);this.hash='';});
  }
  get isOpen(){return !this.root.hidden;}
  open(s:Station,p:(ItemStack|null)[]){this.root.hidden=false;this.hash='';this.update(s,p);}
  close(){this.root.hidden=true;this.station=null;this.drag=null;}
  private label(s:Station,index:number,container:string){if(container!=='station')return String(index+1);if(s.kind==='furnace')return index<2?'INPUT':index===2?'FUEL':'OUTPUT';if(s.kind==='recycler')return index<3?'INPUT':'OUTPUT';return String(index+1);}
  update(s:Station,p:(ItemStack|null)[]){
    this.station=s;const hash=JSON.stringify([s.inventory,p,s.active,s.job&&Math.ceil(s.job.remaining*10)]);if(hash===this.hash||this.drag)return;this.hash=hash;
    const slots=(items:(ItemStack|null)[],container:string)=>items.map((x,i)=>`<button class="station-slot ${container==='station'&&isStationOutputSlot(s,i)?'station-output':''}" draggable="${!!x}" data-container="${container}" data-slot="${i}" title="${x?ITEMS[x.itemId].displayName:'Empty'}"><small>${this.label(s,i,container)}</small>${x?`<img draggable="false" src="${ITEMS[x.itemId].icon}" alt="${ITEMS[x.itemId].displayName}"><b>${x.count}</b>`:''}</button>`).join('');
    const processing=['furnace','campfire','recycler'].includes(s.kind),recipe=currentRecyclerRecipe(s),status=stationStatus(s),recyclerDetail=s.kind==='recycler'?(s.job&&recipe?`PROCESSING · ${ITEMS[recipe.input].displayName.toUpperCase()} · ${Math.ceil(s.job.remaining)}s`:status==='BLOCKED_OUTPUT_FULL'?'OUTPUT FULL':status==='BLOCKED_NO_INPUT'?'READY · NO SALVAGE INPUT':'READY'):'';
    const heading=s.kind==='furnace'?'PROCESSING · 10 RAW + 5 FUEL → 10 FRAGMENTS':s.kind==='recycler'?'RECYCLING · COMPONENTS → SCRAP + METAL':'CONTENTS';
    this.root.innerHTML=`<header><span>TIDELAND / FIELD EQUIPMENT</span><button data-action="close">CLOSE · ESC</button></header><h1>${STATIONS[s.kind].name}</h1><p>${s.kind==='recycler'?'Feed recovered components into protected input slots. Outputs save with your world.':'Drag to transfer or swap · Shift-drag to split · Contents save with your world'}</p><div class="station-columns"><section><h2>YOUR INVENTORY</h2><div class="station-grid">${slots(p,'player')}</div></section><section><h2>${heading}</h2><div class="station-grid">${slots(s.inventory,'station')}</div>${s.inventory.some(Boolean)?'<button data-action="take">TAKE ALL</button>':''}${processing?`<p data-status>${s.kind==='recycler'?recyclerDetail:status.replaceAll('_',' ')+(s.job?` · ${Math.ceil(s.job.remaining)}s`:'')}</p><button data-action="toggle">${s.active?(s.kind==='recycler'?'STOP RECYCLER':'TURN OFF'):(s.kind==='recycler'?'START RECYCLER':'TURN ON')}</button>`:''}${s.kind==='bedroll'?'<button data-action="spawn">SET RESPAWN POINT</button>':''}${s.kind.startsWith('workbench')?'<p>Craft from your inventory while within 5 meters of this workbench.</p>':''}</section></div>`;
  }
}
