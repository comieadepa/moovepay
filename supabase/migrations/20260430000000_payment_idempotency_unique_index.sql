-- Migration: Indice unico parcial para protecao de idempotencia contra cobranca concorrente
-- Impede que duas requisicoes ativas ('creating', 'pending', 'paid') coexistam para o mesmo cartId.
-- Pagamentos historicos cancelados/falhados nao sao afetados.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_unique_active_cart
ON "Payment"("cartId")
WHERE "cartId" IS NOT NULL AND "status" IN ('creating', 'pending', 'paid');
