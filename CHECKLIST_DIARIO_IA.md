# 📋 CongregaPay — Checklist Diário do Agente de IA

Atualizado em: **05/02/2026**

Objetivo: manter um “briefing operacional” do projeto para qualquer agente (ou dev) entrar no repositório e entender rapidamente **o que existe**, **como está amarrado** e **o que fazer a seguir**.

---

## 🎯 Resumo Executivo

**CongregaPay** é uma plataforma SaaS de **gestão de eventos (multi-tenant em evolução)** com:
- criação/publicação de eventos
- tipos de inscrição
- inscrições (individual e em lote via carrinho/checkout)
- autenticação por JWT (cookie httpOnly)
- área do criador (dashboard) + área staff (admin)
- envio de e-mails via Resend

Modelo de negócio (alvo): **taxa da plataforma (ex.: 10%)**.

---

## 🧠 Leitura obrigatória (2 min)

1) `ESTRUTURA.md` — mapa real do projeto, rotas e módulos
2) `PLANEJAMENTO.md` — roadmap e prioridades
3) Este arquivo — checklist “dia a dia”

---

## ✅ Estado atual (o que já está implementado)

### Autenticação e acesso
- ✅ Auth por **JWT HS256** em cookie `token` (proteção via middleware Edge)
- ✅ Login/Cadastro por e-mail e senha
- ✅ **Cadastro/Login social com Google** (OAuth manual) + tela de **Completar Cadastro**
- ✅ Rotas staff `/admin/*` com **RBAC por role** e código adicional `ADMIN_ACCESS_CODE`

### Eventos e inscrições
- ✅ CRUD de eventos (API `/api/events`) com suporte **tenant-aware** (e fallback legado)
- ✅ Publicação de evento (API `/api/events/[id]/publish`)
- ✅ Upsert simplificado do primeiro tipo de inscrição por evento (API `/api/events/[id]/inscription-types`)
- ✅ Inscrições **single e batch** em `/api/registrations` (gera `cartId` quando lote)

### Carrinho/checkout e páginas públicas
- ✅ Store de carrinho (Zustand) em `store/cart.ts`
- ✅ Páginas: `/evento/[slug]`, `/inscricao/[slug]`, `/checkout`, `/confirmacao`
- ✅ Landing com slider + seção **“Eventos em aberto”** consumindo `/api/eventos?open=1`

### Email
- ✅ Cliente Resend + templates em `lib/email.ts`
- ✅ Confirmação de inscrição enviada em `/api/registrations`

---

## 🔐 Variáveis de ambiente (guia rápido)

Arquivo alvo: `.env.local` (não versionar)

### Obrigatórias para rodar o core
```env
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
JWT_SECRET="<string-longa-e-segura>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Produção (recomendado para OAuth/redirects consistentes)
APP_ORIGIN="https://seu-dominio.com"
```

### Email (Resend)
```env
RESEND_API_KEY="re_<...>"
NEXT_PUBLIC_EMAIL_FROM="noreply@seu-dominio.com"
```

### Google OAuth (cadastro social)
```env
GOOGLE_CLIENT_ID="<...>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<...>"
```

Redirect URIs (Google Cloud Console):
- `http://localhost:3000/api/auth/google/callback`
- `https://SEU-DOMINIO/api/auth/google/callback`

Em produção, configure `APP_ORIGIN` no Vercel com o domínio canônico (ex.: `https://congregapay.com.br`).

### Admin (staff)
```env
ADMIN_ACCESS_CODE="<codigo-curto-ou-longo>"
```

### Pagamentos (em evolução)
```env
NEXT_PUBLIC_ASAAS_API_URL="https://api.asaas.com/v3"
ASAAS_API_KEY="sk_<...>"
NEXT_PUBLIC_PLATFORM_FEE="0.10"
```

---

## 🗓️ Rotina diária do agente (10–15 min)

1) **Checar mudanças recentes**
   - `git status` / `git diff` (se aplicável)

2) **Sanidade de ambiente**
   - confirmar `.env.local` com variáveis críticas (Supabase, JWT, Admin, Google, Resend)

3) **Build de segurança**
   - `npm run build`

4) **Fluxos manuais críticos (smoke test)**
   - Landing abre e lista “Eventos em aberto”
   - Login e Signup (e-mail/senha)
   - Login com Google → se faltar dados → `/completar-cadastro` → `/dashboard`
   - Criar evento no dashboard → publicar → abrir página pública → inscrição → checkout → confirmação

