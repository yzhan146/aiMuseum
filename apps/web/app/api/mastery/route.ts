import { resolveIdentity, withIdentity } from "@/lib/identity";
import { listMastery, updateMastery } from "@/lib/platform-store";
export async function GET(request: Request) { const identity = resolveIdentity(request); return withIdentity(Response.json({ mastery: listMastery(identity.userId) }), identity); }
export async function PATCH(request: Request) { const identity = resolveIdentity(request); const body = await request.json(); if (!["exposed", "practicing", "mastered", "decayed"].includes(body.level)) return withIdentity(Response.json({ error: "掌握度状态无效" }, { status: 400 }), identity); const mastery = updateMastery(body.id, identity.userId, body.level); return withIdentity(mastery ? Response.json({ mastery }) : Response.json({ error: "知识记录不存在" }, { status: 404 }), identity); }
