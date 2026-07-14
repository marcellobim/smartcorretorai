# Auditoria QA Creatomate - Produto 3 / Banners Rapidos

Checkpoint de referencia: `481315f87128481ae4f0328aa9fef72ba76e4531`

Objetivo deste documento: orientar a revisao manual dos templates ativos do Produto 3 no Creatomate antes da criacao dos previews reais. Esta auditoria nao altera UUIDs, catalogo, creditos ou codigo de geracao.

## Escopo Ativo

- Produto: Produto 3 / Banners Rapidos.
- Familias ativas no MVP: 12.
- Templates ativos no MVP: 60.
- Formatos ativos por familia: `1x1`, `4x5`, `4x5 Tipo 2`, `9x16`, `16x9`.
- Familia legada/oculta: `Frase Elegante`.
- Fonte local auditada: `frontend/src/data/templateCatalog.js` e `frontend/src/pages/NovaCampanha.jsx`.

## Contrato Dynamic Esperado Pelo Backend

Cada template ativo deve aceitar, quando o layout tiver espaco para o campo, os nomes canonicos abaixo. O backend ainda possui fallback por heuristica/aliases, mas a correcao manual no Creatomate deve priorizar estes nomes exatos:

- `property_tag`
- `sale_badge`
- `property_location_type`
- `property_features`
- `property_price`
- `cta_text`
- `broker_whatsapp`
- `broker_email`
- `property_image_01`
- `property_image_02`
- `property_image_03`
- `property_image_04`

Observacoes de QA:

- `property_features` deve priorizar dormitorios, suites, vagas e area. Nao usar banheiro como diferencial principal.
- `property_price` deve comportar `Consulte` quando preco nao for informado.
- `property_location_type` deve comportar bairro normalizado + tipo do imovel.
- `property_image_01` deve ser a foto principal; `property_image_02..04` devem ser fotos de apoio na ordem recebida.
- Campos de corretor devem usar dados reais quando existirem e nunca placeholders.

## Tabela de Templates Ativos

Status manual sugerido: `OK`, `Ajustar` ou `Revalidar`.

