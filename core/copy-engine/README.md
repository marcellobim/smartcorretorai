# Copy Engine

O Copy Engine sera o engine compartilhado de textos do SmartCorretorAI.

## Objetivo

Centralizar a criacao de textos de campanha para todos os produtos, mantendo consistencia de tom, objetivo comercial, fatos do imovel e chamadas de acao.

## Entradas previstas

- Objetivo da campanha.
- Tipo de produto.
- Perfil comercial.
- Localizacao.
- Fatos do imovel ou da campanha.
- CTA.
- Tom desejado.
- Restrições do Fact Engine.

## Saidas previstas

- Legenda para Instagram.
- Texto para WhatsApp.
- Legenda para Facebook.
- Texto para LinkedIn quando aplicavel.
- Descricao para portal.
- Hashtags.
- Variacoes curtas de CTA.

## Produtos que utilizarao

- Produto 1: Hero IA.
- Produto 2: Studio Hero.
- Produto 3: Banners Rapidos.

## Arquitetura prevista

O Copy Engine devera receber briefing estruturado e regras dos demais engines. Ele nao deve substituir prompts, imagens, videos ou pipelines existentes sem uma etapa futura de integracao.

## Estado atual

Somente infraestrutura. Nenhum fluxo chama este engine ainda.
