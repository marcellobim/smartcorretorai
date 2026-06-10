export const TEMPLATE_CATEGORIES = {
  banner: 'Arte premium',
  card: 'Card premium',
  detailed: 'Detalhes do imovel',
  carousel: 'Carrossel',
  story: 'Story',
  reels: 'Reels',
  video: 'Video premium',
  social: 'Prova social',
}

export const TEMPLATE_FORMATS = {
  square: '1:1',
  portrait: '4:5',
  portraitAlt: '4:5 Tipo 2',
  vertical: '9:16',
  horizontal: '16:9',
}


export const TEMPLATE_MODEL_CREDIT_WEIGHTS = {
  anuncio_premium: 20,
  story_premium: 15,
  card_imobiliario_premium: 10,
  imovel_detalhes: 10,
  avaliacao_do_cliente: 10,
  chat_imobiliario: 10,
  momentos_do_imovel: 60,
  frase_elegante: 15,
  reels_moderno: 60,
  galeria_imobiliaria: 60,
  slides_premium: 15,
  video_tour: 60,
  triple_slide_carousel: 30,
}
export const TEMPLATE_CATALOG = [
  {
    "id": "sc_banner_luxo_01",
    "modelId": "anuncio_premium",
    "modelName": "Anuncio Premium",
    "templateId": "662883d7-1dba-4e61-a2a2-81fd9293ab15",
    "publicName": "Anuncio Premium - Envio direto",
    "description": "Arte de impacto para apresentar o imovel com forca comercial.",
    "type": "banner",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 20,
    "tags": [
      "venda_rapida",
      "luxo_premium",
      "mcmv"
    ]
  },
  {
    "id": "real_estate_banner",
    "modelId": "anuncio_premium",
    "modelName": "Anuncio Premium",
    "templateId": "d791b9b8-55e2-4dff-ae5d-76b9e779c551",
    "publicName": "Anuncio Premium - Feed",
    "description": "Arte de impacto para apresentar o imovel com forca comercial.",
    "type": "banner",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 20,
    "tags": [
      "venda_rapida",
      "luxo_premium",
      "mcmv"
    ]
  },
  {
    "id": "sc_banner_popular_01",
    "modelId": "anuncio_premium",
    "modelName": "Anuncio Premium",
    "templateId": "d45618d1-5f7f-4053-b317-dd2bbe322f5b",
    "publicName": "Anuncio Premium - Portais",
    "description": "Arte de impacto para apresentar o imovel com forca comercial.",
    "type": "banner",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 20,
    "tags": [
      "venda_rapida",
      "luxo_premium",
      "mcmv"
    ]
  },
  {
    "id": "anuncio_premium_vertical",
    "modelId": "anuncio_premium",
    "modelName": "Anuncio Premium",
    "templateId": "116761e5-4cda-4c83-b450-7beaaa4ef5e1",
    "publicName": "Anuncio Premium - Vertical",
    "description": "Arte de impacto para apresentar o imovel com forca comercial.",
    "type": "banner",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 20,
    "tags": [
      "venda_rapida",
      "luxo_premium",
      "mcmv"
    ]
  },
  {
    "id": "sc_video_cinematic_01",
    "modelId": "anuncio_premium",
    "modelName": "Anuncio Premium",
    "templateId": "d280898b-7237-4c0b-a889-e85ededa9644",
    "publicName": "Anuncio Premium - Horizontal",
    "description": "Arte de impacto para apresentar o imovel com forca comercial.",
    "type": "banner",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 20,
    "tags": [
      "venda_rapida",
      "luxo_premium",
      "mcmv"
    ]
  },
  {
    "id": "story_premium_square",
    "modelId": "story_premium",
    "modelName": "Story Premium",
    "templateId": "e8314ba2-cd0f-44e3-afd1-de41083c0846",
    "publicName": "Story Premium - Envio direto",
    "description": "Modelo direto para gerar atencao em publicacoes rapidas.",
    "type": "story",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 15,
    "tags": [
      "venda_rapida",
      "lancamento"
    ]
  },
  {
    "id": "story_premium_portrait",
    "modelId": "story_premium",
    "modelName": "Story Premium",
    "templateId": "5461c940-4309-4c3f-bba1-d90e83e62a9a",
    "publicName": "Story Premium - Feed",
    "description": "Modelo direto para gerar atencao em publicacoes rapidas.",
    "type": "story",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 15,
    "tags": [
      "venda_rapida",
      "lancamento"
    ]
  },
  {
    "id": "story_premium_portrait_alt",
    "modelId": "story_premium",
    "modelName": "Story Premium",
    "templateId": "e15d93e5-dbb0-45c9-b475-2d9e2d6a1d0c",
    "publicName": "Story Premium - Portais",
    "description": "Modelo direto para gerar atencao em publicacoes rapidas.",
    "type": "story",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 15,
    "tags": [
      "venda_rapida",
      "lancamento"
    ]
  },
  {
    "id": "new_listing_story",
    "modelId": "story_premium",
    "modelName": "Story Premium",
    "templateId": "1de0a863-2376-4336-8a0a-4750c2429cf7",
    "publicName": "Story Premium - Vertical",
    "description": "Modelo direto para gerar atencao em publicacoes rapidas.",
    "type": "story",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 15,
    "tags": [
      "venda_rapida",
      "lancamento"
    ]
  },
  {
    "id": "story_premium_horizontal",
    "modelId": "story_premium",
    "modelName": "Story Premium",
    "templateId": "c9cf1d8c-4f01-4f65-baf8-ca20c56ad76e",
    "publicName": "Story Premium - Horizontal",
    "description": "Modelo direto para gerar atencao em publicacoes rapidas.",
    "type": "story",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 15,
    "tags": [
      "venda_rapida",
      "lancamento"
    ]
  },
  {
    "id": "real_estate_card",
    "modelId": "card_imobiliario_premium",
    "modelName": "Card Imobiliario Premium",
    "templateId": "0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d",
    "publicName": "Card Imobiliario Premium - Envio direto",
    "description": "Card objetivo para mostrar dados importantes com clareza.",
    "type": "card",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "card_imobiliario_premium_portrait",
    "modelId": "card_imobiliario_premium",
    "modelName": "Card Imobiliario Premium",
    "templateId": "f7df2c44-ea60-4c42-b862-2d335029acad",
    "publicName": "Card Imobiliario Premium - Feed",
    "description": "Card objetivo para mostrar dados importantes com clareza.",
    "type": "card",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "card_imobiliario_premium_portrait_alt",
    "modelId": "card_imobiliario_premium",
    "modelName": "Card Imobiliario Premium",
    "templateId": "2b4e6dff-ee96-42f0-97e1-7956bef9dfa9",
    "publicName": "Card Imobiliario Premium - Portais",
    "description": "Card objetivo para mostrar dados importantes com clareza.",
    "type": "card",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "card_imobiliario_premium_vertical",
    "modelId": "card_imobiliario_premium",
    "modelName": "Card Imobiliario Premium",
    "templateId": "755d1a44-acb9-4593-96b4-f1741b1651af",
    "publicName": "Card Imobiliario Premium - Vertical",
    "description": "Card objetivo para mostrar dados importantes com clareza.",
    "type": "card",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "card_imobiliario_premium_horizontal",
    "modelId": "card_imobiliario_premium",
    "modelName": "Card Imobiliario Premium",
    "templateId": "656ff3e1-325a-419c-9914-dfde82f911b6",
    "publicName": "Card Imobiliario Premium - Horizontal",
    "description": "Card objetivo para mostrar dados importantes com clareza.",
    "type": "card",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "real_estate_detailed",
    "modelId": "imovel_detalhes",
    "modelName": "Imovel Detalhes",
    "templateId": "1ae7e1f4-ada4-4b03-a032-737a025b88c6",
    "publicName": "Imovel Detalhes - Envio direto",
    "description": "Modelo informativo para destacar dados e diferenciais do imovel.",
    "type": "detailed",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "imovel_detalhes_portrait",
    "modelId": "imovel_detalhes",
    "modelName": "Imovel Detalhes",
    "templateId": "4dd468f4-a439-4a31-b6f3-29be17a1d51d",
    "publicName": "Imovel Detalhes - Feed",
    "description": "Modelo informativo para destacar dados e diferenciais do imovel.",
    "type": "detailed",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "imovel_detalhes_portrait_alt",
    "modelId": "imovel_detalhes",
    "modelName": "Imovel Detalhes",
    "templateId": "4ba4698c-3b6e-4548-b73d-814d71bc7f66",
    "publicName": "Imovel Detalhes - Portais",
    "description": "Modelo informativo para destacar dados e diferenciais do imovel.",
    "type": "detailed",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "imovel_detalhes_vertical",
    "modelId": "imovel_detalhes",
    "modelName": "Imovel Detalhes",
    "templateId": "451b3422-f222-414e-b105-44b896f8277e",
    "publicName": "Imovel Detalhes - Vertical",
    "description": "Modelo informativo para destacar dados e diferenciais do imovel.",
    "type": "detailed",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "imovel_detalhes_horizontal",
    "modelId": "imovel_detalhes",
    "modelName": "Imovel Detalhes",
    "templateId": "71aa0276-bc5f-4245-bb37-62a78fa7cf64",
    "publicName": "Imovel Detalhes - Horizontal",
    "description": "Modelo informativo para destacar dados e diferenciais do imovel.",
    "type": "detailed",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv"
    ]
  },
  {
    "id": "animated_review",
    "modelId": "avaliacao_do_cliente",
    "modelName": "Avaliacao do Cliente",
    "templateId": "792ad84a-0ab8-4e6c-bda1-400fe9c040cc",
    "publicName": "Avaliacao do Cliente - Envio direto",
    "description": "Prova social para reforcar confianca e autoridade.",
    "type": "social",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 10,
    "tags": [
      "captacao_imovel",
      "mcmv"
    ]
  },
  {
    "id": "avaliacao_do_cliente_portrait",
    "modelId": "avaliacao_do_cliente",
    "modelName": "Avaliacao do Cliente",
    "templateId": "a83a2008-8a6a-4a40-8b6f-d87190a1d306",
    "publicName": "Avaliacao do Cliente - Feed",
    "description": "Prova social para reforcar confianca e autoridade.",
    "type": "social",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 10,
    "tags": [
      "captacao_imovel",
      "mcmv"
    ]
  },
  {
    "id": "avaliacao_do_cliente_portrait_alt",
    "modelId": "avaliacao_do_cliente",
    "modelName": "Avaliacao do Cliente",
    "templateId": "cfded0ba-1eb9-4396-ab63-b259cb817a1e",
    "publicName": "Avaliacao do Cliente - Portais",
    "description": "Prova social para reforcar confianca e autoridade.",
    "type": "social",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 10,
    "tags": [
      "captacao_imovel",
      "mcmv"
    ]
  },
  {
    "id": "avaliacao_do_cliente_vertical",
    "modelId": "avaliacao_do_cliente",
    "modelName": "Avaliacao do Cliente",
    "templateId": "52a1e65f-ca92-4c6c-af7e-9f0100c886cb",
    "publicName": "Avaliacao do Cliente - Vertical",
    "description": "Prova social para reforcar confianca e autoridade.",
    "type": "social",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 10,
    "tags": [
      "captacao_imovel",
      "mcmv"
    ]
  },
  {
    "id": "avaliacao_do_cliente_horizontal",
    "modelId": "avaliacao_do_cliente",
    "modelName": "Avaliacao do Cliente",
    "templateId": "ff23c370-89eb-4883-8b5b-c21176f8e746",
    "publicName": "Avaliacao do Cliente - Horizontal",
    "description": "Prova social para reforcar confianca e autoridade.",
    "type": "social",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 10,
    "tags": [
      "captacao_imovel",
      "mcmv"
    ]
  },
  {
    "id": "chat_imobiliario_square",
    "modelId": "chat_imobiliario",
    "modelName": "Chat Imobiliario",
    "templateId": "329b6afb-c749-4bda-a319-38ad42639034",
    "publicName": "Chat Imobiliario - Envio direto",
    "description": "Peca com linguagem de conversa para estimular contato do lead.",
    "type": "social",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv",
      "captacao_imovel"
    ]
  },
  {
    "id": "chat_imobiliario_portrait",
    "modelId": "chat_imobiliario",
    "modelName": "Chat Imobiliario",
    "templateId": "1db7b057-81e0-4db3-af4e-98a7c987cdfa",
    "publicName": "Chat Imobiliario - Feed",
    "description": "Peca com linguagem de conversa para estimular contato do lead.",
    "type": "social",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv",
      "captacao_imovel"
    ]
  },
  {
    "id": "chat_imobiliario_portrait_alt",
    "modelId": "chat_imobiliario",
    "modelName": "Chat Imobiliario",
    "templateId": "71ae86ec-d08e-4f32-9d61-d7ddcb829f9e",
    "publicName": "Chat Imobiliario - Portais",
    "description": "Peca com linguagem de conversa para estimular contato do lead.",
    "type": "social",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv",
      "captacao_imovel"
    ]
  },
  {
    "id": "chat_with_photos",
    "modelId": "chat_imobiliario",
    "modelName": "Chat Imobiliario",
    "templateId": "f4b5c0e9-80fe-408a-b139-f7db7dfbbc89",
    "publicName": "Chat Imobiliario - Vertical",
    "description": "Peca com linguagem de conversa para estimular contato do lead.",
    "type": "social",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv",
      "captacao_imovel"
    ]
  },
  {
    "id": "chat_imobiliario_horizontal",
    "modelId": "chat_imobiliario",
    "modelName": "Chat Imobiliario",
    "templateId": "bee2745c-7887-45e0-a82b-f44191fc0f0f",
    "publicName": "Chat Imobiliario - Horizontal",
    "description": "Peca com linguagem de conversa para estimular contato do lead.",
    "type": "social",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 10,
    "tags": [
      "venda_rapida",
      "mcmv",
      "captacao_imovel"
    ]
  },
  {
    "id": "photo_montage",
    "modelId": "momentos_do_imovel",
    "modelName": "Momentos do Imovel",
    "templateId": "93635efc-ef44-47d2-a8f3-38a379d69941",
    "publicName": "Momentos do Imovel - Envio direto",
    "description": "Modelo visual para valorizar ambientes e criar sensacao de visita.",
    "type": "video",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium",
      "venda_rapida"
    ]
  },
  {
    "id": "momentos_do_imovel_portrait",
    "modelId": "momentos_do_imovel",
    "modelName": "Momentos do Imovel",
    "templateId": "f0a463cc-261f-4b51-ab7e-77fcea67476e",
    "publicName": "Momentos do Imovel - Feed",
    "description": "Modelo visual para valorizar ambientes e criar sensacao de visita.",
    "type": "video",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium",
      "venda_rapida"
    ]
  },
  {
    "id": "polaroid_photos",
    "modelId": "momentos_do_imovel",
    "modelName": "Momentos do Imovel",
    "templateId": "3d72b111-76a7-4c7d-a594-1f75f70be2d2",
    "publicName": "Momentos do Imovel - Portais",
    "description": "Modelo visual para valorizar ambientes e criar sensacao de visita.",
    "type": "video",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium",
      "venda_rapida"
    ]
  },
  {
    "id": "momentos_do_imovel_vertical",
    "modelId": "momentos_do_imovel",
    "modelName": "Momentos do Imovel",
    "templateId": "286a1949-9b0c-4bf2-b7b3-b0e84503f671",
    "publicName": "Momentos do Imovel - Vertical",
    "description": "Modelo visual para valorizar ambientes e criar sensacao de visita.",
    "type": "video",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium",
      "venda_rapida"
    ]
  },
  {
    "id": "real_estate_video_montage",
    "modelId": "momentos_do_imovel",
    "modelName": "Momentos do Imovel",
    "templateId": "62d46ee6-6347-4335-af89-2b65f2794882",
    "publicName": "Momentos do Imovel - Horizontal",
    "description": "Modelo visual para valorizar ambientes e criar sensacao de visita.",
    "type": "video",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium",
      "venda_rapida"
    ]
  },
  {
    "id": "frase_elegante_square",
    "modelId": "frase_elegante",
    "modelName": "Frase Elegante",
    "templateId": "8aab78ac-60cd-4e83-9f4c-51259c4751c6",
    "publicName": "Frase Elegante - Envio direto",
    "description": "Criativo para destacar uma oportunidade com linguagem sofisticada.",
    "type": "social",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "captacao_imovel"
    ]
  },
  {
    "id": "frase_elegante_portrait",
    "modelId": "frase_elegante",
    "modelName": "Frase Elegante",
    "templateId": "164eef00-abf4-429a-9334-c9e4c1319998",
    "publicName": "Frase Elegante - Feed",
    "description": "Criativo para destacar uma oportunidade com linguagem sofisticada.",
    "type": "social",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "captacao_imovel"
    ]
  },
  {
    "id": "frase_elegante_portrait_alt",
    "modelId": "frase_elegante",
    "modelName": "Frase Elegante",
    "templateId": "9a9c663c-0348-462b-a470-c40a86092a81",
    "publicName": "Frase Elegante - Portais",
    "description": "Criativo para destacar uma oportunidade com linguagem sofisticada.",
    "type": "social",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "captacao_imovel"
    ]
  },
  {
    "id": "searchlight_reveal",
    "modelId": "frase_elegante",
    "modelName": "Frase Elegante",
    "templateId": "697a514d-4bab-4062-9c9e-3c208688c0e9",
    "publicName": "Frase Elegante - Vertical",
    "description": "Criativo para destacar uma oportunidade com linguagem sofisticada.",
    "type": "social",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "captacao_imovel"
    ]
  },
  {
    "id": "frase_elegante_horizontal",
    "modelId": "frase_elegante",
    "modelName": "Frase Elegante",
    "templateId": "e74922ee-5882-4917-9051-9ae2e4021767",
    "publicName": "Frase Elegante - Horizontal",
    "description": "Criativo para destacar uma oportunidade com linguagem sofisticada.",
    "type": "social",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "captacao_imovel"
    ]
  },
  {
    "id": "reels_moderno_square",
    "modelId": "reels_moderno",
    "modelName": "Reels Moderno",
    "templateId": "9962f7dc-6cca-491f-bffe-3184a2314f21",
    "publicName": "Reels Moderno - Envio direto",
    "description": "Video curto para aumentar alcance e destacar o imovel com movimento.",
    "type": "reels",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 60,
    "tags": [
      "venda_rapida",
      "lancamento",
      "airbnb_temporada"
    ]
  },
  {
    "id": "reels_moderno_portrait",
    "modelId": "reels_moderno",
    "modelName": "Reels Moderno",
    "templateId": "7f7f420d-da91-48c6-b701-0f0fb540b1aa",
    "publicName": "Reels Moderno - Feed",
    "description": "Video curto para aumentar alcance e destacar o imovel com movimento.",
    "type": "reels",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 60,
    "tags": [
      "venda_rapida",
      "lancamento",
      "airbnb_temporada"
    ]
  },
  {
    "id": "reels_moderno_portrait_alt",
    "modelId": "reels_moderno",
    "modelName": "Reels Moderno",
    "templateId": "dfdcea18-0f3d-4c84-baa9-463c182644b7",
    "publicName": "Reels Moderno - Portais",
    "description": "Video curto para aumentar alcance e destacar o imovel com movimento.",
    "type": "reels",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 60,
    "tags": [
      "venda_rapida",
      "lancamento",
      "airbnb_temporada"
    ]
  },
  {
    "id": "sc_reels_moderno_01",
    "modelId": "reels_moderno",
    "modelName": "Reels Moderno",
    "templateId": "d8310f54-5c9d-4606-ae6a-dacb8c4455ae",
    "publicName": "Reels Moderno - Vertical",
    "description": "Video curto para aumentar alcance e destacar o imovel com movimento.",
    "type": "reels",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 60,
    "tags": [
      "venda_rapida",
      "lancamento",
      "airbnb_temporada"
    ]
  },
  {
    "id": "reels_moderno_horizontal",
    "modelId": "reels_moderno",
    "modelName": "Reels Moderno",
    "templateId": "a8a1eebe-b357-4d35-a1fa-2d06887484aa",
    "publicName": "Reels Moderno - Horizontal",
    "description": "Video curto para aumentar alcance e destacar o imovel com movimento.",
    "type": "reels",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 60,
    "tags": [
      "venda_rapida",
      "lancamento",
      "airbnb_temporada"
    ]
  },
  {
    "id": "galeria_imobiliaria_square",
    "modelId": "galeria_imobiliaria",
    "modelName": "Galeria Imobiliaria",
    "templateId": "7a12a73e-ace7-4ab4-9739-95741b82232a",
    "publicName": "Galeria Imobiliaria - Envio direto",
    "description": "Sequencia para apresentar fotos e ambientes do imovel.",
    "type": "video",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium"
    ]
  },
  {
    "id": "galeria_imobiliaria_portrait",
    "modelId": "galeria_imobiliaria",
    "modelName": "Galeria Imobiliaria",
    "templateId": "8e399960-3ade-453a-b868-e7059f30c6a9",
    "publicName": "Galeria Imobiliaria - Feed",
    "description": "Sequencia para apresentar fotos e ambientes do imovel.",
    "type": "video",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium"
    ]
  },
  {
    "id": "galeria_imobiliaria_portrait_alt",
    "modelId": "galeria_imobiliaria",
    "modelName": "Galeria Imobiliaria",
    "templateId": "660ca820-3d7d-4d9f-8c45-3d6da832588b",
    "publicName": "Galeria Imobiliaria - Portais",
    "description": "Sequencia para apresentar fotos e ambientes do imovel.",
    "type": "video",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium"
    ]
  },
  {
    "id": "galeria_imobiliaria_vertical",
    "modelId": "galeria_imobiliaria",
    "modelName": "Galeria Imobiliaria",
    "templateId": "856a9b35-ac8c-45bb-8709-bb2dfa2618b7",
    "publicName": "Galeria Imobiliaria - Vertical",
    "description": "Sequencia para apresentar fotos e ambientes do imovel.",
    "type": "video",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium"
    ]
  },
  {
    "id": "image_slideshow",
    "modelId": "galeria_imobiliaria",
    "modelName": "Galeria Imobiliaria",
    "templateId": "f2f15dab-77c2-429e-9b62-f8d6694399ed",
    "publicName": "Galeria Imobiliaria - Horizontal",
    "description": "Sequencia para apresentar fotos e ambientes do imovel.",
    "type": "video",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 60,
    "tags": [
      "airbnb_temporada",
      "luxo_premium"
    ]
  },
  {
    "id": "slides_premium_square",
    "modelId": "slides_premium",
    "modelName": "Slides Premium",
    "templateId": "9c7e271b-a9c2-475a-b742-8f949e788abf",
    "publicName": "Slides Premium - Envio direto",
    "description": "Sequencia visual para destacar fotos, detalhes e chamada comercial.",
    "type": "story",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "lancamento"
    ]
  },
  {
    "id": "slides_premium_portrait",
    "modelId": "slides_premium",
    "modelName": "Slides Premium",
    "templateId": "4a7830c5-ff23-446b-8664-2bc8fe86b2c0",
    "publicName": "Slides Premium - Feed",
    "description": "Sequencia visual para destacar fotos, detalhes e chamada comercial.",
    "type": "story",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "lancamento"
    ]
  },
  {
    "id": "sc_story_premium_01",
    "modelId": "slides_premium",
    "modelName": "Slides Premium",
    "templateId": "13008c2d-9e7e-4515-a2ac-649c9ea18409",
    "publicName": "Slides Premium - Portais",
    "description": "Sequencia visual para destacar fotos, detalhes e chamada comercial.",
    "type": "story",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "lancamento"
    ]
  },
  {
    "id": "slides_premium_vertical",
    "modelId": "slides_premium",
    "modelName": "Slides Premium",
    "templateId": "eb6ae228-a08f-4747-a761-e4d47f716019",
    "publicName": "Slides Premium - Vertical",
    "description": "Sequencia visual para destacar fotos, detalhes e chamada comercial.",
    "type": "story",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "lancamento"
    ]
  },
  {
    "id": "slides_premium_horizontal",
    "modelId": "slides_premium",
    "modelName": "Slides Premium",
    "templateId": "2d79f2a0-1143-422c-bdef-7d02c5bb72e9",
    "publicName": "Slides Premium - Horizontal",
    "description": "Sequencia visual para destacar fotos, detalhes e chamada comercial.",
    "type": "story",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 15,
    "tags": [
      "luxo_premium",
      "lancamento"
    ]
  },
  {
    "id": "video_tour_square",
    "modelId": "video_tour",
    "modelName": "Video Tour",
    "templateId": "9ebd1bda-e650-4d88-b8aa-ff555a419082",
    "publicName": "Video Tour - Envio direto",
    "description": "Apresentacao em video para valorizar ambientes e aumentar percepcao de valor.",
    "type": "video",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 60,
    "tags": [
      "luxo_premium",
      "airbnb_temporada"
    ]
  },
  {
    "id": "video_tour_portrait",
    "modelId": "video_tour",
    "modelName": "Video Tour",
    "templateId": "89071652-69ab-4edc-897b-9e7985c95f59",
    "publicName": "Video Tour - Feed",
    "description": "Apresentacao em video para valorizar ambientes e aumentar percepcao de valor.",
    "type": "video",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 60,
    "tags": [
      "luxo_premium",
      "airbnb_temporada"
    ]
  },
  {
    "id": "video_tour_portrait_alt",
    "modelId": "video_tour",
    "modelName": "Video Tour",
    "templateId": "9c831fd6-5412-4afe-9e29-dd8c4984e55c",
    "publicName": "Video Tour - Portais",
    "description": "Apresentacao em video para valorizar ambientes e aumentar percepcao de valor.",
    "type": "video",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 60,
    "tags": [
      "luxo_premium",
      "airbnb_temporada"
    ]
  },
  {
    "id": "video_tour_vertical",
    "modelId": "video_tour",
    "modelName": "Video Tour",
    "templateId": "cd6c0ed3-1dde-4fc0-a604-d728e5cbb73b",
    "publicName": "Video Tour - Vertical",
    "description": "Apresentacao em video para valorizar ambientes e aumentar percepcao de valor.",
    "type": "video",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 60,
    "tags": [
      "luxo_premium",
      "airbnb_temporada"
    ]
  },
  {
    "id": "video_compilation",
    "modelId": "video_tour",
    "modelName": "Video Tour",
    "templateId": "d5171301-84e3-41d2-a6ca-ef3013f360a1",
    "publicName": "Video Tour - Horizontal",
    "description": "Apresentacao em video para valorizar ambientes e aumentar percepcao de valor.",
    "type": "video",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 60,
    "tags": [
      "luxo_premium",
      "airbnb_temporada"
    ]
  },
  {
    "id": "triple_slide_carousel",
    "modelId": "triple_slide_carousel",
    "modelName": "Triple Slide Carousel",
    "templateId": "2ecd48d3-146c-467b-8a0d-908152101378",
    "publicName": "Triple Slide Carousel - Envio direto",
    "description": "Carrossel premium para apresentar diferenciais e criar uma narrativa visual.",
    "type": "carousel",
    "format": "square",
    "formatLabel": "1x1",
    "creditWeight": 30,
    "tags": [
      "venda_rapida",
      "lancamento",
      "mcmv"
    ]
  },
  {
    "id": "triple_slide_carousel_portrait",
    "modelId": "triple_slide_carousel",
    "modelName": "Triple Slide Carousel",
    "templateId": "16682dcd-eb89-404c-94dc-bb9f01317bf4",
    "publicName": "Triple Slide Carousel - Feed",
    "description": "Carrossel premium para apresentar diferenciais e criar uma narrativa visual.",
    "type": "carousel",
    "format": "portrait",
    "formatLabel": "4x5",
    "creditWeight": 30,
    "tags": [
      "venda_rapida",
      "lancamento",
      "mcmv"
    ]
  },
  {
    "id": "triple_slide_carousel_portrait_alt",
    "modelId": "triple_slide_carousel",
    "modelName": "Triple Slide Carousel",
    "templateId": "5635ee72-d0da-4906-9a84-6e0b5f587196",
    "publicName": "Triple Slide Carousel - Portais",
    "description": "Carrossel premium para apresentar diferenciais e criar uma narrativa visual.",
    "type": "carousel",
    "format": "portraitAlt",
    "formatLabel": "4x5 Tipo 2",
    "creditWeight": 30,
    "tags": [
      "venda_rapida",
      "lancamento",
      "mcmv"
    ]
  },
  {
    "id": "triple_slide_carousel_vertical",
    "modelId": "triple_slide_carousel",
    "modelName": "Triple Slide Carousel",
    "templateId": "fa82c49d-39af-46e8-bc31-3649fff10cae",
    "publicName": "Triple Slide Carousel - Vertical",
    "description": "Carrossel premium para apresentar diferenciais e criar uma narrativa visual.",
    "type": "carousel",
    "format": "vertical",
    "formatLabel": "9x16",
    "creditWeight": 30,
    "tags": [
      "venda_rapida",
      "lancamento",
      "mcmv"
    ]
  },
  {
    "id": "triple_slide_carousel_horizontal",
    "modelId": "triple_slide_carousel",
    "modelName": "Triple Slide Carousel",
    "templateId": "21c3ff4b-f632-405f-8ebf-369c1f7d4b10",
    "publicName": "Triple Slide Carousel - Horizontal",
    "description": "Carrossel premium para apresentar diferenciais e criar uma narrativa visual.",
    "type": "carousel",
    "format": "horizontal",
    "formatLabel": "16x9",
    "creditWeight": 30,
    "tags": [
      "venda_rapida",
      "lancamento",
      "mcmv"
    ]
  }
]

