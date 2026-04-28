-- Links de check-in com senha, sem necessidade de cadastro
CREATE TABLE IF NOT EXISTS "EventCheckInLink" (
  "id"           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId"      TEXT        NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "label"        TEXT        NOT NULL,          -- email ou nome para identificação
  "passwordHash" TEXT        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revokedAt"    TIMESTAMPTZ                    -- null = ativo
);

CREATE INDEX IF NOT EXISTS "idx_ecil_eventid" ON "EventCheckInLink"("eventId");
