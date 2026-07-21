ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS artifact_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE user_collections (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  owned_character_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  stars integer NOT NULL DEFAULT 60 CHECK (stars >= 0),
  fragments integer NOT NULL DEFAULT 20 CHECK (fragments >= 0),
  first_free_eligible boolean NOT NULL DEFAULT false,
  first_free_used boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_events (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id text NOT NULL,
  period_id text NOT NULL,
  type text NOT NULL,
  idempotency_key text NOT NULL,
  reward_stars integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, idempotency_key)
);
CREATE UNIQUE INDEX learning_events_encounter_once_idx
  ON learning_events(user_id, character_id, type)
  WHERE type = 'encounter_completed';

CREATE TABLE character_draws (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id text NOT NULL,
  idempotency_key text NOT NULL,
  cost_stars integer NOT NULL,
  result_character_id text NOT NULL,
  duplicate boolean NOT NULL DEFAULT false,
  fragment_reward integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('committed', 'revealed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz,
  UNIQUE(user_id, idempotency_key)
);
