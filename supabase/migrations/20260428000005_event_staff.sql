-- Colaboradores de check-in por evento (granular, não acessa o resto da plataforma)
-- role: 'checkin_operator' (somente check-in) | 'event_manager' (futuro: gerencia evento)

CREATE TABLE IF NOT EXISTS "EventStaff" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId"   TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role"      TEXT NOT NULL DEFAULT 'checkin_operator',
  "addedBy"   TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("eventId", "userId")
);

CREATE INDEX IF NOT EXISTS "idx_eventstaff_eventid" ON "EventStaff"("eventId");
CREATE INDEX IF NOT EXISTS "idx_eventstaff_userid"  ON "EventStaff"("userId");
