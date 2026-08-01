import { authErrorResponse, enforceSameOrigin, rateLimit } from "../../../../../lib/auth-http";
import { answerHallGuide } from "../../../../../lib/hall-guide";
import { resolveIdentity, withIdentity } from "../../../../../lib/identity";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(request);
    rateLimit(request, "hall-guide", 40, 60_000);
  } catch (error) {
    return authErrorResponse(error);
  }

  const identity = await resolveIdentity(request);
  if (!identity.account) {
    return withIdentity(Response.json({ error: "请先登录后再邀请人物导览" }, { status: 401 }), identity);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!body.characterId || !body.stationId || !message || message.length > 600) {
      return withIdentity(Response.json({ error: "导览问题无效" }, { status: 400 }), identity);
    }
    const result = await answerHallGuide({
      hallId: id,
      characterId: String(body.characterId),
      stationId: String(body.stationId),
      objectId: typeof body.objectId === "string" ? body.objectId : undefined,
      message,
      ageBand: typeof body.ageBand === "string" ? body.ageBand : undefined,
      history,
      routeReminderUsed: body.routeReminderUsed === true,
    });
    return withIdentity(Response.json(result), identity);
  } catch (error) {
    return withIdentity(Response.json({ error: error instanceof Error ? error.message : "人物导览暂时不可用" }, { status: 400 }), identity);
  }
}
