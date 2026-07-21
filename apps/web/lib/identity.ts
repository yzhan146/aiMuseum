import { randomUUID } from "node:crypto";
import type { AccountView } from "./auth-store";
import { databaseEnabled } from "./database";
import { resolveSession } from "./auth-store";

const GUEST_COOKIE = "museum_guest"; export const SESSION_COOKIE = "museum_session";
export interface Identity { userId: string; guestUserId?: string; sessionId?: string; account?: AccountView; setCookie?: string }
function cookies(request:Request){const header=request.headers.get("cookie")??"";return new Map(header.split(";").map(part=>part.trim()).filter(Boolean).map(part=>{const index=part.indexOf("=");return [part.slice(0,index),decodeURIComponent(part.slice(index+1))]}));}
export async function resolveIdentity(request: Request): Promise<Identity> {
  const values=cookies(request);const guestValue=values.get(GUEST_COOKIE);const guestUserId=guestValue?`guest:${guestValue}`:undefined;const sessionValue=values.get(SESSION_COOKIE);
  if(sessionValue&&databaseEnabled){try{const session=await resolveSession(sessionValue);if(session)return{userId:session.account.userId,guestUserId,sessionId:session.sessionId,account:session.account};}catch{/* Expired or temporarily unavailable sessions fall through to guest identity. */}}
  if(guestUserId)return{userId:guestUserId};
  const id=randomUUID();const secure=new URL(request.url).protocol==="https:"?"; Secure":"";return{userId:`guest:${id}`,setCookie:`${GUEST_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`};
}
export function sessionCookie(request:Request,value:string){const secure=new URL(request.url).protocol==="https:"?"; Secure":"";return`${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;}
export function clearSessionCookie(request:Request){const secure=new URL(request.url).protocol==="https:"?"; Secure":"";return`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;}
export function withIdentity(response: Response, identity: Identity) { if (identity.setCookie) response.headers.append("set-cookie", identity.setCookie); return response; }
