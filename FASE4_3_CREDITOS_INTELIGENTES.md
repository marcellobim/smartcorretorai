# FASE 4.3 — Créditos Inteligentes Visuais

Data: 2026-05-31

## Objetivo

Implementar somente a experiência visual de créditos inteligentes na tela Nova Campanha, sem débito real e sem qualquer alteração de backend, Stripe, Supabase, migrations ou Edge Functions.

## Arquivos alterados

- `frontend/src/pages/NovaCampanha.jsx`
- `frontend/src/components/CreditSummary.jsx`

## O que foi implementado

### 1. Abas de uso dos créditos

A seção de campanhas agora possui dois modos visuais:

- 🚀 Campanhas Recomendadas
- 🎯 Monte Sua Campanha

As abas ficam dentro da área do Catálogo Premium Visual e controlam apenas a experiência de seleção no frontend.

### 2. Campanhas Recomendadas

Foram mantidos os 6 cards de campanhas:

- Venda Rápida
- Luxo Premium
- Lançamento
- Minha Casa Minha Vida
- Airbnb / Temporada
- Comercial

Cada card continua preenchendo internamente os formatos recomendados, preservando `selectedTemplates` como saída final para o fluxo atual.

Agora os cards também exibem:

- custo estimado em créditos
- saldo simulado atual
- saldo simulado após gerar
- entregáveis explicados de forma didática

### 3. Monte Sua Campanha

Foi adicionada a experiência manual para o corretor escolher exatamente os formatos desejados.

O modo manual permite:

- selecionar e desmarcar formatos individualmente
- selecionar grupos de formatos
- selecionar todos
- ver custo individual de cada formato
- recalcular consumo total em tempo real
- ver saldo simulado após geração
- receber aviso quando o saldo simulado fica insuficiente

Ao alterar manualmente os formatos, a campanha inteligente selecionada é limpa visualmente e `selectedTemplates` continua sendo derivado dos formatos selecionados.

### 4. Resumo de Créditos

O componente `CreditSummary` foi ajustado para reforçar:

- saldo atual
- custo estimado
- saldo após gerar
- aviso de saldo insuficiente
- sugestão de economia

Esse resumo continua visual e simulado. Nenhum crédito real é debitado nesta fase.

## Compatibilidade preservada

- `selectedTemplates` continua sendo a saída final.
- O payload de geração não foi alterado.
- A função `gerar-banners` não foi alterada.
- Nenhum termo técnico foi exposto ao cliente, como template_id, UUID, Creatomate, GPT ou OpenAI.

## O que não foi alterado

- Backend
- Stripe
- Supabase
- Migrations
- Edge Functions
- Débito real de créditos
- Checkout
- Deploy

## Build

Comando executado:

```bash
npm run build
```

Resultado:

- Build passou.
- Permanece apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.

## Riscos

- O saldo ainda é simulado e deve ser substituído por saldo real em fase futura.
- O bloqueio por saldo insuficiente ainda é apenas visual.
- A experiência manual aumenta a quantidade de informação na tela e pode precisar de refinamento mobile após validação visual.

## Próximo passo sugerido

Validar visualmente a Nova Campanha autenticada nos dois modos:

- Campanhas Recomendadas
- Monte Sua Campanha

Depois da validação, decidir se a Fase 4.4 deve conectar saldo real ou refinar UX mobile antes da integração com débito real.
