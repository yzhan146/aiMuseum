import { AuthError } from "../../../../../lib/auth-store";
import { authErrorResponse, enforceSameOrigin } from "../../../../../lib/auth-http";
import { sendThreadMessage } from "../../../../../lib/chat-service";
import { resolveIdentity, withIdentity } from "../../../../../lib/identity";
import {
  getOrCreateCollection,
  getThreadForUser,
  listMessages,
} from "../../../../../lib/platform-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await resolveIdentity(request);
  const { id } = await params;
  const url = new URL(request.url);
  const result = await listMessages(
    id,
    identity.userId,
    url.searchParams.get("cursor") ?? undefined,
    Number(url.searchParams.get("limit") ?? 50),
  );
  return withIdentity(
    result
      ? Response.json(result)
      : Response.json({ error: "线程不存在" }, { status: 404 }),
    identity,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    enforceSameOrigin(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const identity = await resolveIdentity(request);
  try {
    const { id } = await params;
    const thread = await getThreadForUser(id, identity.userId);
    if (!thread) {
      return withIdentity(
        Response.json({ error: "线程不存在" }, { status: 404 }),
        identity,
      );
    }
    const collection = await getOrCreateCollection(identity.userId);
    if (!collection.ownedCharacterIds.includes(thread.characterId)) {
      return withIdentity(
        Response.json(
          { error: "尚未解锁这位人物的长期对话" },
          { status: 403 },
        ),
        identity,
      );
    }
    const body = await request.json();
    if (!body.message?.trim() || body.message.length > 2000) {
      return withIdentity(
        Response.json({ error: "问题无效" }, { status: 400 }),
        identity,
      );
    }
    const result = await sendThreadMessage(
      identity.userId,
      thread,
      body.message,
      body.ageBand,
      body.locale,
    );
    if (request.headers.get("accept")?.includes("text/event-stream")) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          for (const chunk of result.answer.match(/.{1,12}/gu) ?? []) {
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify(chunk)}\n\n`,
              ),
            );
          }
          controller.enqueue(
            encoder.encode(
              `event: result\ndata: ${JSON.stringify(result)}\n\n`,
            ),
          );
          controller.close();
        },
      });
      return withIdentity(
        new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
          },
        }),
        identity,
      );
    }
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
