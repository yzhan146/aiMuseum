import { randomUUID } from "node:crypto";
import { databaseEnabled } from "./database";
import {
  localTestAccountEnabled,
  resolveSession,
  type AccountView,
} from "./auth-store";

const GUEST_COOKIE = "museum_guest";
export const SESSION_COOKIE = "museum_session";

export interface Identity {
  userId: string;
  guestUserId?: string;
  sessionId?: string;
  account?: AccountView;
  setCookie?: string;
}

function cookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return new Map(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [
          part.slice(0, index),
          decodeURIComponent(part.slice(index + 1)),
        ];
      }),
  );
}

export async function resolveIdentity(request: Request): Promise<Identity> {
  const values = cookies(request);
  const guestValue = values.get(GUEST_COOKIE);
  const guestUserId = guestValue ? `guest:${guestValue}` : undefined;
  const sessionValue = values.get(SESSION_COOKIE);

  if (sessionValue && (databaseEnabled || localTestAccountEnabled())) {
    try {
      const session = await resolveSession(sessionValue);
      if (session) {
        return {
          userId: session.account.userId,
          guestUserId,
          sessionId: session.sessionId,
          account: session.account,
        };
      }
    } catch {
      // A database failure must not silently change an authenticated request
      // into a guest request with a different privacy and ownership boundary.
      throw new Error("SESSION_RESOLUTION_FAILED");
    }
  }

  if (guestUserId) return { userId: guestUserId };
  const id = randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    userId: `guest:${id}`,
    setCookie: `${GUEST_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  };
}

export function sessionCookie(request: Request, value: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function withIdentity(response: Response, identity: Identity) {
  if (!identity.setCookie) return response;

  // Response.redirect() has an immutable Headers guard in the Fetch API.
  // Rebuild the response with mutable headers before attaching a newly issued
  // guest cookie. Without this, opening an email verification link in a fresh
  // browser throws twice (the success redirect and its fallback redirect) and
  // Next.js returns HTTP 500.
  const headers = new Headers(response.headers);
  headers.append("set-cookie", identity.setCookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
