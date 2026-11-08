// Demand and cadence are separate: dirty work wakes this scheduler, its budget
// determines when drawing may occur. Input handlers and animation clocks are not throttled.
export function createDrawingCadence(draw, {fps=60, now=()=>performance.now(), raf=requestAnimationFrame, caf=cancelAnimationFrame, delay=setTimeout, cancelDelay=clearTimeout, hidden=()=>document.hidden}={}) {
 let rate=fps,last=-Infinity,frame=null,timer=null,dirty=false,disposed=false,continuous=false;
 const stats={frames:0,requests:0,active:false,disposed:false,lastFrame:0,fps};
 function cancel(){if(frame!==null)caf(frame);if(timer!==null)cancelDelay(timer);frame=timer=null;stats.active=false;}
 function schedule(){
  if(disposed||hidden()||!dirty||frame!==null||timer!==null)return;
  const wait=1000/rate-(now()-last);
  stats.active=true;
  if(wait>1)timer=delay(()=>{timer=null;schedule();},wait);
  else frame=raf(tick);
 }
 function tick(time){frame=null;stats.active=false;if(disposed||hidden())return;
  if(time-last<1000/rate-1){schedule();return;}
  dirty=false;last=time;stats.frames++;stats.lastFrame=time;draw(time/1000);
  if(continuous)dirty=true;schedule();
 }
 function request(){if(disposed)return;stats.requests++;dirty=true;schedule();}
 return {stats,request,setFps(value){rate=value;stats.fps=value;cancel();schedule();},setContinuous(value){continuous=value;if(value)request();},visibility(){cancel();if(!hidden())request();},dispose(){disposed=true;cancel();dirty=false;stats.disposed=true;}};
}
