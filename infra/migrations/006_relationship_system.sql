CREATE TABLE user_character_relationships (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id text NOT NULL CHECK (length(btrim(character_id)) > 0),
  stage text NOT NULL DEFAULT 'initial'
    CHECK (stage IN ('initial', 'acquainted', 'young_friend', 'old_friend', 'kindred_spirit')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused')),
  policy_version text NOT NULL DEFAULT 'relationship-policy-v1'
    CHECK (length(btrim(policy_version)) > 0),
  evidence_revision integer NOT NULL DEFAULT 0 CHECK (evidence_revision >= 0),
  recording_revision integer NOT NULL DEFAULT 1 CHECK (recording_revision >= 1),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  evaluated_at timestamptz,
  paused_at timestamptz,
  reset_cutoff_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, character_id),
  CHECK (
    (status = 'active' AND paused_at IS NULL)
    OR (status = 'paused' AND paused_at IS NOT NULL)
  )
);

CREATE INDEX user_character_relationships_status_idx
  ON user_character_relationships(user_id, status, updated_at DESC);

CREATE TABLE relationship_evidence (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  character_id text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN (
    'continuity',
    'exploration_depth',
    'demonstrated_understanding',
    'reciprocal_context',
    'independent_perspective'
  )),
  event_type text NOT NULL CHECK (event_type IN (
    'substantive_question',
    'historical_connection',
    'reasoned_agreement',
    'reasoned_disagreement',
    'explanation_or_application',
    'revisited_prior_topic',
    'viewpoint_evolution',
    'responsive_followup',
    'cross_topic_synthesis',
    'historical_relationship_explored'
  )),
  quality smallint NOT NULL CHECK (quality BETWEEN 1 AND 3),
  confidence real NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  episode_key text NOT NULL CHECK (length(btrim(episode_key)) > 0),
  topic_key text NOT NULL CHECK (length(btrim(topic_key)) > 0),
  normalized_fingerprint text NOT NULL CHECK (length(btrim(normalized_fingerprint)) > 0),
  logical_key text NOT NULL CHECK (length(btrim(logical_key)) > 0),
  sanitized_summary text CHECK (sanitized_summary IS NULL OR length(btrim(sanitized_summary)) > 0),
  stance text CHECK (stance IS NULL OR stance IN ('agree', 'disagree', 'mixed', 'not_applicable')),
  substantiveness text CHECK (substantiveness IS NULL OR substantiveness IN ('low', 'medium', 'high')),
  extractor_model text NOT NULL CHECK (length(btrim(extractor_model)) > 0),
  extractor_version text NOT NULL CHECK (length(btrim(extractor_version)) > 0),
  policy_mapping_version text NOT NULL CHECK (length(btrim(policy_mapping_version)) > 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'rejected', 'revoked', 'superseded')),
  rejection_reason_code text CHECK (rejection_reason_code IS NULL OR length(btrim(rejection_reason_code)) > 0),
  superseded_by_id uuid REFERENCES relationship_evidence(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, character_id)
    REFERENCES user_character_relationships(user_id, character_id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (user_id, character_id, logical_key),
  UNIQUE (user_id, character_id, normalized_fingerprint),
  CHECK (
    (status = 'superseded' AND superseded_by_id IS NOT NULL AND superseded_by_id <> id)
    OR (status <> 'superseded' AND superseded_by_id IS NULL)
  ),
  CHECK (
    (status = 'rejected' AND rejection_reason_code IS NOT NULL)
    OR (status <> 'rejected' AND rejection_reason_code IS NULL)
  )
);

CREATE INDEX relationship_evidence_projection_idx
  ON relationship_evidence(user_id, character_id, status, dimension, event_type);
CREATE INDEX relationship_evidence_episode_topic_idx
  ON relationship_evidence(user_id, character_id, episode_key, topic_key)
  WHERE status = 'active';

