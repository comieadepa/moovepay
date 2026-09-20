-- Migration: tabela de solicitações de saque (WithdrawalRequest)

CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "amount" DOUBLE PRECISION NOT NULL,
  "pixKey" TEXT NOT NULL,
  "pixKeyType" TEXT NOT NULL, -- cpf | cnpj | email | phone | random
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending | completed | rejected
  "notes" TEXT,
  "receiptUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ,
  "processedBy" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_request_tenantId ON "WithdrawalRequest"("tenantId");
CREATE INDEX IF NOT EXISTS idx_withdrawal_request_status ON "WithdrawalRequest"("status");
CREATE INDEX IF NOT EXISTS idx_withdrawal_request_createdAt ON "WithdrawalRequest"("createdAt");
CREATE INDEX IF NOT EXISTS idx_withdrawal_request_processedBy ON "WithdrawalRequest"("processedBy");

-- Trigger de updatedAt
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_withdrawal_request_updated_at') THEN
      CREATE TRIGGER update_withdrawal_request_updated_at BEFORE UPDATE ON "WithdrawalRequest"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END
$$;

-- Função atômica para validar saldo e criar solicitação de saque (previne race condition)
CREATE OR REPLACE FUNCTION create_withdrawal_request_atomic(
  p_tenant_id TEXT,
  p_user_id TEXT,
  p_amount DOUBLE PRECISION,
  p_pix_key TEXT,
  p_pix_key_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key BIGINT;
  v_total_net DOUBLE PRECISION := 0.0;
  v_total_withdrawn_or_pending DOUBLE PRECISION := 0.0;
  v_available DOUBLE PRECISION := 0.0;
  v_created_row "WithdrawalRequest"%ROWTYPE;
BEGIN
  -- 1. Obter advisory lock exclusivo no tenant durante a transação
  -- Garante que requisições concorrentes para o mesmo tenant sejam enfileiradas e serializadas
  v_lock_key := ('x' || substr(md5(p_tenant_id), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 2. Calcular receita líquida total do tenant
  -- Eventos pagos: tenant tem direito a 90% dos pagamentos 'paid' ou 'received'
  -- Eventos gratuitos (sem InscriptionType com value > 0): 100% (taxa 0%)
  SELECT COALESCE(SUM(
    CASE 
      WHEN ev.is_paid THEN ev.gross * 0.9 
      ELSE ev.gross 
    END
  ), 0.0)
  INTO v_total_net
  FROM (
    SELECT 
      e."id",
      EXISTS (
        SELECT 1 
        FROM "InscriptionType" it 
        WHERE it."eventId" = e."id" 
          AND COALESCE(it."value", 0) > 0
      ) AS is_paid,
      COALESCE((
        SELECT SUM(p."value")
        FROM "Payment" p
        WHERE p."eventId" = e."id"
          AND p."status" IN ('paid', 'received')
      ), 0.0) AS gross
    FROM "Event" e
    WHERE e."tenantId" = p_tenant_id
  ) ev;

  -- 3. Calcular saques pendentes ou concluídos
  SELECT COALESCE(SUM("amount"), 0.0)
  INTO v_total_withdrawn_or_pending
  FROM "WithdrawalRequest"
  WHERE "tenantId" = p_tenant_id
    AND "status" IN ('pending', 'completed');

  -- 4. Saldo disponível
  v_available := GREATEST(0.0, v_total_net - v_total_withdrawn_or_pending);

  -- 5. Validação com tolerância para ponto flutuante (0.001)
  IF p_amount > (v_available + 0.001) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'message', 'Saldo insuficiente. Disponível para saque: R$ ' || to_char(v_available, 'FM999999990.00'),
      'availableBalance', v_available
    );
  END IF;

  -- 6. Inserção atômica da solicitação de saque
  INSERT INTO "WithdrawalRequest" (
    "tenantId",
    "userId",
    "amount",
    "pixKey",
    "pixKeyType",
    "status"
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_amount,
    TRIM(p_pix_key),
    p_pix_key_type,
    'pending'
  )
  RETURNING * INTO v_created_row;

  -- 7. Retorno com dados da solicitação criada e novo saldo disponível
  RETURN jsonb_build_object(
    'success', true,
    'withdrawal', to_jsonb(v_created_row),
    'previousBalance', v_available,
    'newAvailableBalance', GREATEST(0.0, v_available - p_amount)
  );
END;
$$;
