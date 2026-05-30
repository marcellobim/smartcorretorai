# FASE2_CREDITOS_BACKEND.md

## Escopo

Fase 2 criada apenas como infraestrutura de banco Supabase.

Nao foi aplicado em producao.
Nao foi executado `supabase db push`.
Nao houve deploy de Edge Function.
Nao houve alteracao de frontend, `NovaCampanha.jsx`, Stripe, Dashboard ou Planos.

## Migration Criada

Arquivo:

```txt
supabase/migrations/20260530233000_v2_credit_backend.sql
```

## SQL Revisavel

A migration contem:

### Alteracao em `profiles`

Adiciona:

```sql
saldo_creditos bigint not null default 0
creditos_expiram_em timestamptz
```

### Tabela `credit_transactions`

Campos:

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete set null
tipo text not null
creditos bigint not null
saldo_resultante bigint not null
observacao text
metadata jsonb not null default '{}'
created_at timestamptz not null default now()
```

Tipos permitidos:

```txt
assinatura
recarga
consumo
ajuste_admin
expiracao
```

Indices:

- `idx_credit_transactions_user_id`
- `idx_credit_transactions_created_at`
- `idx_credit_transactions_tipo`

### Tabela `credit_reservations`

Campos:

```sql
id uuid primary key default gen_random_uuid()
user_id uuid references auth.users(id) on delete cascade not null
campaign_id uuid null
idempotency_key text not null
amount bigint not null check (amount > 0)
status text not null
reason text
metadata jsonb not null default '{}'
created_at timestamptz not null default now()
consumed_at timestamptz null
cancelled_at timestamptz null
```

Status permitidos:

```txt
reserved
consumed
cancelled
```

Indice unico:

```sql
user_id + idempotency_key
```

Indices auxiliares:

- `idx_credit_reservations_user_id`
- `idx_credit_reservations_status`

## RPCs Criadas

### `add_credits`

Assinatura:

```sql
add_credits(
  p_user_id uuid,
  p_amount bigint,
  p_tipo text default 'ajuste_admin',
  p_observacao text default null,
  p_metadata jsonb default '{}',
  p_expires_at timestamptz default null
)
```

Regras:

- aceita apenas `assinatura`, `recarga` e `ajuste_admin`
- bloqueia valor menor ou igual a zero
- bloqueia usuario inexistente
- se saldo anterior estiver expirado, zera antes de adicionar
- registra expiracao quando necessario
- registra transacao positiva
- recarga sem `p_expires_at` recebe validade padrao de 180 dias
- assinatura sem `p_expires_at` recebe validade padrao de 30 dias
- permite validade parametrizada via `p_expires_at`

### `get_credit_balance`

Assinatura:

```sql
get_credit_balance(p_user_id uuid)
```

Regras:

- retorna saldo real se ainda valido
- retorna `0` se `creditos_expiram_em < now()`
- retorna flag `expirado`

### `consume_credits`

Assinatura:

```sql
consume_credits(
  p_user_id uuid,
  p_amount bigint,
  p_observacao text default null,
  p_metadata jsonb default '{}'
)
```

Regras:

- transacional por lock `FOR UPDATE` em `profiles`
- bloqueia valor menor ou igual a zero
- se saldo expirou, zera antes do consumo
- bloqueia saldo insuficiente
- nao permite saldo negativo
- registra transacao negativa tipo `consumo`

### `reserve_credits`

Assinatura:

```sql
reserve_credits(
  p_user_id uuid,
  p_amount bigint,
  p_idempotency_key text,
  p_campaign_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'
)
```

Regras:

- nao debita saldo
- verifica saldo disponivel
- cria reserva `reserved`
- se a mesma `user_id + idempotency_key` ja existir, retorna a reserva existente
- prepara idempotencia para clique duplo/retry

### `consume_reserved_credits`

Assinatura:

```sql
consume_reserved_credits(
  p_user_id uuid,
  p_idempotency_key text,
  p_observacao text default null,
  p_metadata jsonb default '{}'
)
```

Regras:

- busca reserva com `FOR UPDATE`
- se ja estiver `consumed`, retorna sem debitar novamente
- se estiver `cancelled`, bloqueia
- se estiver `reserved`, chama `consume_credits`
- marca reserva como `consumed`
- grava `consumed_at`
- adiciona `reservation_id`, `idempotency_key`, `saldo_resultante` e `transaction_id` em metadata

### `cancel_credit_reservation`

Assinatura:

```sql
cancel_credit_reservation(
  p_user_id uuid,
  p_idempotency_key text,
  p_reason text default null
)
```

Regras:

- se reserva estiver `reserved`, marca `cancelled`
- se ja estiver `consumed`, nao cancela
- se ja estiver `cancelled`, retorna estado atual

## RLS E Permissoes

RLS habilitado em:

- `credit_transactions`
- `credit_reservations`

Policies de leitura:

- usuario autenticado pode ver suas proprias transacoes
- usuario autenticado pode ver suas proprias reservas

Permissoes:

- `get_credit_balance` liberada para `authenticated` e `service_role`
- RPCs de escrita liberadas apenas para `service_role`

Motivo:

- frontend ainda nao deve adicionar, consumir ou reservar creditos diretamente
- debito real sera conectado depois via Edge Function

## Testes SQL Sugeridos

Executar somente apos aprovacao explicita para aplicar a migration.

### 1. Selecionar usuario real

```sql
select id, email
from auth.users
where email = 'bbqbim@gmail.com';
```

### 2. Consultar saldo inicial

```sql
select *
from get_credit_balance('<USER_ID_AQUI>'::uuid);
```

### 3. Adicionar creditos de assinatura

```sql
select *
from add_credits(
  '<USER_ID_AQUI>'::uuid,
  1000,
  'assinatura',
  'Teste assinatura START',
  '{"plan":"START"}'::jsonb,
  now() + interval '30 days'
);
```

### 4. Adicionar recarga avulsa com validade padrao 180 dias

```sql
select *
from add_credits(
  '<USER_ID_AQUI>'::uuid,
  500,
  'recarga',
  'Teste recarga 500',
  '{"recharge":"500"}'::jsonb,
  null
);
```

### 5. Confirmar saldo

```sql
select *
from get_credit_balance('<USER_ID_AQUI>'::uuid);
```

### 6. Consumir creditos diretamente

```sql
select *
from consume_credits(
  '<USER_ID_AQUI>'::uuid,
  40,
  'Teste consumo direto',
  '{"generation_mode":"economica"}'::jsonb
);
```

### 7. Criar reserva

```sql
select *
from reserve_credits(
  '<USER_ID_AQUI>'::uuid,
  40,
  'teste-idempotencia-001',
  null,
  'Reserva teste economica',
  '{"generation_mode":"economica"}'::jsonb
);
```

### 8. Consumir reserva

```sql
select *
from consume_reserved_credits(
  '<USER_ID_AQUI>'::uuid,
  'teste-idempotencia-001',
  'Consumo reserva teste',
  '{"source":"sql_editor"}'::jsonb
);
```

### 9. Repetir consumo da mesma reserva

Esperado: nao debitar novamente.

```sql
select *
from consume_reserved_credits(
  '<USER_ID_AQUI>'::uuid,
  'teste-idempotencia-001',
  'Consumo duplicado teste',
  '{"source":"sql_editor_retry"}'::jsonb
);
```

### 10. Testar saldo insuficiente

Esperado: erro `Creditos insuficientes para esta geracao.`

```sql
select *
from reserve_credits(
  '<USER_ID_AQUI>'::uuid,
  999999999,
  'teste-saldo-insuficiente-001',
  null,
  'Reserva maior que saldo',
  '{}'::jsonb
);
```

### 11. Cancelar reserva

```sql
select *
from reserve_credits(
  '<USER_ID_AQUI>'::uuid,
  40,
  'teste-cancelamento-001',
  null,
  'Reserva para cancelamento',
  '{}'::jsonb
);

