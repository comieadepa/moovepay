-- ==================== EXTENSÕES ====================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== TABLES ====================

-- Observação: usamos colunas camelCase com aspas para manter o payload
-- alinhado ao que o frontend já consome (Next.js).

-- User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "password" TEXT NOT NULL,
  "cpf" TEXT,
  "whatsapp" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event table
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "creatorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE NOT NULL,
  "description" TEXT,
  "banner" TEXT,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "customFields" JSONB,
  "location" TEXT,
  "eventFormat" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- InscriptionType table
CREATE TABLE IF NOT EXISTS "InscriptionType" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "value" DOUBLE PRECISION NOT NULL,
  "available" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registration table
CREATE TABLE IF NOT EXISTS "Registration" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "inscriptionTypeId" TEXT NOT NULL REFERENCES "InscriptionType"("id") ON DELETE RESTRICT,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "whatsapp" TEXT,
  "cpf" TEXT NOT NULL,
  "customData" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalValue" DOUBLE PRECISION NOT NULL,
  "cartId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment table
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "registrationId" TEXT REFERENCES "Registration"("id") ON DELETE SET NULL,
  "cartId" TEXT,
  "externalId" TEXT,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "value" DOUBLE PRECISION NOT NULL,
  "paidAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TicketConfig table
CREATE TABLE IF NOT EXISTS "TicketConfig" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT UNIQUE NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "useTicket" BOOLEAN NOT NULL DEFAULT true,
  "ticketType" TEXT NOT NULL DEFAULT 'simple',
  "ticketSize" TEXT NOT NULL DEFAULT 'A4',
  "ticketLayout" TEXT NOT NULL DEFAULT 'vertical',
  "includeFields" JSONB NOT NULL,
  "backgroundColor" TEXT,
  "logoUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Voucher table
CREATE TABLE IF NOT EXISTS "Voucher" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "registrationId" TEXT UNIQUE NOT NULL REFERENCES "Registration"("id") ON DELETE CASCADE,
  "qrCode" TEXT NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== COMPAT / UPGRADE ====================
-- Se você já criou tabelas anteriormente (ex.: sem algumas colunas),
-- estes ALTERs evitam erros ao recriar índices.
-- (Após um reset completo, este bloco não atrapalha.)

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "creatorId" TEXT,
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "banner" TEXT,
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "customFields" JSONB,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "eventFormat" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "InscriptionType"
  ADD COLUMN IF NOT EXISTS "eventId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "Registration"
  ADD COLUMN IF NOT EXISTS "eventId" TEXT,
  ADD COLUMN IF NOT EXISTS "inscriptionTypeId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "eventId" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "TicketConfig"
  ADD COLUMN IF NOT EXISTS "eventId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "Voucher"
  ADD COLUMN IF NOT EXISTS "registrationId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_event_creatorId ON "Event"("creatorId");
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_slug_unique ON "Event"("slug");
CREATE INDEX IF NOT EXISTS idx_inscription_type_eventId ON "InscriptionType"("eventId");
CREATE INDEX IF NOT EXISTS idx_registration_eventId ON "Registration"("eventId");
CREATE INDEX IF NOT EXISTS idx_registration_email ON "Registration"("email");
CREATE INDEX IF NOT EXISTS idx_payment_registrationId ON "Payment"("registrationId");
CREATE INDEX IF NOT EXISTS idx_payment_externalId ON "Payment"("externalId");

-- ==================== UPDATED_AT TRIGGER ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_updated_at') THEN
    CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_event_updated_at') THEN
    CREATE TRIGGER update_event_updated_at BEFORE UPDATE ON "Event"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_inscription_type_updated_at') THEN
    CREATE TRIGGER update_inscription_type_updated_at BEFORE UPDATE ON "InscriptionType"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_registration_updated_at') THEN
    CREATE TRIGGER update_registration_updated_at BEFORE UPDATE ON "Registration"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_updated_at') THEN
    CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON "Payment"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ticket_config_updated_at') THEN
    CREATE TRIGGER update_ticket_config_updated_at BEFORE UPDATE ON "TicketConfig"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_voucher_updated_at') THEN
    CREATE TRIGGER update_voucher_updated_at BEFORE UPDATE ON "Voucher"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
