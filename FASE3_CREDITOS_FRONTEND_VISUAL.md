# Fase 3 - Creditos Frontend Visual

## Objetivo

Implementar somente a exibicao visual de creditos no frontend, sem debito real, sem RPC, sem aplicar migration e sem alterar Edge Functions.

## Arquivos criados

- `frontend/src/components/CreditSummary.jsx`
- `FASE3_CREDITOS_FRONTEND_VISUAL.md`

## Arquivos alterados

- `frontend/src/pages/NovaCampanha.jsx`

## O que foi implementado

- Novo componente visual `CreditSummary`.
- Exibicao de saldo simulado de creditos.
- Exibicao de custo estimado com base nos templates selecionados.
- Exibicao de saldo apos gerar.
- Aviso visual quando o saldo simulado for insuficiente.
- Secao visual simples "Pacotes sugeridos" antes do catalogo atual.
- Cards estaticos para `Economica`, `Premium IA` e `Completa`, usando `campaignModes.js`.
- Renome visual de "Formatos de conteudo" para "Catalogo Premium Visual".
- Texto do botao final ajustado para "Gerar campanha".
- Cards dos pacotes com aparencia premium e botao "Selecionar pacote".
- Botao dos pacotes altera somente o modo visual usado no resumo de creditos.
- Catalogo Premium Visual renderizado em cards estilo Netflix, com nome comercial, descricao, tipo, formato, custo e botao selecionar/desmarcar.
- Uso dos dados ja criados em:
  - `creditCosts.js`
  - `campaignModes.js`
  - `templateCatalog.js`
- Integracao minima em `NovaCampanha.jsx`, sem alterar o fluxo de geracao.

## Descricao da tela

Na tela Nova Campanha, a ordem visual passa a ficar:

1. Dados do imovel.
2. Fotos do imovel.
3. Pacotes sugeridos.
4. Catalogo Premium Visual.
5. Resumo de creditos.
6. Gerar campanha.

Os cards de pacotes sugeridos exibem nome, descricao e custo. O botao "Selecionar pacote" altera apenas o modo visual do resumo de creditos nesta fase; ele ainda nao pre-seleciona templates.

O Catalogo Premium Visual agora usa cards premium para cada item selecionavel. Cada card mostra:

- Nome comercial.
- Descricao curta.
- Tipo: arte ou video.
- Formato.
- Custo em creditos.
- Indicacao visual de selecionado.
- Botao selecionar/desmarcar.

Abaixo do catalogo e antes do botao final de gerar, aparece um bloco "Resumo de creditos" com:

- Saldo atual simulado.
- Custo estimado da selecao.
- Saldo apos gerar.
- Modo visual usado no calculo.
- Quantidade de artes e videos selecionados.
- Indicacao de que Textos IA consomem 0 creditos.
- Lista com nomes comerciais dos itens selecionados.

O usuario nao ve `template_id`, Creatomate, OpenAI, GPT, UUID ou qualquer identificador tecnico.

## Build

Comando executado:

```bash
npm run build
```

Resultado: passou.

Observacao: Vite exibiu apenas o aviso conhecido de chunk maior que 500 kB apos minificacao.

## Riscos

- O saldo ainda e simulado e nao representa o banco.
- O bloqueio e apenas visual; ainda nao existe debito real nesta fase.
- O custo estimado usa os pesos do catalogo local e pode precisar ser reconciliado com a regra final de pacotes quando a UI de modos for implementada.

## Nao realizado nesta fase

- Nenhuma chamada RPC.
- Nenhuma aplicacao de migration.
- Nenhum deploy.
- Nenhum debito real de creditos.
- Nenhuma alteracao em `gerar-banners`.
- Nenhuma alteracao no backend.
- Nenhuma alteracao no payload.
- Nenhuma alteracao em `selectedTemplates`.
- Nenhuma exposicao visual de Creatomate, OpenAI, GPT, UUID ou `template_id`.

## Proximo passo sugerido

Implementar uma selecao visual simples de modo de geracao (`Economica`, `Premium IA`, `Completa`) e conectar o resumo visual ao modo escolhido, ainda sem debitar creditos reais.
