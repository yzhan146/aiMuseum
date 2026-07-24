import { authErrorResponse, enforceSameOrigin } from "../../../lib/auth-http";
import {
  clearSessionCookie,
  resolveIdentity,
  withIdentity,
} from "../../../lib/identity";
import { deleteUserData } from "../../../lib/platform-store";

export async function GET(request: Request) {
  const identity = await resolveIdentity(request);
  return withIdentity(
    identity.account
      ? Response.json({ account: identity.account })
      : Response.json({ account: null }, { status: 401 }),
    identity,
  );
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
  } catch (error) {
    return authErrorResponse(error);
  }
  const identity = await resolveIdentity(request);
  if (!identity.account) {
    return withIdentity(
      Response.json({ error: "请先登录后再删除账户" }, { status: 401 }),
      identity,
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== "DELETE_MY_ACCOUNT") {
      return withIdentity(
        Response.json(
          { error: "账户删除需要明确确认" },
          { status: 400 },
        ),
        identity,
      );
    }
    await deleteUserData(identity.userId);
    const response = Response.json({ deleted: true });
    response.headers.append("set-cookie", clearSessionCookie(request));
    return response;
  } catch (error) {
    return withIdentity(
      Response.json(
        { error: error instanceof Error ? error.message : "账户删除失败" },
        { status: 500 },
      ),
      identity,
    );
  }
}
