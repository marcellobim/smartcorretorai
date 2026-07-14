# Studio Hero V3.1 - Auditoria de Referencias Visuais e Movimentos

## Objetivo

Este documento registra uma auditoria visual para orientar a futura evolucao do Studio Hero V3.1.

Nao houve implementacao, geracao de nova versao, deploy ou alteracao de produto. A analise foi feita a partir dos videos de referencia disponiveis e da POC atual em `experiments/slideshow-poc`.

## Videos analisados

### Referencias externas em `experiments/home-references`

| Arquivo | Duracao | Formato | Observacao |
|---|---:|---|---|
| `home-ref-animation.mp4.mp4` | 41,74s | 392x850, vertical mobile | Landing/experiencia mobile com blocos grandes, cartoes verticais e demonstracoes visuais. |
| `home-ref-premium.mp4.mp4` | 117,55s | 392x850, vertical mobile | Video/landing social com apresentacao humana, textos grandes, cards, prova social e storytelling. |

### POC atual

| Arquivo | Duracao | Formato | Observacao |
|---|---:|---|---|
| `output.mp4` | 22,30s | 1080x1920, vertical | V1, slideshow com Ken Burns basico. |
| `output-v2.mp4` | 20,20s | 1080x1920, vertical | V2, mais polida, ainda com sensacao de slideshow. |
| `output-v3.mp4` | 19,10s | 1080x1920, vertical | V3, tenta parallax e direcao por cena, mas depende demais da classificacao. |
| `output-v31-alto-padrao-01.mp4` | 25,47s | 1080x1920, vertical | Teste isolado com tipos explicitos por ambiente. |

### Demo interna

| Arquivo | Duracao | Formato | Observacao |
|---|---:|---|---|
| `frontend/public/previews/studio-hero/moema-demo.mp4` | 8,00s | 1280x720, horizontal | Demo cinematica horizontal, boa para referencia de composicao, nao para regra vertical. |

## Padroes observados nas referencias

### Ritmo

- As referencias mobile nao ficam muito tempo em uma unica ideia visual.
- O ritmo e feito por blocos curtos, mudancas de escala, entrada/saida de elementos e cortes visuais.
- Mesmo quando uma cena permanece na tela, algo muda: texto, card, posicao, foco ou hierarquia.
- A duracao perceptiva de cada bloco fica em torno de 2s a 4s.

### Movimento

- Movimento bom e intencional: revela algo, aproxima do assunto ou cria transicao entre estados.
- Movimento ruim e movimento sem finalidade: zoom constante, drift pequeno repetido ou pan que nao revela nada.
- As referencias usam mais "mudanca de composicao" do que apenas camera lenta.
- Cards e demos entram com deslocamento claro, nao com micro tremor.

### Hierarquia visual

- Textos grandes e poucos.
- Uma ideia principal por tela.
- Contraste forte entre objeto principal e fundo.
- Espaco negativo usado para dar sensacao premium.
- Demonstra que algo foi criado, nao apenas explica.

### Sensacao premium

- O premium vem de controle: menos elementos, menos ruido, menos texto, mais clareza.
- Movimento lento funciona quando existe uma imagem forte.
- Movimento rapido funciona quando o objetivo e energia, oferta ou produto acessivel.
- Blocos com cantos arredondados e sombra suave ajudam, mas o excesso vira cara de app generico.

## Comparacao com a POC atual

### O que a POC faz igual

- Usa formato vertical 9:16.
- Usa imagens reais como base.
- Usa movimento de camera simulado.
- Usa legenda curta em alguns momentos.
- Usa CTA final.

### O que a POC faz pior

- Movimento ainda parece aplicado por filtro, nao por intencao narrativa.
- A classificacao de ambiente ainda e fragil.
- Muitas cenas usam a mesma logica de zoom/pan.
- Falta pausa visual entre momentos importantes.
- Falta musica/trilha para amarrar ritmo.
- Falta escolha automatica de imagem principal.
- Falta variacao real entre perfis de imovel.

### O que falta na POC

- Reconhecimento visual de ambiente.
- Narrativa automatica por tipo de campanha.
- Movimento por funcao da imagem: revelar, aproximar, respirar, encerrar.
- Ritmo por perfil: alto padrao, medio, vazio, lancamento, locacao.
- Transicoes com proposito.
- Trilha sonora com fade in/out.
- Controle de intensidade para evitar tremor.

### O que gera sensacao de slideshow

- Todas as fotos terem duracao parecida.
- Movimento igual em todas as cenas.
- Zoom lento constante sem motivo.
- Texto sempre no mesmo lugar.
- Fade repetido entre todos os slides.
- CTA parecer apenas mais um slide.
- Ausencia de mudanca de ritmo.

### O que gera sensacao de video

- Uma abertura forte.
- Movimento diferente por ambiente.
- Uso de profundidade e escala.
- Transicoes alternadas, mas discretas.
- Pausas em imagens importantes.
- CTA com fechamento visual proprio.
- Narrativa clara: desejo, descoberta, detalhe, convite.

