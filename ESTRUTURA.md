# CongregaPay — Estrutura do Projeto

Atualizado em: **05/02/2026**

Este documento descreve a **estrutura real** do repositório (não um “sonho ideal”), com um mapa rápido de **rotas**, **módulos**, **autenticação/RBAC**, e onde mexer para cada tipo de mudança.

---

## 📂 Estrutura (snapshot do repositório)

```
congregapay/
├── app/                       # Next.js App Router
│   ├── (auth)/                # Login/Signup + completar cadastro + admin login
│   ├── (dashboard)/           # Área autenticada (criador + staff)
│   ├── api/                   # API Routes (server)
│   ├── components/            # Componentes da landing (client)
│   ├── checkout/              # Checkout (lote/carrinho)
│   ├── confirmacao/           # Página final de confirmação
│   ├── evento/[slug]/         # Página pública do evento + carrinho
│   ├── inscricao/[slug]/      # Formulário público de inscrição
│   └── page.tsx               # Landing
│
├── components/ui/             # shadcn/ui (Button, Card, Input, etc.)
├── lib/                       # Auth/JWT, Supabase, validações, utilitários, Resend
├── store/                     # Zustand (carrinho)
├── scripts/                   # Bootstrap/admin utilities
├── supabase/                  # Supabase CLI (config/migrations)
├── supabase-schema.sql        # Schema SQL (referência/execução manual)
├── middleware.ts              # Proteção de rotas + RBAC admin via Edge
└── package.json
```

Observação: existe `components/ui` (design system) e `app/components` (componentes específicos da landing).

---

## 🧭 Rotas (páginas) — App Router

### Público
- `/` — landing (slider + seção “Eventos em aberto”)
- `/evento/[slug]` — página pública do evento
- `/evento/[slug]/carrinho` — revisão do carrinho do evento
- `/inscricao/[slug]` — formulário público de inscrição
- `/checkout` — checkout do carrinho (envia batch para API)
- `/confirmacao` — confirmação pós-checkout
- `/ajuda`, `/contato`, `/privacidade` — páginas institucionais

### Auth
- `/login` — login e-mail/senha + botão “Google”
- `/signup` — cadastro e-mail/senha + botão “Google”
- `/completar-cadastro` — coleta de dados obrigatórios pós OAuth

### Dashboard (protegido)
- `/dashboard` — página inicial do criador
- `/eventos` — lista de eventos
- `/eventos/novo` — criar evento
- `/eventos/[id]` — editar/detalhes

### Admin (protegido + RBAC)
- `/admin/login` — login staff (exige `ADMIN_ACCESS_CODE`)
- `/admin/*` — rotas staff (finance/support/tenants/tickets/users)

---

## 🔌 API Routes (server)

### Auth (plataforma)
- `GET /api/auth/google` — inicia OAuth (state em cookie)
- `GET /api/auth/google/callback` — callback OAuth, cria/login e seta cookie `token`
- `POST /api/auth/signup` — cadastro e-mail/senha
- `POST /api/auth/login` — login e-mail/senha
- `POST /api/auth/logout` — encerra sessão
- `GET /api/auth/me` — retorna usuário logado (via cookie JWT)
- `POST /api/auth/complete-signup` — completa dados obrigatórios pós OAuth

### Auth (admin/staff)
- `POST /api/admin/auth/login` — login staff (email/senha + `ADMIN_ACCESS_CODE`)

### Eventos (dashboard)
- `GET /api/events` — lista eventos do tenant (fallback legado por creatorId)
- `POST /api/events` — cria evento (gera slug único)
- `GET /api/events/[id]` — detalhes do evento + relações
- `PUT /api/events/[id]` — atualiza evento
- `DELETE /api/events/[id]` — deleta evento
- `POST /api/events/[id]/publish` — publica evento
- `POST /api/events/[id]/inscription-types` — upsert do primeiro tipo de inscrição (nome/valor/gratuito)

### Eventos (público)
- `GET /api/eventos?open=1&limit=12` — lista eventos publicados e futuros
- `GET /api/eventos/[slug]` — detalhes públicos de um evento por slug

### Inscrições
- `POST /api/registrations` — cria inscrição single ou lote (participants + quantity) e retorna `cartId`
- `GET /api/registrations?email=&eventId=` — lista inscrições (filtros)

### Suporte (em evolução)
- `GET/POST /api/support/tickets` — cria/lista tickets
- `GET/PUT/DELETE /api/support/tickets/[id]` — opera ticket

---

## 🔐 Autenticação, RBAC e multi-tenant (resumo)

### Sessão
- Cookie: `token` (JWT HS256)
- Proteção: `middleware.ts` verifica token e redireciona para `/login` ou `/admin/login`

### RBAC staff
- `role` do usuário controla acesso a `/admin/*`
- Roles staff: `admin | support | finance`
- Login admin exige também `ADMIN_ACCESS_CODE`

### Multi-tenant (em evolução)
- Conceito: usuário possui `defaultTenantId` e membership em `TenantMember`
- Endpoints de eventos já tentam usar `tenantId`, mas possuem **fallback legado** quando a migration ainda não existe

---

## 🔐 Variáveis de ambiente (referência)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Next
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Produção (recomendado para Google OAuth / redirects)
APP_ORIGIN="https://seu-dominio.com"

# JWT
JWT_SECRET="<string-longa-e-segura>"

# Email (Resend)
RESEND_API_KEY="re_<...>"
NEXT_PUBLIC_EMAIL_FROM="noreply@seu-dominio.com"

# Google OAuth
GOOGLE_CLIENT_ID="<...>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<...>"

# Admin
ADMIN_ACCESS_CODE="<codigo>"

# Plataforma / pagamentos (em evolução)
NEXT_PUBLIC_PLATFORM_FEE="0.10"
NEXT_PUBLIC_ASAAS_API_URL="https://api.asaas.com/v3"
ASAAS_API_KEY="sk_<...>"
```

---

## 🧰 Scripts

```bash
npm run dev
npm run build
npm run lint

# Criar/atualizar staff
npm run bootstrap:admin -- --email voce@dominio.com --password "SENHA_FORTE" --name "Admin" --role admin
```

---

## 🗺️ Onde mexer quando…

- Landing / seção “Eventos em aberto”: `app/page.tsx`, `app/components/OpenEventsSection.tsx`, `app/api/eventos/route.ts`
- Autenticação/JWT: `lib/auth.ts`, `middleware.ts`, `app/api/auth/*`
- Google OAuth: `app/api/auth/google/*`, `app/(auth)/completar-cadastro/page.tsx`, `app/(auth)/login/login-client.tsx`, `app/(auth)/signup/signup-client.tsx`
- CRUD de eventos: `app/api/events/*`, `app/(dashboard)/eventos/*`
- Carrinho/checkout: `store/cart.ts`, `app/checkout/page.tsx`, `app/confirmacao/page.tsx`
- E-mails: `lib/email.ts`, integrações nas rotas (ex.: `app/api/registrations/route.ts`)
- Upload/edição de mídia (avatar/banner): `lib/media-client.ts`, `lib/image-editor-client.ts`, `app/(dashboard)/perfil/page.tsx`, `app/(dashboard)/eventos/*`
