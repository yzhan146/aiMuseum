import { resolveIdentity,withIdentity } from "@/lib/identity";import { listMemories } from "@/lib/platform-store";
export async function GET(request:Request){const identity=await resolveIdentity(request);const characterId=new URL(request.url).searchParams.get("characterId")??undefined;return withIdentity(Response.json({memories:await listMemories(identity.userId,characterId)}),identity);}
