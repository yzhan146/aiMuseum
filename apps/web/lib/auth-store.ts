import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import type { PoolClient } from "pg";
import { databaseEnabled, query, transaction } from "./database";

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const KEY_LENGTH = 32;
const VERIFY_MINUTES = 60;
const RESET_MINUTES = 30;
const SESSION_DAYS = 30;

export type AccountView = {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function requireDatabase() {
  if (!databaseEnabled) {
    throw new AuthError(
      "AUTH_DATABASE_UNAVAILABLE",
      "账户数据库尚未配置",
      503,
    );
  }
}

function authSecret() {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new AuthError("AUTH_SECRET_MISSING", "账户会话密钥尚未配置", 503);
  }
  return secret;
}

function normalizeEmail(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}

function tokenHash(token: string) {
  return createHmac("sha256", authSecret()).update(token).digest();
}

function scrypt(
  password: string,
  salt: Buffer,
  options: { N: number; r: number; p: number },
) {
  return new Promise<Buffer>((resolve, reject) =>
    nodeScrypt(
      password,
      salt,
      KEY_LENGTH,
      { ...options, maxmem: 128 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key as Buffer)),
    ),
  );
}

export function validateRegistration(input: {
  email?: unknown;
  displayName?: unknown;
  password?: unknown;
}) {
  const email = normalizeEmail(String(input.email ?? ""));
  const displayName = String(input.displayName ?? "").trim();
  const password = String(input.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AuthError("INVALID_EMAIL", "请输入有效的邮箱地址");
  }
  if (displayName.length < 1 || displayName.length > 40) {
    throw new AuthError("INVALID_DISPLAY_NAME", "昵称需要保持在 1 到 40 个字符之间");
  }
  if (password.length < 15 || password.length > 128) {
    throw new AuthError("INVALID_PASSWORD", "密码需要 15 到 128 个字符");
  }
  return { email, displayName, password };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  try {
    const [algorithm, n, r, p, saltValue, keyValue] = encoded.split("$");
    if (algorithm !== "scrypt" || password.length > 128) return false;
    const expected = Buffer.from(keyValue, "base64url");
    const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function insertEmailToken(
  client: PoolClient,
  userId: string,
  purpose: "verify_email" | "reset_password",
  minutes: number,
) {
  const token = randomBytes(32).toString("base64url");
  await client.query(
    "UPDATE auth_email_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL",
    [userId, purpose],
  );
  await client.query(
    "INSERT INTO auth_email_tokens(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+make_interval(mins => $5))",
    [randomUUID(), userId, purpose, tokenHash(token), minutes],
  );
  return token;
}

export async function registerAccount(raw: {
  email?: unknown;
  displayName?: unknown;
  password?: unknown;
}) {
  requireDatabase();
  const input = validateRegistration(raw);
  const passwordHash = await hashPassword(input.password);
  try {
    return await transaction(async (client) => {
      const existing = await client.query(
        "SELECT user_id FROM auth_credentials WHERE email=$1",
        [input.email],
      );
      if (existing.rows[0]) return { created: false as const };

      const userId = `account:${randomUUID()}`;
      await client.query("INSERT INTO users(id) VALUES($1)", [userId]);
      await client.query(
        "INSERT INTO user_profiles(user_id,display_name) VALUES($1,$2)",
        [userId, input.displayName],
      );
      await client.query(
        "INSERT INTO auth_credentials(user_id,email,password_hash) VALUES($1,$2,$3)",
        [userId, input.email, passwordHash],
      );
      const token = await insertEmailToken(
        client,
        userId,
        "verify_email",
        VERIFY_MINUTES,
      );
      return { created: true as const, userId, email: input.email, token };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "23505"
    ) {
      return { created: false as const };
    }
    throw error;
  }
}

export async function resendVerification(emailValue: string) {
  requireDatabase();
  const email = normalizeEmail(emailValue);
  return transaction(async (client) => {
    const result = await client.query(
      "SELECT user_id,email_verified_at FROM auth_credentials WHERE email=$1",
      [email],
    );
    const row = result.rows[0];
    if (!row || row.email_verified_at) return null;
    return {
      email,
      token: await insertEmailToken(
        client,
        row.user_id,
        "verify_email",
        VERIFY_MINUTES,
      ),
    };
  });
}

export async function verifyEmailToken(token: string) {
  requireDatabase();
  return transaction(async (client) => {
    const result = await client.query(
      "SELECT * FROM auth_email_tokens WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
      [tokenHash(token)],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AuthError(
        "INVALID_OR_EXPIRED_TOKEN",
        "验证链接无效或已经过期",
      );
    }
    await client.query("UPDATE auth_email_tokens SET used_at=now() WHERE id=$1", [
      row.id,
    ]);
    await client.query(
      "UPDATE auth_credentials SET email_verified_at=coalesce(email_verified_at,now()),updated_at=now() WHERE user_id=$1",
      [row.user_id],
    );
    return row.user_id as string;
  });
}

export async function loginAccount(emailValue: string, password: string) {
  requireDatabase();
  const email = normalizeEmail(emailValue);
  const result = await query(
    "SELECT c.*,p.display_name FROM auth_credentials c JOIN user_profiles p ON p.user_id=c.user_id WHERE c.email=$1",
    [email],
  );
  const row = result.rows[0];
  const valid = row ? await verifyPassword(password, row.password_hash) : false;
  if (!row || !valid) {
    if (row) {
      await query(
        "UPDATE auth_credentials SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE user_id=$1",
        [row.user_id],
      );
    }
    throw new AuthError("INVALID_CREDENTIALS", "邮箱或密码不正确", 401);
  }
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    throw new AuthError(
      "ACCOUNT_TEMPORARILY_LOCKED",
      "尝试次数过多，请稍后再试",
      429,
    );
  }
  if (!row.email_verified_at) {
    throw new AuthError("EMAIL_NOT_VERIFIED", "请先完成邮箱验证", 403);
  }
  await query(
    "UPDATE auth_credentials SET failed_attempts=0,locked_until=NULL,updated_at=now() WHERE user_id=$1",
    [row.user_id],
  );
  return {
    userId: row.user_id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    emailVerified: true,
  };
}

export async function createSession(userId: string) {
  requireDatabase();
  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const raw = `${id}.${secret}`;
  await query(
    "INSERT INTO auth_sessions(id,user_id,secret_hash,expires_at) VALUES($1,$2,$3,now()+make_interval(days => $4))",
    [id, userId, tokenHash(raw), SESSION_DAYS],
  );
  return raw;
}

export async function resolveSession(raw: string) {
  requireDatabase();
  const [id] = raw.split(".");
  if (!id) return null;
  const result = await query(
    "SELECT s.user_id,c.email,c.email_verified_at,p.display_name FROM auth_sessions s JOIN auth_credentials c ON c.user_id=s.user_id JOIN user_profiles p ON p.user_id=s.user_id WHERE s.id=$1 AND s.secret_hash=$2 AND s.revoked_at IS NULL AND s.expires_at>now()",
    [id, tokenHash(raw)],
  );
  const row = result.rows[0];
  if (!row) return null;
  await query("UPDATE auth_sessions SET last_seen_at=now() WHERE id=$1", [id]);
  return {
    sessionId: id,
    account: {
      userId: row.user_id as string,
      email: row.email as string,
      displayName: row.display_name as string,
      emailVerified: Boolean(row.email_verified_at),
    },
  };
}

export async function revokeSession(sessionId: string, userId: string) {
  requireDatabase();
  await query(
    "UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2",
    [sessionId, userId],
  );
}

export async function revokeAllSessions(userId: string) {
  requireDatabase();
  await query(
    "UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
    [userId],
  );
}

export async function createPasswordReset(emailValue: string) {
  requireDatabase();
  const email = normalizeEmail(emailValue);
  return transaction(async (client) => {
    const result = await client.query(
      "SELECT user_id FROM auth_credentials WHERE email=$1",
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      email,
      token: await insertEmailToken(
        client,
        row.user_id,
        "reset_password",
        RESET_MINUTES,
      ),
    };
  });
}

export async function resetPassword(token: string, password: string) {
  requireDatabase();
  if (password.length < 15 || password.length > 128) {
    throw new AuthError("INVALID_PASSWORD", "密码需要 15 到 128 个字符");
  }
  const passwordHash = await hashPassword(password);
  return transaction(async (client) => {
    const result = await client.query(
      "SELECT * FROM auth_email_tokens WHERE token_hash=$1 AND purpose='reset_password' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
      [tokenHash(token)],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AuthError(
        "INVALID_OR_EXPIRED_TOKEN",
        "重置链接无效或已经过期",
      );
    }
    await client.query("UPDATE auth_email_tokens SET used_at=now() WHERE id=$1", [
      row.id,
    ]);
    await client.query(
      "UPDATE auth_credentials SET password_hash=$1,password_changed_at=now(),failed_attempts=0,locked_until=NULL,updated_at=now() WHERE user_id=$2",
      [passwordHash, row.user_id],
    );
    await client.query(
      "UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
      [row.user_id],
    );
    return row.user_id as string;
  });
}

export async function accountByUserId(
  userId: string,
): Promise<AccountView | null> {
  requireDatabase();
  const result = await query(
    "SELECT c.user_id,c.email,c.email_verified_at,p.display_name FROM auth_credentials c JOIN user_profiles p ON p.user_id=c.user_id WHERE c.user_id=$1",
    [userId],
  );
  const row = result.rows[0];
  return row
    ? {
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        emailVerified: Boolean(row.email_verified_at),
      }
    : null;
}
