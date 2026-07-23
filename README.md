# PS CarStand — Backend

Implementação do backend descrito em `PS-CarStand-Arquitetura (2).md`. NestJS +
Postgres, multi-tenant: **DB Central** gerida por Prisma (`prisma/schema.prisma`
— people, stands, stand_members, refresh_tokens) e **1 schema Postgres por
stand** (`stand_<id>`) com as tabelas de negócio (vehicles, sales, ...),
provisionado dinamicamente e acedido via SQL direto (`src/tenant`), porque o
nome do schema só é conhecido em runtime — o Prisma não modela isso
estaticamente.

## Arranque local

```bash
npm install
cp .env.example .env   # preenche DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, ADMIN_API_KEY, ...
npx prisma migrate dev --name init   # cria as tabelas da DB Central
npm run start:dev
```

A API sobe em `http://localhost:3000`.

## Criar o primeiro stand (super-admin)

Não há UI de admin ainda — usa a rota protegida por `ADMIN_API_KEY`:

```bash
curl -X POST http://localhost:3000/admin/stands \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{
    "nome": "Auto Stand Silva",
    "plano": "mensal",
    "ownerNome": "José Silva",
    "ownerEmail": "owner@standsilva.pt",
    "ownerPassword": "uma-password-forte"
  }'
```

Isto cria o stand com `token_estado = 'pendente'`, provisiona o schema
`stand_<id>` (todas as tabelas da secção 12.2) e cria o primeiro owner. Depois
de confirmares o pagamento manualmente, ativa o token:

```bash
curl -X PATCH http://localhost:3000/admin/stands/<stand_id>/token \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{ "tokenEstado": "ativo", "tokenValidoAte": "2026-08-16" }'
```

A app cliente troca o `token` devolvido na criação por `stand_id` via
`POST /auth/validate-token`, e depois autentica com `POST /auth/login`.

## O que falta ligar antes de produção

- **Crawlers** (`src/crawlers/adapters/*`): orquestração, cache
  (`market_estimates`, TTL configurável) e resiliência (`Promise.allSettled`,
  secção 6.6) a funcionar, com 3 fontes reais e validadas contra os sites ao
  vivo: StandVirtual, OLX, CustoJusto. Auto SAPO e AutoUncle nunca chegaram a
  passar de stub e foram removidos (2026-07-23) — decisão de não continuar a
  expandir o número de fontes. PiscaPisca foi implementada e validada, mas
  removida na mesma data: o site passou a estar atrás de Cloudflare Bot
  Management, que bloqueia o handshake TLS de qualquer cliente Node.js
  (`fetch` e `https` nativos, testado e confirmado — não é um problema de
  headers/user-agent), enquanto `curl` da mesma máquina passa sem problema.
  Corrigir isso exigiria um browser headless (Playwright) só para esta fonte;
  decidido não vale a pena para já.
- **PDF do Registo de Compra** (`src/documents/registo-compra.template.ts`):
  gera um PDF próprio com todos os campos exigidos (Q1/Q3/Q4/Q7/Q9), não o
  formulário oficial do IRN escaneado — esse asset não estava disponível.
  Troca por overlay sobre o PDF oficial quando o tiveres.
- **Supabase Storage**: sem `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
  configurados, `StorageService` grava em `./storage` local (servido em
  `/storage/*`) — suficiente para correr tudo localmente já.
- **Convite de equipa** (`POST /team/invite`): sem envio de email configurado,
  devolve uma `tempPassword` gerada para a pessoa nova — o owner partilha-a
  manualmente por agora.
