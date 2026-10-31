export function depositQueueStatus(store,userId){
 const d=store.get("SELECT * FROM deposits WHERE user_id=? AND status IN ('active','queued') ORDER BY created,id LIMIT 1",userId);if(!d)return null;
 const ahead=d.status==='active'?0:store.get("SELECT COUNT(*) n FROM deposits WHERE status='active' OR (status='queued' AND (created<? OR (created=? AND id<?)))",d.created,d.created,d.id).n;
 return {id:d.id,status:d.status,position:ahead+1,ahead,expires:d.expires};
}
