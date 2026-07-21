import { databaseEnabled, query } from "@/lib/database";

export async function GET() {
  if (!databaseEnabled) {
    return Response.json({
      ok: true,
      service: "ai-museum-web",
      storageMode: "local",
    });
  }

  try {
    const result = await query<{
      accounts_ready: boolean;
      museum_ready: boolean;
    }>(`SELECT
      to_regclass('public.auth_credentials') IS NOT NULL AS accounts_ready,
      to_regclass('public.user_collections') IS NOT NULL AS museum_ready`);
    const row = result.rows[0];
    const ready = Boolean(row?.accounts_ready && row?.museum_ready);
    return Response.json(
      {
        ok: ready,
        service: "ai-museum-web",
        storageMode: "postgresql",
        databaseReady: ready,
      },
      { status: ready ? 200 : 503 },
    );
  } catch {
    return Response.json(
      {
        ok: false,
        service: "ai-museum-web",
        storageMode: "postgresql",
        databaseReady: false,
      },
      { status: 503 },
    );
  }
}