5) **Banco / migrações**
   - se houver mudanças de schema, alinhar `supabase/migrations` e/ou `supabase-schema.sql`

---

## 🧰 Comandos úteis

```bash
npm run dev
npm run build
npm run lint

# Criar/atualizar um usuário staff (admin/support/finance)
npm run bootstrap:admin -- --email voce@dominio.com --password "SENHA_FORTE" --name "Admin" --role admin
```

---

## 🧭 O que não quebrar (contratos importantes)

- Cookie `token` é a “fonte de verdade” da sessão (middleware protege rotas)
- `/api/registrations` aceita **batch** (participants + quantity) e retorna `registrations[]` + `cartId`
- `/api/eventos` é endpoint **público** para landing (deve ser estável e performático)
- `/admin/*` exige role staff **e** `ADMIN_ACCESS_CODE`

---

## 🎯 Próximas prioridades (roadmap curto)

1) Pagamentos ASAAS (criar cobrança, salvar Payment, webhook)
2) Voucher/QR + envio por e-mail após pagamento confirmado
3) Check-in (validação QR e auditoria)
4) Consolidar multi-tenant (migrations + regras consistentes em toda API)
- [ ] RegistrationTable
- [ ] FinancialDashboard
- [ ] CheckinReader
- [ ] TicketTemplate

### Public
- [ ] EventCard
- [ ] CartSummary
- [ ] PaymentMethods
- [ ] RegistrationForm

### Shared
- [ ] QRCodeDisplay
- [ ] Stepper (indicador de passos)
- [ ] Loading, Error

---

## 🐛 Problemas Conhecidos

| Problema | Status | Solução |
|----------|--------|---------|
| Schema não executado no Supabase | ⏳ Pendente | Rodar `supabase-schema.sql` no SQL Editor |
| Env vars do Supabase faltando | ⏳ Pendente | Configurar `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` |
| npm install falhou antes | ✅ Resolvido | Dependências já instaladas |
| Google OAuth falha em produção (redirect/origem) | ⏳ Atenção | Conferir `APP_ORIGIN` no Vercel e Redirect URI no Google Cloud (`/api/auth/google/callback`) |

---

## 📞 Instruções para o Agente de IA (Amanhã)

1. **Verificar status:** `npm list --depth=0`
2. **Criar schema no Supabase:** executar `supabase-schema.sql` no SQL Editor
3. **Iniciar dev:** `npm run dev`
4. **Validar smoke tests:** Google OAuth, criar/publicar evento, upload/edição de avatar e banner
5. **Próximo foco:** Pagamentos ASAAS + webhooks

---

## 🎓 Conhecimento Necessário

- Next.js 14 (App Router)
- React Hooks
- TypeScript
- TailwindCSS
- Supabase (PostgREST / supabase-js)
- React Hook Form
- Zod validation
- ASAAS API (pagamentos)
- JWT (autenticação)
- PostgreSQL básico

---

## 📚 Links Úteis

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [TailwindCSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [ASAAS API](https://asaas.com/api)
- [Resend Docs](https://resend.com/docs)

---

## ✨ Última Atualização

- **Data:** 5 de fevereiro de 2026
- **Status:** ✅ Build verde e deploy acionado por push
- **Auth Google:** origem canônica via `APP_ORIGIN` + redirects de erro para `/login?error=...` + cookies mais compatíveis (SameSite Lax)
- **Next.js build:** `useSearchParams` isolado em componentes client com wrappers `Suspense` (login/signup)
- **Mídia:** removida a feature de “Remover fundo” do editor (UI e core) e o input de URL do avatar não exibe URL salva (só aplica ao clicar “Usar URL”)

---

## 📝 Notas Importantes

1. **Desenvolvimento local:** Usar Supabase PostgreSQL (ou Postgres compatível) via `.env.local`
2. **Usuário preferiu:** Implementação ágil, começar logo
3. **Padrão de código:** TypeScript rigoroso + Zod validation
4. **Componentes:** Usar shadcn/ui para consistência
5. **Mobile:** Sempre testar em mobile-first

---

**FIM DO CHECKLIST DIÁRIO**

Próxima sessão: Configure PostgreSQL e continue com autenticação! 🚀
