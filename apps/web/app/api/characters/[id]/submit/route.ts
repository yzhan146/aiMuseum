import { submitPack } from "@/lib/repository";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const pack = submitPack(id); return Response.json({ manifest: pack.manifest, message: "人物包已进入公共发布审核队列" }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "提交失败" }, { status: 409 }); } }
