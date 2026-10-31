export function createStats(store){
 const {get,all}=store;
 const rewards=`FROM games g JOIN json_each(CASE WHEN json_type(g.state,'$.prizes')='array' THEN json_extract(g.state,'$.prizes') WHEN json_type(g.state,'$.prize')='object' THEN json_array(json_extract(g.state,'$.prize')) ELSE '[]' END) p LEFT JOIN items i ON i.id=json_extract(p.value,'$.item_id') WHERE g.closed IS NOT NULL`;
 const select=`SELECT g.id||':'||p.key AS id,i.id AS item,COALESCE(i.name,printf('%g монет',json_extract(p.value,'$.coin')/100.0)) AS name,g.kind AS source,1 AS quantity,COALESCE(i.price,json_extract(p.value,'$.coin'),0)/100.0 AS value,g.closed AS at `;
 function count(user){const where=user?' WHERE user_id=?':'';const args=user?[user]:[];const result=Object.fromEntries(all('SELECT kind,COUNT(*) n FROM games'+where+' GROUP BY kind',...args).map(r=>[r.kind,r.n]));result.case=get("SELECT COALESCE(SUM(json_array_length(json_extract(state,'$.prizes'))),0) n FROM games"+(user?' WHERE user_id=? AND': ' WHERE')+" kind='case'",...args).n;return result;}
 function personal(user){return {counts:count(user),drops:all(select+rewards+' AND g.user_id=? ORDER BY g.closed DESC LIMIT 50',user),bestDrop:get(select+rewards+' AND g.user_id=? ORDER BY value DESC LIMIT 1',user)||null,withdrawnValue:get("SELECT COALESCE(SUM(i.price),0) n FROM inventory v JOIN items i ON i.id=v.item_id WHERE v.user_id=? AND v.status='withdrawn'",user).n};}
 let cached=null,cacheRevision=-1;
 function global(){const revision=get('SELECT total_changes() n').n+':'+Math.floor(Date.now()/60000);if(cached&&cacheRevision===revision)return cached;cacheRevision=revision;cached={counts:{...count(),users:get('SELECT COUNT(*) n FROM users').n},drops:all(select+rewards+' ORDER BY g.closed DESC LIMIT 5'),bestDrop:get(select+rewards+' AND g.closed>=? ORDER BY value DESC LIMIT 1',Date.now()-86400000)||null};return cached;}
 return {personal,global};
}
