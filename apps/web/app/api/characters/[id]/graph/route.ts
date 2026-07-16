import { getPack, getPublishedPack } from "@/lib/repository";
import { toJsonLd } from "@ai-museum/sdk";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const preview = new URL(request.url).searchParams.has("previewToken"); const pack = preview ? getPack(id) : getPublishedPack(id); return pack ? Response.json(toJsonLd(pack)) : Response.json({ error: "Not found" }, { status: 404 }); }
