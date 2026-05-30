# Plano Fase 4 - Catalogo Premium com Previews Reais

## Objetivo

Planejar a evolucao do Catalogo Premium Visual para exibir previews reais dos templates, mantendo a experiencia estilo Netflix e preservando o contrato atual do backend: a saida final continua sendo `selectedTemplates`.

Esta fase nao deve alterar backend, Edge Functions, Stripe, migration ou consumo real de creditos.

## 1. Como mostrar previews reais dos templates

A UI deve exibir imagens reais de preview para cada item do catalogo, sem revelar IDs tecnicos.

Modelo recomendado:

- Cada item de `templateCatalog.js` ganha um campo publico `preview`.
- O campo `preview` aponta para um asset estatico controlado pelo frontend ou por Storage publico.
- O card do catalogo usa `preview` como imagem principal.
- Se o preview ainda nao existir, o card mostra fallback visual premium com nome, tipo, formato e custo.

Exemplo conceitual:

```js
{
  id: 'sc_banner_luxo_01',
  publicName: 'Banner Luxo',
  preview: '/template-previews/sc-banner-luxo-01.jpg',
  description: 'Arte premium para destacar imoveis de alto padrao.',
  type: 'banner',
  format: 'square',
  creditWeight: 10,
  templateId: 'interno, nunca exibido'
}
```

O usuario ve:

- imagem;
- nome comercial;
- descricao;
- tipo;
- formato;
- custo em creditos;
- botao selecionar/desmarcar.

O usuario nunca ve:

- Creatomate;
- OpenAI;
- GPT;
- UUID;
- `template_id`;
- `templateId`.

## 2. Como armazenar thumbnails

Existem duas opcoes seguras.

### Opcao A - Assets estaticos no frontend

Pasta sugerida:

`frontend/public/template-previews/`

Exemplo:

- `frontend/public/template-previews/sc-banner-luxo-01.jpg`
- `frontend/public/template-previews/real-estate-card.jpg`
- `frontend/public/template-previews/video-compilation.jpg`

Vantagens:

- simples;
- versionado no Git;
- nao depende de bucket;
- facil de testar localmente;
- ideal para a primeira versao.

Riscos:

- aumenta tamanho do build se imagens forem pesadas;
- exige cuidado com compressao.

Recomendacao:

Usar `.jpg` ou `.webp` otimizados, entre 60 KB e 180 KB por thumbnail.

### Opcao B - Supabase Storage publico

Bucket sugerido:

`smartcorretor-assets`

Prefixo sugerido:

`template-previews/`

Exemplo:

`https://.../storage/v1/object/public/smartcorretor-assets/template-previews/sc-banner-luxo-01.jpg`

Vantagens:

- nao aumenta o bundle;
- permite atualizar previews sem rebuild;
- melhor para muitos templates no futuro.

Riscos:

- depende de politicas de bucket;
- risco de URLs quebradas;
- exige governanca de assets.

Recomendacao para Fase 4:

Comecar com assets estaticos no frontend. Migrar para Storage quando o catalogo crescer ou quando houver previews animados.

## 3. Como mapear nome comercial, preview, descricao e template interno

O arquivo `templateCatalog.js` deve ser a fonte de verdade do catalogo visual.

Estrutura recomendada:

```js
{
  id: 'sc_banner_luxo_01',
  publicName: 'Banner Luxo',
  preview: '/template-previews/sc-banner-luxo-01.jpg',
  description: 'Arte premium para destacar imoveis de alto padrao.',
  type: 'banner',
  format: 'square',
  creditWeight: 10,
  tags: ['luxo_premium', 'venda_rapida'],
  templateId: '74097a36-5b5d-434a-8db7-4038e4c76f55'
}
```

Regras:

- `publicName` e `description` sao exibidos ao usuario.
- `preview`, `type`, `format` e `creditWeight` sao exibidos ao usuario.
- `templateId` existe apenas para resolver `selectedTemplates`.
- A UI nunca renderiza `templateId`.
- Logs de frontend devem evitar imprimir catalogo completo em producao.

Saida final:

```js
selectedTemplates = selectedCatalogItems.map(item => item.templateId)
```

Assim, o backend continua recebendo exatamente o que ja espera.

## 4. Como organizar o catalogo estilo Netflix

O catalogo deve deixar de parecer uma grade tecnica e passar a parecer uma vitrine editorial.

### Estrutura visual

Secao principal:

`Catalogo Premium Visual`

Subsecoes em carrosseis horizontais:

- Destaques recomendados.
- Artes para Feed e Portais.
- Videos e Reels.
- Stories.
- Carrosseis.
- Comercial e Captacao.

### Categorias sugeridas

#### Destaques recomendados

Cards selecionados com base em campanha/modo ou categoria do imovel.

Uso:

- primeira faixa do catalogo;
- reduz friccao;
- mostra o que faz mais sentido para o usuario.

#### Artes

Itens com `type`:

- `banner`;
- `card`;
- `detailed`;
- `social`.