export const TEMPLATE_MODEL_PREVIEWS = {
  anuncio_premium: {
    modelId: 'anuncio_premium',
    modelName: 'Anuncio Premium',
    previewTitle: 'Anuncio Premium',
    previewDescription: 'Preview real do modelo Anuncio Premium para Banners Rapidos.',
    previewFormat: 'horizontal',
    previewTemplateId: '662883d7-1dba-4e61-a2a2-81fd9293ab15',
    previewAssetUrl: '/previews/produto3/anuncio-premium-preview-16x9.jpg',
    previewType: 'image',
    previewStatus: 'ready',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/anuncio-premium.svg',
    previewAlt: 'Preview do modelo Anuncio Premium',
  },
  story_premium: {
    modelId: 'story_premium',
    modelName: 'Story Premium',
    previewTitle: 'Story Premium',
    previewDescription: 'Preview generico do modelo Story Premium para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: 'e8314ba2-cd0f-44e3-afd1-de41083c0846',
    previewAssetUrl: '/previews/produto3/story-premium.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/story-premium.svg',
    previewAlt: 'Preview do modelo Story Premium',
  },
  card_imobiliario_premium: {
    modelId: 'card_imobiliario_premium',
    modelName: 'Card Imobiliario Premium',
    previewTitle: 'Card Imobiliario Premium',
    previewDescription: 'Preview generico do modelo Card Imobiliario Premium para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '0e8a9ffd-36e3-493a-bf3b-9d83f3b6699d',
    previewAssetUrl: '/previews/produto3/card-imobiliario-premium.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/card-imobiliario-premium.svg',
    previewAlt: 'Preview do modelo Card Imobiliario Premium',
  },
  imovel_detalhes: {
    modelId: 'imovel_detalhes',
    modelName: 'Imovel Detalhes',
    previewTitle: 'Imovel Detalhes',
    previewDescription: 'Preview generico do modelo Imovel Detalhes para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '1ae7e1f4-ada4-4b03-a032-737a025b88c6',
    previewAssetUrl: '/previews/produto3/imovel-detalhes.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/imovel-detalhes.svg',
    previewAlt: 'Preview do modelo Imovel Detalhes',
  },
  avaliacao_do_cliente: {
    modelId: 'avaliacao_do_cliente',
    modelName: 'Avaliacao do Cliente',
    previewTitle: 'Avaliacao do Cliente',
    previewDescription: 'Preview generico do modelo Avaliacao do Cliente para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '792ad84a-0ab8-4e6c-bda1-400fe9c040cc',
    previewAssetUrl: '/previews/produto3/avaliacao-do-cliente.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/avaliacao-do-cliente.svg',
    previewAlt: 'Preview do modelo Avaliacao do Cliente',
  },
  chat_imobiliario: {
    modelId: 'chat_imobiliario',
    modelName: 'Chat Imobiliario',
    previewTitle: 'Chat Imobiliario',
    previewDescription: 'Preview generico do modelo Chat Imobiliario para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '329b6afb-c749-4bda-a319-38ad42639034',
    previewAssetUrl: '/previews/produto3/chat-imobiliario.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/chat-imobiliario.svg',
    previewAlt: 'Preview do modelo Chat Imobiliario',
  },
  momentos_do_imovel: {
    modelId: 'momentos_do_imovel',
    modelName: 'Momentos do Imovel',
    previewTitle: 'Momentos do Imovel',
    previewDescription: 'Preview generico do modelo Momentos do Imovel para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '93635efc-ef44-47d2-a8f3-38a379d69941',
    previewAssetUrl: '/previews/produto3/momentos-do-imovel.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/momentos-do-imovel.svg',
    previewAlt: 'Preview do modelo Momentos do Imovel',
  },
  reels_moderno: {
    modelId: 'reels_moderno',
    modelName: 'Reels Moderno',
    previewTitle: 'Reels Moderno',
    previewDescription: 'Preview generico do modelo Reels Moderno para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '9962f7dc-6cca-491f-bffe-3184a2314f21',
    previewAssetUrl: '/previews/produto3/reels-moderno.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/reels-moderno.svg',
    previewAlt: 'Preview do modelo Reels Moderno',
  },
  galeria_imobiliaria: {
    modelId: 'galeria_imobiliaria',
    modelName: 'Galeria Imobiliaria',
    previewTitle: 'Galeria Imobiliaria',
    previewDescription: 'Preview generico do modelo Galeria Imobiliaria para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '7a12a73e-ace7-4ab4-9739-95741b82232a',
    previewAssetUrl: '/previews/produto3/galeria-imobiliaria.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/galeria-imobiliaria.svg',
    previewAlt: 'Preview do modelo Galeria Imobiliaria',
  },
  slides_premium: {
    modelId: 'slides_premium',
    modelName: 'Slides Premium',
    previewTitle: 'Slides Premium',
    previewDescription: 'Preview generico do modelo Slides Premium para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '9c7e271b-a9c2-475a-b742-8f949e788abf',
    previewAssetUrl: '/previews/produto3/slides-premium.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/slides-premium.svg',
    previewAlt: 'Preview do modelo Slides Premium',
  },
  video_tour: {
    modelId: 'video_tour',
    modelName: 'Video Tour',
    previewTitle: 'Video Tour',
    previewDescription: 'Preview generico do modelo Video Tour para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '9ebd1bda-e650-4d88-b8aa-ff555a419082',
    previewAssetUrl: '/previews/produto3/video-tour.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/video-tour.svg',
    previewAlt: 'Preview do modelo Video Tour',
  },
  triple_slide_carousel: {
    modelId: 'triple_slide_carousel',
    modelName: 'Triple Slide Carousel',
    previewTitle: 'Triple Slide Carousel',
    previewDescription: 'Preview generico do modelo Triple Slide Carousel para Banners Rapidos.',
    previewFormat: 'video',
    previewTemplateId: '2ecd48d3-146c-467b-8a0d-908152101378',
    previewAssetUrl: '/previews/produto3/triple-slide-carousel.mp4',
    previewType: 'video',
    previewStatus: 'missing',
    previewLabel: 'Ver',
    posterUrl: '/previews/modelos-produto3/carrossel-premium.svg',
    previewAlt: 'Preview do modelo Triple Slide Carousel',
  },
}

export const TEMPLATE_BY_ID = Object.fromEntries(
  TEMPLATE_CATALOG.map((template) => [template.id, template])
)

export const TEMPLATE_BY_TEMPLATE_ID = Object.fromEntries(
  TEMPLATE_CATALOG.map((template) => [template.templateId, template])
)

export const getSelectedTemplatesFromCatalogIds = (catalogIds = []) => (
  catalogIds
    .map((catalogId) => TEMPLATE_BY_ID[catalogId]?.templateId)
    .filter(Boolean)
)

export default TEMPLATE_CATALOG
