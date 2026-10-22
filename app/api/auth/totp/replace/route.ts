import { handleAuthSecurity } from "../../../_helpers/authSecurity";
export const POST = (request: Request) => handleAuthSecurity(request,"totp-replace");
