# FASE 5 — Correção Técnica do Consumo Server-Side

Data: 2026-05-31

## Objetivo

Corrigir os riscos críticos identificados na auditoria da Fase 5 antes de qualquer deploy:

- bloqueio server-side do plano demonstrativo;
- reserva real de saldo para evitar corrida em cliques simultâneos;
- preservação da cobrança por soma de templates selecionados;
- manutenção de `selectedTemplates` como contrato principal.

## Arquivos alterados

- `supabase/functions/gerar-banners/index.ts`

## Arquivos criados

- `supabase/migrations/20260531203000_fix_credit_reservations_hold.sql`
- `FASE5_CREDITOS_SERVER_SIDE_CORRECAO.md`

## Migration corretiva criada

Arquivo:

```text
supabase/migrations/20260531203000_fix_credit_reservations_hold.sql
```

A migration antiga não foi alterada.

### RPCs substituídas

- `reserve_credits`
- `consume_reserved_credits`
- `cancel_credit_reservation`

### Nova regra de reserva

`reserve_credits` agora:

- valida usuário, valor e `idempotency_key`;
- consulta reserva existente com lock;
- bloqueia a linha de `profiles` com `FOR UPDATE`;
- reconsulta a reserva após lock para serializar cliques simultâneos;
- trata créditos expirados;
- valida saldo;
- desconta/segura saldo imediatamente;
- cria reserva `reserved` com metadata de hold.

### Nova regra de consumo

`consume_reserved_credits` agora:

- não desconta novamente o saldo;
- registra transação `consumo`;
- marca a reserva como `consumed`;
- grava `transaction_id`, saldo resultante e metadata.

### Nova regra de cancelamento

`cancel_credit_reservation` agora:

- se a reserva ainda estiver `reserved`, bloqueia o profile;
- devolve o saldo reservado;
- marca a reserva como `cancelled`;
- registra metadata de devolução.

## Correção em gerar-banners

Arquivo:

```text
supabase/functions/gerar-banners/index.ts
```

### Bloqueio demonstrativo server-side

Foi adicionada a lista fixa de templates demonstrativos:

```text
7ab695ae-e12b-4322-87dc-eb085760dd01
ad9f8382-ea38-4ef6-84cc-049f1b289345
96a25196-5a64-4f65-9b3e-c9c8b0d871f2
```

Regras aplicadas antes de reserva, OpenAI ou Creatomate:

- usuário `starter` só pode usar `generation_mode = demonstrativo`;
- usuário `starter` em modo demonstrativo só pode usar exatamente os 3 templates demonstrativos;
- qualquer template fora da lista é bloqueado;
- qualquer tentativa starter fora do modo demonstrativo é bloqueada.

## O que foi preservado

- Stripe não foi alterado.
- Preços não foram alterados.
- Modelo comercial não foi alterado.
- Templates Creatomate não foram alterados.
- `selectedTemplates` continua sendo o contrato principal.
- `gerar-campanha` não foi alterada.
- Textos IA continuam gratuitos.
- Não houve deploy.
- A migration foi criada, mas não aplicada.

## Validações executadas

### Build frontend

Comando:

```bash
npm run build
```

Resultado:

- Build passou.
- Permanece apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.

### Git diff check

Comando:

```bash
git diff --check
```

Resultado:

- Sem erros.
- Apenas aviso de conversão LF/CRLF no Windows.

### Deno check

Comando tentado:

```bash
deno check supabase/functions/gerar-banners/index.ts
```

Resultado:

- Não executado porque `deno` não está instalado no ambiente local.

## Riscos restantes

1. A migration corretiva ainda precisa ser revisada e aplicada no Supabase antes do deploy da Edge Function.
2. A Edge Function ainda precisa de validação Deno em ambiente com Deno disponível.
3. Após aplicar a migration e fazer deploy controlado, é necessário testar:
   - saldo suficiente;
   - saldo insuficiente;
   - clique duplo com mesma `idempotency_key`;
   - reservas simultâneas com chaves diferentes;
   - cancelamento antes de render;
   - confirmação após render criado.

## Próximo passo recomendado

Revisar este patch. Se aprovado:

1. aplicar a migration corretiva no Supabase;
2. rodar testes SQL das RPCs;
3. fazer deploy controlado somente de `gerar-banners`;
4. executar teste real remoto com usuário controlado.
