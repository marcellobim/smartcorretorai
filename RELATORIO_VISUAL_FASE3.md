# Relatorio Visual Fase 3

## Como ficou a tela Nova Campanha

A tela Nova Campanha passou a seguir a ordem visual aprovada para a V2:

1. Dados do imovel.
2. Fotos do imovel.
3. Pacotes sugeridos.
4. Catalogo Premium Visual.
5. Resumo de Creditos.
6. Gerar campanha.

### Dados do imovel

Permanece como a primeira etapa do formulario, reunindo os dados principais do imovel: categoria, tipo, quantidade de quartos/banheiros/vagas, estado, cidade, bairro, preco, area e diferenciais.

### Fotos do imovel

Permanece logo apos os dados do imovel. O usuario envia as fotos e a primeira foto continua sendo tratada visualmente como principal.

### Pacotes sugeridos

Foi adicionada uma nova secao visual antes do catalogo.

Ela exibe tres cards premium:

- Economica.
- Premium IA.
- Completa.

Cada card mostra:

- nome do pacote;
- descricao curta;
- custo em creditos;
- botao "Selecionar pacote".

Nesta fase, o botao altera apenas o modo visual usado no resumo de creditos. Ele ainda nao pre-seleciona templates nem altera o payload enviado ao backend.

### Catalogo Premium Visual

A antiga secao de formatos foi renomeada visualmente para "Catalogo Premium Visual" e ganhou apresentacao em cards premium, aproximando a experiencia do estilo Netflix.

Cada card do catalogo mostra:

- nome comercial;
- descricao curta;
- tipo: arte ou video;
- formato;
- custo em creditos;
- estado visual de selecionado;
- botao "Selecionar" ou "Desmarcar".

O seletor continua usando a mesma estrutura interna anterior. Ou seja, a escolha visual continua alimentando os mesmos grupos de formatos e preserva a saida final `selectedTemplates`.

### Resumo de Creditos

Foi adicionada a secao "Resumo de creditos" depois do catalogo e antes do botao final.

Ela mostra:

- saldo simulado de creditos;
- custo estimado;
- saldo apos gerar;
- modo selecionado;
- quantidade de artes e videos;
- indicacao de que Textos IA consomem 0 creditos;
- itens considerados no custo usando nomes comerciais.

Nesta fase, o saldo e simulado. Nenhum credito real e consumido.

### Gerar campanha

O botao final foi renomeado de "Gerar anuncios agora" para "Gerar campanha".

O fluxo de clique, validacao e geracao nao foi alterado.

## Componentes existentes agora

### `CreditSummary.jsx`

Arquivo:

`frontend/src/components/CreditSummary.jsx`

Responsabilidade:

- Exibir saldo simulado.
- Calcular custo estimado com base nos itens selecionados.
- Exibir saldo apos gerar.
- Alertar visualmente quando o saldo simulado for insuficiente.
- Mostrar apenas nomes comerciais dos itens selecionados.

Dependencias usadas:

- `campaignModes.js`
- `templateCatalog.js`
- `lucide-react`

### Dados de arquitetura da Fase 1

Arquivos ja existentes e agora usados pela UI:

- `frontend/src/data/creditCosts.js`
- `frontend/src/data/campaignModes.js`
- `frontend/src/data/campaignTemplates.js`
- `frontend/src/data/templateCatalog.js`

### `NovaCampanha.jsx`

Arquivo:

`frontend/src/pages/NovaCampanha.jsx`

Responsabilidade atual na Fase 3:

- Renderizar a nova ordem visual.
- Exibir os cards de pacotes sugeridos.
- Exibir o Catalogo Premium Visual.
- Enviar os IDs selecionados pelo fluxo antigo como `selectedTemplates`.
- Manter o fluxo atual de geracao.

## Componentes que ainda faltam

### `CampaignModeSelector`

Componente futuro para substituir os cards inline de pacotes sugeridos.

Responsabilidade esperada:

- Selecionar entre Economica, Premium IA e Completa.
- Atualizar custo estimado.
- Opcionalmente pre-selecionar itens do catalogo.
- Nao alterar backend diretamente.

### `PremiumTemplateCatalog`

Componente futuro para extrair o Catalogo Premium Visual de dentro de `NovaCampanha.jsx`.

Responsabilidade esperada:

- Renderizar cards do catalogo.
- Controlar selecao/desmarcacao visual.
- Exibir nome comercial, tipo, formato e custo.
- Nunca expor `template_id`, UUID, Creatomate, OpenAI ou GPT ao cliente.

### `SmartCampaignSuggestion`

Componente futuro para Sugestoes Inteligentes.

Responsabilidade esperada:

