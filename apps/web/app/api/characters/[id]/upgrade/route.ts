import { createUpgrade } from "@/lib/repository";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; return Response.json(createUpgrade(id), { status: 201 }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "升级失败" }, { status: 400 }); } }
