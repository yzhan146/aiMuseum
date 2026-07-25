import { createSession, verifyEmailToken } from "@/lib/auth-store";
import {
  resolveIdentity,
  sessionCookie,
  withIdentity,
  type Identity,
} from "@/lib/identity";
import { mergeGuestIntoUser } from "@/lib/platform-store";
import { applicationUrl } from "@/lib/public-url";

function verificationRedirect(path: string, identity?: Identity) {
  const response = Response.redirect(applicationUrl(path));
  return identity ? withIdentity(response, identity) : response;
}

export async function GET(request: Request) {
  let identity: Identity | undefined;
  const url = new URL(request.url);
  try {
    identity = await resolveIdentity(request);
    const userId = await verifyEmailToken(url.searchParams.get("token") ?? "");
    if (identity.userId.startsWith("guest:")) {
      await mergeGuestIntoUser(identity.userId, userId);
    }
    const raw = await createSession(userId);
    const response = verificationRedirect("/museum?verified=1", identity);
    response.headers.append("set-cookie", sessionCookie(request, raw));
    return response;
  } catch (error) {
    console.error(
      "Email verification failed",
      error instanceof Error ? error.message : "UNKNOWN_ERROR",
    );
    return verificationRedirect("/login?verification=failed", identity);
  }
}