## Elementos que funcionam bem

### Movimento aspiracional

Funciona bem para piscina, rooftop, vista, fachada e amenidades fortes.

Deve ser amplo, lento e estavel. A camera deve parecer observar o espaco, nao procurar algo.

### Movimento de descoberta

Funciona para cozinha, living, varanda e gourmet.

O movimento deve revelar profundidade ou continuidade do ambiente. Exemplo: pan lateral suave, diagonal discreta ou aproximacao controlada.

### Profundidade

Funciona quando ha linhas de fuga: varanda, corredor, cozinha, living, fachada.

Deve usar pouco zoom e mais deslocamento direcional.

### Destaque para lazer

Lazer deve abrir ou elevar o video. E um dos melhores gatilhos visuais para alto padrao e medio padrao com condominio.

### Destaque para vista

Vista funciona como respiro. Deve ter movimento lento, sem excesso de texto.

### Destaque para ambientes principais

Living, cozinha e suite devem formar o corpo do video. Cada um precisa de movimento proprio, mas todos devem manter elegancia.

## Elementos a evitar

- Tremor.
- Microdrift constante.
- Zoom sem finalidade.
- Movimento repetitivo.
- Excesso de transicoes chamativas.
- Flash forte.
- Texto grande em todas as cenas.
- Legendas longas.
- Movimento rapido em alto padrao.
- CTA final com a mesma linguagem visual dos slides anteriores.
- Aparencia de PowerPoint.
- Aparencia de Canva basico.

## Catalogo de movimentos proposto

### POOL_LUXURY

- Quando usar: piscina, rooftop, lazer com vista, area externa premium.
- Ambiente: `pool`, `amenity`, `view`.
- Velocidade: lenta.
- Direcao: pan horizontal amplo ou leve aproximacao.
- Intensidade: baixa a media.
- Duracao recomendada: 3,2s a 4,0s.
- Observacao: deve abrir o video quando a imagem for forte. Evitar zoom agressivo.

### AMENITY_REVEAL

- Quando usar: portaria, lounge, academia, churrasqueira, salao, areas comuns.
- Ambiente: `amenity`, `gourmet`, `facade`.
- Velocidade: media-lenta.
- Direcao: diagonal curta ou pan lateral.
- Intensidade: media.
- Duracao recomendada: 2,8s a 3,6s.
- Observacao: movimento deve revelar o espaco, nao apenas mexer a foto.

### LIVING_PREMIUM

- Quando usar: sala, living integrado, ambientes sociais.
- Ambiente: `living`, `sala`.
- Velocidade: lenta.
- Direcao: travelling lateral suave.
- Intensidade: baixa.
- Duracao recomendada: 3,0s a 3,8s.
- Observacao: texto curto. Ideal para mostrar amplitude.

### KITCHEN_REVEAL

- Quando usar: cozinha planejada, cozinha americana, ilha, integracao com sala.
- Ambiente: `kitchen`.
- Velocidade: media-lenta.
- Direcao: lateral reverso ou pan de bancada para living.
- Intensidade: baixa.
- Duracao recomendada: 2,8s a 3,5s.
- Observacao: funciona melhor quando ha linhas horizontais claras.

### SUITE_SLOW

- Quando usar: suite master, quarto decorado, quarto principal.
- Ambiente: `suite`, `bedroom`.
- Velocidade: lenta.
- Direcao: push in suave.
- Intensidade: baixa.
- Duracao recomendada: 3,3s a 4,2s.
- Observacao: alto padrao pede calma. Evitar movimentos laterais grandes.

### BEDROOM_SOFT

- Quando usar: dormitorios secundarios ou quartos simples.
- Ambiente: `bedroom`, `dormitorio`.
- Velocidade: lenta.
- Direcao: drift vertical ou aproximacao curta.
- Intensidade: baixa.
- Duracao recomendada: 2,8s a 3,5s.
- Observacao: se o ambiente for vazio, reduzir tempo.

### BALCONY_VIEW

- Quando usar: varanda, sacada, vista urbana, vista livre.
- Ambiente: `balcony`, `view`.
- Velocidade: lenta.
- Direcao: movimento de profundidade, diagonal leve ou pan para fora.
- Intensidade: baixa a media.
- Duracao recomendada: 3,0s a 3,8s.
- Observacao: deve criar sensacao de respiro.

### BATHROOM_DETAIL

- Quando usar: banheiro, lavabo, detalhe de acabamento.
- Ambiente: `bathroom`, `detail`.
- Velocidade: curta e discreta.
- Direcao: push in pequeno ou pan minimo.
- Intensidade: muito baixa.
- Duracao recomendada: 2,2s a 3,0s.
- Observacao: nao deve parecer cena principal, exceto em alto luxo.

### COMMERCIAL_OBJECTIVE

- Quando usar: sala comercial, laje, recepcao, fachada comercial.
- Ambiente: `commercial`.
- Velocidade: media.
- Direcao: pan lateral limpo.
- Intensidade: baixa.
- Duracao recomendada: 2,6s a 3,3s.
- Observacao: visual mais institucional, menos emocional.

