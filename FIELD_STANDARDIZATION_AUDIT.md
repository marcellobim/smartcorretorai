# Field Standardization Audit

Data: 2026-05-27

Escopo: comparacao entre os campos padronizados dos novos templates Creatomate e o estado atual do frontend/backend do SmartCorretorAI. Nenhum arquivo de codigo foi alterado nesta auditoria.

## Campos Padronizados Desejados

Os novos templates foram padronizados com os seguintes campos principais:

```txt
property_image_01
property_image_02
property_image_03

feature_01
feature_02
feature_03

features_title
property_description
property_price
price_label
headline_main
sale_badge
```

Valores visuais brasileiros padrao:

```txt
headline_main = Oportunidade
sale_badge = A Venda
price_label = A partir de
features_title = Diferenciais
```

Observacao: nos templates, o texto pode usar acentos normalmente, como `À Venda`. Em codigo e documentacao tecnica, manter o cuidado com encoding.

## Estado Atual Do Backend

A Edge Function `supabase/functions/gerar-banners/index.ts` ainda nao possui um construtor direto para esses campos padronizados.

O comportamento atual e:

1. Recebe os dados do imovel e do corretor.
2. Busca os elementos reais do template no Creatomate.
3. Envia esses nomes para a IA.
4. A IA monta as `modifications`.
5. O backend valida e sanitiza.
6. O backend envia o render ao Creatomate.

Esse fluxo funciona como camada flexivel, mas nao aproveita totalmente a padronizacao nova.

## Campos Antigos Ainda Encontrados

Foram identificados nomes antigos ou nao padronizados ainda considerados pelo sistema por causa dos templates antigos:

### Imagens

```txt
property_media_01
property_media_02
property_media_03
property_media_04
Photo-1
Photo-2
Photo-3
Image-1
Image-2
Image-3
image_01
image_1
image_2
image_3
```

### Textos De Imovel

```txt
headline_01
location_text_01
details_text_01
price_text
property_location
property_features
property_description
property_price
```

### Marca, Corretor E Contato

```txt
brand_name
brabd_name
broker_name
agent_name
agente_name
agent_logo
logo_image
broker_avatar
broker_whatsapp
broker_email
agent_phone
cta_text
```

### Templates Especiais

```txt
quote_text
review_text
review_date
client_name
client_photo
message_01
message_02
message_03
caption_01
caption_02
caption_03
```

Esses campos nao precisam necessariamente ser removidos agora, mas devem ser tratados como legado ou especificos de familias especiais.

## Dicionarios Antigos De Traducao E Sanitizacao

A funcao `sanitizeTemplateText()` ainda contem regras para limpar ou traduzir placeholders antigos, incluindo:

- emails ficticios
- telefones ficticios
- dominios ficticios
- cidades americanas
- estados americanos
- nomes ficticios
- CTAs em ingles
- frases como `New Listing`, `For Sale`, `Learn More`, `Contact Us`

Esse sanitizador ainda e util como protecao, mas nao deve ser o caminho principal para os novos templates.

O fluxo ideal e:

1. Preencher campos padronizados diretamente com dados reais.
2. Sanitizar apenas como camada de seguranca.
3. Usar IA somente para campos narrativos ou templates especiais.

## Mapeamento Recomendado Dos Novos Campos

### Imagens

```txt
property_image_01 = primeira foto do imovel
property_image_02 = segunda foto do imovel, se existir
property_image_03 = terceira foto do imovel, se existir
```

Se faltar foto, a opcao segura e repetir a melhor foto disponivel ou remover/ocultar o elemento se o template suportar.

### Caracteristicas

```txt
feature_01 = principal diferencial ou atributo forte
feature_02 = segundo diferencial ou atributo forte
feature_03 = terceiro diferencial ou atributo forte
```

Fontes possiveis:

- dormitorios
- banheiros
- vagas
- area
- diferenciais selecionados
- tipo do imovel
- bairro/cidade

### Textos Fixos

```txt
headline_main = Oportunidade
sale_badge = À Venda
price_label = A partir de
features_title = Diferenciais
```

Esses campos nao precisam de IA para serem preenchidos.

### Descricao E Preco

```txt
property_description = resumo curto do imovel
property_price = preco formatado
```

`property_description` pode ser derivado da campanha textual ou do cadastro do imovel.

## Gaps Atuais

1. `feature_01`, `feature_02` e `feature_03` ainda nao possuem regra deterministica no backend.
2. `headline_main`, `sale_badge`, `price_label` e `features_title` ainda podem depender da IA, mesmo sendo padroes fixos.
3. `property_image_01..03` pode ser preenchido automaticamente, mas ainda passa por logica generica de nomes.
4. O backend ainda aceita muitos nomes antigos, o que e util para compatibilidade mas aumenta a chance de render antigo entrar no fluxo.
5. A interface ainda nao reflete o catalogo novo como fonte unica da verdade.

## Conclusao

A padronizacao dos templates esta no caminho certo. O proximo passo seguro e transformar esses nomes em contrato direto no backend.

O ganho principal sera reduzir dependencia da IA para tarefas mecanicas, diminuir erros de nomes de elementos e evitar que placeholders antigos em ingles aparecam nos renders.
