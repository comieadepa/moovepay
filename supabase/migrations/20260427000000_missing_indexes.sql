-- Migration: índices faltantes para performance

-- Registration.cartId: necessário para lookups de checkout em lote
CREATE INDEX IF NOT EXISTS idx_registration_cartId ON "Registration"("cartId");

-- Payment.cartId: necessário para associar pagamento ao carrinho
CREATE INDEX IF NOT EXISTS idx_payment_cartId ON "Payment"("cartId");
