import type { AccountView } from "./auth-store";
import { LOCAL_TEST_ACCOUNT } from "./auth-store";
import { databaseEnabled, query } from "./database";

export type OperationalMetrics = {
  available: boolean;
  registeredTotal: number;
  newToday: number;
  new7d: number;
  new30d: number;
  onlineNow: number;
  activeToday: number;
  active7d: number;
  active30d: number;
  updatedAt: string;
};

const EMPTY_METRICS: Omit<OperationalMetrics, "updatedAt"> = {
  available: false,
  registeredTotal: 0,
  newToday: 0,
  new7d: 0,
  new30d: 0,
  onlineNow: 0,
  activeToday: 0,
  active7d: 0,
  active30d: 0,
};

function normalizedEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().normalize("NFKC").toLowerCase())
    .filter(Boolean);
}

export function metricsAdminEmails(env: NodeJS.ProcessEnv = process.env) {
  return new Set(normalizedEmails(env.ADMIN_EMAIL_ALLOWLIST));
}

export function isMetricsAdmin(
  account: Pick<AccountView, "email"> | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!account) return false;
  const email = account.email.trim().normalize("NFKC").toLowerCase();
  if (env.NODE_ENV !== "production" && email === LOCAL_TEST_ACCOUNT.email) return true;
  return metricsAdminEmails(env).has(email);
}

export function publicPresenceEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.PUBLIC_ONLINE_PRESENCE?.trim().toLowerCase() === "true";
}

export function onlineCountBucket(count: number) {
  if (!Number.isFinite(count) || count < 10) return null;
  if (count < 100) return `${Math.floor(count / 10) * 10}+`;
  if (count < 1000) return `${Math.floor(count / 50) * 50}+`;
  return `${Math.floor(count / 100) * 100}+`;
}

export async function getOperationalMetrics(): Promise<OperationalMetrics> {
  const updatedAt = new Date().toISOString();
  if (!databaseEnabled) return { ...EMPTY_METRICS, updatedAt };

  const excluded = new Set([
    LOCAL_TEST_ACCOUNT.email,
    ...normalizedEmails(process.env.METRICS_EXCLUDED_EMAILS),
  ]);
  const timeZone = process.env.METRICS_TIME_ZONE?.trim() || "Asia/Shanghai";
  const result = await query<{
    registered_total: string;
    new_today: string;
    new_7d: string;
    new_30d: string;
    online_now: string;
    active_today: string;
    active_7d: string;
    active_30d: string;
  }>(
    `WITH eligible AS (
       SELECT c.user_id,c.email_verified_at
       FROM auth_credentials c
       JOIN users u ON u.id=c.user_id
       WHERE c.email_verified_at IS NOT NULL
         AND u.deleted_at IS NULL
         AND NOT (lower(c.email::text)=ANY($1::text[]))
     ), activity AS (
       SELECT s.user_id,max(s.last_seen_at) AS last_seen_at
       FROM auth_sessions s
       JOIN eligible e ON e.user_id=s.user_id
       GROUP BY s.user_id
     ), online AS (
       SELECT DISTINCT s.user_id
       FROM auth_sessions s
       JOIN eligible e ON e.user_id=s.user_id
       WHERE s.revoked_at IS NULL
         AND s.expires_at>now()
         AND s.last_seen_at>=now()-interval '2 minutes'
     )
     SELECT
       (SELECT count(*) FROM eligible)::text AS registered_total,
       (SELECT count(*) FROM eligible WHERE email_verified_at>=date_trunc('day',now() AT TIME ZONE $2) AT TIME ZONE $2)::text AS new_today,
       (SELECT count(*) FROM eligible WHERE email_verified_at>=now()-interval '7 days')::text AS new_7d,
       (SELECT count(*) FROM eligible WHERE email_verified_at>=now()-interval '30 days')::text AS new_30d,
       (SELECT count(*) FROM online)::text AS online_now,
       (SELECT count(*) FROM activity WHERE last_seen_at>=date_trunc('day',now() AT TIME ZONE $2) AT TIME ZONE $2)::text AS active_today,
       (SELECT count(*) FROM activity WHERE last_seen_at>=now()-interval '7 days')::text AS active_7d,
       (SELECT count(*) FROM activity WHERE last_seen_at>=now()-interval '30 days')::text AS active_30d`,
    [[...excluded], timeZone],
  );
  const row = result.rows[0];
  if (!row) return { ...EMPTY_METRICS, updatedAt };
  return {
    available: true,
    registeredTotal: Number(row.registered_total),
    newToday: Number(row.new_today),
    new7d: Number(row.new_7d),
    new30d: Number(row.new_30d),
    onlineNow: Number(row.online_now),
    activeToday: Number(row.active_today),
    active7d: Number(row.active_7d),
    active30d: Number(row.active_30d),
    updatedAt,
  };
}
