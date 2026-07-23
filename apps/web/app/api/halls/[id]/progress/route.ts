import { publishedExhibitPackByHallId } from "@ai-museum/characters";
import { resolveIdentity, withIdentity } from "@/lib/identity";
import { saveHallVisit } from "@/lib/platform-store";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(request);
  try {
    const { id } = await params;
    const pack = publishedExhibitPackByHallId(id);
    if (!pack) return withIdentity(Response.json({ error: "展厅不存在" }, { status: 404 }), identity);
    const input = await request.json();
    const stationIds = new Set(pack.hall.stations.map((station) => station.id));
    const objectIds = new Set(pack.objects.map((object) => object.id));
    const characterIds = new Set(pack.hall.characterRefs.map((ref) => ref.id));
    if (input.sceneVersion !== pack.hall.sceneVersion || !stationIds.has(input.lastStationId)) throw new Error("展厅版本或站点无效");
    const viewedObjectIds = Array.isArray(input.viewedObjectIds) ? input.viewedObjectIds.filter((value: unknown): value is string => typeof value === "string" && objectIds.has(value)) : [];
    const visitedCharacterIds = Array.isArray(input.visitedCharacterIds) ? input.visitedCharacterIds.filter((value: unknown): value is string => typeof value === "string" && characterIds.has(value)) : [];
    const completedStationIds = Array.isArray(input.completedStationIds) ? input.completedStationIds.filter((value: unknown): value is string => typeof value === "string" && stationIds.has(value)) : [];
    const update = { userId: identity.userId, hallId: id, sceneVersion: pack.hall.sceneVersion, lastStationId: input.lastStationId, viewedObjectIds, visitedCharacterIds, completedStationIds, completedAt: completedStationIds.includes("reflection") ? new Date().toISOString() : undefined };
    let result = await saveHallVisit({ ...update, expectedRevision: Number.isInteger(input.expectedRevision) ? input.expectedRevision : undefined });
    if (result.conflict) result = await saveHallVisit({ ...update, expectedRevision: result.state.revision });
    return withIdentity(Response.json(result), identity);
  } catch (error) {
    return withIdentity(Response.json({ error: error instanceof Error ? error.message : "展厅进度无效" }, { status: 400 }), identity);
  }
}
