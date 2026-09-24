import {MouseLookFilter} from './MouseLookFilter';

export class Input {
  readonly keys = new Set<string>();
  locked = false;
  onLook: (x:number,y:number)=>void = ()=>{};
  onKey: (code:string)=>void = ()=>{};
  onClick: (button:number)=>void = ()=>{};
  onLockChange: (locked:boolean)=>void = ()=>{};
  onWheel:(direction:number)=>void=()=>{};
  private handlers: Array<()=>void> = [];
  private readonly lookFilter=new MouseLookFilter(180);
  private lookFrame=0;
  private ignoreLookUntil=0;
  constructor(private canvas:HTMLCanvasElement) {
    const bind = (target:EventTarget,type:string,fn:EventListener) => {target.addEventListener(type,fn);this.handlers.push(()=>target.removeEventListener(type,fn));};
    bind(window,'keydown',((e:KeyboardEvent)=>{
      const target=e.target;
      if (target instanceof HTMLElement && target.matches('input,select,textarea')) return;
      if (['Tab','Space','ArrowUp','ArrowDown','F3'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); if (!e.repeat) this.onKey(e.code);
    }) as EventListener);
    bind(window,'keyup',((e:KeyboardEvent)=>{this.keys.delete(e.code);}) as EventListener);
    bind(document,'mousemove',((e:MouseEvent)=>{
      if(!this.locked||performance.now()<this.ignoreLookUntil)return;
      this.lookFilter.add(e.movementX,e.movementY,window.devicePixelRatio||1);
      if(!this.lookFrame)this.lookFrame=requestAnimationFrame(()=>this.flushLook());
    }) as EventListener);
    bind(document,'pointerlockchange',()=>{
      this.locked=document.pointerLockElement===canvas;this.keys.clear();this.resetLook();
      if(this.locked)this.ignoreLookUntil=performance.now()+80;
      this.onLockChange(this.locked);
    });
    bind(canvas,'mousedown',((e:MouseEvent)=>{e.preventDefault();this.onClick(e.button);}) as EventListener);
    bind(canvas,'contextmenu',(e)=>e.preventDefault());
    bind(canvas,'wheel',((e:WheelEvent)=>{e.preventDefault();this.onWheel(Math.sign(e.deltaY));}) as EventListener);
    bind(window,'blur',()=>{this.keys.clear();this.resetLook();this.release();});
  }
  private flushLook(){
    this.lookFrame=0;
    const delta=this.lookFilter.consume();
    if(this.locked&&(delta.x!==0||delta.y!==0))this.onLook(delta.x,delta.y);
  }
  private resetLook(){
    this.lookFilter.clear();
    if(this.lookFrame){cancelAnimationFrame(this.lookFrame);this.lookFrame=0;}
  }
  down(...keys:string[]) {return keys.some(k=>this.keys.has(k));}
  async lock() {try {await this.canvas.requestPointerLock();}catch { /* Browser may reject while another lock request is leaving. A click retries. */ }}
  release(){if(document.pointerLockElement)document.exitPointerLock();this.keys.clear();this.resetLook();}
  dispose(){this.resetLook();this.handlers.forEach(fn=>fn());}
}
