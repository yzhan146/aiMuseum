import { explorationSnapshot } from "@/lib/exploration";
import { resolveIdentity, withIdentity } from "@/lib/identity";

export async function GET(request: Request) {
  const identity = resolveIdentity(request);
  return withIdentity(Response.json(explorationSnapshot(identity.userId)), identity);
}
