CREATE TABLE hall_visit_states (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hall_id text NOT NULL,
  scene_version text NOT NULL,
  last_station_id text NOT NULL,
  viewed_object_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  visited_character_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_station_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  revision integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, hall_id)
);

CREATE INDEX hall_visit_states_updated_idx ON hall_visit_states(user_id, updated_at DESC);
