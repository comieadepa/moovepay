-- Migration: multi-tenant + RBAC base

-- ==================== TENANT ====================

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TenantMember" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'owner',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_member_unique UNIQUE ("tenantId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_tenant_member_tenantId ON "TenantMember"("tenantId");
CREATE INDEX IF NOT EXISTS idx_tenant_member_userId ON "TenantMember"("userId");

-- ==================== USER DEFAULT TENANT ====================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultTenantId" TEXT;

-- ==================== ADD tenantId to core tables ====================

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ==================== BACKFILL ====================

-- 1) Cria um tenant para cada usuário existente (tenantId = userId, compatível com dados atuais)
INSERT INTO "Tenant" ("id", "name")
SELECT u."id", u."name"
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Tenant" t WHERE t."id" = u."id"
);

-- 2) Define defaultTenantId
UPDATE "User" SET "defaultTenantId" = "id" WHERE "defaultTenantId" IS NULL;

-- 3) Cria membership owner do tenant para o próprio usuário
INSERT INTO "TenantMember" ("tenantId", "userId", "role")
SELECT u."id", u."id", 'owner'
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "TenantMember" m WHERE m."tenantId" = u."id" AND m."userId" = u."id"
);

-- 4) Backfill tenantId nas tabelas
UPDATE "Event" SET "tenantId" = "creatorId" WHERE "tenantId" IS NULL;
UPDATE "SupportTicket" SET "tenantId" = "creatorId" WHERE "tenantId" IS NULL;

-- 5) Enforce NOT NULL depois do backfill
ALTER TABLE "Event" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SupportTicket" ALTER COLUMN "tenantId" SET NOT NULL;

-- Postgres não suporta `ADD CONSTRAINT IF NOT EXISTS`, então usamos um guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_event_tenant'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT fk_event_tenant
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_support_ticket_tenant'
  ) THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT fk_support_ticket_tenant
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_event_tenantId ON "Event"("tenantId");
CREATE INDEX IF NOT EXISTS idx_support_ticket_tenantId ON "SupportTicket"("tenantId");

-- ==================== updatedAt triggers ====================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_updated_at') THEN
      CREATE TRIGGER update_tenant_updated_at BEFORE UPDATE ON "Tenant"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_member_updated_at') THEN
      CREATE TRIGGER update_tenant_member_updated_at BEFORE UPDATE ON "TenantMember"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END
$$;
