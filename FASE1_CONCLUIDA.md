# FASE1_CONCLUIDA.md

## Escopo

Fase 1 concluida apenas com dados puros.

Nao houve integracao com interface, backend, banco, Stripe, Dashboard, Planos ou `NovaCampanha.jsx`.

## Arquivos Criados

1. `frontend/src/data/creditCosts.js`
2. `frontend/src/data/campaignModes.js`
3. `frontend/src/data/campaignTemplates.js`
4. `frontend/src/data/templateCatalog.js`

## Estrutura Dos Arquivos

### `creditCosts.js`

Contem:

- `CREDIT_COSTS`
  - custo de textos IA: `0`
  - pacotes:
    - `economica`: `40`
    - `premium_ia`: `200`
    - `completa`: `500`
  - custos unitarios referenciais para banner, story, carrossel e video
- `CREDIT_PLANS`
  - START: `1.000` creditos
  - PRO: `2.500` creditos
  - ELITE: `6.000` creditos
- `CREDIT_RECHARGES`
  - 500 creditos: R$ 59
  - 1.000 creditos: R$ 99
  - 2.000 creditos: R$ 179
  - validade padrao: `180` dias
- `CREDIT_POLICIES`
  - multiplicador x10
  - margem alvo 48% a 65%
  - creditos de assinatura expiram no ciclo
  - creditos avulsos expiram em prazo parametrizado, padrao 180 dias

### `campaignModes.js`

Contem:

- `CAMPAIGN_MODES`
  - Economica
  - Premium IA
  - Completa
- `CAMPAIGN_MODE_ORDER`
- `getCampaignMode(modeId)`

Cada modo contem:

- nome interno
- label comercial
- descricao curta
- custo em creditos
- indicacao de video premium
- estimativa de artes/videos

### `templateCatalog.js`

Contem:

- `TEMPLATE_CATEGORIES`
- `TEMPLATE_FORMATS`
- `TEMPLATE_CATALOG`
- `TEMPLATE_BY_ID`
- `getSelectedTemplatesFromCatalogIds(catalogIds)`

O catalogo encapsula os IDs tecnicos existentes da master e expoe nomes comerciais para a futura UI.

Cliente nao deve ver:

- Creatomate
- OpenAI
- GPT
- UUID
- `template_id`

### `campaignTemplates.js`

Contem:

- `CAMPAIGN_IDS`
- `CAMPAIGN_TEMPLATES`
- `CAMPAIGN_TEMPLATE_OPTIONS`
- `getCampaignModeTemplates(campaignId, modeId)`

Campanhas incluidas:

- Venda Rapida
- Luxo Premium
- Lancamento
- Minha Casa Minha Vida
- Airbnb / Temporada
- Comercial
- Captacao de Imovel

Cada campanha possui os tres modos:

- Economica
- Premium IA
- Completa

Cada combinacao resolve para:

- `catalogItems`
- `selectedTemplates`

## Regras Aplicadas

- `selectedTemplates` permanece como saida final.
- Pacotes apenas pre-selecionam itens.
- Usuario podera editar manualmente em fase futura.
- Saldo nao define campanha sugerida.
- Saldo deve apenas habilitar/desabilitar modos em fase futura.
- Textos IA nao consomem creditos.
- Creditos avulsos nao expiram em 30 dias; validade padrao definida como 180 dias e parametrizavel.

## Build

Executado:

```bash
npm run build
```

Resultado:

- Build passou.
- Aviso esperado do Vite sobre chunk acima de 500 kB.

## Fora De Escopo Nesta Fase

Nao foi alterado:

- `NovaCampanha.jsx`
- Edge Functions
- banco/migrations
- Stripe
- Dashboard
- Planos
- UI
- fluxo de geracao
- downloads
- creditos reais no backend

## Proxima Fase Recomendada

Fase 2: creditos backend com migration nova, sem alterar frontend visual.
