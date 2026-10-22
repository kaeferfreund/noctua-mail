import { handleAdminUser } from "../../../_users";
export async function POST(request:Request,context:{params:Promise<{userId:string}>}){return handleAdminUser(request,"recovery",(await context.params).userId);}
