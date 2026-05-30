# Validacao Visual Pre-Fase 4

## Contexto da validacao

A aplicacao local foi iniciada em:

`http://127.0.0.1:5173`

Resultado:

- servidor local respondeu `200`;
- landing page carregou corretamente;
- ao abrir `/nova-campanha`, a aplicacao redirecionou para `/login`;
- nao havia sessao autenticada disponivel no navegador de validacao.

Por esse motivo, a revisao visual completa da tela Nova Campanha nao foi feita em uma sessao autenticada ao vivo. A validacao abaixo combina:

- verificacao do app local rodando;
- confirmacao do redirecionamento de auth;
- auditoria da estrutura atual implementada em `NovaCampanha.jsx` e `CreditSummary.jsx`.

Nenhum usuario foi criado. Nenhum dado foi alterado. Nenhum deploy foi feito.

## Ordem visual confirmada na implementacao

A estrutura atual da tela Nova Campanha esta organizada nesta ordem:

1. Dados do imovel.
2. Fotos do imovel.
3. Pacotes sugeridos.
4. Catalogo Premium Visual.
5. Resumo de Creditos.
6. Gerar campanha.

Referencias encontradas:

- `Dados do imóvel` em `NovaCampanha.jsx`.
- `Fotos do imóvel` em `NovaCampanha.jsx`.
- `Pacotes sugeridos` em `NovaCampanha.jsx`.
- `Catálogo Premium Visual` em `NovaCampanha.jsx`.
- `Resumo de creditos` em `CreditSummary.jsx`.
- `Gerar campanha` em `NovaCampanha.jsx`.

## O que ficou bom

### Ordem da experiencia

A ordem ficou coerente com o fluxo aprovado:

- primeiro o usuario informa o imovel;
- depois envia fotos;
- depois ve pacotes sugeridos;
- depois escolhe materiais no catalogo;
- depois entende o custo;
- por fim gera a campanha.

Isso reduz confusao porque o custo aparece somente depois da escolha visual dos materiais.

### Separacao entre pacote e catalogo

Os pacotes sugeridos aparecem antes do catalogo, como uma camada de orientacao.

Isso e bom porque:

- cria uma decisao simples para o usuario;
- prepara o caminho para pre-selecao futura;
- nao substitui a edicao manual do catalogo.

### Catalogo deixou de parecer lista tecnica

O Catalogo Premium Visual agora usa cards com:

- nome comercial;
- descricao;
- tipo;
- formato;
- custo;
- botao selecionar/desmarcar;
- estado visual de selecionado.

Isso ja aproxima a tela de uma vitrine premium.

### Resumo de creditos no lugar certo

O resumo aparece depois do catalogo e antes do botao final.

Isso esta correto porque:

- o usuario entende o impacto da selecao antes de gerar;
- o botao de geracao fica mais consciente;
- prepara a transicao para saldo real na fase futura.

### Contrato tecnico preservado

A tela continua preservando `selectedTemplates` como saida final.

Nenhuma alteracao visual feita na Fase 3 exige mudanca no backend.

## O que ficou visualmente fraco

### Falta imagem nos cards

O catalogo ainda depende de cards textuais.

Mesmo com estilo premium, sem imagem real o catalogo ainda parece mais uma lista bonita do que uma vitrine visual.

Impacto:

- usuario nao consegue prever o resultado;
- a escolha ainda parece abstrata;
- falta impacto emocional no catalogo.

### Pacotes ainda parecem conceituais

Os cards de Economica, Premium IA e Completa mostram custo e descricao, mas ainda nao demonstram visualmente o que cada pacote entrega.

Impacto:

- usuario nao percebe a diferenca real entre pacotes;
- falta comparacao visual;
- o botao "Selecionar pacote" pode parecer mais poderoso do que realmente e nesta fase.

### Resumo de creditos ainda explicita simulacao

O resumo informa que e visual temporario e usa saldo simulado.

Isso e correto para desenvolvimento, mas visualmente ainda nao parece produto final.

Impacto:

- experiencia pode parecer incompleta;
- precisa ser substituido por saldo real quando a migration for aplicada e testada.

### Copy legada ainda existe em areas antigas

Ainda existem trechos antigos no produto usando "anuncios", principalmente em areas nao totalmente limpas da tela/landing.

Impacto:

- a experiencia V2 ainda pode parecer misturada com modelo antigo;
- a linguagem de creditos ainda nao esta 100% consolidada.

## O que ainda nao parece Netflix

### Falta thumbnail real

O principal elemento ausente e a imagem de preview.

Um catalogo estilo Netflix precisa que o usuario bata o olho e entenda visualmente:

- qual arte vai receber;
- qual formato e mais bonito;
- qual video parece mais premium;
- qual item combina com o imovel.

Hoje os cards ainda sao textuais.

### Falta carrossel horizontal

O catalogo usa grid.

Isso e funcional, mas ainda nao tem a sensacao de prateleiras/linhas como:

- "Mais recomendados";
- "Videos premium";
- "Stories";
- "Artes para feed";
- "Comercial";
- "Captacao".

Para parecer Netflix, a Fase 4 deve organizar itens em faixas horizontais ou secoes editoriais.

### Falta hierarquia editorial

Hoje todos os itens do catalogo tem peso visual parecido.

O estilo Netflix exige mais curadoria:

- primeiro os recomendados;
- depois formatos por canal;
- depois itens adicionais;
- talvez uma faixa "Mais usados por corretores".

