import { cookies } from "next/headers";
import type { AccountView } from "./auth-store";
import { localTestAccountEnabled, resolveSession } from "./auth-store";
import { databaseEnabled } from "./database";
import { SESSION_COOKIE } from "./identity";

export async function currentAccount(): Promise<AccountView | null> {
  const cookieStore = await cookies();
  if (!databaseEnabled) {
    // Explicit test-only bypass used by the headless browser suite; never configure this in a deployed service.
    if (process.env.NODE_ENV !== "production" && process.env.E2E_TEST_ACCOUNT === "true") {
      return { userId: "e2e-visitor", email: "visitor@example.test", displayName: "测试访客", emailVerified: true };
    }
    if (!localTestAccountEnabled()) return null;
  }
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return (await resolveSession(raw))?.account ?? null;
  } catch {
    return null;
  }
}

export function safeReturnPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/museum";
}
