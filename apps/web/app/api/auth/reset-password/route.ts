import { resetPassword } from "@/lib/auth-store";
import { authErrorResponse, enforceSameOrigin, rateLimit } from "@/lib/auth-http";
import { clearSessionCookie } from "@/lib/identity";

export async function POST(request:Request){try{enforceSameOrigin(request);rateLimit(request,"reset",6);const body=await request.json();await resetPassword(String(body.token??""),String(body.password??""));const response=Response.json({ok:true});response.headers.append("set-cookie",clearSessionCookie(request));return response;}catch(error){return authErrorResponse(error);}}
