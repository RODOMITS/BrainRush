import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {catalog,cents,acceptedNames,normalize,withdrawNames} from './catalog.js';
export function openStore(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, username TEXT, balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0), blocked INTEGER NOT NULL DEFAULT 0, referrer INTEGER, created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,name TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),image TEXT,tier INTEGER,deposit INTEGER NOT NULL DEFAULT 0,withdraw INTEGER NOT NULL DEFAULT 0,stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0));
 CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS inventory(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),item_id TEXT NOT NULL REFERENCES items(id),status TEXT NOT NULL DEFAULT 'available');
 CREATE INDEX IF NOT EXISTS inventory_user ON inventory(user_id,status);
 CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),delta INTEGER NOT NULL,balance INTEGER NOT NULL,kind TEXT NOT NULL,detail TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,kind TEXT NOT NULL,stake INTEGER NOT NULL,payout INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL,created INTEGER NOT NULL,closed INTEGER);
 CREATE TABLE IF NOT EXISTS claims(user_id INTEGER NOT NULL,case_id TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(user_id,case_id));
 CREATE TABLE IF NOT EXISTS deposits(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,nick TEXT NOT NULL,items TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,started INTEGER,expires INTEGER);
 CREATE TABLE IF NOT EXISTS withdrawals(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,nick TEXT NOT NULL,inventory TEXT NOT NULL,day TEXT NOT NULL,slot INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'queued',ready INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,UNIQUE(day,slot));
 CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,coins INTEGER NOT NULL,stars INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',charge TEXT UNIQUE,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS partners(user_id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,percent REAL NOT NULL DEFAULT 5,active INTEGER NOT NULL DEFAULT 1,balance INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS partner_accruals(partner_id INTEGER NOT NULL,referral_id INTEGER NOT NULL,accrued INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(partner_id,referral_id));
 CREATE TABLE IF NOT EXISTS promos(code TEXT PRIMARY KEY,amount INTEGER NOT NULL,uses INTEGER NOT NULL,expires INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS promo_claims(code TEXT NOT NULL,user_id INTEGER NOT NULL,PRIMARY KEY(code,user_id));
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor INTEGER NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(user_id INTEGER NOT NULL,key TEXT NOT NULL,path TEXT NOT NULL,response TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user_id,key));
 CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,text TEXT NOT NULL,sent INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
 `);
 const all=(sql,...args)=>db.prepare(sql).all(...args),get=(sql,...args)=>db.prepare(sql).get(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
 const set=(k,v)=>run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',k,JSON.stringify(v));
 const setting=(k,fallback)=>{const r=get('SELECT value FROM settings WHERE key=?',k);return r?JSON.parse(r.value):fallback;};
 tx(()=>{
 for(const i of catalog.items)run('INSERT OR IGNORE INTO items(id,name,price,image,tier,deposit,withdraw) VALUES(?,?,?,?,?,?,?)',i.id,i.name,cents(i.value),i.imageSmall||i.image,i.tier,Number(acceptedNames.some(n=>normalize(n)===normalize(i.name))),Number(withdrawNames.includes(i.name)));
 for(const c of catalog.cases)run('INSERT OR IGNORE INTO cases(id,data) VALUES(?,?)',c.id,JSON.stringify(c));
 if(!get("SELECT key FROM settings WHERE key='economy'"))set('economy',{minesEdge:.08,upgradeEdge:.08,crashEdge:.08,partnerPercent:5,depositBonus:0,freeMode:'recent_deposit',cashbackPercent:5});
 });
 return {db,all,get,run,tx,set,setting};
}
