import http from 'node:http';
import {depositQueueStatus} from './deposit-queue.js';
import {createGiveaway} from './giveaway.js';
import {createMaintenance} from './maintenance.js';
import {gzipSync} from 'node:zlib';
import {createFairness} from './fairness.js';
import {createStats} from './stats.js';
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
const maintenance=createMaintenance(store),giveaways=createGiveaway(store,e);
const fairness=createFairness(store,e),stats=createStats(store),bootId=randomUUID(),avatarCache=new Map(),staticCache=new Map();
const routes={
 '/api/giveaway/join':giveaways.join,
 '/api/sell':e.sell,'/api/buy':e.buy,'/api/exchange':e.exchange,'/api/case':e.openCase,'/api/upgrade':e.upgrade,'/api/dice':e.dice,
 '/api/mines/start':e.mineStart,'/api/mines/action':e.mineAction,'/api/crash/start':e.crashStart,'/api/crash/cashout':e.crashCashout,
 '/api/deposit/queue':e.joinDeposit,'/api/withdraw':e.withdraw,'/api/withdraw/ready':e.withdrawalReady,'/api/withdraw/cancel':e.cancelWithdrawal,
 '/api/cashback':e.claimCashback,'/api/partner/transfer':e.transferPartner,'/api/promo':e.redeem,
 '/api/admin/action':e.admin,'/api/admin/deposit-session':e.depositSession,'/api/admin/deposit-confirm':e.confirmDeposit,'/api/admin/withdraw-confirm':e.withdrawalConfirm
};
const rates=new Map();
function rate(key,max){const t=Date.now(),v=rates.get(key);if(!v||v.until<t){rates.set(key,{count:1,until:t+60000});return;}check(++v.count<=max,'Слишком много запросов, подожди минуту');}
setInterval(()=>{const t=Date.now();for(const [k,v] of rates)if(v.until<t)rates.delete(k);},60000).unref();
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');const body=JSON.stringify(data);if(body.length>2048&&res.req?.headers['accept-encoding']?.includes('gzip')){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');res.end(gzipSync(body,{level:3}));}else res.end(body);}
async function readBody(req){let raw='';for await(const part of req){raw+=part;check(Buffer.byteLength(raw)<=65536,'Слишком большой запрос');}return raw?JSON.parse(raw):{};}
function authenticated(req){const raw=req.headers.authorization?.replace(/^tma /,'');if(dev&&req.headers['x-dev-user']){const id=Number(req.headers['x-dev-user']);integer(id);return {id,first_name:id===adminId?'Владелец (локально)':'Игрок (локально)',last_name:'@Brainrot_Rush_bot'};}return validateInitData(raw,token);}

function userSummary(id){return {...stats.personal(id),global:stats.global(),proofs:fairness.proofs(id)};}

