import { resolveIdentity, withIdentity } from "@/lib/identity";
import { getArtifact } from "@/lib/platform-store";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const identity = resolveIdentity(request); const { id } = await params; const artifact = getArtifact(id, identity.userId); return withIdentity(artifact ? Response.json({ artifact }) : Response.json({ error: "产物不存在" }, { status: 404 }), identity); }
