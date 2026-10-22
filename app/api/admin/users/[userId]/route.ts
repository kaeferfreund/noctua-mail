import { handleAdminUser } from "../../_users";
type Context={params:Promise<{userId:string}>};
export async function PATCH(request:Request,context:Context){return handleAdminUser(request,"update",(await context.params).userId);}
export async function DELETE(request:Request,context:Context){return handleAdminUser(request,"delete",(await context.params).userId);}