- Receber `propertyContext`.
- Sugerir campanha principal e ate duas alternativas.
- Pre-selecionar itens do catalogo sem gerar logica paralela de backend.

### `CreditBalance`

Componente futuro para saldo real.

Responsabilidade esperada:

- Buscar saldo real de creditos.
- Exibir data de expiracao.
- Mostrar avisos de saldo baixo.
- Separar creditos de assinatura e creditos avulsos quando o backend estiver aplicado.

### `CreditPurchaseCTA`

Componente futuro para orientar usuario sem saldo.

Responsabilidade esperada:

- Exibir CTA de adicionar creditos.
- Exibir CTA de assinatura.
- Nao bloquear geracao ate a fase em que o backend de consumo real estiver conectado.

## Telas alteradas

### Nova Campanha

Arquivo alterado:

`frontend/src/pages/NovaCampanha.jsx`

Alteracoes visuais:

- inclusao de Pacotes sugeridos;
- renome para Catalogo Premium Visual;
- cards premium para o catalogo;
- inclusao do Resumo de Creditos;
- renome do botao final para "Gerar campanha".

Nenhuma outra tela foi alterada na Fase 3.

## Dependencias criadas

### Dependencias entre componentes e dados

`NovaCampanha.jsx` passou a depender de:

- `CreditSummary.jsx`
- `campaignModes.js`
- `templateCatalog.js`

`CreditSummary.jsx` depende de:

- `campaignModes.js`
- `templateCatalog.js`
- `lucide-react`

### Dependencias de comportamento

O Catalogo Premium Visual depende do mapeamento entre os IDs internos ja usados no seletor antigo e os metadados comerciais de `templateCatalog.js`.

O resumo de creditos depende do mesmo mapeamento para calcular custo estimado por item selecionado.

## O que nao foi alterado

- Backend.
- Edge Function `gerar-banners`.
- Edge Function `gerar-campanha`.
- Stripe.
- Banco.
- Migration de creditos.
- RPCs.
- Payload de geracao.
- Contrato `selectedTemplates`.
- Deploy.

## Riscos para a Fase 4

### 1. Saldo ainda simulado

O resumo visual ainda nao consulta Supabase. Na Fase 4, sera necessario conectar saldo real sem quebrar a experiencia atual.

Risco:

- usuario ver custo visual diferente do saldo real se a regra nao for centralizada.

### 2. Pacotes ainda nao pre-selecionam templates

Os cards de pacotes sugeridos ainda nao alteram a selecao do catalogo.

Risco:

- usuario pode achar que selecionou um pacote, mas o backend ainda receber apenas os templates marcados manualmente.

Mitigacao recomendada:

- na Fase 4, conectar pacote selecionado ao mapa campanha + modo -> `selectedTemplates`, mantendo possibilidade de edicao manual.

### 3. Catalogo ainda esta dentro de `NovaCampanha.jsx`

O catalogo visual foi implementado com patch controlado, mas ainda esta no mesmo arquivo da tela.

Risco:

- `NovaCampanha.jsx` continuar crescendo e ficar dificil de manter.

Mitigacao recomendada:

- extrair `PremiumTemplateCatalog.jsx` em fase propria, sem mudar comportamento.

### 4. Custos precisam ser reconciliados

Hoje o custo estimado combina custo do modo e pesos dos itens do catalogo.

Risco:

- custo por pacote, custo por item e custo real de backend divergirem.

Mitigacao recomendada:

- definir uma unica fonte de verdade para custos antes de implementar debito real.

### 5. Migration de creditos ainda nao aplicada

A infraestrutura SQL ja foi criada em arquivo, mas ainda nao foi aplicada no Supabase.

Risco:

- qualquer tentativa de usar saldo real/RPC antes de aplicar migration vai falhar.

Mitigacao recomendada:

- aplicar e testar a migration em etapa controlada antes de chamar RPC no frontend.

### 6. Termos antigos ainda existem em trechos legados

A Fase 3 ajustou a area principal do fluxo visual, mas ainda existem mensagens legadas em partes da tela e comentarios internos.

Risco:

- inconsistencias de copy como "anuncios" aparecerem em modais/avisos antigos.

Mitigacao recomendada:

- fazer uma fase de limpeza de copy depois que a ordem visual e o catalogo estiverem estabilizados.

## Conclusao

A Fase 3 deixou a Nova Campanha visualmente alinhada com a V2: pacotes, catalogo premium, resumo de creditos e botao final de campanha.

O sistema continua seguro do ponto de vista funcional porque o backend, o payload e `selectedTemplates` permanecem inalterados.

A Fase 4 deve priorizar a conexao entre pacote selecionado, pre-selecao do catalogo e saldo real, sempre mantendo `selectedTemplates` como contrato final com o backend.
