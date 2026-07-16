import { publishPack } from "@/lib/repository";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; return Response.json(publishPack(id)); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "发布失败" }, { status: 409 }); } }