#### Videos

Itens com `type`:

- `video`;
- `reels`.

#### Stories

Itens com `type`:

- `story`;
- itens verticais de resposta rapida.

#### Carrosseis

Itens com `type`:

- `carousel`;
- templates multi-slide ou apresentacao sequencial.

### Card estilo Netflix

Cada card deve ter:

- imagem preview em proporcao fixa;
- gradiente sutil no rodape;
- nome comercial;
- chips de tipo/formato/custo;
- estado selecionado claro;
- botao selecionar/desmarcar;
- layout responsivo.

Regras de UI:

- nao usar IDs tecnicos;
- nao usar nome tecnico do template;
- nao usar texto explicando Creatomate ou IA;
- manter cards com dimensoes estaveis;
- no mobile, usar grid de 1 coluna ou carrossel com scroll horizontal.

## 5. Integracao com Economica, Premium IA e Completa

Os pacotes devem continuar separados do catalogo.

Regra:

- pacote sugere selecao;
- catalogo permite edicao manual;
- `selectedTemplates` continua sendo a saida final.

### Economica

Objetivo:

- gerar materiais essenciais com baixo custo.

Comportamento futuro:

- pre-selecionar 3 a 5 templates leves;
- priorizar banners, card e talvez 1 video basico;
- custo visual base: 40 creditos.

### Premium IA

Objetivo:

- valorizar artes premium e composicoes mais sofisticadas.

Comportamento futuro:

- pre-selecionar artes premium;
- priorizar feed, story premium e carrossel;
- videos pesados podem ficar opcionais;
- custo visual base: 200 creditos.

### Completa

Objetivo:

- pacote completo com artes e videos principais.

Comportamento futuro:

- pre-selecionar mais itens;
- incluir videos/reels/stories;
- cobrir canais principais;
- custo visual base: 500 creditos.

### Como o pacote interage com o catalogo

Fluxo recomendado:

1. Usuario clica em "Selecionar pacote".
2. Frontend busca no mapa `campaignTemplates.js` quais catalog IDs pertencem ao modo.
3. Frontend converte catalog IDs para `templateId`.
4. Frontend marca os itens no catalogo visual.
5. Usuario pode desmarcar ou selecionar outros itens.
6. `selectedTemplates` e montado a partir do estado final do catalogo.

Importante:

O pacote nunca deve chamar backend diretamente.

## 6. Como evitar quebrar selectedTemplates

Principio central:

`selectedTemplates` permanece o contrato final.

O catalogo pode mudar visualmente, mas a saida final precisa continuar sendo:

```js
[
  '74097a36-5b5d-434a-8db7-4038e4c76f55',
  'a637acac-6a7b-42f8-b7d8-e25361eff207'
]
```

Medidas de seguranca:

- manter `templateId` em `templateCatalog.js`;
- nunca renomear `selectedTemplates` no payload;
- nao alterar `gerar-banners`;
- nao alterar Edge Functions;
- criar helper puro para converter catalog IDs em template IDs;
- testar uma selecao manual antes e depois;
- testar gerar com 1 template;
- testar gerar com varios templates;
- testar gerar sem template selecionado, respeitando regra atual.

Arquitetura recomendada:

```js
const selectedCatalogIds = ['sc_banner_luxo_01']
const selectedTemplates = getSelectedTemplatesFromCatalogIds(selectedCatalogIds)
```

## 7. Preparacao para preview animado, video demonstrativo e antes/depois

Adicionar campos opcionais no catalogo, sem obrigar uso imediato.

Campos futuros:

```js
{
  preview: '/template-previews/sc-banner-luxo-01.jpg',
  animatedPreview: '/template-previews/sc-banner-luxo-01.webp',
  demoVideo: '/template-previews/sc-banner-luxo-01.mp4',
  beforeAfter: {
    before: '/template-previews/sc-banner-luxo-before.jpg',
    after: '/template-previews/sc-banner-luxo-after.jpg'
  }
}
```

Regras:

- se `animatedPreview` existir, usar no hover ou em card expandido;
- se `demoVideo` existir, abrir modal de demonstracao;
- se `beforeAfter` existir, usar em visualizacao detalhada;
- se nada existir, usar `preview`;
- se nem `preview` existir, usar fallback visual.

Fase 4 deve preparar os campos, mas nao precisa implementar todos os comportamentos.

## 8. Arquivos que serao alterados

### Obrigatorios

#### `frontend/src/data/templateCatalog.js`

Mudancas:

- adicionar campo `preview`;
- opcionalmente adicionar `categoryRows`;
- preparar campos futuros opcionais.

Risco:

- baixo, se nao alterar `templateId`.

#### `frontend/src/pages/NovaCampanha.jsx`

Mudancas:

- usar preview no card do catalogo;
- opcionalmente consumir novo helper ou componente extraido;
- manter `selectedTemplates`.

Risco:

- medio, porque a tela ja concentra muita logica.