CREATE TABLE relationship_evidence_sources (
  id uuid PRIMARY KEY,
  evidence_id uuid NOT NULL REFERENCES relationship_evidence(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('message', 'memory', 'learning_event')),
  message_id uuid REFERENCES messages(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  memory_id uuid REFERENCES memories(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  learning_event_id uuid REFERENCES learning_events(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  source_role text NOT NULL CHECK (source_role IN ('user', 'character', 'system')),
  dependency_role text NOT NULL
    CHECK (dependency_role IN ('primary', 'required_support', 'optional_context')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(message_id, memory_id, learning_event_id) = 1),
  CHECK (
    (source_type = 'message' AND message_id IS NOT NULL)
    OR (source_type = 'memory' AND memory_id IS NOT NULL)
    OR (source_type = 'learning_event' AND learning_event_id IS NOT NULL)
  ),
  CHECK (
    dependency_role <> 'primary'
    OR (source_type = 'message' AND source_role = 'user')
  )
);

CREATE UNIQUE INDEX relationship_evidence_one_primary_idx
  ON relationship_evidence_sources(evidence_id)
  WHERE dependency_role = 'primary';
CREATE UNIQUE INDEX relationship_evidence_message_source_idx
  ON relationship_evidence_sources(evidence_id, message_id, dependency_role)
  WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_evidence_memory_source_idx
  ON relationship_evidence_sources(evidence_id, memory_id, dependency_role)
  WHERE memory_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_evidence_learning_source_idx
  ON relationship_evidence_sources(evidence_id, learning_event_id, dependency_role)
  WHERE learning_event_id IS NOT NULL;
CREATE INDEX relationship_evidence_sources_message_idx
  ON relationship_evidence_sources(message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX relationship_evidence_sources_memory_idx
  ON relationship_evidence_sources(memory_id)
  WHERE memory_id IS NOT NULL;
CREATE INDEX relationship_evidence_sources_learning_idx
  ON relationship_evidence_sources(learning_event_id)
  WHERE learning_event_id IS NOT NULL;

COMMENT ON TABLE relationship_evidence_sources IS
  'The service must insert exactly one primary user-message source for every evidence row before commit and verify that every referenced source belongs to the same user and character as the evidence. The partial unique index enforces at most one; PostgreSQL CHECK constraints cannot enforce cross-row existence or verify the persisted message role.';
COMMENT ON COLUMN relationship_evidence_sources.message_id IS
  'Deferred NO ACTION requires message or thread deletion to revoke/delete dependent relationship evidence sources in the same transaction.';
COMMENT ON COLUMN relationship_evidence_sources.memory_id IS
  'Memory suppression/forgetting is a logical state change; the service must suspend/revoke required_support links and reproject atomically.';

CREATE TABLE relationship_stage_transitions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  character_id text NOT NULL,
  from_stage text NOT NULL CHECK (from_stage IN (
    'initial', 'acquainted', 'young_friend', 'old_friend', 'kindred_spirit'
  )),
  to_stage text NOT NULL CHECK (to_stage IN (
    'initial', 'acquainted', 'young_friend', 'old_friend', 'kindred_spirit'
  )),
  policy_version text NOT NULL CHECK (length(btrim(policy_version)) > 0),
  evidence_revision integer NOT NULL CHECK (evidence_revision >= 0),
  evidence_snapshot_hash text NOT NULL CHECK (length(btrim(evidence_snapshot_hash)) > 0),
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'evidence_projection', 'guest_merge', 'policy_reprojection'
  )),
  feedback_status text NOT NULL DEFAULT 'pending'
    CHECK (feedback_status IN ('pending', 'acknowledged')),
  feedback_text text NOT NULL CHECK (length(btrim(feedback_text)) > 0),
  after_message_id uuid NOT NULL REFERENCES messages(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  feedback_idempotency_key text,
  feedback_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, character_id)
    REFERENCES user_character_relationships(user_id, character_id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (user_id, character_id, idempotency_key),
  UNIQUE (user_id, character_id, to_stage),
  CHECK (
    (from_stage = 'initial' AND to_stage = 'acquainted')
    OR (from_stage = 'acquainted' AND to_stage = 'young_friend')
    OR (from_stage = 'young_friend' AND to_stage = 'old_friend')
    OR (from_stage = 'old_friend' AND to_stage = 'kindred_spirit')
  ),
  CHECK (
    (feedback_status = 'pending' AND feedback_idempotency_key IS NULL AND feedback_at IS NULL)
    OR (
      feedback_status = 'acknowledged'
      AND feedback_idempotency_key IS NOT NULL
      AND length(btrim(feedback_idempotency_key)) > 0
      AND feedback_at IS NOT NULL
    )
  )
);

CREATE INDEX relationship_stage_transitions_pending_idx
  ON relationship_stage_transitions(user_id, character_id, created_at, id)
  WHERE feedback_status = 'pending';
CREATE UNIQUE INDEX relationship_stage_transitions_feedback_idem_idx
  ON relationship_stage_transitions(user_id, character_id, feedback_idempotency_key)
  WHERE feedback_idempotency_key IS NOT NULL;

CREATE TABLE relationship_preferences (
  user_id text NOT NULL,
  character_id text NOT NULL,
  preferred_address text NOT NULL,
  consent_status text NOT NULL CHECK (consent_status IN ('granted', 'revoked')),
  consent_version integer NOT NULL CHECK (consent_version >= 1),
  granted_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, character_id),
  FOREIGN KEY (user_id, character_id)
    REFERENCES user_character_relationships(user_id, character_id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    preferred_address = btrim(preferred_address)
    AND char_length(preferred_address) BETWEEN 1 AND 20
    AND preferred_address !~ '[[:cntrl:]]'
  ),
  CHECK (
    (consent_status = 'granted' AND revoked_at IS NULL)
    OR (consent_status = 'revoked' AND revoked_at IS NOT NULL)
  ),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE relationship_outbox (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  character_id text NOT NULL,
  aggregate_key text NOT NULL CHECK (length(btrim(aggregate_key)) > 0),
  event_type text NOT NULL CHECK (event_type IN (
    'evidence_extraction_requested',
    'relationship_reprojection_requested',
    'evidence_source_changed'
  )),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  producer_version text NOT NULL CHECK (length(btrim(producer_version)) > 0),
  idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'dead_letter')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts >= 1),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claim_token uuid,
  processed_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, character_id)
    REFERENCES user_character_relationships(user_id, character_id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (aggregate_key, event_type, producer_version, idempotency_key),
  CHECK (attempt <= max_attempts),
  CHECK (
    (status = 'pending' AND claimed_at IS NULL AND claim_token IS NULL AND processed_at IS NULL)
    OR (
      status = 'processing'
      AND claimed_at IS NOT NULL
      AND claim_token IS NOT NULL
      AND processed_at IS NULL
    )
    OR (
      status IN ('processed', 'dead_letter')
      AND claimed_at IS NULL
      AND claim_token IS NULL
      AND processed_at IS NOT NULL
    )
  )
);

CREATE INDEX relationship_outbox_claim_retry_idx
  ON relationship_outbox(available_at, created_at, id)
  WHERE status = 'pending';
CREATE INDEX relationship_outbox_stale_claim_idx
  ON relationship_outbox(claimed_at, id)
  WHERE status = 'processing';
CREATE INDEX relationship_outbox_aggregate_idx
  ON relationship_outbox(user_id, character_id, created_at DESC);

COMMENT ON COLUMN relationship_outbox.payload IS
  'Payload identifiers are untrusted references; the service must overwrite source identity from persisted server-side messages and validate reset/pause revisions before processing.';
