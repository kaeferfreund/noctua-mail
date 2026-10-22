#include <sqlite3ext.h>
SQLITE_EXTENSION_INIT1
static void writer(sqlite3_context *ctx,int argc,sqlite3_value **argv){sqlite3_result_int(ctx,2);}
int sqlite3_extension_init(sqlite3 *db,char **err,const sqlite3_api_routines *api){SQLITE_EXTENSION_INIT2(api);return sqlite3_create_function_v2(db,"noctua_writer_v2",0,SQLITE_UTF8|SQLITE_DETERMINISTIC|SQLITE_INNOCUOUS,0,writer,0,0,0);}
