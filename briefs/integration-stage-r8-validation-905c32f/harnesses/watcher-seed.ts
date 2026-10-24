import {getAuth} from '../lib/betterAuth';
import {upsertAccount} from '../lib/db';
import {closeAllDbConnections} from '../lib/db/connection';
await getAuth();
const endpoint={host:'127.0.0.1',port:Number(process.argv[2]),secure:false,user:'demo@monkeydent.test',password:'demo'};
await upsertAccount({id:'synthetic-shutdown',name:'Synthetic shutdown mailbox',email:'demo@monkeydent.test',avatar:'S',imap:endpoint,smtp:endpoint});
closeAllDbConnections();
