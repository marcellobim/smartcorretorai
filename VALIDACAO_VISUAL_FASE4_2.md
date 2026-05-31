# Validacao Visual Fase 4.2 - SmartCampaignSelector Didatico

## Objetivo

Validar visualmente a tela Nova Campanha apos o ajuste didatico dos cards de campanha.

Escopo solicitado:

- confirmar os 6 cards;
- confirmar descricao, beneficios, pecas, creditos, bloco `Voce recebera`, `Onde usar`, `Serve para` e `Dica SmartCorretorAI`;
- avaliar se a tela ficou poluida;
- confirmar que `selectedTemplates` e payload nao foram alterados;
- nao alterar codigo.

## Status da validacao

Status: bloqueada por erro runtime ao abrir `/nova-campanha`.

Ao tentar acessar a tela autenticada em ambiente local, a rota chegou a:

`http://127.0.0.1:5173/nova-campanha`

Porem a tela ficou em branco.

Erro capturado no console:

```text
Cannot access 'demoStorageKey' before initialization
```

Esse erro ocorre dentro do componente `NovaCampanha`.

## Evidencias

Screenshots gerados durante a tentativa:

- `screenshots/validacao-visual-fase4-2-link-nova-campanha.png`
- `screenshots/validacao-visual-fase4-2-nova-campanha-full.png`
- `screenshots/validacao-visual-fase4-2-nova-campanha-view.png`

Observacao:

- as capturas mostram a tentativa de acesso, mas a tela final nao renderizou os cards por causa do erro runtime.

## Itens nao confirmados visualmente

Por causa da tela em branco, nao foi possivel confirmar visualmente:

1. Se os 6 cards aparecem:
   - Venda Rapida;
   - Luxo Premium;
   - Lancamento;
   - Minha Casa Minha Vida;
   - Airbnb / Temporada;
   - Comercial.

2. Se cada campanha mostra:
   - descricao;
   - beneficios;
   - quantidade de pecas;
   - custo estimado em creditos;
   - bloco `Voce recebera`;
   - explicacao de onde usar;
   - explicacao de para que serve;
   - `Dica SmartCorretorAI`.

3. Se a tela ficou visualmente poluida ou confortavel.

4. Se o clique em campanha atualiza visualmente o Resumo de Creditos.

## Validacao estatica complementar

Mesmo sem renderizacao visual, a inspecao do arquivo `frontend/src/pages/NovaCampanha.jsx` confirmou que a implementacao contem:

- os 6 cards oficiais em `SMART_CAMPAIGNS`;
- descricoes por campanha;
- beneficios por campanha;
- `smartTip` por campanha;
- bloco `Voce recebera`;
- textos `Onde usar`;
- textos `Serve para`;
- custo estimado em `creditos`;
- entregaveis didaticos:
  - Banner Feed;
  - Story;
  - Carrossel;
  - Video/Reels;
  - Texto IA;
  - WhatsApp.

## selectedTemplates e payload

Confirmacao por inspecao estatica:

- a Fase 4.2 nao alterou Edge Functions;
- a Fase 4.2 nao alterou backend;
- a Fase 4.2 nao alterou o payload final de geracao;
- `selectedTemplates` continua sendo derivado internamente a partir de `formatosSel`;
- ao selecionar campanha, `applySmartCampaign` continua preenchendo `formatosSel` com os templates resolvidos por `CAMPAIGN_TEMPLATES`;
- `CreditSummary` continua recebendo `selectedTemplateIds`.

## Termos tecnicos

Na interface adicionada pela Fase 4.2, nao foram adicionados termos tecnicos visiveis como:

- `template_id`;
- UUID;
- Creatomate;
- GPT;
- nomes tecnicos.

Observacao:

- existem referencias tecnicas internas no codigo e em blocos ocultos/legados, mas nao fazem parte do texto comercial dos cards adicionados.

## Avaliacao de poluicao visual

