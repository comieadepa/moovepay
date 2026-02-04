-- Migration: support tickets

-- ==================== SUPPORT: TICKETS ====================

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "creatorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SupportTicketMessage" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
  "sender" TEXT NOT NULL DEFAULT 'user',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_creatorId ON "SupportTicket"("creatorId");
CREATE INDEX IF NOT EXISTS idx_support_ticket_status ON "SupportTicket"("status");
CREATE INDEX IF NOT EXISTS idx_support_message_ticketId ON "SupportTicketMessage"("ticketId");

-- updatedAt trigger (function is created in init migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'update_support_ticket_updated_at'
    ) THEN
      CREATE TRIGGER update_support_ticket_updated_at BEFORE UPDATE ON "SupportTicket"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END
$$;
