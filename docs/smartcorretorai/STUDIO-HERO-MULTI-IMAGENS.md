# Studio Hero Multi-Imagens - Especificacao Oficial de Prompts

Documento de desenho tecnico antes da implementacao.

Regras de preservacao:
- Nao alterar a opcao atual de 1 imagem / 8s.
- Nao alterar IA Livre.
- Nao alterar Produto 3.
- Nao alterar Creatomate.
- Nao fazer deploy sem autorizacao.
- Nao expor tecnologia ao usuario.

## Objetivo

Definir como o SmartCorretorAI deve montar os prompts enviados ao Veo quando o Studio Hero usar multiplas imagens.

Existem dois modos oficiais:

1. Comercial Cinematografico Multi-Imagens com textos.
2. Motion / Sem Textos.

O usuario escolhe apenas a experiencia desejada. Ele nao escolhe Veo, pares, clipes, FFmpeg, duracoes tecnicas ou estrutura interna.

## Arquitetura Geral

### Entrada comum

- Lista ordenada de imagens enviadas pelo usuario.
- Escolha do modo:
  - com informacoes e CTA;
  - video limpo, sem textos.
- Dados sanitizados da conversa quando existirem.
- Preferencias visuais futuras:
  - fidelidade alta;
  - transformacao leve;
  - movimento;
  - iluminacao;
  - atmosfera;
  - ritmo;
  - efeitos cinematograficos.

### Saida esperada

- Lista de jobs/clipes.
- Prompt final de cada clipe.
- Relatorio tecnico com:
  - imagens usadas;
  - pares gerados;
  - duracao por clipe;
  - prompt por clipe;
  - se houve CTA ou frame neutro;
  - avisos e erros.
- Montagem final posterior em MP4 vertical.

## Modo 1 - Comercial Cinematografico Multi-Imagens com Textos

### Regra central

O fluxo de 1 imagem continua igual ao Studio Hero atual.

Para 2 ou mais imagens, o sistema divide o video em clipes:

- Clipe 1:
  - imagem 1 -> imagem 2;
  - duracao: 8 segundos;
  - usa o prompt atual completo;
  - pode conter hook/chamariz;
  - pode conter narracao como hoje.
- Clipes intermediarios:
  - imagem N -> imagem N+1;
  - duracao: 4 segundos;
  - sem narracao;
  - sem CTA;
  - no maximo uma hard word por clipe.
- Clipe final:
  - ultima imagem -> CTA oficial;
  - duracao: 4 segundos;
  - sem narracao nova;
  - usa o CTA oficial existente;
  - nao inventa texto novo.

### Regra de narração

Nunca repetir narracao em todos os clipes.

A narracao pode existir apenas no primeiro clipe, seguindo a logica atual do Studio Hero. Os clipes intermediarios e final devem ser silenciosos ou apenas musicais, sem voz.

### Regra de textos

O sistema nunca deve inventar textos extras.

Textos permitidos:
- hard word derivada do chat atual;
- CTA oficial ja selecionado ou ja gerado pelo fluxo aprovado;
- nenhum outro texto.

Hard words devem ser curtas, em caixa alta, e vir de dados ja existentes:
- EXCLUSIVO;
- OPORTUNIDADE;
- LANCAMENTO;
- DISPONIVEL;
- ALTO PADRAO;
- SAIBA MAIS;
- AGENDE SUA VISITA;
- ENTRE EM CONTATO.

Se nao houver hard word segura para um clipe intermediario, o clipe deve ser gerado sem texto.

### Tabela de geracao por quantidade de imagens - com textos

| Imagens | Clipe 1 | Intermediarios | Clipe final | Duracao total estimada |
|---:|---|---|---|---:|
| 1 | Fluxo atual 1 imagem / 8s | Nao aplica | CTA atual do fluxo existente | 8s |
| 2 | 1 -> 2, 8s, prompt completo | Nao aplica | 2 -> CTA, 4s | 12s |
| 3 | 1 -> 2, 8s, prompt completo | 2 -> 3, 4s | 3 -> CTA, 4s | 16s |
| 4 | 1 -> 2, 8s, prompt completo | 2 -> 3, 4s; 3 -> 4, 4s | 4 -> CTA, 4s | 20s |
| 5 | 1 -> 2, 8s, prompt completo | 2 -> 3, 4s; 3 -> 4, 4s; 4 -> 5, 4s | 5 -> CTA, 4s | 24s |
| 6+ | 1 -> 2, 8s, prompt completo | Um clipe de 4s por transicao interna | Ultima -> CTA, 4s | 8s + 4s por transicao restante |

## Modo 2 - Motion / Sem Textos

### Regra central

O modo Motion e uma experiencia visual limpa.

Entrada:
- 1 ate 9 imagens.

