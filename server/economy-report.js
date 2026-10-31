import {catalog, acceptedNames, normalize} from './catalog.js';
const items = [...catalog.items,...(catalog.coinRewards||[])];
const value = id => items.find(i=>i.id===id)?.value ?? 0;
const rows = catalog.cases.map(c=>{const sum=c.drops.reduce((s,d)=>s+d.weight,0);const ev=c.drops.reduce((s,d)=>s+value(d.id)*d.weight/sum,0);return {name:c.name,price:c.price,ev:+ev.toFixed(4),rtp:c.price?+(ev/c.price).toFixed(6):null,freeType:c.freeType};});
const missing = acceptedNames.filter(name=>!catalog.items.some(i=>normalize(i.name)===normalize(name)));
console.log(JSON.stringify({cases:rows,dice:{winProbability:501/1296,rtp:1002/1296},minesRtp:1-catalog.minesEdge,upgradeRtp:1-catalog.upgradeEdge,missingDepositNames:missing},null,2));
