import { databaseEnabled } from "@/lib/database";

export async function GET() {
  return Response.json({
    ok: true,
    service: "ai-museum-web",
    databaseConfigured: databaseEnabled,
  });
}
