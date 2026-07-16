import { randomUUID } from "node:crypto";

const COOKIE = "museum_guest";
export interface Identity { userId: string; setCookie?: string }
export function resolveIdentity(request: Request): Identity {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
  if (match) return { userId: `guest:${decodeURIComponent(match.slice(COOKIE.length + 1))}` };
  const id = randomUUID(); const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return { userId: `guest:${id}`, setCookie: `${COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}` };
}
export function withIdentity(response: Response, identity: Identity) { if (identity.setCookie) response.headers.append("set-cookie", identity.setCookie); return response; }