Nao foi possivel avaliar visualmente por causa do erro runtime.

Pela estrutura implementada, ha risco de os cards ficarem carregados, pois cada card agora contem:

- descricao;
- lista de entregaveis detalhada;
- onde usar;
- para que serve;
- dica pratica;
- beneficios;
- botao.

Se a validacao visual confirmar excesso de informacao, as alternativas recomendadas sao:

- usar accordion dentro de `Voce recebera`;
- exibir apenas o resumo no card e abrir detalhes em `Ver mais`;
- manter cards compactos e mostrar os detalhes da campanha selecionada em painel lateral/abaixo;
- esconder beneficios quando `Voce recebera` estiver expandido;
- exibir `Onde usar` e `Serve para` somente no card selecionado.

## Correcao minima recomendada

Antes de nova validacao visual, corrigir o erro:

```text
Cannot access 'demoStorageKey' before initialization
```

Provavel causa:

- `useEffect` usa `demoStorageKey` antes da declaracao da constante no corpo do componente.

Correcao minima sugerida para uma proxima tarefa:

- mover a declaracao de `isDemoPlan` e `demoStorageKey` para antes do `useEffect` que le `demoStorageKey`;
- nao alterar backend;
- nao alterar payload;
- nao alterar `selectedTemplates`.

## Conclusao

A validacao visual da Fase 4.2 nao foi concluida porque a tela Nova Campanha nao renderizou.

A implementacao didatica existe no codigo, mas precisa da correcao minima do erro runtime antes de validar visualmente os cards e decidir se a UI ficou poluida.

Nao houve commit, deploy ou migration durante esta validacao inicial.


## Revalidacao apos correcao minima

A correcao minima foi aplicada movendo as constantes `isDemoPlan` e `demoStorageKey` para antes do `useEffect` que consulta `demoStorageKey`.

### Build

Comando executado:

```bash
npm run build
```

Resultado:

- build passou;
- Vite exibiu apenas o aviso conhecido de chunk maior que 500 kB.

### Resultado visual

A rota local foi aberta novamente em:

`http://127.0.0.1:5173/nova-campanha`

Resultado:

- a tela nao ficou mais branca;
- o conteudo de Nova Campanha renderizou;
- nao apareceu novamente o erro `Cannot access 'demoStorageKey' before initialization`;
- foram capturados screenshots da tela renderizada.

Screenshots novos:

- `screenshots/validacao-visual-fase4-2-corrigida-full.png`
- `screenshots/validacao-visual-fase4-2-corrigida-view.png`

### Cards e conteudo didatico

Na renderizacao validada, foi possivel confirmar a presenca do Catalogo Premium Visual e do bloco didatico com:

- `Voce recebera`;
- `Onde usar`;
- `Serve para`;
- `Dica SmartCorretorAI`;
- custo estimado em creditos.

A captura textual confirmou especialmente o card `Venda Rapida`, incluindo:

- Banner Feed;
- Story;
- Carrossel;
- explicacao de onde usar;
- explicacao de para que serve;
- custo visual no plano demonstrativo.

Tambem foram encontrados titulos de campanhas no DOM renderizado, incluindo:

- Venda Rapida;
- Luxo Premium;
- Minha Casa Minha Vida;
- Airbnb / Temporada;
- Comercial.

Observacao:

- a validacao foi feita com sessao local simulada; por isso houve erros esperados de profile/JWT no console, mas eles nao impediram a renderizacao da tela apos a correcao minima.
- para usuario real autenticado, ainda e recomendavel repetir a validacao completa com sessao valida.

### Termos tecnicos

Nao foram encontrados na tela renderizada:

- `template_id`;
- `Creatomate`;
- `GPT`;
- `UUID`.

### Conclusao atualizada

O erro de tela branca foi corrigido. A Nova Campanha voltou a renderizar e os cards didaticos aparecem na tela. A avaliacao visual completa com usuario real ainda e recomendada antes de commit/deploy.
