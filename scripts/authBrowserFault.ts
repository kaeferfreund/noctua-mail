/** Local fault injection for isolated browser storage; never mounted on HTTP. */
import {getDb} from "../lib/db/connection";
const [mode,userId]=process.argv.slice(2);
if(!process.env.AUTH_BROWSER_DATA_DIR || process.env.NOCTUA_DATA_DIR!==process.env.AUTH_BROWSER_DATA_DIR || !/^[A-Za-z0-9_-]+$/.test(userId??""))throw new Error("Isolated synthetic storage/user required");
const db=await getDb();
if(mode === "inspect") {
  console.log(JSON.stringify({passkeys:db.prepare("SELECT count(*) n FROM auth_passkey WHERE userId=?").get(userId).n,
    sessions:db.prepare("SELECT count(*) n FROM auth_session WHERE userId=?").get(userId).n,
    grants:db.prepare("SELECT count(*) n FROM auth_reauth_grants WHERE userId=?").get(userId).n,
    pendingState:db.prepare("SELECT state FROM admin_lifecycle_operations WHERE slot=?").get(`security:${userId}`)?.state}));
} else {
  db.exec("DROP TRIGGER IF EXISTS synthetic_browser_finalizer_fault");
  if(mode === "registration")db.exec(`CREATE TRIGGER synthetic_browser_finalizer_fault BEFORE DELETE ON auth_pending_challenges WHEN OLD.userId='${userId}' AND OLD.kind='passkey_register' BEGIN SELECT RAISE(ABORT,'synthetic registration finalizer fault'); END`);
  else if(mode === "uv")db.exec(`CREATE TRIGGER synthetic_browser_finalizer_fault BEFORE INSERT ON auth_reauth_grants WHEN NEW.userId='${userId}' AND NEW.state='issued' AND NEW.purpose='backup.regenerate' BEGIN SELECT RAISE(ABORT,'synthetic UV finalizer fault'); END`);
  else if(mode !== "clear")throw new Error("Unknown fault");
}
