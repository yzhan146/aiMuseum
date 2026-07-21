import { AuthError } from "./auth-store";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(
    process.env.APP_BASE_URL?.trim() || request.url,
  ).origin;
  if (origin !== expected) {
    throw new AuthError("INVALID_ORIGIN", "请求来源无效", 403);
  }
}

export function rateLimit(
  request: Request,
  action: string,
  limit = 8,
  windowMs = 15 * 60_000,
) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const key = `${action}:${forwarded || "unknown"}`;
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count++;
  if (current.count > limit) {
    throw new AuthError("RATE_LIMITED", "操作过于频繁，请稍后再试", 429);
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(
    "Authentication request failed",
    error instanceof Error ? error.message : error,
  );
  return Response.json(
    { error: "账户服务暂时不可用", code: "AUTH_FAILED" },
    { status: 503 },
  );
}
