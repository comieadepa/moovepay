-- Migration: Adiciona tokenHash para links de check-in móveis independentes
ALTER TABLE "EventCheckInLink"
  ADD COLUMN IF NOT EXISTS "tokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_ecil_tokenhash" ON "EventCheckInLink"("tokenHash") WHERE "tokenHash" IS NOT NULL;
