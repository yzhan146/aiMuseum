import { resolveIdentity, withIdentity } from "@/lib/identity";
import { listRelationshipPublicStates } from "@/lib/platform-store";

export async function GET(request: Request) {
  const identity = await resolveIdentity(request);
  return withIdentity(
    Response.json({ relationships: await listRelationshipPublicStates(identity.userId) }),
    identity,
  );
}
