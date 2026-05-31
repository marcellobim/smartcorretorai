# Plano Fase 4.3 - Creditos Inteligentes

## Objetivo

Planejar a proxima evolucao do SmartCorretorAI para transformar creditos em uma experiencia clara, flexivel e orientada ao valor.

A Fase 4.3 nao deve alterar backend, Stripe, banco, Edge Functions ou payload. Este documento planeja a experiencia antes de qualquer implementacao.

## Principio central

O usuario nao compra anuncios.

O usuario nao compra templates.

O usuario compra creditos e decide livremente como utiliza-los para gerar materiais de marketing imobiliario.

Esse e o diferencial do SmartCorretorAI: liberdade de composicao com controle de saldo, custo estimado e resultado esperado.

## Modelo oficial aprovado

### Modo 1 - Campanhas Recomendadas

Campanhas prontas:

- Venda Rapida;
- Luxo Premium;
- Lancamento;
- Minha Casa Minha Vida;
- Airbnb / Temporada;
- Comercial.

Objetivo:

Permitir que o corretor gere uma campanha completa com poucos cliques.

Ideal para:

- corretor novo;
- usuario com pressa;
- quem nao quer escolher formatos um por um;
- quem quer uma recomendacao inteligente pronta.

### Modo 2 - Monte Sua Campanha

O corretor escolhe exatamente o que deseja gerar.

Exemplos de formatos:

- Banner Feed;
- Story;
- Carrossel;
- Video/Reels;
- Google Ads;
- Texto IA;
- WhatsApp;
- formatos futuros.

Objetivo:

Permitir controle total do consumo de creditos e dos materiais gerados.

Ideal para:

- corretor experiente;
- usuario com saldo limitado;
- usuario que quer gerar apenas um formato especifico;
- campanhas recorrentes com composicao propria.

## Fluxo do usuario

1. Usuario preenche os dados do imovel.
2. Usuario envia fotos.
3. Sistema mostra saldo atual de creditos.
4. Usuario escolhe entre:
   - Campanhas Recomendadas;
   - Monte Sua Campanha.
5. Usuario visualiza custo estimado.
6. Usuario visualiza saldo apos geracao.
7. Usuario pode ajustar formatos ou escolher pacote mais economico.
8. Usuario confirma a geracao.
9. Backend continua recebendo `selectedTemplates`.

## Wireframe textual

```text
Nova Campanha

[Dados do imovel]
[Fotos do imovel]

Saldo atual: 1.000 creditos

Como deseja criar sua campanha?

[ Campanhas Recomendadas ] [ Monte Sua Campanha ]

--------------------------------------------------
MODO 1 - Campanhas Recomendadas
--------------------------------------------------

[Venda Rapida]
Ideal para vender rapido e gerar contatos.
Voce recebera:
- 3 banners
- 2 stories
- 1 carrossel
- textos IA
Custo estimado: 120 creditos
Saldo apos gerar: 880 creditos
[Selecionar campanha]

[Luxo Premium]
Ideal para alto padrao.
Custo estimado: 260 creditos
Saldo apos gerar: 740 creditos
[Selecionar campanha]

--------------------------------------------------
MODO 2 - Monte Sua Campanha
--------------------------------------------------

[x] Banner Feed        10 creditos
[x] Story              15 creditos
[ ] Carrossel          20 creditos
[ ] Video/Reels        60 creditos
[ ] Google Ads         20 creditos
[x] Texto IA            0 creditos
[x] WhatsApp            0 creditos

Subtotal: 25 creditos
Saldo apos gerar: 975 creditos

[Adicionar formato] [Gerar campanha]
```

## Experiencia do usuario

### 1. Como exibir saldo atual

Mostrar o saldo atual sempre acima da escolha de campanha.

Formato recomendado:

```text
Saldo atual
1.000 creditos de marketing
```

Com estados:

