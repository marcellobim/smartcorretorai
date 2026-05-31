# Ajuste Landing Pre-Fase 4

## Objetivo

Realizar ajustes minimos de copy e link na LandingPage antes da Fase 4, sem alterar backend, geracao, APIs, migration, Stripe, NovaCampanha ou pagina `/planos`.

## Arquivos alterados

- `frontend/src/pages/LandingPage.jsx`
- `AJUSTE_LANDING_PRE_FASE4.md`

## Ajustes realizados

### Hero

Mantido:

- `✨ Inteligência Artificial Multimodelo`

Substituido:

- `Marketing imobiliário completo em segundos`

Por:

- `Marketing imobiliário em segundos`

Descricao do hero substituida por:

```text
Crie campanhas imobiliárias profissionais em minutos.
Escolha os formatos que deseja e utilize seus créditos de forma inteligente.
Sem designer. Sem esforço.
```

### Planos e Precos

A secao existente foi mantida com:

- chamada `Planos e Preços`;
- titulo `Simples, sem surpresas`;
- descricao atual mantida.

Os cards/tabela de precos da Home foram removidos visualmente.

O array local antigo de planos da Landing tambem foi removido por nao ser mais usado nessa tela.

Foi adicionada uma chamada unica clicavel para:

`/planos`

Texto do botao:

`Ver planos e créditos`

## Build

Comando executado:

```bash
npm run build
```

Resultado: passou.

Observacao: Vite exibiu apenas o aviso conhecido de chunk maior que 500 kB apos minificacao.

## Nao alterado

- Backend.
- Stripe.
- Geracao.
- APIs.
- `NovaCampanha.jsx`.
- Migration.
- Deploy.
- Pagina `/planos`.
- Fase 4.
