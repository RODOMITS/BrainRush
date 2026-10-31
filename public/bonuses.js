/* Local bonuses and partner-only referrals. Real permissions move to the backend. */
function bonusProfileId(){return String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'demo');}
function ensureBonusState(){
 state.partnerDirectory??={};state.cashback??={periods:{},claimed:0};
 if(state.bonusRevision!==1){state.referrals={code:'',available:0,earned:0,transferred:0,people:[],history:[],visits:0};state.bonusRevision=1;}
 const entry=state.partnerDirectory[bonusProfileId()];state.referrals.code=entry?.active?entry.code:'';
 if(state.referral&&!Object.values(state.partnerDirectory).some(p=>p.active&&p.code===state.referral.code))delete state.referral;
}
function currentPartner(){ensureBonusState();const entry=state.partnerDirectory[bonusProfileId()];return entry?.active?entry:null;}
function assignDemoPartner(id,code,active){
 if(page!=='admin')return false;
 id=String(id).trim();code=String(code).trim().toUpperCase();
 if(!/^(demo|[1-9]\d{0,19})$/.test(id)||!/^[A-Z0-9_]{3,20}$/.test(code)||code==='ROT'||code===promoNow().code||state.userPromos.some(p=>p.code===code)||Object.entries(state.partnerDirectory).some(([key,p])=>key!==id&&p.code===code))return false;
 state.partnerDirectory[id]={active:!!active,code,updatedAt:Date.now()};ensureBonusState();save();return true;
}
function claimCashback(at=Date.now()){
 ensureBonusState();const snapshot=cashbackSnapshot(at);
 if(!snapshot.open){toast('Получение по субботам, 10:00–22:00 МСК',true);return false;}
 if(snapshot.available<=0)return false;
 for(const [end,p] of Object.entries(state.cashback.periods)){if(Number(end)<=snapshot.cutoff)p.claimed=Math.floor(Math.max(0,p.stake-p.payout)*.05);}
 state.cashback.claimed+=Math.round(snapshot.available*100);state.balance=round(state.balance+snapshot.available);
 log('cashback','Получен кэшбэк 5%',snapshot.available);render();toast('Кэшбэк '+fmt(snapshot.available)+' R зачислен');return true;
}
const oldBonusRefTransfer=refTransfer,oldBonusProfile=renderProfile,oldBonusAdmin=renderAdmin,oldBonusGo=go,oldBonusPromoCreate=createUserPromo,oldBonusRedeem=redeemUserPromo,oldBonusDepositForm=depositForm,oldBonusDepositPromo=depositPromo;
refTransfer=function(){if(!currentPartner())return toast('Доступно только партнёрам',true);if(!bonusWindow().open)return toast('Получение по субботам, 10:00–22:00 МСК',true);return oldBonusRefTransfer();};
go=function(id){if(id==='referrals'&&!currentPartner())id='bonuses';return oldBonusGo(id);};
renderBonuses=function(){
 ensureBonusState();const partner=currentPartner(),cash=cashbackSnapshot();
 return `${title('Бонусы','')}<div class="bonus-grid">${partner?`<button class="panel partner-entry" data-page="referrals"><span class="bonus-symbol">${icon('users')}</span><div><h2>Реферальный кабинет</h2><p>${esc(partner.code)}</p></div>${icon('chevron')}</button>`:''}<section class="panel cashback-panel"><div class="panel-heading"><h2>Кэшбэк</h2><span class="cashback-rate">5%</span></div><p class="subtle">С чистого проигрыша за неделю.</p><div class="bonus-money"><div><small>К получению</small><strong class="bonus-amount">${fmt(cash.available)} R</strong></div><div><small>За текущую неделю</small><strong class="bonus-amount">${fmt(cash.pending)} R</strong></div></div><button class="btn wide" data-bonus="cashback" ${cash.open&&cash.available>0?'':'disabled'}>Забрать кэшбэк</button><small class="bonus-schedule">По субботам, 10:00–22:00 МСК. Расчёт недели — в 10:00.</small></section><div class="bonus-giveaways-soon">Розыгрыши. <span>Скоро</span></div></div>`;
};
renderReferrals=function(){
 if(!currentPartner())return `${title('Партнёрский кабинет','')}<section class="panel"><p class="subtle">Доступ предоставляется администратором.</p><button class="btn secondary" data-page="bonuses">К бонусам</button></section>`;
 const r=state.referrals,rates=referralRates(),rows=referralRows();
 return `${title('Реферальный кабинет','')}<div class="ref-top-grid"><section class="panel"><h3>Твой код</h3><button class="ref-code" data-action="copy-code">${esc(r.code)} ${icon('copy')}</button><div class="copy-row"><input readonly aria-label="Реферальная ссылка" value="https://t.me/your_bot/app?startapp=${esc(r.code)}"><button class="btn secondary" data-action="copy-ref">${icon('copy')}</button></div><small class="subtle">Код назначает администратор.</small><div class="ref-rates"><div><strong>${rates.referralPercent}%</strong><span>с чистого проигрыша</span></div><div><strong>${rates.partnerBonus}%</strong><span>с пополнения</span></div></div></section><section class="panel"><span class="label">Реферальный баланс</span><div class="ref-big">${fmt(r.available)}<small>R</small></div><button class="btn wide" data-action="ref-transfer" ${bonusWindow().open&&r.available>0?'':'disabled'}>Забрать</button><small class="bonus-schedule">По субботам, 10:00–22:00 МСК.</small></section></div><section class="panel" style="margin-top:18px"><h3>Приглашённые · ${r.people.length}</h3>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Пользователь</th><th>Пополнено</th><th>Чистый проигрыш</th><th>Доход</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${esc(p.name)}</td><td>${fmt(p.deposited)} R</td><td>${fmt(p.loss)} R</td><td>${fmt(p.earned)} R</td></tr>`).join('')}</tbody></table></div>`:'<p class="subtle">Приглашённых пока нет.</p>'}</section>`;
};
function profilePromoPanel(){return `<section class="panel profile-promo"><h3>Промокод</h3><div class="copy-row"><input id="redeemCode" placeholder="Ввести промокод" autocomplete="off" maxlength="30"><button class="btn" data-feature="redeem-promo">Применить</button></div>${state.activeDepositPromo?`<div class="active-promo"><span>На пополнение: <strong>${esc(state.activeDepositPromo)}</strong></span><button class="btn secondary" data-bonus="clear-promo">Убрать</button></div>`:''}</section>`;}
renderProfile=function(){ensureBonusState();return oldBonusProfile().replace(/<button class="panel ref-profile-link"[\s\S]*?<\/button>/,profilePromoPanel());};
depositPromo=function(code){const partner=Object.values(state.partnerDirectory||{}).find(p=>p.active&&p.code===code);if(partner)return state.settings.promoBonus;const percent=oldBonusDepositPromo(code);return code===state.referrals.code&&!currentPartner()?null:percent;};
redeemUserPromo=function(){const code=$('#redeemCode').value.trim().toUpperCase();if(state.userPromos.some(p=>p.code===code))return oldBonusRedeem();if(depositPromo(code)===null)return toast('Промокод недоступен',true);state.activeDepositPromo=code;save();render();toast('Промокод на пополнение применён');};
depositForm=function(){return oldBonusDepositForm().replace(/<label class="label" for="promo">[\s\S]*?<input[^>]*id="promo"[^>]*>/,'')+(state.activeDepositPromo?`<p class="subtle">Применён код ${esc(state.activeDepositPromo)}</p>`:'');};
doDeposit=function(){const n=Number($('#depositAmount').value);if(!Number.isFinite(n)||n<1||n>1e6)return toast('Введи сумму от 1 до 1 000 000',true);const code=state.activeDepositPromo||'',percent=code?depositPromo(code):0;if(percent===null)return toast('Промокод истёк. Убери или замени его в профиле',true);const amount=round(n+round(n*percent/100));state.balance=round(state.balance+amount);log('deposit','Тестовое пополнение',amount);closeModal();render();toast('Начислено '+fmt(amount)+' тестовых монет');};
createUserPromo=function(){if(page!=='admin')return toast('Промокоды создаёт администратор',true);return oldBonusPromoCreate();};
renderAdmin=function(){
 ensureBonusState();return oldBonusAdmin()+`<section class="panel partner-admin"><h3>Партнёры</h3><p class="subtle">Локальная демка. Текущий профиль: ${esc(bonusProfileId())}.</p><div class="form-grid"><label>Telegram ID или demo<input id="partnerUserId" value="${esc(bonusProfileId())}"></label><label>Персональный код<input id="partnerCustomCode" maxlength="20" placeholder="PARTNER_CODE"></label></div><div class="inline-actions"><button class="btn" data-bonus="grant-partner">Выдать / изменить код</button><button class="btn secondary" data-bonus="revoke-partner">Снять партнёрство</button></div><div class="partner-directory">${Object.entries(state.partnerDirectory).map(([id,p])=>`<div class="stat-line"><span>${esc(id)} · ${esc(p.code)}</span><span>${p.active?'Партнёр':'Отключён'}</span></div>`).join('')}</div></section><section class="panel" style="margin-top:18px"><h3>Создать промокод</h3><div class="form-grid"><label>Код<input id="newPromoCode" maxlength="20"></label><label>Награда<select id="newPromoType"><option value="coins">Монеты</option><option value="case">Кейс</option></select></label><label>Монет за активацию<input id="newPromoAmount" type="number" min=".01" value="10"></label><label>Кейс<select id="newPromoCase">${CONFIG.cases.filter(c=>!c.freeType).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Активаций<input id="newPromoUses" type="number" min="1" value="1"></label></div><button class="btn" data-feature="create-promo">Создать</button></section>`;
};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(['change-ref-code','save-ref-code'].includes(d.feature)||(['copy-code','copy-ref','ref-help'].includes(d.action)&&!currentPartner())){e.preventDefault();e.stopImmediatePropagation();return;}
 if(d.bonus){e.preventDefault();e.stopImmediatePropagation();switch(d.bonus){case'cashback':claimCashback();break;case'clear-promo':state.activeDepositPromo=null;save();render();break;case'grant-partner':if(assignDemoPartner($('#partnerUserId').value,$('#partnerCustomCode').value,true)){render();toast('Партнёрство и код сохранены');}else toast('Проверь ID и уникальность кода',true);break;case'revoke-partner':{if(page!=='admin')break;const id=$('#partnerUserId').value.trim(),entry=state.partnerDirectory[id];if(!entry)return toast('Партнёр не найден',true);entry.active=false;ensureBonusState();save();render();toast('Партнёрство снято');break;}}}
},true);
ensureBonusState();if(page==='referrals'&&!currentPartner())page='bonuses';render();
