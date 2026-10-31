/* Delay final modal cleanup until its closing transition completes. */
(()=>{
 const finishClose=closeModal,openModal=showModal,finishDrawer=closeDrawer;
 let closeTimer=null,drawerTimer=null;
 function cancelClose(){if(closeTimer!==null)clearTimeout(closeTimer);closeTimer=null;document.querySelector('#modal')?.classList.remove('is-closing');}
 showModal=function(...args){cancelClose();return openModal(...args);};
 closeModal=function(){
  const modal=document.querySelector('#modal');
  if(!modal||modal.hidden||modalLocked||matchMedia('(prefers-reduced-motion: reduce)').matches)return finishClose();
  if(closeTimer!==null)return;
  modal.classList.add('is-closing');
  closeTimer=setTimeout(()=>{closeTimer=null;modal.classList.remove('is-closing');finishClose();},180);
 };
 closeDrawer=function(){
  if(!document.body.classList.contains('drawer-open'))return finishDrawer();
  if(drawerTimer!==null)clearTimeout(drawerTimer);
  document.body.classList.add('drawer-closing');finishDrawer();
  drawerTimer=setTimeout(()=>{document.body.classList.remove('drawer-closing');drawerTimer=null;},220);
 };
 document.addEventListener('click',e=>{const trigger=e.target.closest('[data-feature="drawer"]');if(!trigger)return;if(document.body.classList.contains('drawer-open')){e.preventDefault();e.stopImmediatePropagation();closeDrawer();}else{if(drawerTimer!==null)clearTimeout(drawerTimer);drawerTimer=null;document.body.classList.remove('drawer-closing');}},true);
})();