| Familia | ModelId | Formato | Uso interno | Template ID | Creditos | Dynamic fields esperados | Status |
|---|---|---:|---|---|---:|---|---|
| Anuncio Premium | `anuncio_premium` | 1x1 | `square` | `662883d7-1dba-4e61-a2a2-81fd9293ab15` | 20 | Contrato canonico Produto 3 | Revalidar |
| Anuncio Premium | `anuncio_premium` | 4x5 | `portrait` | `d791b9b8-55e2-4dff-ae5d-76b9e779c551` | 20 | Contrato canonico Produto 3 | Revalidar |
| Anuncio Premium | `anuncio_premium` | 4x5 Tipo 2 | `portraitAlt` | `d45618d1-5f7f-4053-b317-dd2bbe322f5b` | 20 | Contrato canonico Produto 3 | Revalidar |
| Anuncio Premium | `anuncio_premium` | 9x16 | `vertical` | `116761e5-4cda-4c83-b450-7beaaa4ef5e1` | 20 | Contrato canonico Produto 3 | Revalidar |
| Anuncio Premium | `anuncio_premium` | 16x9 | `horizontal` | `d280898b-7237-4c0b-a889-e85ededa9644` | 20 | Contrato canonico Produto 3 | Revalidar |
| Story Premium | `story_premium` | 1x1 | `square` | `e8314ba2-cd0f-44e3-afd1-de41083c0846` | 15 | Contrato canonico Produto 3 | Revalidar |
| Story Premium | `story_premium` | 4x5 | `portrait` | `5461c940-4309-4c3f-bba1-d90e83e62a9a` | 15 | Contrato canonico Produto 3 | Revalidar |
| Story Premium | `story_premium` | 4x5 Tipo 2 | `portraitAlt` | `e15d93e5-dbb0-45c9-b475-2d9e2d6a1d0c` | 15 | Contrato canonico Produto 3 | Revalidar |
| Story Premium | `story_premium` | 9x16 | `vertical` | `1de0a863-2376-4336-8a0a-4750c2429cf7` | 15 | Contrato canonico Produto 3 | Revalidar |
| Story Premium | `story_premium` | 16x9 | `horizontal` | `c9cf1d8c-4f01-4f65-baf8-ca20c56ad76e` | 15 | Contrato canonico Produto 3 | Revalidar |
| Card Imobiliario Premium | `card_imobiliario_premium` | 1x1 | `square` | `0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d` | 10 | Contrato canonico Produto 3 | Revalidar |
| Card Imobiliario Premium | `card_imobiliario_premium` | 4x5 | `portrait` | `f7df2c44-ea60-4c42-b862-2d335029acad` | 10 | Contrato canonico Produto 3 | Revalidar |
| Card Imobiliario Premium | `card_imobiliario_premium` | 4x5 Tipo 2 | `portraitAlt` | `2b4e6dff-ee96-42f0-97e1-7956bef9dfa9` | 10 | Contrato canonico Produto 3 | Revalidar |
| Card Imobiliario Premium | `card_imobiliario_premium` | 9x16 | `vertical` | `755d1a44-acb9-4593-96b4-f1741b1651af` | 10 | Contrato canonico Produto 3 | Revalidar |
| Card Imobiliario Premium | `card_imobiliario_premium` | 16x9 | `horizontal` | `656ff3e1-325a-419c-9914-dfde82f911b6` | 10 | Contrato canonico Produto 3 | Revalidar |
| Imovel Detalhes | `imovel_detalhes` | 1x1 | `square` | `1ae7e1f4-ada4-4b03-a032-737a025b88c6` | 10 | Contrato canonico Produto 3 | Revalidar |
| Imovel Detalhes | `imovel_detalhes` | 4x5 | `portrait` | `4dd468f4-a439-4a31-b6f3-29be17a1d51d` | 10 | Contrato canonico Produto 3 | Revalidar |
| Imovel Detalhes | `imovel_detalhes` | 4x5 Tipo 2 | `portraitAlt` | `4ba4698c-3b6e-4548-b73d-814d71bc7f66` | 10 | Contrato canonico Produto 3 | Revalidar |
| Imovel Detalhes | `imovel_detalhes` | 9x16 | `vertical` | `451b3422-f222-414e-b105-44b896f8277e` | 10 | Contrato canonico Produto 3 | Revalidar |
| Imovel Detalhes | `imovel_detalhes` | 16x9 | `horizontal` | `71aa0276-bc5f-4245-bb37-62a78fa7cf64` | 10 | Contrato canonico Produto 3 | Revalidar |
| Avaliacao do Cliente | `avaliacao_do_cliente` | 1x1 | `square` | `792ad84a-0ab8-4e6c-bda1-400fe9c040cc` | 10 | Contrato canonico Produto 3 | Revalidar |
| Avaliacao do Cliente | `avaliacao_do_cliente` | 4x5 | `portrait` | `a83a2008-8a6a-4a40-8b6f-d87190a1d306` | 10 | Contrato canonico Produto 3 | Revalidar |
| Avaliacao do Cliente | `avaliacao_do_cliente` | 4x5 Tipo 2 | `portraitAlt` | `cfded0ba-1eb9-4396-ab63-b259cb817a1e` | 10 | Contrato canonico Produto 3 | Revalidar |
| Avaliacao do Cliente | `avaliacao_do_cliente` | 9x16 | `vertical` | `52a1e65f-ca92-4c6c-af7e-9f0100c886cb` | 10 | Contrato canonico Produto 3 | Revalidar |
| Avaliacao do Cliente | `avaliacao_do_cliente` | 16x9 | `horizontal` | `ff23c370-89eb-4883-8b5b-c21176f8e746` | 10 | Contrato canonico Produto 3 | Revalidar |
| Chat Imobiliario | `chat_imobiliario` | 1x1 | `square` | `329b6afb-c749-4bda-a319-38ad42639034` | 10 | Contrato canonico Produto 3 | Revalidar |
| Chat Imobiliario | `chat_imobiliario` | 4x5 | `portrait` | `1db7b057-81e0-4db3-af4e-98a7c987cdfa` | 10 | Contrato canonico Produto 3 | Revalidar |
| Chat Imobiliario | `chat_imobiliario` | 4x5 Tipo 2 | `portraitAlt` | `71ae86ec-d08e-4f32-9d61-d7ddcb829f9e` | 10 | Contrato canonico Produto 3 | Revalidar |
| Chat Imobiliario | `chat_imobiliario` | 9x16 | `vertical` | `f4b5c0e9-80fe-408a-b139-f7db7dfbbc89` | 10 | Contrato canonico Produto 3 | Revalidar |
| Chat Imobiliario | `chat_imobiliario` | 16x9 | `horizontal` | `bee2745c-7887-45e0-a82b-f44191fc0f0f` | 10 | Contrato canonico Produto 3 | Revalidar |
| Momentos do Imovel | `momentos_do_imovel` | 1x1 | `square` | `93635efc-ef44-47d2-a8f3-38a379d69941` | 60 | Contrato canonico Produto 3 | Revalidar |
| Momentos do Imovel | `momentos_do_imovel` | 4x5 | `portrait` | `f0a463cc-261f-4b51-ab7e-77fcea67476e` | 60 | Contrato canonico Produto 3 | Revalidar |
| Momentos do Imovel | `momentos_do_imovel` | 4x5 Tipo 2 | `portraitAlt` | `3d72b111-76a7-4c7d-a594-1f75f70be2d2` | 60 | Contrato canonico Produto 3 | Revalidar |
| Momentos do Imovel | `momentos_do_imovel` | 9x16 | `vertical` | `286a1949-9b0c-4bf2-b7b3-b0e84503f671` | 60 | Contrato canonico Produto 3 | Revalidar |
| Momentos do Imovel | `momentos_do_imovel` | 16x9 | `horizontal` | `62d46ee6-6347-4335-af89-2b65f2794882` | 60 | Contrato canonico Produto 3 | Revalidar |
| Reels Moderno | `reels_moderno` | 1x1 | `square` | `9962f7dc-6cca-491f-bffe-3184a2314f21` | 60 | Contrato canonico Produto 3 | Revalidar |
| Reels Moderno | `reels_moderno` | 4x5 | `portrait` | `7f7f420d-da91-48c6-b701-0f0fb540b1aa` | 60 | Contrato canonico Produto 3 | Revalidar |
| Reels Moderno | `reels_moderno` | 4x5 Tipo 2 | `portraitAlt` | `dfdcea18-0f3d-4c84-baa9-463c182644b7` | 60 | Contrato canonico Produto 3 | Revalidar |
| Reels Moderno | `reels_moderno` | 9x16 | `vertical` | `d8310f54-5c9d-4606-ae6a-dacb8c4455ae` | 60 | Contrato canonico Produto 3 | Revalidar |
| Reels Moderno | `reels_moderno` | 16x9 | `horizontal` | `a8a1eebe-b357-4d35-a1fa-2d06887484aa` | 60 | Contrato canonico Produto 3 | Revalidar |
| Galeria Imobiliaria | `galeria_imobiliaria` | 1x1 | `square` | `7a12a73e-ace7-4ab4-9739-95741b82232a` | 60 | Contrato canonico Produto 3 | Revalidar |
| Galeria Imobiliaria | `galeria_imobiliaria` | 4x5 | `portrait` | `8e399960-3ade-453a-b868-e7059f30c6a9` | 60 | Contrato canonico Produto 3 | Revalidar |
| Galeria Imobiliaria | `galeria_imobiliaria` | 4x5 Tipo 2 | `portraitAlt` | `660ca820-3d7d-4d9f-8c45-3d6da832588b` | 60 | Contrato canonico Produto 3 | Revalidar |
| Galeria Imobiliaria | `galeria_imobiliaria` | 9x16 | `vertical` | `856a9b35-ac8c-45bb-8709-bb2dfa2618b7` | 60 | Contrato canonico Produto 3 | Revalidar |
| Galeria Imobiliaria | `galeria_imobiliaria` | 16x9 | `horizontal` | `f2f15dab-77c2-429e-9b62-f8d6694399ed` | 60 | Contrato canonico Produto 3 | Revalidar |
| Slides Premium | `slides_premium` | 1x1 | `square` | `9c7e271b-a9c2-475a-b742-8f949e788abf` | 15 | Contrato canonico Produto 3 | Revalidar |
| Slides Premium | `slides_premium` | 4x5 | `portrait` | `4a7830c5-ff23-446b-8664-2bc8fe86b2c0` | 15 | Contrato canonico Produto 3 | Revalidar |
| Slides Premium | `slides_premium` | 4x5 Tipo 2 | `portraitAlt` | `13008c2d-9e7e-4515-a2ac-649c9ea18409` | 15 | Contrato canonico Produto 3 | Revalidar |
| Slides Premium | `slides_premium` | 9x16 | `vertical` | `eb6ae228-a08f-4747-a761-e4d47f716019` | 15 | Contrato canonico Produto 3 | Revalidar |
| Slides Premium | `slides_premium` | 16x9 | `horizontal` | `2d79f2a0-1143-422c-bdef-7d02c5bb72e9` | 15 | Contrato canonico Produto 3 | Revalidar |
| Video Tour | `video_tour` | 1x1 | `square` | `9ebd1bda-e650-4d88-b8aa-ff555a419082` | 60 | Contrato canonico Produto 3 | Revalidar |
| Video Tour | `video_tour` | 4x5 | `portrait` | `89071652-69ab-4edc-897b-9e7985c95f59` | 60 | Contrato canonico Produto 3 | Revalidar |
| Video Tour | `video_tour` | 4x5 Tipo 2 | `portraitAlt` | `9c831fd6-5412-4afe-9e29-dd8c4984e55c` | 60 | Contrato canonico Produto 3 | Revalidar |
| Video Tour | `video_tour` | 9x16 | `vertical` | `cd6c0ed3-1dde-4fc0-a604-d728e5cbb73b` | 60 | Contrato canonico Produto 3 | Revalidar |
| Video Tour | `video_tour` | 16x9 | `horizontal` | `d5171301-84e3-41d2-a6ca-ef3013f360a1` | 60 | Contrato canonico Produto 3 | Revalidar |
| Triple Slide Carousel | `triple_slide_carousel` | 1x1 | `square` | `2ecd48d3-146c-467b-8a0d-908152101378` | 30 | Contrato canonico Produto 3 | Revalidar |
| Triple Slide Carousel | `triple_slide_carousel` | 4x5 | `portrait` | `16682dcd-eb89-404c-94dc-bb9f01317bf4` | 30 | Contrato canonico Produto 3 | Revalidar |
| Triple Slide Carousel | `triple_slide_carousel` | 4x5 Tipo 2 | `portraitAlt` | `5635ee72-d0da-4906-9a84-6e0b5f587196` | 30 | Contrato canonico Produto 3 | Revalidar |
| Triple Slide Carousel | `triple_slide_carousel` | 9x16 | `vertical` | `fa82c49d-39af-46e8-bc31-3649fff10cae` | 30 | Contrato canonico Produto 3 | Revalidar |
| Triple Slide Carousel | `triple_slide_carousel` | 16x9 | `horizontal` | `21c3ff4b-f632-405f-8ebf-369c1f7d4b10` | 30 | Contrato canonico Produto 3 | Revalidar |

