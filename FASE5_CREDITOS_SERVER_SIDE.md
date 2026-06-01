# FASE 5 — Consumo Real de Créditos Server-Side

Data: 2026-05-31

Checkpoint anterior:

- `backup-fase4-3-creditos-inteligentes-visuais`
- commit `0ad606f67cd2c907bfe17a9b0a3bc46b9e34ac64`

## Objetivo

Conectar o fluxo visual da Nova Campanha ao consumo real de créditos no backend, mantendo o modelo:

- Campanhas Recomendadas
- Monte Sua Campanha
- `selectedTemplates` como contrato final

## Arquivos alterados

- `frontend/src/pages/NovaCampanha.jsx`
- `frontend/src/components/CreditSummary.jsx`
- `supabase/functions/gerar-banners/index.ts`

## Arquivos criados

- `FASE5_CREDITOS_SERVER_SIDE.md`
- `screenshots/fase-creditos-server-side-recomendadas.png`
- `screenshots/fase-creditos-server-side-manual.png`

## Implementação frontend

A tela Nova Campanha agora envia para `gerar-banners`:

- `credit_cost`
- `generation_mode`
- `video_ia_premium`
- `idempotency_key`

Regras aplicadas:

- Plano demonstrativo envia `generation_mode = demonstrativo` e `credit_cost = 0`.
- Usuários pagos enviam o custo estimado com base nos formatos selecionados.
- `idempotency_key` é gerado por tentativa de geração.
- `selectedTemplates` continua sendo enviado sem alteração de contrato.

## Implementação backend

A Edge Function `gerar-banners` agora:

1. Valida JWT normalmente.
2. Continua ignorando `user_id` do body.
3. Recebe o payload de créditos.
4. Recalcula o custo real no servidor a partir de `selectedTemplates`.
5. Usa o maior valor entre:
   - custo enviado pelo frontend
   - custo calculado no servidor
6. Reserva créditos com `reserve_credits` antes de iniciar custos externos.
7. Cancela reserva se houver erro antes do render.
8. Consome reserva com `consume_reserved_credits` após render criado com sucesso.
9. Retorna resposta idempotente se a mesma `idempotency_key` já tiver sido consumida.

## Proteções adicionadas

- Backend não confia apenas no `credit_cost` do frontend.
- Custo é recalculado pelos templates selecionados.
- `idempotency_key` é obrigatório quando há custo.
- Retry/clique duplo com chave já consumida não debita novamente.
- Erros antes do render tentam cancelar a reserva.
- Se nenhum render for criado, a reserva é cancelada.

## O que não foi alterado

- Stripe
- Checkout
- Banco/migrations
- Templates Creatomate
- `selectedTemplates`
- `gerar-campanha`
- Deploy

## Validação executada

### Build

Comando:

```bash
npm run build
```

Resultado:

- Build passou.
- Permanece apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.

### Validação visual

Foram capturados screenshots:

- `screenshots/fase-creditos-server-side-recomendadas.png`
- `screenshots/fase-creditos-server-side-manual.png`

Observação:

O usuário autenticado local está no plano demonstrativo. Por isso, a tela não exibiu o resumo global de créditos de usuário pago nessa sessão. A estrutura visual de Campanhas Recomendadas e Monte Sua Campanha continuou renderizando.

### Validação Edge Function

Não foi possível rodar `deno check` localmente porque `deno` não está instalado no ambiente.

A validação feita nesta etapa foi:

- revisão estática do fluxo
- build frontend
- conferência de payload e resposta
- nenhuma chamada real à Edge Function remota

## Dependência operacional

Para consumo real funcionar em produção/remoto, é necessário que a migration de créditos já exista no banco remoto:

- `supabase/migrations/20260530233000_v2_credit_backend.sql`

Sem essa migration aplicada, `gerar-banners` retornará erro ao chamar:

- `reserve_credits`
- `consume_reserved_credits`
- `cancel_credit_reservation`

## Riscos

- O frontend ainda exibe saldo visual/simulado em algumas áreas.
- O plano demonstrativo ainda depende de controle visual/local para uso único.
- A Edge Function precisa ser deployada e testada remotamente antes de considerar a fase operacional.
- Como `gerar-campanha` e `gerar-banners` continuam em paralelo, textos podem ser gerados mesmo se banners forem bloqueados por saldo insuficiente. Isso respeita a regra de textos IA gratuitos.

## Próximo passo recomendado

1. Aplicar a migration de créditos no Supabase, se ainda não estiver aplicada.
2. Deploy controlado somente de `gerar-banners`.
3. Testar com usuário pago com saldo suficiente.
4. Testar idempotência repetindo a mesma chave.
5. Testar saldo insuficiente.
6. Só depois atualizar a UI para saldo real, caso ainda esteja usando saldo simulado.