const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 try{
  const url=new URL(req.url,'http://localhost'),p=url.pathname;
  if(p==='/health'){json(res,200,{ok:true});return;}
  if(p==='/api/config'){json(res,200,{dev,botUsername:process.env.BOT_USERNAME||'Brainrot_Rush_bot',channel:'https://t.me/BrainrotRushNews',maintenance:maintenance.read()});return;}
  if(p.startsWith('/api/')){
   rate('ip:'+req.socket.remoteAddress,600);
   const tg=authenticated(req);rate('user:'+tg.id,240);e.login(tg);const admin=tg.id===adminId;
   if(p.startsWith('/api/admin/'))check(admin,'Доступ только владельцу');
   if(req.method==='GET'&&p==='/api/state'){
    const response=tx(()=>{e.tick();giveaways.tick();const revision=bootId+':'+get('SELECT total_changes() n').n+':'+Math.floor(Date.now()/60000);if(url.searchParams.get('revision')===revision)return {unchanged:true,serverTime:Date.now()};return {...e.snapshot(tg.id),...userSummary(tg.id),giveaway:giveaways.snapshot(tg.id),depositQueue:depositQueueStatus(store,tg.id),maintenance:maintenance.read(),admin,revision};});json(res,200,response);return;
   }
   if(req.method==='GET'&&p==='/api/avatar'){
    let cached=avatarCache.get(tg.id);if(!cached||cached.until<Date.now()){
     check(token,'Фото недоступно в локальном режиме');const photos=await telegram('getUserProfilePhotos',{user_id:tg.id,limit:1});check(photos.photos?.length,'Фото профиля не установлено');const photo=photos.photos[0],file=await telegram('getFile',{file_id:photo[Math.min(1,photo.length-1)].file_id});check(file.file_path,'Фото не найдено');const r=await fetch('https://api.telegram.org/file/bot'+token+'/'+file.file_path,{signal:AbortSignal.timeout(10000)});check(r.ok,'Фото недоступно');cached={bytes:Buffer.from(await r.arrayBuffer()),type:r.headers.get('content-type')||'image/jpeg',until:Date.now()+3600000};avatarCache.set(tg.id,cached);
    }res.writeHead(200,{'Content-Type':cached.type,'Cache-Control':'private,max-age=3600'});res.end(cached.bytes);return;
   }
   if(req.method==='GET'&&p==='/api/admin/state'){json(res,200,tx(()=>({...e.adminSnapshot(),inventory:all("SELECT id,item_id,user_id FROM inventory WHERE status='reserved'"),invoices:all('SELECT * FROM invoices ORDER BY created DESC LIMIT 200')})));return;}
   check(req.method==='POST','Метод не поддерживается');
   const body=await readBody(req),key=req.headers['idempotency-key'];
   check(typeof key==='string'&&/^[a-zA-Z0-9-]{8,100}$/.test(key),'Нужен ключ запроса');
   const signature=createHash('sha256').update(p+JSON.stringify(body)).digest('hex');
   const cached=get('SELECT * FROM requests WHERE user_id=? AND key=?',tg.id,key);
   if(cached){check(cached.path===signature,'Ключ уже использован для другой операции');json(res,200,JSON.parse(cached.response));return;}
   if(p==='/api/admin/maintenance'){const response=tx(()=>{const value=maintenance.update(tg.id,body);run('INSERT INTO requests VALUES(?,?,?,?,?)',tg.id,key,signature,JSON.stringify(value),Date.now());return value;});json(res,200,response);return;}
   if(!maintenance.allows(p,admin)){json(res,503,{error:maintenance.read().message,maintenance:maintenance.read()});return;}
   if(p==='/api/fairness/commit'){const result=tx(()=>fairness.commit(tg.id,body.clientSeed));json(res,200,result);return;}
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
   const response=tx(()=>{check(!get('SELECT blocked FROM users WHERE id=?',tg.id).blocked,'Аккаунт заблокирован');check(maintenance.allows(p,admin),maintenance.read().message);e.tick();const value=fairness.execute(tg.id,p,body,()=>handler(tg.id,body));run('INSERT INTO requests VALUES(?,?,?,?,?)',tg.id,key,signature,JSON.stringify(value),Date.now());return value;});json(res,200,response);return;
  }
  check(req.method==='GET'||req.method==='HEAD','Метод не поддерживается');
  const file=path.resolve(root,'.'+decodeURIComponent(p==='/'?'/index.html':p));check(file.startsWith(root+path.sep),'Недоступный путь');
  const stat=fs.statSync(file);check(stat.isFile(),'Файл не найден');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
  if(/\.(html|js|css|svg)$/.test(file)&&req.headers['accept-encoding']?.includes('gzip')){
   let packed=staticCache.get(file);if(!packed||packed.modified!==stat.mtimeMs){packed={modified:stat.mtimeMs,bytes:gzipSync(fs.readFileSync(file),{level:6})};staticCache.set(file,packed);}
   res.writeHead(200,{'Content-Type':types[path.extname(file)],'Content-Encoding':'gzip','Vary':'Accept-Encoding','Cache-Control':p.startsWith('/images/')?'public,max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:packed.bytes);return;
  }
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':p.startsWith('/images/')?'public,max-age=86400':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(err){json(res,err.code==='ENOENT'?404:400,{error:err.code==='ENOENT'?'Файл не найден':err.message?.includes('UNIQUE constraint')?'Операция уже выполнена или код занят':err.message||'Ошибка сервера'});}
});
server.listen(port,dev?'127.0.0.1':'0.0.0.0',()=>console.log(`Brainrot Rush: порт ${port}${dev?' (локальный режим)':''}`));
setInterval(()=>{try{tx(()=>{e.tick();giveaways.tick();});}catch(err){console.error('Scheduler:',err.message);}},1000).unref();
let stopped=false;
async function onUpdate(u){
 if(u.pre_checkout_query){const q=u.pre_checkout_query,i=get('SELECT * FROM invoices WHERE id=?',q.invoice_payload),ok=!maintenance.read().enabled&&!!i&&i.status==='pending'&&i.user_id===q.from.id&&i.stars===q.total_amount&&q.currency==='XTR';await telegram('answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(!ok?{error_message:'Счёт недоступен. Создай новый в приложении.'}:{})});}
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
