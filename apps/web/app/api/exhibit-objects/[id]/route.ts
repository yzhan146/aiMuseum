import { publishedMuseumObjectById } from "@ai-museum/characters";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = publishedMuseumObjectById(id);
  if (!found) return Response.json({ error: "展项不存在或未发布" }, { status: 404 });
  return Response.json({ object: found.object, sources: found.pack.sources.filter((source) => found.object.sourceIds.includes(source.id)) });
}
