CREATE INDEX IF NOT EXISTS auth_sessions_presence_idx
  ON auth_sessions(last_seen_at DESC, user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_user_last_seen_idx
  ON auth_sessions(user_id, last_seen_at DESC);
