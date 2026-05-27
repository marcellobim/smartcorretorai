# Creatomate Payload Audit

Data: 2026-05-27

Escopo: auditoria de leitura do payload enviado do SmartCorretorAI para a Edge Function `gerar-banners` e, depois, para a API do Creatomate. Nenhum arquivo de codigo foi alterado nesta auditoria.

## Fluxo Atual

O fluxo principal parte da pagina `frontend/src/pages/NovaCampanha.jsx`.

Ao clicar em gerar, a pagina:

1. Faz upload das fotos no bucket `smartcorretor-assets`.
2. Monta o payload da campanha textual.
3. Se houver templates selecionados, monta tambem o payload dos banners.
4. Dispara `gerar-campanha` e `gerar-banners` em paralelo.
5. Faz polling dos renders do Creatomate ate `succeeded` ou `failed`.

Se nenhum formato estiver selecionado, a chamada de banners e videos e pulada, e a geracao textual continua funcionando.

## Payload Frontend Para `gerar-banners`

O payload atual enviado pela tela contem:

```json
{
  "user_id": "id do usuario autenticado",
  "selectedTemplates": [
    "template_id_1",
    "template_id_2"
  ],
  "fotos_urls": [
    "url_publica_1",
    "url_publica_2"
  ],
  "foto_principal": "url_publica_1",
  "titulo": "titulo da campanha",
  "descricao": "descricao do imovel",
  "preco": "preco formatado",
  "endereco": "bairro, cidade, estado",
  "tipo_imovel": "tipo do imovel",
  "corretor_nome": "nome exibido do corretor",
  "corretor_avatar_url": "url da foto do corretor",
  "marca_imovel": "nome da imobiliaria ou marca"
}
```

Existe tambem um fluxo separado pelo botao "Gerar banners e videos", que envia payload semelhante e inclui `campaign_id` quando ja existe campanha salva.

## Autenticacao Do Payload

A chamada para `gerar-banners` usa `Authorization: Bearer <accessToken>`.

No backend, a Edge Function valida o JWT com:

```ts
supabase.auth.getUser(token)
```

O `user_id` recebido no body nao deve ser tratado como fonte de verdade. O backend ja usa o usuario autenticado do token como referencia segura.

## Enriquecimento No Backend

Quando `campaign_id` e recebido, a Edge Function busca dados na tabela `campaigns`, incluindo:

- `dados_imovel`
- `textos_gerados`
- `fotos_urls`

Depois busca dados do corretor na tabela `profiles`, incluindo:

- `nome`
- `email`
- `creci`
- `telefone`
- `whatsapp`
- `imobiliaria`
- `site`
- `instagram`
- `avatar_url`
- `logo_url`

Campos opcionais vazios sao convertidos para `REMOVER_ELEMENTO` no bloco de dados enviado para a IA.

## Descoberta De Elementos Do Template

Antes de montar as `modifications`, a Edge Function faz:

```http
GET https://api.creatomate.com/v1/templates/{template_id}
Authorization: Bearer ${CREATOMATE_API_KEY}
```

Com a resposta, ela extrai os elementos reais do template e usa esses nomes como contrato permitido.

Esse mecanismo reduz o risco de enviar nomes inexistentes ao Creatomate.

## Payload Para Render No Creatomate

O envio final para o Creatomate segue este formato:

```json
{
  "template_id": "id do template",
  "modifications": {
    "nome_do_elemento.text": "texto final",
    "nome_do_elemento.source": "url da imagem",
    "nome_do_elemento.track": false
  }
}
```

Propriedades aceitas atualmente pelo validador:

- `.text`
- `.source`
- `.background`
- `.fill_color`
- `.stroke_color`
- `.color`
- `.opacity`
- `.track`

O validador permite `.track` booleano e strings vazias quando usadas para remover elementos opcionais.

## Payload Antigo Ainda Presente

O backend ainda trabalha com uma estrategia dinamica e antiga:

1. Descobre os elementos reais do template.
2. Pede para a IA montar `modifications`.
3. Valida e sanitiza as respostas.
4. Corrige placeholders em ingles ou ficticios.

Isso significa que ainda nao existe um contrato fixo prioritario para os novos campos padronizados:

- `property_image_01`
- `property_image_02`
- `property_image_03`
- `feature_01`
- `feature_02`
- `feature_03`
- `features_title`
- `property_description`
- `property_price`
- `price_label`
- `headline_main`
- `sale_badge`

Esses campos podem funcionar se a IA os preencher corretamente, mas ainda nao existe preenchimento direto e deterministico no backend.

## Polling Dos Renders

O polling atual e feito no frontend contra:

```http
GET https://api.creatomate.com/v1/renders/{render_id}
Authorization: Bearer <CREATOMATE_API_KEY>
```

Risco: a chave do Creatomate aparece hardcoded no frontend para polling. Mesmo que a Edge Function use `Deno.env.get("CREATOMATE_API_KEY")`, a tela ainda expoe a chave no navegador.

## Persistencia Em `campaigns.banners`

A Edge Function salva os renders retornados no campo `banners` da tabela `campaigns`, quando `campaign_id` esta disponivel.

O registro inclui informacoes como:

- `render_id`
- `template_id`
- `template_name`
- `status`
- `url`
- `snapshot_url`

O frontend tambem atualiza a campanha com os banners quando o fluxo paralelo gera a campanha e os banners na mesma acao.

## Riscos Encontrados

1. Novos template IDs ainda nao cadastrados no backend serao rejeitados.
2. A interface ainda exibe IDs antigos no seletor de formatos.
3. Templates renomeados como `[OFF]` no Creatomate ainda aparecem no codigo se o ID antigo estiver cadastrado.
4. O preenchimento ainda depende de IA para montar `modifications`, mesmo com templates agora padronizados.
5. A chave do Creatomate ainda aparece no frontend para polling.
6. Se `campaign_id` nao existir no primeiro momento do fluxo paralelo, o salvamento de banners depende da atualizacao posterior feita pelo frontend.
7. Campos novos como `feature_01`, `feature_02` e `feature_03` ainda precisam de regra clara de origem a partir dos diferenciais do imovel.

## Conclusao

O backend ja possui uma camada importante de protecao: ele consulta os elementos reais do template antes de montar as `modifications` e valida o resultado antes de enviar ao Creatomate.

O ponto principal ainda pendente e trocar o modelo dinamico antigo por um preenchimento prioritario dos campos padronizados. A IA deve ficar como fallback para templates especiais, nao como caminho principal para os novos templates brasileiros.
