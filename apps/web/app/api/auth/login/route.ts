import { createSession, loginAccount } from "@/lib/auth-store";
import { authErrorResponse, enforceSameOrigin, rateLimit } from "@/lib/auth-http";
import { resolveIdentity, sessionCookie, withIdentity } from "@/lib/identity";
import { mergeGuestIntoUser } from "@/lib/platform-store";

export async function POST(request:Request){const identity=await resolveIdentity(request);try{enforceSameOrigin(request);rateLimit(request,"login",10);const body=await request.json();const account=await loginAccount(String(body.email??""),String(body.password??""));if(identity.userId.startsWith("guest:"))await mergeGuestIntoUser(identity.userId,account.userId);const raw=await createSession(account.userId);const response=withIdentity(Response.json({account}),identity);response.headers.append("set-cookie",sessionCookie(request,raw));return response;}catch(error){return withIdentity(authErrorResponse(error),identity);}}
