import { recordLearningEvent } from "@/lib/exploration";
import { resolveIdentity, withIdentity } from "@/lib/identity";

export async function POST(request: Request) {
  const identity = resolveIdentity(request);
  try {
    const input = await request.json();
    if (!input.idempotencyKey || !input.characterId || !input.periodId || !input.type) throw new Error("学习事件字段不完整");
    return withIdentity(Response.json(recordLearningEvent(identity.userId, input), { status: 201 }), identity);
  } catch (error) {
    return withIdentity(Response.json({ error: error instanceof Error ? error.message : "学习事件无效" }, { status: 400 }), identity);
  }
}
