/** Last-line release handling when a browser/overlay loses the control's event.
 * A normal lift releases only that pointer, preserving the other thumb.
 */
export function watchPointerRelease({release,clear,hasPointers},target=window,doc=document){
  const capture={capture:true};
  const up=e=>release(e);
  const move=e=>{if(e.buttons===0)release({pointerId:e.pointerId,type:'pointercancel'});};
  const touchEnd=e=>{if(e.touches.length===0&&hasPointers())clear();};
  const touchCancel=()=>{if(hasPointers())clear();};
  target.addEventListener('pointerup',up,capture);
  target.addEventListener('pointercancel',up,capture);
  target.addEventListener('pointermove',move,capture);
  target.addEventListener('pagehide',clear);
  doc.addEventListener('touchend',touchEnd,{capture:true,passive:true});
  doc.addEventListener('touchcancel',touchCancel,{capture:true,passive:true});
  return()=>{
    target.removeEventListener('pointerup',up,capture);target.removeEventListener('pointercancel',up,capture);
    target.removeEventListener('pointermove',move,capture);target.removeEventListener('pagehide',clear);
    doc.removeEventListener('touchend',touchEnd,capture);doc.removeEventListener('touchcancel',touchCancel,capture);
  };
}
