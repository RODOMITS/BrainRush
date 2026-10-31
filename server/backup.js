import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const source=process.env.DATABASE_PATH||'./data/brainrot.db';
const dir=process.env.BACKUP_DIR||path.join(path.dirname(source),'backups');mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
const target=path.join(dir,'brainrot-'+new Date().toISOString().replaceAll(':','-')+'.db');
await backup(db,target);db.close();console.log(target);
