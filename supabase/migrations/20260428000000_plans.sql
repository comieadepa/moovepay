-- Migration: planos de negócio

-- ==================== PLAN TABLE ====================

CREATE TABLE IF NOT EXISTS "Plan" (
  "id"            TEXT PRIMARY KEY,               -- free | essencial | pro | custom
  "name"          TEXT NOT NULL,
  "monthlyPrice"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "feePercent"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "features"      JSONB NOT NULL DEFAULT '{}',
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed dos 4 planos
INSERT INTO "Plan" ("id", "name", "monthlyPrice", "feePercent", "features")
VALUES
  ('free', 'Gratuito', 0, 0, '{
    "paidEvents": false,
    "pix": false,
    "qrCheckin": false,
    "certificates": false,
    "multipleOrganizers": false,
    "advancedReports": false,
    "whiteLabel": false,
    "prioritySupport": false
  }'),
  ('essencial', 'Essencial', 0, 10, '{
    "paidEvents": true,
    "pix": true,
    "qrCheckin": true,
    "certificates": true,
    "multipleOrganizers": false,
    "advancedReports": false,
    "whiteLabel": false,
    "prioritySupport": false
  }'),
  ('pro', 'Pro', 97, 5, '{
    "paidEvents": true,
    "pix": true,
    "qrCheckin": true,
    "certificates": true,
    "multipleOrganizers": true,
    "advancedReports": true,
    "whiteLabel": false,
    "prioritySupport": true
  }'),
  ('custom', 'Igrejas & Ministérios', 0, 0, '{
    "paidEvents": true,
    "pix": true,
    "qrCheckin": true,
    "certificates": true,
    "multipleOrganizers": true,
    "advancedReports": true,
    "whiteLabel": true,
    "prioritySupport": true
  }')
ON CONFLICT ("id") DO NOTHING;

-- ==================== TENANT.planId ====================

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "planId" TEXT NOT NULL DEFAULT 'essencial'
    REFERENCES "Plan"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tenant_planId ON "Tenant"("planId");
