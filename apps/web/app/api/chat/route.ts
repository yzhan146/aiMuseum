import { AuthError } from "../../../lib/auth-store";
import { authErrorResponse, enforceSameOrigin } from "../../../lib/auth-http";
import { sendThreadMessage } from "../../../lib/chat-service";
import { resolveIdentity, withIdentity } from "../../../lib/identity";
import {
  getOrCreateCollection,
  getOrCreateThread,
} from "../../../lib/platform-store";
import { getPublishedPack } from "../../../lib/repository";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const identity = await resolveIdentity(request);
  try {
    const body = await request.json();
    if (
      !body.characterId ||
      !body.message?.trim() ||
      body.message.length > 2000
    ) {
      return withIdentity(
        Response.json({ error: "问题无效" }, { status: 400 }),
        identity,
      );
    }
    const pack = getPublishedPack(body.characterId, body.version);
    if (!pack) {
      return withIdentity(
        Response.json(
          { error: "人物版本不存在或尚未发布" },
          { status: 404 },
        ),
        identity,
      );
    }
    const collection = await getOrCreateCollection(identity.userId);
    if (!collection.ownedCharacterIds.includes(body.characterId)) {
      return withIdentity(
        Response.json(
          { error: "尚未解锁这位人物的长期对话" },
          { status: 403 },
        ),
        identity,
      );
    }
    const thread = await getOrCreateThread(
      identity.userId,
      body.characterId,
      pack.manifest.version,
      pack.manifest.name[pack.manifest.defaultLocale] ?? body.characterId,
    );
    const result = await sendThreadMessage(
      identity.userId,
      thread,
      body.message,
      body.ageBand,
      body.locale,
    );
    return withIdentity(Response.json(result), identity);
  } catch (error) {
    if (error instanceof AuthError) {
      return withIdentity(authErrorResponse(error), identity);
    }
    return withIdentity(
      Response.json(
        { error: error instanceof Error ? error.message : "对话失败" },
        { status: 409 },
      ),
      identity,
    );
  }
}
