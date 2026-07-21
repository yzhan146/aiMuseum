import { createSession, verifyEmailToken } from "@/lib/auth-store";
import { resolveIdentity, sessionCookie, withIdentity } from "@/lib/identity";
import { mergeGuestIntoUser } from "@/lib/platform-store";

export async function GET(request:Request){const identity=await resolveIdentity(request);const url=new URL(request.url);try{const userId=await verifyEmailToken(url.searchParams.get("token")??"");if(identity.userId.startsWith("guest:"))await mergeGuestIntoUser(identity.userId,userId);const raw=await createSession(userId);const response=withIdentity(Response.redirect(new URL("/museum?verified=1",request.url)),identity);response.headers.append("set-cookie",sessionCookie(request,raw));return response;}catch{return withIdentity(Response.redirect(new URL("/login?verification=failed",request.url)),identity);}}
