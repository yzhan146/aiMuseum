import { cancelTask } from "@/lib/agents";
import { resolveIdentity, withIdentity } from "@/lib/identity";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const identity = resolveIdentity(request); const { id } = await params; const task = cancelTask(identity.userId, id); return withIdentity(task ? Response.json({ task }) : Response.json({ error: "任务不存在" }, { status: 404 }), identity); }
