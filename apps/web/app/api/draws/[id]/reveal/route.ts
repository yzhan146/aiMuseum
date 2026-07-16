import { revealDraw } from "@/lib/exploration";
import { resolveIdentity, withIdentity } from "@/lib/identity";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = resolveIdentity(request);
  try { const { id } = await params; return withIdentity(Response.json(revealDraw(identity.userId, id)), identity); }
  catch (error) { return withIdentity(Response.json({ error: error instanceof Error ? error.message : "揭晓失败" }, { status: 404 }), identity); }
}
