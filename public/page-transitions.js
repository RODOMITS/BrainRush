/* Route-only transitions: state updates never replay the page animation. */
(()=>{
 const previousGo=go;
 let running=[],ghost=null;
 const order=['cases','upgrade','mines','dice','crash','inventory','bonuses','referrals','profile','admin','faq'];
 function clear(){running.forEach(a=>a.cancel());running=[];ghost?.remove();ghost=null;}
 go=function(id){
  if(page===id||busy||mine.active||crash.active)return previousGo(id);
  clear();
  const main=document.querySelector('#main .page-in');
  if(!main?.animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return previousGo(id);
  const direction=order.indexOf(id)>=order.indexOf(page)?1:-1;
  const rect=main.getBoundingClientRect();
  const distance=Math.max(280,Math.min(rect.width,innerWidth)*.94);
  if(rect.bottom>0&&rect.top<innerHeight&&main.getElementsByTagName('*').length<=900){
   ghost=main.cloneNode(true);
   ghost.removeAttribute('id');
   ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
   ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');
   ghost.classList.add('route-ghost');
   Object.assign(ghost.style,{position:'fixed',top:rect.top+'px',left:rect.left+'px',width:rect.width+'px',height:Math.min(rect.height,innerHeight-Math.max(0,rect.top))+'px',margin:'0',boxSizing:'border-box',overflow:'hidden',pointerEvents:'none',zIndex:'30'});
   document.body.appendChild(ghost);
  }
  previousGo(id);
  if(page!==id){clear();return;}
  const outgoing=ghost;
  if(outgoing){
   const exit=outgoing.animate([{opacity:1,transform:'translateX(0) scale(1)'},{opacity:0,transform:`translateX(${-direction*distance}px) scale(1)`}],{duration:220,easing:'cubic-bezier(.3,.1,.5,1)',fill:'both'});
   running.push(exit);exit.finished.then(()=>{outgoing.remove();if(ghost===outgoing)ghost=null;}).catch(()=>{});
  }
  const incoming=document.querySelector('#main .page-in');
  if(!incoming?.animate){clear();return;}
  const enter=incoming.animate([{opacity:.85,transform:`translateX(${direction*distance}px) scale(1)`},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:240,easing:'cubic-bezier(.22,.65,.35,1)',fill:'none'});
  running.push(enter);
 };
})();
