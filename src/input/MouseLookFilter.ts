export interface LookDelta {x:number;y:number}

/**
 * Coalesces high-frequency pointer-lock mouse events into one render-frame delta.
 * This prevents browser stalls from replaying a burst of movement as a camera jump.
 */
export class MouseLookFilter {
  private x=0;
  private y=0;
  constructor(private readonly maxPerFrame=180){}
  add(dx:number,dy:number,devicePixelRatio=1){
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    const dpr=Number.isFinite(devicePixelRatio)?Math.max(1,devicePixelRatio):1;
    this.x+=dx/dpr;
    this.y+=dy/dpr;
  }
  consume():LookDelta{
    let x=this.x,y=this.y;this.x=0;this.y=0;
    const length=Math.hypot(x,y);
    if(length>this.maxPerFrame&&length>0){const scale=this.maxPerFrame/length;x*=scale;y*=scale;}
    return {x,y};
  }
  clear(){this.x=0;this.y=0;}
}
