/* One proxy control, visible only while the real game action is outside the viewport. */
(()=>{
 const dock=document.createElement('div');dock.className='floating-game-action';dock.hidden=true;
 const button=document.createElement('button');button.type='button';button.className='btn wide';button.setAttribute('aria-label','Запустить раунд');dock.appendChild(button);document.body.appendChild(dock);
 const quick=document.createElement('div');quick.className='floating-quick-chances';quick.hidden=true;dock.insertBefore(quick,button);
 const quickButtons=[30,50,75].map(chance=>{const proxy=document.createElement('button');proxy.type='button';proxy.className='chip';proxy.textContent=chance+'%';proxy.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const original=document.querySelector('#main [data-quick="'+chance+'"]');if(original&&!original.disabled&&!busy)original.click();schedule();});quick.appendChild(proxy);return{chance,proxy};});
 let source=null,scheduled=false;
 function refresh(){
  scheduled=false;
  const header=document.querySelector('header'),headerHeight=header?.getBoundingClientRect().height||0;
  const heightValue=headerHeight+'px';if(document.documentElement.style.getPropertyValue('--fixed-header-height')!==heightValue)document.documentElement.style.setProperty('--fixed-header-height',heightValue);
  if(uiPrefs.floatingButton===false){dock.hidden=true;source=null;return;}
  const modal=document.querySelector('#modal'),modalOpen=modal&&!modal.hidden;
  source=modalOpen?modal.querySelector('#caseOpen'):document.querySelector('#main #upgradeGo,#main [data-action="roll-dice"],#main #mineAction,#main [data-action="mine-start"],#main #crashAction,#main [data-action="crash"]');
  if(!source||!source.isConnected||source.offsetParent===null){dock.hidden=true;return;}
  const nav=document.querySelector('#mobileNav'),navRect=nav?.getBoundingClientRect(),navHeight=!modalOpen&&navRect&&navRect.height>0&&navRect.top<innerHeight?innerHeight-navRect.top:0;
  const rect=source.getBoundingClientRect(),top=modalOpen?12:Math.max(header?.getBoundingClientRect().bottom||0,document.querySelector('#main .mobile-modes:not(:empty)')?.getBoundingClientRect().bottom||0)+8,bottom=innerHeight-navHeight-12;
  dock.hidden=rect.top>=top&&rect.bottom<=bottom;
  dock.style.bottom=(navHeight+12)+'px';
  if(button.innerHTML!==source.innerHTML)button.innerHTML=source.innerHTML;
  button.disabled=source.disabled;
  quick.hidden=modalOpen||source.id!=='upgradeGo';
  if(!quick.hidden)quickButtons.forEach(({chance,proxy})=>{const original=document.querySelector('#main [data-quick="'+chance+'"]');proxy.disabled=!original||original.disabled||busy;const active=!!original?.classList.contains('active');proxy.classList.toggle('active',active);proxy.setAttribute('aria-pressed',String(active));});
  button.setAttribute('aria-label',source.textContent.trim());
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(refresh);}}
 button.addEventListener('click',e=>{e.stopImmediatePropagation();e.preventDefault();if(source?.isConnected&&!source.disabled)source.click();schedule();});
 const observer=new MutationObserver(schedule);
 for(const selector of ['#main','#modal']){const el=document.querySelector(selector);if(el)observer.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','class','aria-pressed'],characterData:true});}
 addEventListener('scroll',schedule,{passive:true,capture:true});addEventListener('resize',schedule,{passive:true});
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});
 schedule();
})();