#### `FASE3_CREDITOS_FRONTEND_VISUAL.md` ou novo relatorio de Fase 4

Mudancas:

- documentar a implementacao final da fase.

Risco:

- baixo.

### Recomendados

#### `frontend/src/components/PremiumTemplateCatalog.jsx`

Novo componente recomendado.

Responsabilidade:

- renderizar catalogo com previews;
- receber itens selecionados;
- emitir toggle;
- nao conhecer backend.

Risco:

- baixo/medio, depende da extracao de estado de `NovaCampanha.jsx`.

#### `frontend/src/components/CampaignModeSelector.jsx`

Novo componente recomendado.

Responsabilidade:

- renderizar Economica, Premium IA e Completa;
- atualizar modo selecionado;
- futuramente pre-selecionar itens.

Risco:

- baixo.

#### `frontend/public/template-previews/`

Nova pasta de assets.

Responsabilidade:

- armazenar thumbnails reais otimizadas.

Risco:

- baixo, mas exige controle de tamanho.

## 9. Riscos

### Risco 1 - Expor IDs tecnicos

Se `templateId` for usado diretamente em JSX, o usuario pode ver UUIDs ou nomes tecnicos.

Mitigacao:

- UI renderiza apenas `publicName`, `description`, `type`, `format`, `creditWeight` e `preview`.

### Risco 2 - Quebrar selectedTemplates

Ao trocar o seletor visual, existe risco de deixar de enviar os IDs esperados pelo backend.

Mitigacao:

- manter helper de conversao;
- adicionar teste manual com geracao real;
- nao alterar `gerar-banners`.

### Risco 3 - Imagens pesadas

Thumbnails grandes podem prejudicar performance.

Mitigacao:

- usar imagens `.webp` ou `.jpg` otimizadas;
- limitar tamanho;
- usar lazy loading;
- usar fallback leve.

### Risco 4 - Crescimento de NovaCampanha.jsx

Adicionar preview e carrosseis direto na tela pode aumentar a complexidade.

Mitigacao:

- extrair `PremiumTemplateCatalog.jsx` assim que a estrutura visual estabilizar.

### Risco 5 - Custo visual divergir do custo real

Se o custo por item e pacote nao estiver centralizado, o resumo pode divergir do debito futuro.

Mitigacao:

- manter custos em `creditCosts.js` e pesos no `templateCatalog.js`;
- antes do debito real, validar regra unica de calculo.

### Risco 6 - Pacote selecionado nao refletir catalogo

Se o pacote apenas alterar resumo visual, usuario pode se confundir.

Mitigacao:

- Fase 4 deve deixar claro se o pacote ja pre-seleciona itens ou ainda e apenas visual.
- Recomendacao: implementar pre-selecao somente quando o mapa estiver validado.

## 10. Ordem de implementacao

### Etapa 1 - Preparar assets

1. Criar pasta `frontend/public/template-previews/`.
2. Adicionar thumbnails reais otimizadas.
3. Nomear arquivos com slugs comerciais, sem UUID.

### Etapa 2 - Atualizar `templateCatalog.js`

1. Adicionar campo `preview`.
2. Adicionar campos opcionais futuros:
   - `animatedPreview`;
   - `demoVideo`;
   - `beforeAfter`.
3. Garantir que `templateId` permaneça inalterado.

### Etapa 3 - Extrair `PremiumTemplateCatalog.jsx`

1. Mover renderizacao do catalogo para componente proprio.
2. Receber `selectedTemplateIds`.
3. Receber `onToggleTemplate`.
4. Renderizar previews.
5. Nao alterar payload.

### Etapa 4 - Extrair `CampaignModeSelector.jsx`

1. Mover cards de Economica, Premium IA e Completa para componente proprio.
2. Manter selecao de modo no estado da pagina.
3. Ainda sem backend.

### Etapa 5 - Integrar pacote com pre-selecao opcional

1. Usar `campaignTemplates.js`.
2. Ao selecionar pacote, pre-marcar os templates recomendados.
3. Permitir edicao manual depois.
4. Confirmar que `selectedTemplates` reflete o estado final.

### Etapa 6 - Validar UI

1. Testar desktop.
2. Testar mobile.
3. Confirmar que nenhum termo tecnico aparece.
4. Confirmar que previews carregam.
5. Confirmar que cards nao quebram layout.

### Etapa 7 - Build

Executar:

```bash
npm run build
```

### Etapa 8 - Relatorio e checkpoint

1. Criar relatorio da Fase 4.
2. Commitar apenas apos aprovacao.
3. Criar tag de backup se solicitado.

## Recomendacao final

Implementar a Fase 4 em duas partes:

1. Fase 4A: thumbnails reais + catalogo extraido em componente proprio.
2. Fase 4B: pacote selecionado pre-seleciona itens do catalogo.

Essa divisao reduz risco porque primeiro melhora a vitrine visual sem mexer no comportamento de selecao. Depois conecta pacote e catalogo mantendo `selectedTemplates` como contrato final.
