# Produto 3 - Controle de Previews Reais

Este documento controla os previews fixos e publicos do Produto 3 / Banners Rapidos.

## Regras de seguranca

- Usar somente dados, imagens e videos genericos.
- Nao usar fotos reais de clientes.
- Nao colocar secrets, tokens, chaves ou dados sensiveis.
- Nao chamar Creatomate, OpenAI ou Edge Functions ao clicar em "Ver".
- Nao consumir creditos para exibir preview.
- Manter 1 preview por familia ativa.
- Frase Elegante permanece fora do MVP ativo.

## Contrato de preview

Cada familia ativa deve ter:

- `modelId`
- `modelName`
- `previewTitle`
- `previewDescription`
- `previewFormat`
- `previewTemplateId`
- `previewAssetUrl`
- `previewType`
- `previewStatus`

Enquanto o arquivo final ainda nao existir, usar:

- `previewType: "video"`
- `previewStatus: "missing"`

Estado atual:

- As 12 familias ativas possuem preview oficial 1x1 aplicado.
- Anuncio Premium usa imagem JPG estatica.
- As demais familias usam MP4.

## Status dos assets

| Familia | modelId | previewTemplateId | Path esperado | Status |
|---|---|---|---|---|
| Anuncio Premium | `anuncio_premium` | `662883d7-1dba-4e61-a2a2-81fd9293ab15` | `/previews/produto3/anuncio-premium-preview-1x1.jpg` | Pronto |
| Story Premium | `story_premium` | `e8314ba2-cd0f-44e3-afd1-de41083c0846` | `/previews/produto3/story-premium-preview-1x1.mp4` | Pronto |
| Card Imobiliario Premium | `card_imobiliario_premium` | `0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d` | `/previews/produto3/card-imobiliario-premium-preview-1x1.mp4` | Pronto |
| Imovel Detalhes | `imovel_detalhes` | `1ae7e1f4-ada4-4b03-a032-737a025b88c6` | `/previews/produto3/imovel-detalhes-preview-1x1.mp4` | Pronto |
| Avaliacao do Cliente | `avaliacao_do_cliente` | `792ad84a-0ab8-4e6c-bda1-400fe9c040cc` | `/previews/produto3/avaliacao-do-cliente-preview-1x1.mp4` | Pronto |
| Chat Imobiliario | `chat_imobiliario` | `329b6afb-c749-4bda-a319-38ad42639034` | `/previews/produto3/chat-imobiliario-preview-1x1.mp4` | Pronto |
| Momentos do Imovel | `momentos_do_imovel` | `93635efc-ef44-47d2-a8f3-38a379d69941` | `/previews/produto3/momentos-do-imovel-preview-1x1.mp4` | Pronto |
| Reels Moderno | `reels_moderno` | `9962f7dc-6cca-491f-bffe-3184a2314f21` | `/previews/produto3/reels-moderno-preview-1x1.mp4` | Pronto |
| Galeria Imobiliaria | `galeria_imobiliaria` | `7a12a73e-ace7-4ab4-9739-95741b82232a` | `/previews/produto3/galeria-imobiliaria-preview-1x1.mp4` | Pronto |
| Slides Premium | `slides_premium` | `9c7e271b-a9c2-475a-b742-8f949e788abf` | `/previews/produto3/slides-premium-preview-1x1.mp4` | Pronto |
| Video Tour | `video_tour` | `9ebd1bda-e650-4d88-b8aa-ff555a419082` | `/previews/produto3/video-tour-preview-1x1.mp4` | Pronto |
| Triple Slide Carousel | `triple_slide_carousel` | `2ecd48d3-146c-467b-8a0d-908152101378` | `/previews/produto3/triple-slide-carousel-preview-1x1.mp4` | Pronto |