## Checklist Manual Por Template No Creatomate

Aplicar a todos os 60 templates ativos:

- [ ] Todos os textos que devem mudar estao como Dynamic.
- [ ] Nenhum texto de exemplo ficou fixo no template.
- [ ] Nomes dos elementos Dynamic batem com o contrato canonico do backend.
- [ ] Imagens principais estao Dynamic.
- [ ] `property_image_01` corresponde ao slot visual de foto principal.
- [ ] `property_image_02`, `property_image_03` e `property_image_04` preenchem fotos de apoio na ordem correta.
- [ ] CTA esta Dynamic e nao esta fixo.
- [ ] Preco esta Dynamic quando existir no layout.
- [ ] Preco comporta `Consulte` sem quebrar o layout.
- [ ] Bairro/cidade/tipo do imovel aparecem em campo Dynamic.
- [ ] Quartos/suites/vagas/area aparecem somente quando o template comporta.
- [ ] Banheiro nao aparece como destaque principal quando houver suite.
- [ ] Telefone/WhatsApp do corretor nao esta fixo.
- [ ] Email/telefone ficticio nao esta fixo.
- [ ] Nao ha nomes ficticios de corretor, empresa, email, site ou telefone.
- [ ] Textos nao ficam cortados.
- [ ] Contraste esta bom.
- [ ] Fonte esta legivel em mobile.
- [ ] 1x1, 4x5, 9x16 e 16x9 estao visualmente coerentes dentro da familia.
- [ ] Videos/motion nao comecam com tela preta longa demais.
- [ ] Duracao esta aceitavel para o uso pretendido.
- [ ] Marca visual esta premium.
- [ ] Nao ha informacao inventada.
- [ ] Nao ha placeholders visiveis.
- [ ] Nao ha campos em ingles aparecendo para o cliente.

