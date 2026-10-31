/* Custom case categories and explicitly local free-case conditions. */
const baseCustomCasesView=renderCases,baseCustomOpen=openCase,baseCustomControls=caseControls,baseCustomSettlement=settleCaseBatch,baseCustomRoll=rollCase;
let previousPaidCount=caseCount,lastCaseWasFree=false;
function freeCaseStatus(c,at=Date.now()){
 const claim=state.freeCaseClaims?.[c.id];
 if(c.freeType==='referral'&&claim?.used)return{ready:false,condition:true,label:'Уже получен'};
 const next=Number(claim?.nextAt)||0;
 if(next>at)return{ready:false,condition:true,label:'Через '+countdown(next),next};
 const condition=state.freeCaseConditions?.[c.id]===true||(c.freeType==='referral'&&!!state.referral?.code&&state.referral.code!==state.referrals?.code)||(c.freeType==='username'&&!!window.Telegram?.WebApp?.initDataUnsafe?.user?.username);
 return{ready:condition,condition,label:condition?'Открыть бесплатно':'Подтвердить условие'};
}
function customCaseFoot(c){if(c.freeType){const status=freeCaseStatus(c);return `<span class="free-case-status" ${status.next?`data-free-case-timer="${c.id}"`:''}>${esc(status.label)}</span><span class="price">Бесплатно</span>`;}return `<span>${c.category==='allin'?'All-in':'Открыть'}</span><span class="price"><span class="coin">R</span>${fmt(casePrice(c))}</span>`;}
renderCases=function(){return baseCustomCasesView().replace(/<label class="search">[\s\S]*?<\/label>/,'');};
filterCases=function(){
 const card=c=>`<button class="case-card custom-case-card" style="--accent:${c.accent}" data-case="${c.id}">${c.freeType?`<span class="tiny-tag">${c.freeType==='referral'?'Один раз':'Раз в 6 часов'}</span>`:c.category==='allin'?'<span class="tiny-tag">All-in</span>':''}<div class="case-art">${caseArt(c)}</div><h3>${esc(c.name)}</h3><div class="price-row">${customCaseFoot(c)}</div><div class="rarity-bar"></div></button>`;
 patchElementHTML($('#caseGrid'),CONFIG.caseGroups.map(([id,name])=>`<section class="custom-case-section" data-case-section="${id}"><div class="section-head"><h2>${name}</h2></div><div class="case-grid custom-case-grid">${CONFIG.cases.filter(c=>c.category===id).map(card).join('')}</div></section>`).join(''));
};
caseControls=function(c){
 if(!c.freeType)return baseCustomControls(c);
 const status=freeCaseStatus(c),condition={subscribe:'Подписка на канал',username:'Telegram-юзернейм',referral:'Первый переход по чужой реферальной ссылке'}[c.freeType];
 return `<div class="free-case-condition"><strong>${condition}</strong><small>Демо: условие подтверждается вручную. Реальная проверка появится с бэкендом.</small>${!status.condition?`<button class="btn secondary" data-free-case-check="${c.id}">Подтвердить условие (демо)</button>`:''}</div><button class="btn wide" id="caseOpen" data-open="${c.id}" ${status.ready?'':'disabled'} ${status.next?`data-free-case-timer="${c.id}"`:''}>${esc(status.label)}</button>`;
};
openCase=function(id){if(busy)return baseCustomOpen(id);const c=CONFIG.cases.find(c=>c.id===id);if(!c)return;if(c.freeType){if(!lastCaseWasFree)previousPaidCount=caseCount;caseCount=1;lastCaseWasFree=true;}else if(lastCaseWasFree){caseCount=previousPaidCount;lastCaseWasFree=false;}baseCustomOpen(id);if(c.freeType){const price=document.querySelector('.case-opening-price');if(price)price.textContent='Бесплатно';}};
settleCaseBatch=function(c,count){
 if(c.freeType&&(count!==1||!freeCaseStatus(c).ready))return null;
 const winners=baseCustomSettlement(c,count);
 if(winners&&c.freeType){state.freeCaseClaims??={};state.freeCaseClaims[c.id]={used:true,at:Date.now(),nextAt:c.freeType==='referral'?null:Date.now()+12*3600000};save();}
 return winners;
};
rollCase=function(id){if(!busy){const c=CONFIG.cases.find(c=>c.id===id);if(c?.freeType&&!freeCaseStatus(c).ready)return toast(freeCaseStatus(c).label,true);}return baseCustomRoll(id);};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.freeCaseCheck){const c=CONFIG.cases.find(c=>c.id===b.dataset.freeCaseCheck);if(!c?.freeType)return;state.freeCaseConditions??={};state.freeCaseConditions[c.id]=true;save();openCase(c.id);}});
setInterval(()=>{$$('[data-free-case-timer]').forEach(el=>{const c=CONFIG.cases.find(c=>c.id===el.dataset.freeCaseTimer);if(!c)return;const status=freeCaseStatus(c);if(el.textContent!==status.label)el.textContent=status.label;if(el.tagName==='BUTTON')el.disabled=!status.ready;});},1000);
if(page==='cases')render();
