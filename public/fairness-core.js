export function replay(kind,input,draws){
 let n=0;const draw=()=>{const v=draws[n++];if(!Number.isFinite(v)||v<0||v>=1)throw Error('Неверная последовательность');return v;};
 if(kind==='case'){const sum=input.pool.reduce((a,d)=>a+d.weight,0);return {items:Array.from({length:input.quantity},()=>{let r=draw()*sum;return (input.pool.find(d=>(r-=d.weight)<0)||input.pool.at(-1)).id;})};}
 if(kind==='upgrade'){const chance=Math.min(.75,input.stake/input.target*(1-input.edge));return {won:draw()<chance,chance};}
 if(kind==='dice'){const faces=Array.from({length:4},()=>Math.floor(draw()*6)),matches=faces.filter(f=>f===input.color).length;return {faces,matches,won:matches===1||matches===4};}
 if(kind==='mines'){const cells=Array.from({length:25},(_,i)=>i);for(let i=24;i>0;i--){const j=Math.floor(draw()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}return {bombs:cells.slice(0,input.count)};}
 if(kind==='crash')return {point:Math.max(1,(1-input.edge)/(1-draw()))};
 throw Error('Неизвестная игра');
}
export async function verifyProof(proof,cryptoAPI=globalThis.crypto){
 const encoder=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 if(!proof.seed)return {valid:false,pending:true};
 if(hex(await cryptoAPI.subtle.digest('SHA-256',encoder.encode(proof.seed)))!==proof.hash)return {valid:false,reason:'Seed не соответствует хэшу'};
 const key=await cryptoAPI.subtle.importKey('raw',encoder.encode(proof.seed),{name:'HMAC',hash:'SHA-256'},false,['sign']),draws=[];
 for(let i=0;i<proof.drawCount;i++){const h=hex(await cryptoAPI.subtle.sign('HMAC',key,encoder.encode(proof.clientSeed+':'+i)));draws.push(parseInt(h.slice(0,13),16)/2**52);}
 const actual=replay(proof.kind,proof.input,draws);
 return {valid:JSON.stringify(actual)===JSON.stringify(proof.outcome),actual,draws};
}
