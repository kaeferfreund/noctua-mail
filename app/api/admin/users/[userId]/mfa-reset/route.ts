import { handleAdminUser } from "../../../_users";
export async function POST(request:Request,context:{params:Promise<{userId:string}>}){return handleAdminUser(request,"mfa-reset",(await context.params).userId);}
