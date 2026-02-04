-- Migration: support tickets assignment (admin/support)

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_support_ticket_assigned_to'
  ) THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT fk_support_ticket_assigned_to
      FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_support_ticket_assignedToUserId ON "SupportTicket"("assignedToUserId");
