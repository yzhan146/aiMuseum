type SessionPin = { characterId: string; version: string; createdAt: number };
const globalSessions = globalThis as typeof globalThis & { __museumSessions?: Map<string, SessionPin> };
const sessions = globalSessions.__museumSessions ??= new Map<string, SessionPin>();
export function resolveSessionVersion(sessionId: string | undefined, characterId: string, requestedVersion: string | undefined, latestVersion: string) {
  if (!sessionId) return requestedVersion ?? latestVersion;
  const current = sessions.get(sessionId);
  if (current) { if (current.characterId !== characterId) throw new Error("一个会话只能固定到一个人物版本"); if (requestedVersion && requestedVersion !== current.version) throw new Error("会话已固定人物版本，不能在中途切换"); return current.version; }
  const version = requestedVersion ?? latestVersion; sessions.set(sessionId, { characterId, version, createdAt: Date.now() }); return version;
}
export function clearSessionsForTests() { sessions.clear(); }