## Tipos De Problema Para Classificacao

Usar estes tipos ao revisar cada template:

- `Campo Dynamic ausente`
- `Campo Dynamic com nome errado`
- `Texto fixo que deveria ser variavel`
- `Imagem fixa que deveria ser variavel`
- `Layout pobre`
- `Texto cortado`
- `Contraste ruim`
- `Tempo de video ruim`
- `Informacao desnecessaria`
- `Template aprovado`

## Checklist De Qualidade Visual Por Familia

### Anuncio Premium

- [ ] A peca comunica oferta clara e direta.
- [ ] `sale_badge`, preco e CTA estao visiveis sem competir entre si.
- [ ] A foto principal domina o layout sem cortar o imovel de forma ruim.
- Status geral: `Revalidar`

### Story Premium

- [ ] Legibilidade boa em mobile.
- [ ] CTA e contato nao ficam pequenos demais.
- [ ] Movimento/tempo, se houver, nao atrasa a leitura.
- Status geral: `Revalidar`

### Card Imobiliario Premium

- [ ] Dados principais estao organizados sem excesso visual.
- [ ] `property_features` cabe bem.
- [ ] Nao parece ficha tecnica fria quando o objetivo e venda.
- Status geral: `Revalidar`

### Imovel Detalhes

- [ ] Usa informacao real do cadastro, sem inventar diferenciais.
- [ ] Dados tecnicos aparecem apenas quando cabem.
- [ ] Suites substituem banheiro como destaque quando aplicavel.
- Status geral: `Revalidar`

