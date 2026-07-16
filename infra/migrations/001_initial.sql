CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE characters(id text PRIMARY KEY,owner_id text NOT NULL,name jsonb NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE character_versions(character_id text REFERENCES characters(id),version text,status text NOT NULL,pack jsonb NOT NULL,published_at timestamptz,PRIMARY KEY(character_id,version));
CREATE TABLE source_assets(id uuid PRIMARY KEY,character_id text REFERENCES characters(id),version text,name text,mime_type text,storage_key text,external_url text,checksum text,license jsonb,status text,revoked_at timestamptz,UNIQUE(character_id,version,checksum));
CREATE TABLE ingestion_jobs(id uuid PRIMARY KEY,asset_id uuid REFERENCES source_assets(id),idempotency_key text UNIQUE,status text,attempt int DEFAULT 0,progress int DEFAULT 0,error text,updated_at timestamptz DEFAULT now());
CREATE TABLE candidate_claims(id uuid PRIMARY KEY,asset_id uuid REFERENCES source_assets(id),body jsonb NOT NULL,review_status text DEFAULT 'pending',revision int DEFAULT 0);
CREATE TABLE claims(character_id text,version text,id text,body jsonb NOT NULL,embedding vector(1536),PRIMARY KEY(character_id,version,id),FOREIGN KEY(character_id,version) REFERENCES character_versions(character_id,version));
CREATE INDEX claims_embedding_idx ON claims USING hnsw(embedding vector_cosine_ops);
