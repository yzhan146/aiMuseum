import { authErrorResponse, enforceSameOrigin } from "../../../../lib/auth-http";
import { resolveIdentity } from "../../../../lib/identity";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const identity = await resolveIdentity(request);
    if (!identity.account) return Response.json({ error: "需要登录" }, { status: 401 });
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