Sistema:
- acrescenta automaticamente um frame branco/neutro final;
- todos os clipes duram 4 segundos;
- nao usa CTA;
- nao usa textos;
- nao usa narracao;
- nao usa chamadas comerciais.

### O que o prompt raiz mantem

O prompt deve preservar:
- imagens enviadas;
- identidade do imovel;
- arquitetura;
- layout;
- materiais;
- cores;
- proporcoes;
- fidelidade ou transformacao conforme escolha do usuario;
- movimento de camera;
- iluminacao;
- atmosfera;
- ritmo;
- efeitos cinematograficos.

### O que o prompt raiz remove

O prompt deve remover qualquer instrucao de:
- CTA;
- textos;
- hard words;
- legendas;
- narracao;
- chamadas comerciais;
- venda;
- aluguel;
- telefone;
- endereco;
- marca;
- logo;
- QR Code;
- qualquer informacao escrita.

### Regra do frame branco/neutro

O frame final do modo Motion deve ser:
- branco, claro ou neutro;
- sem texto;
- sem logo;
- sem marca;
- sem telefone;
- sem CTA;
- sem icones;
- sem imagem de imovel;
- sem elemento comercial.

O objetivo do frame neutro e encerrar o movimento sem criar marketing, CTA ou texto.

### Tabela de geracao por quantidade de imagens - sem textos

| Imagens | Pares gerados | Duracao por clipe | Duracao total estimada |
|---:|---|---:|---:|
| 1 | 1 -> frame neutro | 4s | 4s |
| 2 | 1 -> 2; 2 -> frame neutro | 4s | 8s |
| 3 | 1 -> 2; 2 -> 3; 3 -> frame neutro | 4s | 12s |
| 4 | 1 -> 2; 2 -> 3; 3 -> 4; 4 -> frame neutro | 4s | 16s |
| 5 | 1 -> 2; 2 -> 3; 3 -> 4; 4 -> 5; 5 -> frame neutro | 4s | 20s |
| 6 | 1 -> 2; 2 -> 3; 3 -> 4; 4 -> 5; 5 -> 6; 6 -> frame neutro | 4s | 24s |
| 7 | 1 -> 2; 2 -> 3; 3 -> 4; 4 -> 5; 5 -> 6; 6 -> 7; 7 -> frame neutro | 4s | 28s |
| 8 | 1 -> 2; 2 -> 3; 3 -> 4; 4 -> 5; 5 -> 6; 6 -> 7; 7 -> 8; 8 -> frame neutro | 4s | 32s |
| 9 | 1 -> 2; 2 -> 3; 3 -> 4; 4 -> 5; 5 -> 6; 6 -> 7; 7 -> 8; 8 -> 9; 9 -> frame neutro | 4s | 36s |

## Exemplos de Prompts por Clipe

Os exemplos abaixo sao modelos de composicao. A implementacao deve montar os textos a partir de dados sanitizados.

### Modo 1 - Clipe 1 com textos, 8s

```text
Create a vertical 9:16 cinematic real estate commercial video.

Use image 1 as the opening frame and image 2 as the ending frame.
Duration: 8 seconds.

Use the current Studio Hero full cinematic prompt rules:
- preserve the real property identity;
- preserve architecture, layout, materials, windows, doors, colors and proportions;
- create premium real estate camera movement;
- use elegant lighting and cinematic atmosphere;
- avoid geometry warping, hallucinated rooms and invented objects.

Marketing context:
- objective: [SANITIZED_OBJECTIVE]
- property facts: [SANITIZED_FACTS]
- location: [SANITIZED_LOCATION]
- approved hook/hard word: [SANITIZED_HARD_WORD]

Voiceover:
- allowed only in this first clip;
- Brazilian Portuguese;
- short, elegant, real estate commercial tone;
- use only facts explicitly provided by the user;
- do not repeat the same narration in later clips.

On-screen text:
- at most one approved hard word;
- do not invent additional text;
- do not show phone, address or extra CTA in this clip.
```

### Modo 1 - Clipe intermediario, 4s

```text
Create a vertical 9:16 cinematic real estate transition video.

Use image [N] as the opening frame and image [N+1] as the ending frame.
Duration: 4 seconds.

Preserve the property identity, architecture, materials, colors and proportions.
Create smooth cinematic camera movement between the two frames.
Use premium lighting, subtle depth, realistic reflections and tasteful atmosphere.

No voiceover.
No narration.
No CTA.
No phone.
No address.
No invented text.

Optional on-screen text:
- use only this approved hard word if provided: [SANITIZED_HARD_WORD]
- if no approved hard word is available, use no text.
- never create more than one word/short phrase.
```

### Modo 1 - Clipe final com CTA oficial, 4s

```text
Create a vertical 9:16 cinematic closing video.

Use the last property image as the opening frame and the official CTA frame as the ending frame.
Duration: 4 seconds.

Preserve the property identity in the opening movement.
Naturally transition to the official CTA frame.
Keep the official CTA readable and unchanged.

No voiceover.
No new narration.
No extra text.
Do not rewrite the CTA.
Do not add phone, address, logo, watermark or extra words.
End cleanly on the provided CTA frame.
```

