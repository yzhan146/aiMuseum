import { z } from "zod";
import { enforceSameOrigin } from "@/lib/auth-http";
import { resolveIdentity, withIdentity } from "@/lib/identity";
import {
  acknowledgeRelationshipTransition,
  ensureRelationshipState,
  getOrCreateCollection,
  getRelationshipPublicState,
  grantPreferredAddress,
  resetRelationship,
  revokePreferredAddress,
  setRelationshipStatus,
} from "@/lib/platform-store";
import { getPublishedPack } from "@/lib/repository";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause"), revision: z.number().int().positive().optional() }).strict(),
  z.object({ action: z.literal("resume"), revision: z.number().int().positive().optional() }).strict(),
  z.object({ action: z.literal("set_address"), value: z.string().trim().min(1).max(40) }).strict(),
  z.object({ action: z.literal("revoke_address") }).strict(),
  z.object({ action: z.literal("ack_transition"), transitionId: z.string().min(1) }).strict(),
]);

async function publicState(userId: string, characterId: string) {
  await ensureRelationshipState(userId, characterId);
  return getRelationshipPublicState(userId, characterId);
}

function characterMissing(characterId: string) {
  return !getPublishedPack(characterId);
}

async function relationshipUnlocked(userId: string, characterId: string) {
  return (await getOrCreateCollection(userId)).ownedCharacterIds.includes(characterId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await resolveIdentity(request);
  const { id } = await params;
  if (characterMissing(id)) {
    return withIdentity(Response.json({ error: "人物不存在" }, { status: 404 }), identity);
  }
  if (!(await relationshipUnlocked(identity.userId, id))) {
    return withIdentity(Response.json({ error: "尚未解锁这位人物的长期关系" }, { status: 403 }), identity);
  }
  const relationship = await publicState(identity.userId, id);
  return withIdentity(Response.json({ relationship }), identity);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await resolveIdentity(request);
  try {
    enforceSameOrigin(request);
    const { id } = await params;
    if (characterMissing(id)) {
      return withIdentity(Response.json({ error: "人物不存在" }, { status: 404 }), identity);
    }
    if (!(await relationshipUnlocked(identity.userId, id))) {
      return withIdentity(Response.json({ error: "尚未解锁这位人物的长期关系" }, { status: 403 }), identity);
    }
    const mutation = mutationSchema.parse(await request.json());
    if (mutation.action === "pause" || mutation.action === "resume") {
      await setRelationshipStatus(
        identity.userId,
        id,
        mutation.action === "pause" ? "paused" : "active",
        mutation.revision,
      );
    } else if (mutation.action === "set_address") {
      const current = await publicState(identity.userId, id);
      if (!current || !["young_friend", "old_friend", "kindred_spirit"].includes(current.stage)) {
        return withIdentity(Response.json({ error: "当前关系阶段尚未开放特别称呼" }, { status: 409 }), identity);
      }
      await grantPreferredAddress(identity.userId, id, mutation.value);
    } else if (mutation.action === "revoke_address") {
      await revokePreferredAddress(identity.userId, id);
    } else {
      await acknowledgeRelationshipTransition(
        identity.userId,
        id,
        mutation.transitionId,
        `ack:${mutation.transitionId}`,
      );
    }
    return withIdentity(
      Response.json({ relationship: await publicState(identity.userId, id) }),
      identity,
    );
  } catch (error) {
    const revisionConflict =
      error instanceof Error && error.message === "RELATIONSHIP_REVISION_CONFLICT";
    const stageConflict =
      error instanceof Error &&
      error.message === "RELATIONSHIP_PREFERRED_ADDRESS_NOT_ELIGIBLE";
    const conflict = revisionConflict || stageConflict;
    return withIdentity(
      Response.json(
        {
          error: revisionConflict
            ? "关系状态已更新，请刷新后重试"
            : stageConflict
              ? "当前关系阶段尚未开放特别称呼"
              : error instanceof Error
                ? error.message
                : "关系设置没有保存",
        },
        { status: conflict ? 409 : 400 },
      ),
      identity,
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await resolveIdentity(request);
  try {
    enforceSameOrigin(request);
    const { id } = await params;
    if (characterMissing(id)) {
      return withIdentity(Response.json({ error: "人物不存在" }, { status: 404 }), identity);
    }
    if (!(await relationshipUnlocked(identity.userId, id))) {
      return withIdentity(Response.json({ error: "尚未解锁这位人物的长期关系" }, { status: 403 }), identity);
    }
    await resetRelationship(identity.userId, id);
    return withIdentity(
      Response.json({ relationship: await publicState(identity.userId, id) }),
      identity,
    );
  } catch (error) {
    return withIdentity(
      Response.json({ error: error instanceof Error ? error.message : "关系没有重置" }, { status: 400 }),
      identity,
    );
  }
}