select *
from cancel_credit_reservation(
  '<USER_ID_AQUI>'::uuid,
  'teste-cancelamento-001',
  'Cancelamento antes da geracao'
);
```

### 12. Auditar transacoes e reservas

```sql
select *
from credit_transactions
where user_id = '<USER_ID_AQUI>'::uuid
order by created_at desc;

select *
from credit_reservations
where user_id = '<USER_ID_AQUI>'::uuid
order by created_at desc;
```

## Build

Nao executado nesta fase.

Justificativa:

- a Fase 2 alterou apenas SQL/migration
- nenhum arquivo frontend foi modificado
- nenhuma importacao JavaScript nova foi adicionada

O ultimo build da Fase 1 ja havia passado.

## Arquivos Criados Nesta Fase

- `supabase/migrations/20260530233000_v2_credit_backend.sql`
- `FASE2_CREDITOS_BACKEND.md`

## Fora De Escopo

Nao foi feito:

- aplicacao da migration em producao
- `supabase db push`
- deploy de Edge Function
- alteracao em `gerar-banners`
- alteracao em frontend
- integracao com Stripe
- debito real no fluxo de geracao
- alteracao em `NovaCampanha.jsx`

## Proxima Etapa Recomendada

Antes de aplicar:

1. Revisar o SQL da migration.
2. Confirmar que `profiles.id` corresponde ao `auth.users.id` no ambiente atual.
3. Aprovar aplicacao da migration.

Depois da aprovacao:

1. Aplicar migration no Supabase.
2. Rodar os testes SQL sugeridos.
3. Validar saldo, transacoes, reservas e idempotencia.
