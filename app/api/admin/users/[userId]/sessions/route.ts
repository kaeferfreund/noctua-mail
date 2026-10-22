import { handleAdminUser } from "../../../_users";
export async function DELETE(request:Request,context:{params:Promise<{userId:string}>}){return handleAdminUser(request,"sessions-revoke",(await context.params).userId);}
