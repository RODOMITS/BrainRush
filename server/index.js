import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {openStore} from './db.js';
import {validateInitData} from './auth.js';
import {createEngine,check,integer} from './engine.js';
const root=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const dev=process.env.DEV_MODE==='1';
if(dev&&process.env.NODE_ENV==='production')throw new Error('DEV_MODE запрещён в production');
const token=process.env.BOT_TOKEN||'',adminId=Number(process.env.ADMIN_ID||8911524524),port=Number(process.env.PORT||3000);
if(!dev&&!token)throw new Error('Укажи BOT_TOKEN в переменных окружения');
const store=openStore(process.env.DATABASE_PATH||'./data/brainrot.db');
async function telegram(method,body){check(token,'Telegram не подключён');const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(method==='getUpdates'?35000:12000)});const data=await response.json();check(data.ok,data.description||'Ошибка Telegram');return data.result;}
const e=createEngine(store,{telegram}),{get,all,run,tx,set,setting}=store;
const routes={
 '/api/sell':e.sell,'/api/buy':e.buy,'/api/exchange':e.exchange,'/api/case':e.openCase,'/api/upgrade':e.upgrade,'/api/dice':e.dice,
 '/api/mines/start':e.mineStart,'/api/mines/action':e.mineAction,'/api/crash/start':e.crashStart,'/api/crash/cashout':e.crashCashout,
 '/api/deposit/queue':e.joinDeposit,'/api/withdraw':e.withdraw,'/api/withdraw/ready':e.withdrawalReady,'/api/withdraw/cancel':e.cancelWithdrawal,
 '/api/cashback':e.claimCashback,'/api/partner/transfer':e.transferPartner,'/api/promo':e.redeem,
 '/api/admin/action':e.admin,'/api/admin/deposit-session':e.depositSession,'/api/admin/deposit-confirm':e.confirmDeposit,'/api/admin/withdraw-confirm':e.withdrawalConfirm
};
const rates=new Map();
function rate(key,max){const t=Date.now(),v=rates.get(key);if(!v||v.until<t){rates.set(key,{count:1,until:t+60000});return;}check(++v.count<=max,'Слишком много запросов, подожди минуту');}
setInterval(()=>{const t=Date.now();for(const [k,v] of rates)if(v.until<t)rates.delete(k);},60000).unref();
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function readBody(req){let raw='';for await(const part of req){raw+=part;check(Buffer.byteLength(raw)<=65536,'Слишком большой запрос');}return raw?JSON.parse(raw):{};}
function authenticated(req){const raw=req.headers.authorization?.replace(/^tma /,'');if(dev&&req.headers['x-dev-user']){const id=Number(req.headers['x-dev-user']);integer(id);return {id,first_name:id===adminId?'Владелец (локально)':'Игрок (локально)',last_name:'@Brainrot_Rush_bot'};}return validateInitData(raw,token);}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 try{
  const url=new URL(req.url,'http://localhost'),p=url.pathname;
  if(p==='/health'){json(res,200,{ok:true});return;}
  if(p==='/api/config'){json(res,200,{dev,botUsername:process.env.BOT_USERNAME||'Brainrot_Rush_bot',channel:'https://t.me/BrainrotRushNews'});return;}
  if(p.startsWith('/api/')){
   rate('ip:'+req.socket.remoteAddress,600);
   const tg=authenticated(req);rate('user:'+tg.id,240);e.login(tg);const admin=tg.id===adminId;
   if(p.startsWith('/api/admin/'))check(admin,'Доступ только владельцу');
   if(req.method==='GET'&&p==='/api/state'){json(res,200,{...tx(()=>e.snapshot(tg.id)),admin});return;}
   if(req.method==='GET'&&p==='/api/admin/state'){json(res,200,tx(()=>({...e.adminSnapshot(),invoices:all('SELECT * FROM invoices ORDER BY created DESC LIMIT 200')})));return;}
   check(req.method==='POST','Метод не поддерживается');
   const body=await readBody(req),key=req.headers['idempotency-key'];
   check(typeof key==='string'&&/^[a-zA-Z0-9-]{8,100}$/.test(key),'Нужен ключ запроса');
   const signature=createHash('sha256').update(p+JSON.stringify(body)).digest('hex');
   const cached=get('SELECT * FROM requests WHERE user_id=? AND key=?',tg.id,key);
   if(cached){check(cached.path===signature,'Ключ уже использован для другой операции');json(res,200,JSON.parse(cached.response));return;}
   if(p==='/api/case'){const c=get('SELECT data FROM cases WHERE id=?',body.caseId);check(c,'Кейс не найден');await e.freeCheck(tg.id,JSON.parse(c.data),tg);}
   if(p==='/api/admin/refund'){
    const invoice=get('SELECT * FROM invoices WHERE id=?',body.id);check(invoice&&['paid','refund_pending'].includes(invoice.status),'Платёж не найден или уже возвращён');
    if(invoice.status==='paid')tx(()=>{e.balance(invoice.user_id,-invoice.coins,'stars_refund_reserve',{invoice:invoice.id});run("UPDATE invoices SET status='refund_pending' WHERE id=?",invoice.id);e.audit(tg.id,'refund_pending',{id:invoice.id});});
    try{await telegram('refundStarPayment',{user_id:invoice.user_id,telegram_payment_charge_id:invoice.charge});}catch(err){if(!/already.*refund|charge_already_refunded/i.test(err.message))throw new Error('Возврат ожидает повтора: '+err.message);}
    tx(()=>{run("UPDATE invoices SET status='refunded' WHERE id=?",invoice.id);e.audit(tg.id,'stars_refund',{id:invoice.id});e.notify(invoice.user_id,'Платёж Stars возвращён.');});json(res,200,{ok:true});return;
   }
   if(p==='/api/invoice'){
    const coins=integer(body.coins,2);check(coins%2===0,'Сумма монет должна быть чётной: Stars списываются целым числом');const stars=coins*1.5;integer(stars);
    const id=randomUUID();run('INSERT INTO invoices(id,user_id,coins,stars,created) VALUES(?,?,?,?,?)',id,tg.id,coins*100,stars,Date.now());
    const link=await telegram('createInvoiceLink',{title:'Монеты Brainrot Rush',description:`${coins} игровых монет. 1 монета = 1,5 Stars.`,payload:id,currency:'XTR',prices:[{label:'Монеты',amount:stars}],provider_token:''});
    const response={link};run('INSERT INTO requests VALUES(?,?,?,?,?)',tg.id,key,signature,JSON.stringify(response),Date.now());json(res,200,response);return;
   }
   const handler=routes[p];check(handler,'Операция не найдена');
   const response=tx(()=>{check(!get('SELECT blocked FROM users WHERE id=?',tg.id).blocked,'Аккаунт заблокирован');e.tick();const value=handler(tg.id,body);run('INSERT INTO requests VALUES(?,?,?,?,?)',tg.id,key,signature,JSON.stringify(value),Date.now());return value;});json(res,200,response);return;
  }
  check(req.method==='GET'||req.method==='HEAD','Метод не поддерживается');
  const file=path.resolve(root,'.'+decodeURIComponent(p==='/'?'/index.html':p));check(file.startsWith(root+path.sep),'Недоступный путь');
  const stat=fs.statSync(file);check(stat.isFile(),'Файл не найден');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':p.startsWith('/images/')?'public,max-age=86400':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(err){json(res,err.code==='ENOENT'?404:400,{error:err.code==='ENOENT'?'Файл не найден':err.message?.includes('UNIQUE constraint')?'Операция уже выполнена или код занят':err.message||'Ошибка сервера'});}
});
server.listen(port,dev?'127.0.0.1':'0.0.0.0',()=>console.log(`Brainrot Rush: порт ${port}${dev?' (локальный режим)':''}`));
setInterval(()=>{try{tx(()=>e.tick());}catch(err){console.error('Scheduler:',err.message);}},1000).unref();
let stopped=false;
async function onUpdate(u){
 if(u.pre_checkout_query){const q=u.pre_checkout_query,i=get('SELECT * FROM invoices WHERE id=?',q.invoice_payload),ok=!!i&&i.status==='pending'&&i.user_id===q.from.id&&i.stars===q.total_amount&&q.currency==='XTR';await telegram('answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(!ok?{error_message:'Счёт недоступен. Создай новый в приложении.'}:{})});}
 const m=u.message;if(!m)return;
 if(m.successful_payment){const p=m.successful_payment;tx(()=>{const i=get('SELECT * FROM invoices WHERE id=?',p.invoice_payload);check(i&&i.user_id===m.from.id&&i.stars===p.total_amount&&p.currency==='XTR','Несовпадение платежа');if(i.status==='paid')return;check(i.status==='pending','Счёт уже закрыт');run("UPDATE invoices SET status='paid',charge=? WHERE id=?",p.telegram_payment_charge_id,i.id);e.balance(i.user_id,i.coins,'deposit_stars',{invoice:i.id,charge:p.telegram_payment_charge_id});e.notify(i.user_id,`Зачислено ${i.coins/100} монет.`);});}
 if(m.text?.startsWith('/start')){const arg=m.text.split(/\s+/)[1]||'';tx(()=>e.login({...m.from,start_param:arg}));await telegram('sendMessage',{chat_id:m.chat.id,text:'Brainrot Rush — кейсы и коллекция. Открывай приложение 👇',reply_markup:{inline_keyboard:[[{text:'Открыть Brainrot Rush',web_app:{url:process.env.PUBLIC_URL}}]]}});}
 if(m.text==='/paysupport'||m.text==='/support')await telegram('sendMessage',{chat_id:m.chat.id,text:'Помощь по платежам: отправь описание проблемы и идентификатор платежа командой /support ТЕКСТ. Владелец рассмотрит обращение.'});
 else if(m.text?.startsWith('/support ')){await telegram('sendMessage',{chat_id:adminId,text:`Обращение от ${m.from.id}:\n${m.text.slice(9,3000)}`});await telegram('sendMessage',{chat_id:m.chat.id,text:'Обращение передано владельцу.'});}
}
async function poll(){while(!stopped){try{const updates=await telegram('getUpdates',{offset:setting('telegramOffset',0),timeout:25,allowed_updates:['message','pre_checkout_query']});for(const u of updates){await onUpdate(u);set('telegramOffset',u.update_id+1);}}catch(err){console.error('Telegram:',err.message.replaceAll(token,'[TOKEN]'));await new Promise(r=>setTimeout(r,3000));}}}
let draining=false;
setInterval(async()=>{if(draining||!token)return;draining=true;try{for(const m of all('SELECT * FROM outbox WHERE sent=0 ORDER BY id LIMIT 20')){try{await telegram('sendMessage',{chat_id:m.user_id,text:m.text});run('UPDATE outbox SET sent=1 WHERE id=?',m.id);}catch(err){if(/blocked|chat not found|deactivated/i.test(err.message))run('UPDATE outbox SET sent=-1 WHERE id=?',m.id);else break;}}}finally{draining=false;}},2000).unref();
if(token){telegram('setChatMenuButton',{menu_button:{type:'web_app',text:'Играть',web_app:{url:process.env.PUBLIC_URL}}}).catch(()=>console.error('Проверь PUBLIC_URL для меню бота'));poll();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;server.close(()=>{store.db.close();process.exit(0);});});
