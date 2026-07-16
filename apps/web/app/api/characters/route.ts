import { createDraft, listPacks } from "@/lib/repository";
import { NextResponse } from "next/server";
export async function GET(request: Request) { const drafts = new URL(request.url).searchParams.get("includeDrafts") === "true"; return NextResponse.json(listPacks(drafts).map(p => ({ manifest: p.manifest, summary: p.entities[0]?.summary, boundaries: p.boundaries }))); }
export async function POST(request: Request) { try { return NextResponse.json(createDraft(await request.json()), { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "人物草稿无效" }, { status: 400 }); } }
