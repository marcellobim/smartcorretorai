# Fase 5 - Validacao SQL em Producao

Data da validacao: 2026-05-31

## Contexto

A migration de hold real de creditos foi aplicada manualmente no Supabase SQL Editor para validar a infraestrutura de consumo server-side antes de qualquer deploy da Edge Function.

Objetivo validado:

- `reserve_credits` deve segurar/descontar o saldo no momento da reserva.
- `consume_reserved_credits` deve apenas confirmar a reserva e registrar o consumo, sem descontar novamente.
- `cancel_credit_reservation` deve devolver saldo quando a reserva ainda estiver em `reserved`.
- O fluxo deve ser idempotente e impedir debito duplicado.

## SQL aplicado manualmente

Foram aplicadas redefinicoes das funcoes:

- `reserve_credits`
- `consume_reserved_credits`
- `cancel_credit_reservation`

Depois da primeira aplicacao, foram aplicados patches manuais adicionais para corrigir ambiguidades causadas pelos nomes das colunas de retorno do `RETURNS TABLE`.

### Patch de ambiguidades por coluna `id`

As referencias abaixo foram qualificadas com alias:

```sql
FROM public.profiles p
WHERE p.id = p_user_id
```

```sql
UPDATE public.profiles p
SET saldo_creditos = ...
WHERE p.id = p_user_id
```

```sql
UPDATE public.credit_reservations AS cr
SET ...
WHERE cr.id = v_reservation.id
```

Tambem foram qualificados campos de `credit_reservations` usados no `SET`:

```sql
metadata = COALESCE(cr.metadata, '{}'::jsonb)
```

```sql
reason = COALESCE(p_reason, cr.reason)
```

### Patch de `RETURNING id`

O `INSERT` em `credit_transactions` foi ajustado para usar alias:

```sql
INSERT INTO public.credit_transactions AS ct (
  user_id,
  tipo,
  creditos,
  saldo_resultante,
  observacao,
  metadata
)
VALUES (
  p_user_id,
  'consumo',
  -v_reservation.amount,
  COALESCE(v_balance, 0),
  p_observacao,
  COALESCE(p_metadata, '{}'::jsonb)
    || COALESCE(v_reservation.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'reservation_id', v_reservation.id,
      'idempotency_key', v_reservation.idempotency_key,
      'hold_confirmed', true
    )
)
RETURNING ct.id INTO v_transaction_id;
```

## Erros encontrados

### Erro 1 - Ambiguidade em `reserve_credits`

Erro retornado:

```text
ERROR: 42702: column reference "id" is ambiguous
DETAIL: It could refer to either a PL/pgSQL variable or a table column.
```

Trecho com problema:

```sql
SELECT *
FROM public.profiles
WHERE id = p_user_id
FOR UPDATE
```

Causa:

Como as funcoes retornam `RETURNS TABLE (id uuid, ...)`, `id` tambem existe como variavel de saida dentro do PL/pgSQL. Por isso, referencias sem alias a `id` ficam ambiguas.

Correcao:

```sql
FROM public.profiles p
WHERE p.id = p_user_id
```

### Erro 2 - Ambiguidade em `consume_reserved_credits`

Erro retornado:

```text
ERROR: 42702: column reference "id" is ambiguous
```

Trecho com problema:

```sql
INSERT INTO public.credit_transactions (...)
RETURNING id INTO v_transaction_id;
```

Causa:

`id` conflitou com a coluna de saida `id` do `RETURNS TABLE`.

Correcao:

```sql
INSERT INTO public.credit_transactions AS ct (...)
RETURNING ct.id INTO v_transaction_id;
```

## Testes executados

### 1. Adicionar creditos

Funcao testada:

```sql
public.add_credits
```

Resultado:

- Funcionou.
- Saldo inicial apos credito: `1000`.

### 2. Reservar creditos

Funcao testada:

```sql
public.reserve_credits
```

Reserva testada:

```text
idempotency_key: teste-hold-real-001
amount: 40
```

Resultado:

- Reserva criada com sucesso.
- Saldo caiu de `1000` para `960` no ato da reserva.
- Hold real confirmado.

### 3. Consumir reserva

Funcao testada:

```sql
public.consume_reserved_credits
```

Reserva consumida:

```text
idempotency_key: teste-hold-real-001
```

Resultado:

- Reserva confirmada com sucesso.
- Status final da reserva: `consumed`.
- Saldo permaneceu `960`.
- Nao houve segundo desconto.

## Resultado final

- Saldo final: `960`.
- Reserva `teste-hold-real-001`: `consumed`.
- Ausencia de debito duplo: confirmada.
- Hold real em `reserve_credits`: confirmado.
- Confirmacao sem novo desconto em `consume_reserved_credits`: confirmada.

## Arquivo local sincronizado

O arquivo local abaixo foi atualizado para refletir os patches manuais aplicados no remoto:

```text
supabase/migrations/20260531203000_fix_credit_reservations_hold.sql
```

## Observacoes

- Nenhum deploy foi realizado.
- Nenhuma nova migration foi aplicada por CLI.
- Stripe nao foi alterado.
- Frontend e Edge Function nao foram alterados nesta etapa.
- A validacao SQL deixa o banco pronto para a proxima etapa controlada: deploy e teste remoto da Edge Function `gerar-banners`, quando aprovado.
