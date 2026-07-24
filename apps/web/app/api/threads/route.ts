import { AuthError } from "../../../lib/auth-store";
import { authErrorResponse, enforceSameOrigin } from "../../../lib/auth-http";
import { resolveIdentity, withIdentity } from "../../../lib/identity";
import {
  getOrCreateCollection,
  getOrCreateThread,
  listThreads,
} from "../../../lib/platform-store";
import { getPublishedPack } from "../../../lib/repository";

export async function GET(request: Request) {
  const identity = await resolveIdentity(request);
  return withIdentity(
    Response.json({ threads: await listThreads(identity.userId) }),
    identity,
  );
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const identity = await resolveIdentity(request);
  try {
    const { characterId } = await request.json();
    const pack = getPublishedPack(characterId);
    if (!pack) {
      return withIdentity(
        Response.json({ error: "人物不存在" }, { status: 404 }),
        identity,
      );
    }
    const collection = await getOrCreateCollection(identity.userId);
    if (!collection.ownedCharacterIds.includes(characterId)) {
      return withIdentity(
        Response.json(
          { error: "尚未解锁这位人物的长期对话" },
          { status: 403 },
        ),
        identity,
      );
    }
    const title =
      pack.manifest.name[pack.manifest.defaultLocale] ?? characterId;
    const thread = await getOrCreateThread(
      identity.userId,
      characterId,
      pack.manifest.version,
      title,
    );
    return withIdentity(Response.json({ thread }, { status: 201 }), identity);
  } catch (error) {
    if (error instanceof AuthError) {
      return withIdentity(authErrorResponse(error), identity);
    }
    return withIdentity(
      Response.json(
        { error: error instanceof Error ? error.message : "创建线程失败" },
        { status: 400 },
      ),
      identity,
    );
  }
}
