import { revokeSession } from "@/lib/auth-store";
import { authErrorResponse, enforceSameOrigin } from "@/lib/auth-http";
import { clearSessionCookie, resolveIdentity } from "@/lib/identity";

export async function POST(request:Request){try{enforceSameOrigin(request);const identity=await resolveIdentity(request);if(identity.sessionId)await revokeSession(identity.sessionId,identity.userId);const response=Response.json({ok:true});response.headers.append("set-cookie",clearSessionCookie(request));return response;}catch(error){return authErrorResponse(error);}}