### CTA_FINAL

- Quando usar: encerramento.
- Ambiente: final.
- Velocidade: quase estavel.
- Direcao: sem pan ou zoom minimo.
- Intensidade: minima.
- Duracao recomendada: 3,0s a 4,0s.
- Observacao: deve parecer anuncio profissional. Preparar suporte a WhatsApp, telefone e logo.

## Narrativa automatica proposta

### Alto padrao

1. Amenidade/Lazer
2. Living
3. Cozinha
4. Suite
5. Varanda/Vista
6. Banheiro/Detalhe premium
7. CTA

Ritmo: lento, elegante, aspiracional.

Texto: pouco, forte, sem ficha tecnica excessiva.

### Apartamento vazio

1. Sala
2. Cozinha
3. Dormitorio
4. Banheiro
5. Varanda
6. Amenidade, se existir
7. CTA

Ritmo: mais direto que alto padrao.

Texto: objetivo, comercial, sem tentar fingir luxo.

### Lancamento

1. Portaria/Fachada
2. Lazer
3. Planta
4. Diferenciais
5. CTA

Ritmo: oportunidade, clareza e promessa.

Texto: pode falar de condicoes, localizacao e fase, sem inventar dados.

### Locacao

1. Sala
2. Cozinha
3. Dormitorio
4. Banheiro
5. Vaga/varanda/amenidade
6. CTA

Ritmo: pratico, rapido e confiavel.

Texto: disponibilidade, localizacao e contato.

## Relacao com a biblioteca `assets-imoveis`

### `alto-padrao-01`

- Melhor grupo para showcase.
- Movimentos recomendados:
  - `POOL_LUXURY`
  - `AMENITY_REVEAL`
  - `LIVING_PREMIUM`
  - `KITCHEN_REVEAL`
  - `SUITE_SLOW`
  - `BALCONY_VIEW`
  - `BATHROOM_DETAIL`
  - `CTA_FINAL`
- Observacao: ideal para demonstrar valor percebido.

### `apartamento-vazio-01`

- Bom para validar imovel vazio simples.
- Movimentos recomendados:
  - `LIVING_PREMIUM`, com menor duracao
  - `KITCHEN_REVEAL`
  - `BEDROOM_SOFT`
  - `BATHROOM_DETAIL`
  - `BALCONY_VIEW`, se houver
  - `CTA_FINAL`
- Observacao: precisa de ritmo mais direto para nao parecer vazio demais.

### `apartamento-vazio-02`

- Segundo melhor grupo para showcase realista.
- Movimentos recomendados:
  - `LIVING_PREMIUM`
  - `KITCHEN_REVEAL`
  - `BALCONY_VIEW`
  - `BATHROOM_DETAIL`
  - `POOL_LUXURY` ou `AMENITY_REVEAL` para piscina/area comum
  - `CTA_FINAL`
- Observacao: bom para provar que o produto tambem melhora fotos comuns.

### `lancamento-01`

- Incompleto, mas util para narrativa de lancamento.
- Movimentos recomendados:
  - `AMENITY_REVEAL` para portaria/fachada
  - `POOL_LUXURY` para piscina/render
  - movimento quase estatico para planta
  - `CTA_FINAL`
- Observacao: precisa de mais interiores ou imagens de apoio.

### `locacao-lapa-01`

- Nao e descarte.
- Funciona como imagem de amenidade/lazer de apoio.
- Movimentos recomendados:
  - `AMENITY_REVEAL`
  - `CTA_FINAL`, se usada no fechamento visual de um video curto
- Observacao: deve enriquecer videos de apartamentos medios ou vazios quando faltar imagem de condominio.

## Regras para futura implementacao V3.1

1. Movimento deve ser consequencia do ambiente.
2. A primeira imagem deve prender atencao em ate 1 segundo.
3. Alto padrao precisa de menos texto e mais respiro.
4. Imovel vazio precisa de ritmo mais rapido e CTA mais claro.
5. Lancamento precisa de clareza: fachada, lazer, planta, condicao.
6. Se a classificacao visual for incerta, preferir movimento seguro e curto.
7. Nunca usar o mesmo movimento em mais de duas cenas seguidas.
8. Evitar `detail` como fallback dominante.
9. CTA final deve ter composicao propria.
10. Musica deve ser parte do ritmo, nao apenas trilha colada no final.

## Conclusao

Um video do Studio Hero deve se mover como uma narrativa curta, nao como uma lista de fotos. A diferenca central entre a POC atual e uma experiencia profissional esta em quatro pontos:

1. classificacao correta do ambiente;
2. movimento com intencao;
3. ritmo adaptado ao perfil do imovel;
4. fechamento comercial forte.

A POC atual ja prova que e possivel gerar MP4 vertical localmente. Para parecer superior, a V3.1 precisa parar de tratar cada imagem como slide e passar a tratar cada imagem como cena.

