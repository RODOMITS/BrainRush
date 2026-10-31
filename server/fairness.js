import {randomBytes,randomUUID,createHash,createHmac} from 'node:crypto';
import {check} from './engine.js';
import {catalog} from './catalog.js';
export function createFairness(store,engine){
 const {db,all,get,run}=store;
 db.exec(`CREATE TABLE IF NOT EXISTS fairness(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,seed TEXT NOT NULL,hash TEXT NOT NULL,client_seed TEXT NOT NULL,game_id TEXT UNIQUE,kind TEXT,input TEXT,outcome TEXT,draw_count INTEGER,created INTEGER NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS fairness_pending ON fairness(user_id) WHERE game_id IS NULL;
 CREATE INDEX IF NOT EXISTS games_user_closed ON games(user_id,closed);
 CREATE INDEX IF NOT EXISTS ledger_user_created ON ledger(user_id,created);`);
 const kinds={'/api/case':'case','/api/upgrade':'upgrade','/api/dice':'dice','/api/mines/start':'mines','/api/crash/start':'crash'};
 function commit(user,clientSeed){check(typeof clientSeed==='string'&&clientSeed.length>=3&&clientSeed.length<=100,'Client seed: 3–100 символов');let row=get('SELECT * FROM fairness WHERE user_id=? AND game_id IS NULL',user);if(!row){const seed=randomBytes(32).toString('hex'),id=randomUUID(),hash=createHash('sha256').update(seed).digest('hex');run('INSERT INTO fairness(id,user_id,seed,hash,client_seed,created) VALUES(?,?,?,?,?,?)',id,user,seed,hash,clientSeed,Date.now());row=get('SELECT * FROM fairness WHERE id=?',id);}else if(row.client_seed!==clientSeed){run('UPDATE fairness SET client_seed=? WHERE id=?',clientSeed,row.id);row.client_seed=clientSeed;}return {id:row.id,hash:row.hash,clientSeed:row.client_seed,created:row.created};}
 function inputFor(user,kind,b){const eco=store.setting('economy');if(kind==='case'){const c=JSON.parse(get('SELECT data FROM cases WHERE id=?',b.caseId)?.data||'null');check(c,'Кейс не найден');return {pool:c.drops,quantity:c.freeType?1:b.quantity||1};}if(kind==='dice')return {color:b.color};if(kind==='mines')return {count:b.count};if(kind==='crash')return {edge:eco.crashEdge};let stake=b.coins||0;check(Array.isArray(b.ids),'Нет ставки');for(const id of b.ids){const i=get("SELECT i.price FROM inventory v JOIN items i ON v.item_id=i.id WHERE v.id=? AND v.user_id=? AND v.status='available'",id,user);check(i,'Предмет недоступен');stake+=i.price;}const target=get('SELECT price FROM items WHERE id=?',b.target);check(target,'Цель не найдена');return {stake,target:target.price,edge:eco.upgradeEdge};}
 function execute(user,path,b,handler){const kind=kinds[path];if(!kind)return handler();const f=get('SELECT * FROM fairness WHERE id=? AND user_id=? AND game_id IS NULL',b.fairnessId||'',user);check(f,'Обнови приложение для получения хэша следующего раунда');const input=inputFor(user,kind,b);let nonce=0;const rng=()=>parseInt(createHmac('sha256',f.seed).update(f.client_seed+':'+nonce++).digest('hex').slice(0,13),16)/2**52;
  const result=engine.withRandom(rng,handler),gameId=result.gameId||result.id,g=get('SELECT * FROM games WHERE id=?',gameId),state=JSON.parse(g.state);let outcome;
  if(kind==='case')outcome={items:result.prizes.map(p=>p.coin?catalog.coinRewards.find(i=>Math.round(i.value*100)===p.coin).id:p.item_id)};
  if(kind==='upgrade')outcome={won:result.won,chance:result.chance};
  if(kind==='dice')outcome={faces:result.faces,matches:result.matches,won:result.won};
  if(kind==='mines')outcome={bombs:state.bombs};if(kind==='crash')outcome={point:state.point};
  run('UPDATE fairness SET game_id=?,kind=?,input=?,outcome=?,draw_count=? WHERE id=?',gameId,kind,JSON.stringify(input),JSON.stringify(outcome),nonce,f.id);return {...result,fairness:{id:f.id,hash:f.hash}};
 }
 function proofs(user){return all('SELECT f.*,g.closed FROM fairness f JOIN games g ON g.id=f.game_id WHERE f.user_id=? ORDER BY f.created DESC LIMIT 100',user).map(f=>({id:f.id,gameId:f.game_id,kind:f.kind,hash:f.hash,clientSeed:f.client_seed,created:f.created,closed:f.closed,...(f.closed?{seed:f.seed,input:JSON.parse(f.input),outcome:JSON.parse(f.outcome),drawCount:f.draw_count}:{})}));}
 return {commit,execute,proofs};
}
