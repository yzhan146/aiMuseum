import { startAgentTask } from "@/lib/agents";
import { resolveIdentity, withIdentity } from "@/lib/identity";
import { listTasks } from "@/lib/platform-store";
export async function GET(request: Request) { const identity = resolveIdentity(request); return withIdentity(Response.json({ tasks: listTasks(identity.userId) }), identity); }
export async function POST(request: Request) { const identity = resolveIdentity(request); try { return withIdentity(Response.json({ task: startAgentTask(identity.userId, await request.json()) }, { status: 202 }), identity); } catch (error) { return withIdentity(Response.json({ error: error instanceof Error ? error.message : "任务无效" }, { status: 400 }), identity); } }
