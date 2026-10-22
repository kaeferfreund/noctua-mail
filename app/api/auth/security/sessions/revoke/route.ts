import {handleAuthSecurity} from "@/app/api/_helpers/authSecurity";
export const POST = (request:Request) => handleAuthSecurity(request,"sessions-revoke");
