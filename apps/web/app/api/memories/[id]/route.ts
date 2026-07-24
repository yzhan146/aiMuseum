import { enforceSameOrigin } from "@/lib/auth-http";
import { resolveIdentity, withIdentity } from "@/lib/identity";
import { updateMemory } from "@/lib/platform-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(request);
  try {
    enforceSameOrigin(request);
    const { id } = await params;
    const body = await request.json();
    if (
      body.content !== undefined &&
      (typeof body.content !== "string" || !body.content.trim())
    )
      throw new Error("记忆内容不能为空");
    if (
      body.status !== undefined &&
      !["pending_confirmation", "active", "suppressed", "forgotten"].includes(
        body.status,
      )
    )
      throw new Error("记忆状态无效");
    for (const key of ["importance", "confidence"] as const) {
      if (
        body[key] !== undefined &&
        (typeof body[key] !== "number" || body[key] < 0 || body[key] > 1)
      )
        throw new Error(`${key} 必须是 0 到 1 之间的数字`);
    }
    const memory = await updateMemory(
      id,
      identity.userId,
      Object.fromEntries(
        ["content", "status", "importance", "confidence"]
          .filter((key) => body[key] !== undefined)
          .map((key) => [key, body[key]]),
      ),
    );
    return withIdentity(memory ? Response.json({ memory }) : Response.json({ error: "记忆不存在" }, { status: 404 }), identity);
  } catch (error) {
    return withIdentity(Response.json({ error: error instanceof Error ? error.message : "记忆没有更新" }, { status: 400 }), identity);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(request);
  try {
    enforceSameOrigin(request);
    const { id } = await params;
    const memory = await updateMemory(id, identity.userId, { status: "forgotten" });
    return withIdentity(memory ? Response.json({ memory }) : Response.json({ error: "记忆不存在" }, { status: 404 }), identity);
  } catch (error) {
    return withIdentity(Response.json({ error: error instanceof Error ? error.message : "记忆没有删除" }, { status: 400 }), identity);
  }
}
