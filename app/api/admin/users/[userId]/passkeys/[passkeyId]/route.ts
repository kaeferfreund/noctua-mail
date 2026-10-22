import { handleAdminUser } from "../../../../_users";
export async function DELETE(request:Request,context:{params:Promise<{userId:string;passkeyId:string}>}){
  const {userId,passkeyId}=await context.params;return handleAdminUser(request,"passkey-remove",userId,passkeyId);
}
