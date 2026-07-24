import { resolveIdentity, withIdentity } from "../../../../lib/identity";
import { exportUserData } from "../../../../lib/platform-store";

export async function GET(request: Request) {
  const identity = await resolveIdentity(request);
  if (!identity.account) {
    return withIdentity(
      Response.json({ error: "请先登录后再导出账户数据" }, { status: 401 }),
      identity,
    );
  }
  const payload = await exportUserData(identity.userId);
  return withIdentity(
    Response.json(payload, {
      headers: {
        "cache-control": "no-store",
        "content-disposition":
          'attachment; filename="ai-museum-account-export.json"',
      },
    }),
    identity,
  );
}
