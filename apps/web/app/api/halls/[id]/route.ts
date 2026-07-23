import { publishedExhibitPackByHallId } from "@ai-museum/characters";
import { resolveIdentity, withIdentity } from "@/lib/identity";
import { getHallVisit } from "@/lib/platform-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(request);
  const { id } = await params;
  const pack = publishedExhibitPackByHallId(id);
  if (!pack) return withIdentity(Response.json({ error: "展厅不存在" }, { status: 404 }), identity);
  const progress = await getHallVisit(identity.userId, id);
  return withIdentity(Response.json({ pack, progress }), identity);
}
