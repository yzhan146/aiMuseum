import { authErrorResponse, enforceSameOrigin } from "../../../../lib/auth-http";
import { resolveIdentity, withIdentity } from "../../../../lib/identity";
import { deleteThreadForUser } from "../../../../lib/platform-store";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    enforceSameOrigin(request);
  } catch (error) {
    return authErrorResponse(error);
  }
  const identity = await resolveIdentity(request);
  const { id } = await params;
  try {
    const deleted = await deleteThreadForUser(id, identity.userId);
    return withIdentity(
      deleted
        ? Response.json({ deleted: true })
        : Response.json({ error: "线程不存在" }, { status: 404 }),
      identity,
    );
  } catch (error) {
    return withIdentity(
      Response.json(
        { error: error instanceof Error ? error.message : "线程删除失败" },
        { status: 500 },
      ),
      identity,
    );
  }
}
