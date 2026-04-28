-- Tabela de auditoria de check-ins
CREATE TABLE IF NOT EXISTS "CheckinLog" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "voucherId"      TEXT NOT NULL REFERENCES "Voucher"("id") ON DELETE CASCADE,
  "registrationId" TEXT NOT NULL REFERENCES "Registration"("id") ON DELETE CASCADE,
  "eventId"        TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "scannedBy"      TEXT NOT NULL,          -- userId do operador
  "scannedByName"  TEXT,
  "result"         TEXT NOT NULL,          -- 'ok' | 'already_used' | 'not_found' | 'not_paid'
  "scannedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkinlog_voucher   ON "CheckinLog"("voucherId");
CREATE INDEX IF NOT EXISTS idx_checkinlog_event     ON "CheckinLog"("eventId");
CREATE INDEX IF NOT EXISTS idx_checkinlog_scannedat ON "CheckinLog"("scannedAt");
