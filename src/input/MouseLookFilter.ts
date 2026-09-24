export interface LookDelta {x:number;y:number}

/**
 * Coalesces pointer-lock events without making sensitivity depend on render FPS.
 * Each individual browser sample is burst-limited before it is accumulated, so
 * splitting the exact same physical movement across 30, 60 or 144 render frames
 * produces the same total camera rotation.
 */
export class MouseLookFilter {
  private x=0;
  private y=0;
  constructor(private readonly maxPerEvent=96){}
  add(dx:number,dy:number,devicePixelRatio=1){
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    const dpr=Number.isFinite(devicePixelRatio)?Math.max(1,devicePixelRatio):1;
    let x=dx/dpr,y=dy/dpr;
    const length=Math.hypot(x,y);
    if(length>this.maxPerEvent&&length>0){const scale=this.maxPerEvent/length;x*=scale;y*=scale;}
    this.x+=x;
    this.y+=y;
  }
  consume():LookDelta{const result={x:this.x,y:this.y};this.x=0;this.y=0;return result;}
  clear(){this.x=0;this.y=0;}
}