### Falta preview de movimento

Videos, Reels e Stories precisam de algum sinal visual de movimento.

Sem preview animado ou thumbnail com botao de play, os videos parecem cards comuns.

## O que precisa de thumbnail real

Todos os itens do Catalogo Premium Visual precisam de thumbnail.

Prioridade alta:

- Banner Luxo.
- Banner Popular.
- Reels Moderno.
- Story Premium.
- Video Cinematografico.
- Banner Completo.
- Card Comercial.
- Ficha Visual.
- Montagem Profissional.

Prioridade media:

- Carrossel Triplo.
- Story Novo Imovel.
- Montagem de Fotos.
- Galeria Lifestyle.
- Prova Social Animada.
- Revelacao Premium.
- Chat WhatsApp.
- Slideshow Horizontal.
- Compilado de Video.

Recomendacao:

- usar imagens `.webp` ou `.jpg` otimizadas;
- evitar previews pesados;
- nomear arquivos com slugs comerciais, nunca UUID.

## O que precisa de preview

### Preview estatico

Obrigatorio para a Fase 4A.

Cada card deve ter:

- imagem real do template;
- proporcao coerente com o formato;
- fallback visual se imagem nao carregar.

### Preview animado

Preparar, mas nao obrigar na primeira implementacao.

Ideal para:

- Reels;
- Stories;
- videos horizontais;
- montagens;
- compilados.

### Video demonstrativo

Pode ficar para fase posterior.

Uso recomendado:

- modal ao clicar em "Ver preview";
- video curto;
- sem gerar nada no backend.

### Antes/depois

Pode ficar preparado no catalogo como campo futuro.

Uso recomendado:

- mostrar foto comum versus criativo final;
- ajuda muito a vender valor percebido.

## O que precisa de reorganizacao

### Extrair Catalogo Premium Visual

Hoje o catalogo ainda esta dentro de `NovaCampanha.jsx`.

Recomendacao:

Criar futuramente:

`frontend/src/components/PremiumTemplateCatalog.jsx`

Responsabilidade:

- renderizar prateleiras/carrosseis;
- receber selecao;
- emitir toggle;
- nunca conhecer backend;
- nunca expor IDs tecnicos.

### Extrair Pacotes sugeridos

Hoje os cards de pacotes tambem estao inline na tela.

Recomendacao:

Criar futuramente:

`frontend/src/components/CampaignModeSelector.jsx`

Responsabilidade:

- renderizar Economica, Premium IA e Completa;
- controlar modo selecionado;
- futuramente pre-selecionar catalogo.

### Organizar catalogo por categorias comerciais

Sugestao de prateleiras:

- Recomendados para esta campanha.
- Artes premium.
- Videos e Reels.
- Stories.
- Carrosseis.
- Comercial e Captacao.

### Separar custo de pacote e custo por item

Hoje o resumo visual pode usar custo do pacote ou soma dos itens selecionados.

Antes de debito real, a regra precisa ficar unica.

Recomendacao:

- definir se o custo final sera por pacote, por item ou hibrido;
- centralizar a regra antes de conectar RPC.

## Riscos para iniciar a Fase 4

### Risco 1 - Implementar preview e quebrar selecao

Ao trocar grid por carrossel, existe risco de quebrar o toggle atual.

Mitigacao:

- manter estado de selecao igual;
- manter `selectedTemplates`;
- mudar apenas camada visual primeiro.

### Risco 2 - Expor template interno

Ao usar thumbnails e metadados, existe risco de renderizar `templateId` ou UUID por acidente.

Mitigacao:

- renderizar somente `publicName`, `description`, `type`, `format`, `creditWeight` e `preview`;
- revisar DOM visual antes de aprovar.

### Risco 3 - Assets pesados

Thumbnails reais podem deixar a tela lenta.

Mitigacao:

- comprimir imagens;
- usar lazy loading;
- limitar tamanho;
- comecar com previews estaticos.

### Risco 4 - Criar componentes grandes demais

Se a Fase 4 tentar resolver preview, carrossel, pacote, saldo e pre-selecao ao mesmo tempo, aumenta o risco.

Mitigacao:

- dividir em Fase 4A e Fase 4B.

### Risco 5 - Validacao visual autenticada ainda pendente

A tela completa nao foi aberta em sessao autenticada nesta validacao.

Mitigacao:

- antes de implementar Fase 4, validar com usuario logado ou ambiente local autenticado;
- se necessario, usar conta teste aprovada pelo usuario.

## Recomendacao para Fase 4

Implementar em duas partes:

### Fase 4A

- adicionar thumbnails reais;
- extrair `PremiumTemplateCatalog.jsx`;
- manter selecao e payload intactos;
- manter `selectedTemplates`;
- sem pre-selecao automatica por pacote.

### Fase 4B

- extrair `CampaignModeSelector.jsx`;
- conectar pacote selecionado a pre-selecao de itens;
- permitir edicao manual depois;
- recalcular custo com regra unica;
- ainda sem debito real, se essa for a decisao de produto.

## Conclusao

A Fase 3 deixou a estrutura visual correta e funcional para evoluir.

O que falta para parecer realmente Netflix nao e mais ordem de tela, e sim:

- thumbnails reais;
- prateleiras/carrosseis;
- previews de video;
- hierarquia editorial;
- componentes separados para reduzir complexidade.

A Fase 4 deve priorizar visual e organizacao do catalogo, preservando `selectedTemplates` e evitando qualquer mudanca de backend.
