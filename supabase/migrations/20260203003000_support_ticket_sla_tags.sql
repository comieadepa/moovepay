-- Migration: support tickets SLA fields + tags

-- Tags (para triagem)
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Campos de SLA/filas (denormalização)
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "firstSupportResponseAt" TIMESTAMPTZ;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "lastUserMessageAt" TIMESTAMPTZ;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "lastSupportMessageAt" TIMESTAMPTZ;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMPTZ;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "lastMessageSender" TEXT;

CREATE INDEX IF NOT EXISTS idx_support_ticket_lastUserMessageAt ON "SupportTicket"("lastUserMessageAt");
CREATE INDEX IF NOT EXISTS idx_support_ticket_lastMessageAt ON "SupportTicket"("lastMessageAt");
CREATE INDEX IF NOT EXISTS idx_support_ticket_tags ON "SupportTicket" USING GIN ("tags");

-- Mantém os campos acima atualizados a cada inserção de mensagem
CREATE OR REPLACE FUNCTION support_ticket_on_message_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "SupportTicket"
  SET
    "lastMessageAt" = NEW."createdAt",
    "lastMessageSender" = NEW."sender",
    "lastUserMessageAt" = CASE WHEN NEW."sender" = 'user' THEN NEW."createdAt" ELSE "lastUserMessageAt" END,
    "lastSupportMessageAt" = CASE WHEN NEW."sender" = 'support' THEN NEW."createdAt" ELSE "lastSupportMessageAt" END,
    "firstSupportResponseAt" = CASE
      WHEN NEW."sender" = 'support' AND "firstSupportResponseAt" IS NULL THEN NEW."createdAt"
      ELSE "firstSupportResponseAt"
    END
  WHERE "id" = NEW."ticketId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'support_ticket_message_after_insert'
  ) THEN
    CREATE TRIGGER support_ticket_message_after_insert
      AFTER INSERT ON "SupportTicketMessage"
      FOR EACH ROW
      EXECUTE FUNCTION support_ticket_on_message_insert();
  END IF;
END
$$;

-- Backfill básico (garante que tickets antigos tenham lastMessageAt)
WITH last_msg AS (
  SELECT DISTINCT ON ("ticketId")
    "ticketId",
    "createdAt",
    "sender"
  FROM "SupportTicketMessage"
  ORDER BY "ticketId", "createdAt" DESC
)
UPDATE "SupportTicket" t
SET
  "lastMessageAt" = lm."createdAt",
  "lastMessageSender" = lm."sender",
  "lastUserMessageAt" = CASE WHEN lm."sender" = 'user' THEN lm."createdAt" ELSE t."lastUserMessageAt" END,
  "lastSupportMessageAt" = CASE WHEN lm."sender" = 'support' THEN lm."createdAt" ELSE t."lastSupportMessageAt" END
FROM last_msg lm
WHERE t."id" = lm."ticketId"
  AND t."lastMessageAt" IS NULL;
