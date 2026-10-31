import {check} from './engine.js';
export function createMaintenance(store){
 const read=()=>store.setting('maintenance',{enabled:false,message:'Обновляем проект. Скоро вернёмся!',updated:0});
 function update(actor,body){check(typeof body.enabled==='boolean','Укажи состояние режима обновления');const message=String(body.message||read().message).trim();check(message.length>0&&message.length<=500,'Сообщение: 1–500 символов');const state={enabled:body.enabled,message,updated:Date.now()};store.set('maintenance',state);store.run('INSERT INTO audit(actor,action,detail,created) VALUES(?,?,?,?)',actor,'maintenance',JSON.stringify(state),Date.now());return state;}
 const finish=new Set(['/api/mines/action','/api/crash/cashout','/api/withdraw/ready','/api/withdraw/cancel','/api/fairness/commit']);
 function allows(path,admin){return admin||!read().enabled||finish.has(path);}
 return {read,update,allows};
}