- saldo alto: neutro/verde;
- saldo medio: amarelo suave;
- saldo baixo: alerta leve;
- saldo insuficiente: alerta forte com CTA para adicionar creditos.

### 2. Como exibir saldo apos geracao

Mostrar em tempo real conforme o usuario escolhe campanha ou formatos.

Exemplo:

```text
Custo estimado: 120 creditos
Saldo apos gerar: 880 creditos
```

Se saldo ficar negativo:

```text
Creditos insuficientes para esta geracao.
Escolha menos formatos ou adicione creditos.
```

### 3. Como exibir consumo estimado

No Modo 1:

- mostrar custo total da campanha;
- nao mostrar custo de cada template;
- mostrar resumo de entregaveis.

No Modo 2:

- mostrar custo individual por formato;
- mostrar subtotal;
- mostrar total;
- mostrar saldo restante.

### 4. Como sugerir economia de creditos

Sugestoes simples:

- "Quer economizar? Remova Video/Reels e mantenha banners + textos IA."
- "Texto IA nao consome creditos."
- "Stories custam menos que videos e geram visualizacao rapida."
- "Comece com Economica e adicione formatos depois."

Estado recomendado:

```text
Dica de economia
Remover Video/Reels reduz esta geracao de 120 para 60 creditos.
```

### 5. Como permitir adicionar/remover formatos

No Modo 2:

- usar checkboxes/toggles por formato;
- mostrar custo ao lado;
- atualizar subtotal instantaneamente;
- manter textos IA e WhatsApp como itens de custo zero;
- permitir formatos futuros sem quebrar o modelo.

Exemplo:

```text
[x] Banner Feed       10 creditos
[x] Story             15 creditos
[ ] Video/Reels       60 creditos
[x] Texto IA           0 creditos
```

### 6. Como manter a tela simples

Recomendacoes:

- mostrar somente uma camada principal por vez;
- usar abas ou segmented control para Modo 1 e Modo 2;
- evitar mostrar lista tecnica de templates;
- manter textos curtos no card;
- mover detalhes para `Ver detalhes`;
- explicar creditos com microcopy simples;
- manter resumo fixo antes do botao Gerar.

### 7. Como evitar poluicao visual

Evitar:

- repetir a mesma explicacao em todos os cards;
- mostrar custo individual dentro das campanhas recomendadas;
- exibir IDs, nomes tecnicos ou templates;
- misturar campanha recomendada com modo manual na mesma area visual.

Preferir:

- cards compactos;
- painel de resumo;
- accordions;
- detalhes apenas no card selecionado;
- frases curtas;
- icones e badges simples.

## Modo 1 - Campanhas Recomendadas

### Estrutura do card

```text
[Nome da campanha]
Descricao curta.

Melhor para: ...

Voce recebera:
- banners
- stories
- carrossel
- textos IA

Custo estimado: X creditos
Saldo apos gerar: Y creditos

[Selecionar]
[Ver detalhes]
```

### Exemplos praticos

#### Venda Rapida

Saldo atual: 1.000 creditos.

Entregaveis:

- 3 banners;
- 2 stories;
- 1 carrossel;
- textos IA;
- WhatsApp.

Custo estimado: 120 creditos.

Saldo restante: 880 creditos.

Melhor uso:

- imovel pronto;
- oportunidade de preco;
- corretor quer gerar contato rapidamente.

#### Luxo Premium

Saldo atual: 1.000 creditos.

Entregaveis:

- 4 artes premium;
- 2 stories;
- 1 video/reels;
- textos IA;
- WhatsApp.

Custo estimado: 260 creditos.

Saldo restante: 740 creditos.

Melhor uso:

- alto padrao;
- cobertura;
- casa em condominio;
- imovel com fotos fortes.

#### Lancamento

Saldo atual: 1.000 creditos.

Entregaveis:

- 2 stories;
- 1 carrossel;
- 1 video/reels;
- textos IA.

Custo estimado: 140 creditos.

Saldo restante: 860 creditos.

Melhor uso:

- planta;
- obra;
- pre-venda;
- campanha de expectativa.

#### Minha Casa Minha Vida

Saldo atual: 1.000 creditos.

Entregaveis:

- 3 banners;
- 1 story;
- mensagem WhatsApp;
- textos IA.

Custo estimado: 80 creditos.

Saldo restante: 920 creditos.

Melhor uso:

- primeiro imovel;
- financiamento;
- entrada facilitada;
- FGTS/subsidio.

#### Airbnb / Temporada

Saldo atual: 1.000 creditos.

Entregaveis:

- 2 banners lifestyle;
- 2 stories;
- 1 video/reels;
- textos IA.

Custo estimado: 180 creditos.

Saldo restante: 820 creditos.

Melhor uso:

- praia;
- mobiliado;
- diaria;
- lazer e experiencia.

#### Comercial

Saldo atual: 1.000 creditos.

Entregaveis:

- 3 banners;
- 1 ficha visual;
- 1 video simples;
- textos IA;
- WhatsApp.

Custo estimado: 150 creditos.

Saldo restante: 850 creditos.

Melhor uso:

- loja;
- sala;
- galpao;
- terreno;
- decisao B2B.

## Modo 2 - Monte Sua Campanha

### Estrutura dos itens

```text
[x] Banner Feed
Onde usar: Instagram e Facebook
Custo: 10 creditos

[x] Story
Onde usar: Stories e Status do WhatsApp
Custo: 15 creditos

[ ] Carrossel
Onde usar: Instagram e Facebook
Custo: 20 creditos

[ ] Video/Reels
Onde usar: Reels, TikTok e Facebook Reels
Custo: 60 creditos

[ ] Google Ads
Onde usar: campanhas de trafego
Custo: 20 creditos

[x] Texto IA
Custo: 0 creditos

[x] WhatsApp
Custo: 0 creditos
```

### Exemplo economico

Saldo atual: 150 creditos.

Selecionado:

- Banner Feed: 10;
- Story: 15;
- Texto IA: 0;
- WhatsApp: 0.

Subtotal: 25 creditos.

Saldo restante: 125 creditos.

### Exemplo intermediario

Saldo atual: 300 creditos.

Selecionado:

- Banner Feed: 10;
- Story: 15;
- Carrossel: 20;
- Video/Reels: 60;
- Texto IA: 0;
- WhatsApp: 0.

Subtotal: 105 creditos.

Saldo restante: 195 creditos.

### Exemplo premium

Saldo atual: 600 creditos.

Selecionado:

- 3 Banners Feed: 30;
- 2 Stories: 30;
- 1 Carrossel: 20;
- 2 Video/Reels: 120;
- Google Ads: 20;
- Texto IA: 0;
- WhatsApp: 0.

Subtotal: 200 creditos.

Saldo restante: 400 creditos.

## Vantagens

### Para o corretor

- entende o custo antes de gerar;
- controla o proprio saldo;
- escolhe velocidade ou personalizacao;
- consegue economizar creditos;
- evita gerar formatos desnecessarios.

### Para o produto

- reduz suporte sobre "quantas campanhas tenho";
- posiciona creditos como liberdade;
- aumenta percepcao de valor;
- permite upsell de recargas;
- prepara formatos futuros sem mudar o modelo mental.

### Para o negocio

- protege margem;
- facilita precificacao dinamica;
- permite testar novos formatos;
- reduz desperdicio de renderizacao;
- incentiva compra de creditos avulsos.

## Riscos

### Risco 1 - Complexidade visual

Mostrar creditos, formatos, saldo e dicas ao mesmo tempo pode poluir a tela.

Mitigacao:

- usar abas;
- manter resumo fixo;
- esconder detalhes em accordions;
- mostrar custo simples no card.

### Risco 2 - Usuario focar apenas em custo

O corretor pode escolher sempre o mais barato e nao perceber valor dos formatos premium.

Mitigacao:

- mostrar melhor uso;
- destacar alcance/impacto esperado;
- sugerir upgrade contextual.

### Risco 3 - Confusao entre campanha e modo manual

Usuario pode nao entender a diferenca entre Campanhas Recomendadas e Monte Sua Campanha.

Mitigacao:

- explicar em uma frase:
  - "Campanhas Recomendadas: o sistema escolhe por voce."
  - "Monte Sua Campanha: voce escolhe formato por formato."

### Risco 4 - Saldo insuficiente frustrar o usuario

Se muitas opcoes aparecerem bloqueadas, a experiencia pode parecer negativa.

Mitigacao:

- sugerir alternativa economica;
- mostrar "remova video para economizar X creditos";
- oferecer adicionar creditos sem interromper o fluxo.

### Risco 5 - Creditos ainda simulados no frontend

Enquanto o consumo real nao estiver conectado ao backend, pode haver diferenca entre exibicao e cobranca real.

Mitigacao:

- manter fase visual separada;
- conectar debito real somente em etapa backend controlada;
- validar idempotencia antes de producao.

## Recomendacoes UX

1. Usar controle segmentado:

```text
[Campanhas Recomendadas] [Monte Sua Campanha]
```

2. Manter saldo sempre visivel:

```text
Saldo atual: 1.000 creditos
Custo estimado: 120 creditos
Saldo apos gerar: 880 creditos
```

3. Evitar detalhes repetidos dentro de todos os cards.

4. Mostrar detalhes completos apenas:

- no card selecionado;
- em accordion;
- em modal leve;
- em painel abaixo do catalogo.

5. Usar linguagem de valor:

- "ideal para vender rapido";
- "melhor para alto padrao";
- "economize removendo videos";
- "textos IA inclusos sem custo".

6. Nunca exibir:

- template_id;
- UUID;
- Creatomate;
- OpenAI;
- GPT;
- nomes tecnicos internos.

7. Preparar formatos futuros como itens de catalogo:

- Google Ads;
- YouTube Shorts;
- LinkedIn;
- portais imobiliarios;
- email marketing;
- landing page do imovel.

## Estrutura de dados sugerida

```js
campaignModes = {
  recommended: 'Campanhas Recomendadas',
  manual: 'Monte Sua Campanha'
}

formatCosts = {
  banner_feed: 10,
  story: 15,
  carousel: 20,
  video_reels: 60,
  google_ads: 20,
  texto_ia: 0,
  whatsapp: 0
}

selectionSummary = {
  currentBalance: 1000,
  estimatedCost: 120,
  balanceAfter: 880,
  selectedFormats: []
}
```

## Ordem recomendada de implementacao

### Etapa 1 - Planejamento visual

- aprovar este plano;
- definir custos finais por formato;
- definir quais formatos entram no Modo 2.

### Etapa 2 - UI sem debito real

- criar abas Campanhas Recomendadas / Monte Sua Campanha;
- manter creditos simulados;
- atualizar subtotal em tempo real;
- preservar `selectedTemplates`.

### Etapa 3 - Integracao com saldo real

- trocar saldo simulado por saldo real do Supabase;
- manter custo estimado no frontend;
- nao debitar ainda.

### Etapa 4 - Debito real seguro

- conectar reserva/consumo de creditos no backend;
- usar idempotencia;
- validar saldo server-side;
- evitar saldo negativo.

### Etapa 5 - UX final

- testar com corretor real;
- simplificar textos;
- ajustar mobile;
- medir taxa de selecao por formato.

## Conclusao

A Fase 4.3 deve transformar creditos em uma experiencia inteligente:

- facil para quem quer gerar rapido;
- flexivel para quem quer controlar cada formato;
- transparente no custo;
- preparada para novos formatos;
- compativel com `selectedTemplates` e backend atual.

O caminho recomendado e iniciar pela UI visual sem debito real, depois conectar saldo real e apenas por ultimo ativar consumo server-side.
