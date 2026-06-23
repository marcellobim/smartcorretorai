# Produto 2 - Studio Hero: Decisao de Arquitetura

## Objetivo

Registrar a decisao atual do Produto 2 Studio Hero antes de qualquer nova integracao.

Esta decisao separa o Studio Hero em dois caminhos internos:

1. Studio Hero Cinematografico IA.
2. Studio Hero Inteligente - Produto B / Opus V2.

Este documento nao implementa produto, nao ativa Veo, nao altera backend e nao altera Produto 3.

## Caminho 1 - Studio Hero Cinematografico IA

### Posicionamento

Produto principal de video IA do SmartCorretorAI.

O Studio Hero Cinematografico IA deve entregar um video final de alto impacto, com sensacao de producao cinematografica, usando IA visual real.

### Motor

Veo.

### Produto

Produto unico.

Nao criar planos internos como:

- Essencial.
- Profissional.
- Premium.

Nao criar variacoes comerciais por duracao, complexidade ou categoria.

### Experiencia do Usuario

O usuario nao deve precisar entender configuracoes tecnicas.

O fluxo deve ser simples:

1. Chat coleta dados do imovel.
2. Usuario envia imagens.
3. Usuario escolhe apenas a quantidade de imagens.
4. Sistema monta o prompt.
5. Veo entrega o video final.

### Escolha Permitida ao Usuario

Quantidade de imagens:

- 2 imagens.
- 4 imagens.
- 6 imagens.
- 8 imagens.

Nao existe escolha de tempo pelo usuario.

### Upload

Orientacao ao usuario:

> Envie suas melhores imagens na ordem desejada.

Regras:

- A ordem enviada deve ser respeitada como referencia.
- Nao exigir classificacao por comodo.
- Nao pedir que o usuario escolha tipo de cena.
- Nao criar etapa de categorizacao visual manual.

### Prompt

O chat coleta dados do imovel.

O sistema monta o prompt automaticamente com:

- Dados principais do imovel.
- Objetivo da campanha.
- Destaques comerciais.
- CTA.
- Tom desejado.
- Ordem e contexto das imagens enviadas.

O usuario nao escreve prompt tecnico.

### Saida Esperada

O Veo deve entregar:

- Video final.
- Efeitos visuais.
- Textos ou chamadas quando fizer sentido.
- Musica ou som, conforme capacidade do motor.
- CTA.
- Atmosfera visual coerente com o imovel.

### O Que Nao Entra Neste Caminho

- Escolha manual de tempo.
- Planos internos Essencial / Profissional / Premium.
- Classificacao por comodo.
- Slideshow FFmpeg.
- Tentativa de simular Veo com movimentos artificiais.

## Caminho 2 - Studio Hero Inteligente - Produto B / Opus V2

### Posicionamento

Produto complementar, utilitario e de baixo custo.

Nao deve ser vendido como video IA cinematografico.

### Base Tecnica

Baseado na POC:

`experiments/slideshow-poc/`

### Motor

FFmpeg.

### Proposta

Gerar video com fotos do imovel usando:

- Imagens enviadas pelo usuario.
- Legendas.
- CTA.
- Transicoes simples.
- Possivel musica de fundo.

### Caracteristicas

- Baixo custo.
- Uso recorrente.
- Nao depende de Veo.
- Pode atender necessidades simples de divulgacao.
- Pode ser usado para WhatsApp, portais e redes sociais.

### Status Atual

Ainda nao integrar ao produto real.

Continuar como POC ate nova decisao.

### Proxima Evolucao Futura

Evoluir para uma V3.1 focada em:

- Narrativa mais clara.
- Suavidade.
- Musica.
- Melhor fluxo de montagem.
- Melhor escolha de imagens.
- Legendas comerciais mais fortes.

Sem prometer:

- Video cinematografico.
- IA visual premium.
- Transformacao visual do imovel.
- Efeito Veo.

## Decisao Final

O Studio Hero tera dois caminhos internos:

1. **Studio Hero Cinematografico IA**: caminho premium, motor Veo, produto principal de impacto.
2. **Studio Hero Inteligente - Produto B / Opus V2**: caminho utilitario, motor FFmpeg, baixo custo, ainda em POC.

O foco principal de produto premium permanece no Veo.

A POC com FFmpeg deve ser tratada como produto B, sem promessa de video IA premium.

## Restrições Desta Etapa

- Nao alterar codigo de producao.
- Nao integrar Veo.
- Nao fazer deploy.
- Nao alterar Produto 3.
- Nao criar commit sem autorizacao.
