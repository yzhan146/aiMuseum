import { explorationSnapshot } from "@/lib/exploration";import { resolveIdentity,withIdentity } from "@/lib/identity";
export async function GET(request:Request){const identity=await resolveIdentity(request);return withIdentity(Response.json(await explorationSnapshot(identity.userId)),identity);}
