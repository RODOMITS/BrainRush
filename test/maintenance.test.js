import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,unlinkSync,rmdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/db.js';
import {createEngine} from '../server/engine.js';
import {createMaintenance} from '../server/maintenance.js';
test('Maintenance survives reopening database; balances, items and active game remain',()=>{
 const dir=mkdtempSync(join(tmpdir(),'brainrot-maint-')),file=join(dir,'test.db');let store=openStore(file),engine=createEngine(store),mode=createMaintenance(store);
 engine.login({id:1,first_name:'Игрок'});engine.balance(1,10000,'deposit_items');const item=store.get('SELECT id FROM items LIMIT 1');const owned=engine.add(1,item.id);const mine=store.tx(()=>engine.mineStart(1,{stake:100,count:3}));const balance=store.get('SELECT balance FROM users WHERE id=1').balance;
 store.tx(()=>mode.update(99,{enabled:true,message:'Вернёмся после обновления'}));store.db.close();
 store=openStore(file);mode=createMaintenance(store);assert.equal(mode.read().enabled,true);assert.equal(mode.read().message,'Вернёмся после обновления');assert.equal(store.get('SELECT balance FROM users WHERE id=1').balance,balance);assert.equal(store.get('SELECT status FROM inventory WHERE id=?',owned.id).status,'available');assert.equal(store.get('SELECT closed FROM games WHERE id=?',mine.id).closed,null);
 for(const path of ['/api/case','/api/upgrade','/api/mines/start','/api/crash/start','/api/invoice','/api/deposit/queue','/api/withdraw','/api/sell'])assert.equal(mode.allows(path,false),false,path);
 for(const path of ['/api/mines/action','/api/crash/cashout','/api/withdraw/ready','/api/withdraw/cancel'])assert.equal(mode.allows(path,false),true,path);
 assert.equal(mode.allows('/api/admin/action',true),true);store.tx(()=>mode.update(99,{enabled:false}));store.db.close();store=openStore(file);assert.equal(createMaintenance(store).read().enabled,false);store.db.close();for(const name of ['test.db','test.db-wal','test.db-shm'])if(existsSync(join(dir,name)))unlinkSync(join(dir,name));rmdirSync(dir);
});
