-- Migration: user profile fields (avatar + address)

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "address" JSONB;
