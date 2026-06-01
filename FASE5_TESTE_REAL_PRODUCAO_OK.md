# Fase 5 - Teste Real de Creditos em Producao

Data do teste: 2026-05-31

## Contexto

Teste real controlado realizado apos:

- migration de hold real aplicada manualmente no Supabase SQL Editor;
- validacao SQL das RPCs de credito concluida;
- deploy controlado da Edge Function `gerar-banners`;
- frontend local `127.0.0.1:5173` apontando para Supabase producao.

Nao houve alteracao de codigo durante este teste.
Nao houve novo deploy alem do deploy controlado ja aprovado da `gerar-banners`.
Nao houve nova migration aplicada durante este teste.

## Usuario testado

```text
email: riccieri68@gmail.com
user_id: 653b5a06-9b7a-4009-9a8c-6e3ea701460c
```

## Estado inicial

```text
plano inicial: starter
saldo inicial: 960 creditos
creditos_expiram_em: 2026-11-28 01:18:22+00
```

## Alteracao temporaria autorizada

Para validar o consumo real de creditos, o perfil foi temporariamente alterado:

```text
de: starter
para: pro
```

Somente o campo `plano` foi alterado.
O saldo nao foi alterado manualmente.
Stripe nao foi alterado.

## Geracao executada

```text
campanha: Venda Rapida
modo: Economica
geracao: uma unica geracao controlada
renders: 4/4
```

Materiais gerados com sucesso:

- Real Estate Banner
- New Listing Story
- SC_Reels_Moderno_01
- Real Estate Card

## Reserva criada

```text
reservation_id: c23bd2bb-52a2-4fc9-ae74-08d6a0ec1d86
amount: 95
status: consumed
generation_mode: economica
render_count: 4
hold_applied: true
hold_confirmed: true
```

Saldo registrado na reserva:

```text
saldo_antes_reserva: 960
saldo_apos_reserva: 865
saldo_resultante: 865
```

## Transacao criada

```text
transaction_id: 0c6569f2-0380-484f-8aa7-b09b7d27b5b4
tipo: consumo
creditos: -95
saldo_resultante: 865
observacao: Consumo de creditos na geracao visual
```

## Estado final

Depois da geracao, o plano foi restaurado:

```text
plano final: starter
saldo final: 865 creditos
creditos_expiram_em: 2026-11-28 01:18:22+00
```

## Fluxo validado

```text
saldo 960
  -> reserva 95 creditos
  -> saldo 865 no ato da reserva
  -> geracao visual concluida
  -> 4/4 renders criados
  -> consume_reserved_credits confirmou a reserva
  -> saldo permaneceu 865
```

## Conclusao

GO.

O consumo real de creditos server-side foi validado em producao:

- saldo foi reservado antes da geracao externa;
- os renders foram criados com sucesso;
- a reserva foi consumida;
- a transacao de consumo foi registrada;
- nao houve debito duplo;
- o plano temporario foi restaurado para `starter`.

## Observacao para fase futura

A UI ainda mostra alguns textos e saldos simulados/antigos durante o fluxo, incluindo referencias comerciais antigas em trechos da confirmacao visual.

Isso nao afetou o backend nem o debito real, mas precisa de correcao visual futura para alinhar a experiencia ao modelo oficial de creditos reais.
