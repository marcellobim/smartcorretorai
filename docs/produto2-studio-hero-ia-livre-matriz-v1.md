# Produto 2 / Studio Hero - Modo IA Livre

Data: 2026-07-01

## Decisao De Arquitetura

O teste realizado diretamente no Veo utilizando apenas prompt, sem imagens enviadas pelo usuario, apresentou resultado muito superior ao esperado.

Foram observadas as seguintes caracteristicas:

- Geracao completa por IA.
- Personagem virtual apresentando o imovel.
- Boa sincronizacao entre fala e narracao.
- Textos cinematograficos.
- Video mais rico do que o esperado para um fluxo sem imagens.

Conclusao: o Modo IA Livre nao deve reutilizar a filosofia do Modo Comercial Cinematografico. Ele passa a ser tratado como uma arquitetura propria dentro do Studio Hero.

## Studio Hero - Modo IA Livre - Matriz v1 Experimental

Entrada:

- Conversa IA.
- Nenhuma imagem obrigatoria.

Motor:

- Veo Text-to-Video.

Objetivo:

- Criar um comercial imobiliario completo baseado apenas na conversa.

Prioridades:

1. Narrativa cinematografica.
2. Personagem virtual quando fizer sentido.
3. Narracao sincronizada.
4. Cenas criadas por IA.
5. Textos elegantes.
6. Idioma em Portugues do Brasil, sem misturar idiomas.
7. Fact Engine: nunca inventar informacoes que o usuario nao forneceu.
8. Marketing Style respeitando MCMV, Prontos, Alto Padrao e Lancamento.
9. Smart Ending sem lastFrame; o encerramento sera feito posteriormente pelo pipeline do SmartCorretorAI usando o compilador existente.

## Arquiteturas Do Produto 2

O Produto 2 passa a possuir duas arquiteturas distintas:

### Modo 1 - Comercial Cinematografico

- Imagem real.
- Smart Ending.
- Uso de referencia visual enviada pelo usuario.
- Encerramento controlado pelo SmartCorretorAI.

### Modo 2 - IA Livre

- Text-to-Video completo.
- Compilador SmartCorretorAI.
- Smart Ending posterior.
- Nenhuma dependencia obrigatoria de imagem enviada pelo usuario.

## Comentarios Internos

- O Modo IA Livre deve evoluir como produto proprio dentro do Studio Hero, nao como variante reduzida do Modo 1.
- A matriz experimental v1 deve priorizar direcao criativa, narrativa e apresentacao completa do comercial.
- O uso de personagem virtual passa a ser permitido quando fizer sentido comercial e respeitar os dados fornecidos.
- O lastFrame nao deve ser usado neste modo.
- A etapa de encerramento deve ficar sob responsabilidade posterior do pipeline/compilador do SmartCorretorAI.
- Qualquer implementacao futura deve preservar a separacao conceitual entre Modo 1 e Modo 2.
