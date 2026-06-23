# Biblioteca de Imoveis Reais - SmartCorretorAI

Esta pasta organiza uma biblioteca local de imagens reais para testes do Studio Hero V3.1.

## Regra de Preservacao

`assets-imoveis/importacao-bruta/` e o backup original da importacao e nao deve ser alterado, renomeado, limpo ou reorganizado diretamente.

Os grupos abaixo foram criados por copia, mantendo a importacao bruta intacta.

## Resumo Geral

- Total na importacao bruta: 47 arquivos.
- Imagens JPG legiveis: 46.
- Arquivo sem extensao/invalido para uso direto: 1.
- Duplicata identificada: `Portaria_REV05-1-1024x647(1).jpg`.

## Estrutura Organizada

```text
assets-imoveis/
├── importacao-bruta/
├── alto-padrao-01/
├── apartamento-vazio-01/
├── apartamento-vazio-02/
├── lancamento-01/
├── locacao-lapa-01/
└── descartes-ou-revisao/
```

## Grupos

### alto-padrao-01

- Quantidade: 18 imagens.
- Origem: screenshots de `062941` ate `063344`.
- Tipo estimado: apartamento.
- Perfil estimado: alto padrao.
- Estado: decorado.
- Ambientes: piscina, vista, cozinha, lavanderia, suite, banheiro, varanda e amenidades.
- Potencial Studio Hero V3.1: muito alto.
- Uso recomendado: principal grupo de showcase.

Este e o conjunto mais forte da biblioteca. Possui variedade, acabamento, ambientes decorados e imagens com maior apelo visual.

### apartamento-vazio-01

- Quantidade: 8 imagens.
- Origem: screenshots de `064329` ate `064410`.
- Tipo estimado: apartamento.
- Perfil estimado: medio padrao.
- Estado: vazio.
- Ambientes: sala/living, cozinha, dormitorio, banheiro e varanda pequena.
- Potencial Studio Hero V3.1: medio.
- Uso recomendado: teste de imovel vazio simples.

Este grupo e importante para validar se o Studio Hero consegue criar valor visual mesmo com fotos menos aspiracionais.

### apartamento-vazio-02

- Quantidade: 15 imagens.
- Origem: screenshots de `064718` ate `064909`.
- Tipo estimado: apartamento.
- Perfil estimado: medio padrao.
- Estado: vazio/pronto.
- Ambientes: sala, cozinha, varanda, vista, banheiro, dormitorio, piscina e amenidade.
- Potencial Studio Hero V3.1: alto.
- Uso recomendado: segundo melhor grupo para showcase e testes de produto realista.

Este grupo tem narrativa mais completa do que `apartamento-vazio-01`, principalmente por incluir varanda, vista e area de lazer.

### lancamento-01

- Quantidade: 3 imagens.
- Arquivos: portaria, piscina/render e planta.
- Tipo estimado: empreendimento/apartamento.
- Perfil estimado: medio padrao ou MCMV possivel.
- Estado: lancamento/render.
- Ambientes: fachada/portaria, piscina e planta.
- Potencial Studio Hero V3.1: medio, mas incompleto.
- Uso recomendado: apoio para testes de lancamento.

Este grupo precisa de mais imagens de interiores, decorado ou areas comuns para sustentar um video completo.

### locacao-lapa-01

- Quantidade: 1 imagem.
- Tipo estimado: amenidade/area comum de predio.
- Perfil estimado: medio padrao.
- Estado: apoio visual.
- Ambientes: gourmet/churrasqueira.
- Potencial Studio Hero V3.1: baixo isoladamente.
- Uso recomendado: imagem de apoio para videos de apartamentos vazios ou medio padrao, especialmente quando faltar imagem de lazer/condominio.

Este grupo nao possui imagens suficientes para um video completo sozinho, mas nao deve ser tratado como descarte. A imagem pode enriquecer narrativas de apartamentos vazios, locacao ou medio padrao ao mostrar area comum/lazer do predio.

### descartes-ou-revisao

- Quantidade: 2 arquivos.
- Conteudo:
  - `Luxury Real Estate Video Commercial`: arquivo sem extensao/invalido para uso direto.
  - `Portaria_REV05-1-1024x647(1).jpg`: duplicata da portaria mantida fora do grupo principal.
- Uso recomendado: revisao manual futura.

## Potencial Para Studio Hero V3.1

### Videos completos possiveis

1. `alto-padrao-01`
2. `apartamento-vazio-02`
3. `apartamento-vazio-01`

### Videos parciais ou de apoio

1. `lancamento-01`
2. `locacao-lapa-01`

## Grupos Ideais Para Showcase

1. `alto-padrao-01`
   - Melhor material visual.
   - Tem decoracao, piscina, varanda, suite e acabamento.
   - Ideal para demonstrar qualidade premium.

2. `apartamento-vazio-02`
   - Melhor grupo realista de imovel vazio.
   - Bom para provar que o produto tambem funciona com fotos comuns.

## Recomendacoes Para V3.1

- Classificar ambientes automaticamente por imagem, nao apenas por nome de arquivo.
- Priorizar narrativa:
  1. fachada ou amenidade forte
  2. sala/living
  3. cozinha
  4. varanda/vista
  5. suite/dormitorio
  6. banheiro
  7. lazer
  8. CTA final
- Evitar repetir ambientes parecidos no mesmo video.
- Selecionar automaticamente de 6 a 8 imagens por grupo.
- Adaptar ritmo por perfil:
  - alto padrao: mais lento, elegante e cinematografico
- vazio/locacao: mais direto, claro e comercial
- lancamento: foco em oportunidade, planta e areas comuns
- amenidade/lazer de apoio: usar para complementar videos quando o imovel principal nao tiver imagens de condominio ou areas comuns
- Criar CTA final por objetivo:
  - venda: `Agende sua visita`
  - locacao: `Fale agora e veja disponibilidade`
  - lancamento: `Conheca as condicoes`

## Observacao

Esta organizacao e apenas uma copia estruturada para testes. A pasta `importacao-bruta` continua sendo a fonte original preservada.
