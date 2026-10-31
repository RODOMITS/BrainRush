/* One visual denomination for every visible money amount. */
const CURRENCY_SRC='images/brand/currency.svg';
function currencyTextMatches(text){return [...text.matchAll(/(^|[^\p{L}\p{N}_])(?:(\d(?:[\d \u00a0\u202f.,]*\d)?)[ \u00a0\u202f]*(R|монет(?:ами|ах|ам|а|ы|у)?)|(монет(?:ами|ах|ам|а|ы|у)?|деньги|денег))(?![\p{L}\p{N}_])/giu)];}
(()=>{
 if(!document.createTreeWalker)return;
 document.documentElement.classList.add('currency-enabled');
 const skip='script,style,svg,pre,code,textarea,input,select,option,[contenteditable],.currency-value,.currency-word,.currency-unit,.coin,#crashMult,#crashSideMult,#crashReturn,.timer,[data-free-case-timer]';
 function makeIcon(){const img=document.createElement('img');img.className='currency-icon';img.src=CURRENCY_SRC;img.width=20;img.height=20;img.alt='';img.setAttribute('aria-hidden','true');return img;}
 function decorate(root){
  if(!root?.isConnected)return;
  const coins=[...(root.matches?.('.coin')?[root]:[]),...(root.querySelectorAll?.('.coin')||[])];
  for(const coin of coins){if(coin.querySelector('.currency-icon'))continue;coin.replaceChildren(makeIcon());coin.setAttribute('aria-label','Монеты Brainrot Rush');}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode()){const n=walker.currentNode;if(n.parentElement&&!n.parentElement.closest(skip)&&currencyTextMatches(n.nodeValue).length)nodes.push(n);}
  for(const node of nodes){const text=node.nodeValue,matches=currencyTextMatches(text),fragment=document.createDocumentFragment();let cursor=0;
   for(const m of matches){fragment.append(document.createTextNode(text.slice(cursor,m.index)+m[1]));const span=document.createElement('span');span.className=m[2]?'currency-value':'currency-word';span.append(makeIcon());if(m[2]){const number=m[2].trim();span.append(document.createTextNode(number));span.setAttribute('aria-label',number+' монет');}else span.append(document.createTextNode(m[4]));fragment.append(span);cursor=m.index+m[0].length;}
   fragment.append(document.createTextNode(text.slice(cursor)));node.replaceWith(fragment);
  }
  const units=root.querySelectorAll?.('.upgrade-boost>div>span,.ref-big>small')||[];
  for(const unit of units){if(unit.textContent.trim()==='R'){unit.classList.add('currency-unit');unit.replaceChildren(makeIcon());unit.setAttribute('aria-label','монет');}}
 }
 const pending=new Set();let scheduled=false;
 function flush(){scheduled=false;observer.disconnect();const roots=[...pending].filter(n=>n.isConnected);pending.clear();for(const root of roots){if(!roots.some(other=>other!==root&&other.contains(root)))decorate(root);}observer.observe(document.body,{subtree:true,childList:true,characterData:true});}
 const observer=new MutationObserver(records=>{for(const r of records){const el=r.target.nodeType===Node.TEXT_NODE?r.target.parentElement:r.target;if(el&&!el.closest?.(skip))pending.add(el);}if(pending.size&&!scheduled){scheduled=true;requestAnimationFrame(flush);}});
 decorate(document.body);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();
