import {createHmac,timingSafeEqual} from 'node:crypto';
export function validateInitData(raw, token, now = Date.now()) {
  if (!raw || raw.length>16384 || !token) throw new Error('Открой приложение через Telegram');
  const p=new URLSearchParams(raw), seen=new Set();
  for(const [key] of p){if(seen.has(key))throw new Error('Повтор параметра авторизации');seen.add(key);}
  const hash=p.get('hash');p.delete('hash');
  const data=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  const expected=createHmac('sha256',secret).update(data).digest();
  if(!/^[a-f0-9]{64}$/i.test(hash||'')||!timingSafeEqual(expected,Buffer.from(hash,'hex')))throw new Error('Неверная подпись Telegram');
  const age=now/1000-Number(p.get('auth_date'));
  if(!Number.isFinite(age)||age < -30||age>3600)throw new Error('Открой приложение заново: авторизация истекла');
  const user=JSON.parse(p.get('user')||'null');
  if(!user||!Number.isSafeInteger(user.id)||user.id<=0)throw new Error('Нет пользователя Telegram');
  return {...user,start_param:p.get('start_param')||''};
}