### Avaliacao do Cliente

- [ ] Nao usa depoimento falso ou atribuicao enganosa.
- [ ] Se houver texto institucional, esta Dynamic ou neutro.
- [ ] Nao promete avaliacao real se nao foi fornecida.
- Status geral: `Revalidar`

### Chat Imobiliario

- [ ] Conversa/bolhas nao contem texto fixo generico ruim.
- [ ] WhatsApp/telefone nao esta hardcoded.
- [ ] Linguagem parece mensagem do corretor, nao do lead.
- Status geral: `Revalidar`

### Momentos do Imovel

- [ ] Sequencia visual valoriza fotos reais.
- [ ] Nao repete a mesma foto de forma estranha.
- [ ] Duração/motion esta aceitavel.
- Status geral: `Revalidar`

### Reels Moderno

- [ ] Comeca com imagem/texto forte, sem tela preta longa.
- [ ] Textos curtos cabem no ritmo do video.
- [ ] Nao usa trilha/texto/placeholder inadequado.
- Status geral: `Revalidar`

### Galeria Imobiliaria

- [ ] Galeria usa multiplas fotos quando disponiveis.
- [ ] Nao deixa slot vazio ou placeholder visivel.
- [ ] Transicoes e cortes nao prejudicam leitura do imovel.
- Status geral: `Revalidar`

### Slides Premium

- [ ] Cada slide tem funcao clara.
- [ ] Nao ha excesso de texto por slide.
- [ ] Fotos e textos mantem coerencia entre si.
- Status geral: `Revalidar`

### Video Tour

- [ ] Movimento simula apresentacao do imovel sem parecer aleatorio.
- [ ] Duração e ritmo estao adequados.
- [ ] Primeiros segundos mostram valor, nao tela vazia.
- Status geral: `Revalidar`

### Triple Slide Carousel

- [ ] Os 3 slides estao coerentes entre si.
- [ ] Nao ha imagem fixa ou repeticao indevida.
- [ ] Cada slide tem texto curto e legivel.
- Status geral: `Revalidar`

## Registro De Ajustes Manuais No Creatomate

Preencher durante a auditoria manual:

| Familia | Formato | Template ID | Problema encontrado | Tipo do problema | Acao manual no Creatomate | Status |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

## Criterio Para Aprovar Preview Real

Um template/familia so deve virar preview real quando:

- Todos os campos variaveis relevantes estiverem Dynamic.
- O resultado com dados reais nao exibir placeholders.
- O layout estiver legivel no formato final.
- O template nao inventar informacoes.
- O template nao exibir texto fixo incompatível com o imovel.
- O output tiver qualidade visual suficiente para o corretor escolher antes de gerar.