### Modo 2 - Motion sem textos, 4s

```text
Create a vertical 9:16 cinematic motion video.

Use image [N] as the opening frame and image [N+1 or neutral frame] as the ending frame.
Duration: 4 seconds.

Preserve the real property identity, architecture, layout, materials, colors and proportions.
Visual direction:
- fidelity mode: [HIGH_FIDELITY or LIGHT_TRANSFORMATION]
- camera movement: [SANITIZED_MOVEMENT]
- lighting: [SANITIZED_LIGHTING]
- atmosphere: [SANITIZED_ATMOSPHERE]
- rhythm: [SANITIZED_RHYTHM]
- cinematic effects: [SANITIZED_EFFECTS]

Use smooth transitions, natural depth, subtle parallax, consistent exposure and coherent color grading.
Maintain realistic scale, stable geometry and continuous camera flow.
```

Observacao obrigatoria: no modo Motion, o prompt gerado nao deve mencionar texto, CTA, som, musica, narracao, branding, logo, telefone, endereco, venda, aluguel ou marketing, nem mesmo como proibicao negativa. Essas restricoes pertencem ao contrato do sistema e as validacoes internas, nao ao prompt Motion enviado ao modelo.

## Regras Anti-Repeticao

- A narracao so pode existir no primeiro clipe do modo com textos.
- Clipes intermediarios nao podem repetir frases, hooks ou CTA.
- O mesmo hard word nao deve ser repetido em todos os clipes.
- O clipe final nao cria hard word; ele usa apenas o CTA oficial.
- Se o sistema nao tiver hard words suficientes, deve preferir clipes sem texto.
- Musica e ritmo podem continuar ao longo da montagem, mas a voz nao deve reiniciar a cada clipe.

## Regras Anti-Alucinacao de Texto

Proibido gerar:
- telefone nao informado;
- endereco nao informado;
- nome de empreendimento nao informado;
- logo;
- marca;
- QR Code;
- preco;
- condicao comercial;
- metragem, quartos, suites ou vagas nao informados;
- CTA diferente do CTA oficial;
- textos decorativos aleatorios;
- palavras em ingles quando a campanha for em portugues;
- legendas inventadas;
- textos empilhados ou duplicados.

O prompt deve sempre conter uma regra explicita:

```text
Use only approved text tokens provided in this prompt. If no approved text token is provided, generate no text.
```

## Regra do CTA

O CTA oficial pertence apenas ao modo com textos.

No modo com textos:
- o CTA aparece somente no clipe final;
- o CTA deve vir do fluxo oficial ja existente;
- o CTA nao deve ser reescrito;
- o CTA nao deve ser duplicado;
- o CTA nao deve ganhar telefone, endereco ou palavras extras por iniciativa do modelo.

No modo Motion / Sem Textos:
- nao existe CTA;
- o final e frame branco/neutro;
- o prompt deve negar CTA explicitamente.

## Riscos Conhecidos

- Veo pode tentar inserir texto mesmo quando o prompt proibe.
- Veo pode repetir padroes de narracao se a proibicao nao estiver clara em todos os clipes.
- O primeiro clipe com prompt completo pode criar expectativa comercial forte demais para clipes motion se a montagem nao tiver ritmo musical adequado.
- Hard words derivadas automaticamente podem ficar genericas se o chat tiver poucos dados.
- O frame neutro pode ser interpretado como espaco para texto se o prompt nao disser claramente que deve ficar vazio.
- Clips separados podem variar em cor, exposicao ou estilo se nao houver bloco comum de preservacao visual.
- A montagem final pode ter saltos de audio se a musica nao for aplicada no render final, e sim por clipe.

## Checklist Antes da Implementacao

- Confirmar que 1 imagem com textos continua usando o fluxo atual 1 imagem / 8s.
- Confirmar que 2+ imagens com textos entram no fluxo multi-imagens.
- Confirmar limite de imagens do modo com textos.
- Confirmar que modo Motion aceita 1 ate 9 imagens.
- Criar gerador deterministico de pares.
- Criar sanitizacao de hard words.
- Criar selecao de hard words sem repeticao agressiva.
- Garantir que clipes intermediarios tenham `no voiceover`.
- Garantir que clipe final com textos use CTA oficial.
- Garantir que modo Motion gere frame branco/neutro automaticamente.
- Garantir que modo Motion remova CTA, texto, som, musica, narracao, branding e marketing do prompt enviado.
- Garantir relatorio JSON com prompt de cada clipe.
- Garantir que a UI nao mencione Veo, pares, clipes ou FFmpeg.
- Garantir que Produto 3 e Creatomate nao sejam tocados.
- Rodar build depois da implementacao.
