# MoovePay — Planejamento (Roadmap + Status)

Atualizado em: **05/02/2026**

Este documento descreve o escopo do produto e, principalmente, **o que já foi entregue** e **o próximo bloco de entregas** (prioridades). Ele deve ser lido junto de `ESTRUTURA.md`.

---

## 📌 Objetivo do produto

Plataforma para criadores de eventos publicarem inscrições e gerenciarem participantes, pagamentos e operação do evento, com:
- inscrição online (single e em lote)
- checkout único
- notificações por e-mail
- check-in por QR
- dashboard do criador
- módulo staff/admin

---

## ✅ Entregas já concluídas (Fev/2026)

### Fundamentos
- ✅ Next.js 14 + TypeScript + Tailwind + shadcn/ui
- ✅ Supabase (PostgREST) via `lib/supabase-server.ts`
- ✅ Validações Zod em `lib/validations.ts`

### Autenticação e acesso
- ✅ JWT HS256 em cookie `token` + proteção por `middleware.ts`
- ✅ Signup/Login por e-mail e senha
- ✅ Logout
- ✅ Cadastro/Login social com Google (OAuth manual)
- ✅ Tela e API de “Completar cadastro” pós OAuth

### Admin / staff
- ✅ Login staff com RBAC por role (`admin | support | finance`) + `ADMIN_ACCESS_CODE`
- ✅ Script `npm run bootstrap:admin` para criar/atualizar usuário staff

### Eventos
- ✅ CRUD de eventos via `/api/events` (tenant-aware, com fallback legado)
- ✅ Publicação via `/api/events/[id]/publish`
- ✅ Upsert simplificado do primeiro tipo de inscrição via `/api/events/[id]/inscription-types`

### Páginas públicas e carrinho
- ✅ Landing com slider + seção “Eventos em aberto” (endpoint público `/api/eventos`)
- ✅ Página pública do evento e fluxo de carrinho
- ✅ Checkout compatível com inscrições em lote (`/api/registrations`)
- ✅ Página de confirmação

### E-mail
- ✅ Integração Resend (`lib/email.ts`) e envio de confirmação de inscrição (best-effort)

### UX / build / deploy
- ✅ Fluxo Google OAuth mais robusto em produção (origem canônica via `APP_ORIGIN` + redirects padronizados)
- ✅ Correção de build do Next.js (wrappers com `Suspense` em rotas que usam `useSearchParams`)
- ✅ Simplificação do editor de imagem (remoção completa de “Remover fundo”)
- ✅ Campo de URL do avatar não exibe a URL salva (aplica somente via ação explícita do usuário)

---

## 🧩 Funcionalidades alvo (escopo completo)

1) Gestão de contas e autenticação
2) Criação/edição/publicação de eventos
3) Inscrição pública dinâmica
4) Inscrição em lote (carrinho) + checkout único
5) Pagamentos (ASAAS)
6) Vouchers + QR code
7) Check-in
8) Financeiro e relatórios
9) Suporte/tickets (em evolução)
10) Área staff/admin

---

## 🚀 Próximas entregas (prioridade alta)

### 1) Pagamentos ASAAS (core)
Critérios de aceite:
- Criar cobrança no ASAAS (PIX/cartão/boleto)
- Persistir `Payment` no banco com status
- Atualizar inscrição(s) quando webhook confirmar pagamento

### 2) Voucher + QR + envio por e-mail
Critérios de aceite:
- Ao marcar `paid`, gerar QR e “voucher” (HTML/PDF conforme decisão)
- Enviar e-mail com link ou anexo
- Reenvio de voucher no dashboard/admin

### 3) Check-in
Critérios de aceite:
- Scanner/validação por QR
- Bloquear duplicado (ou registrar tentativas)
- Auditoria (quando/quem validou)

### 4) Consolidar multi-tenant
Critérios de aceite:
- Migrations aplicadas (`Tenant`, `TenantMember`, `Event.tenantId`, `User.defaultTenantId`)
- Remover “fallback legado” gradualmente e padronizar RBAC

---

## 🧪 Qualidade / Operação

- `npm run build` deve permanecer verde (build já está passando)
- Criar smoke tests mínimos (manual ou automatizado) para:
  - login/signup/google
  - criar/publicar evento
  - inscrição batch + checkout

---

## 📝 Status rápido (checklist)

- [x] Auth (email/senha)
- [x] Auth Google + completar cadastro
- [x] Middleware proteção + RBAC staff
- [x] CRUD eventos + publicar
- [x] Endpoint público de eventos (landing)
- [x] Inscrição batch (API) + checkout compatível
- [x] Email Resend (confirmação de inscrição)
- [ ] Pagamentos ASAAS + webhooks
- [ ] Voucher/QR + envio após pagamento
- [ ] Check-in
- [ ] Financeiro/relatórios completos
