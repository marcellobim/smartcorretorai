# Auditoria Termos e Privacidade - Modelo de Creditos

## Objetivo

Auditar as telas e textos legais atuais para identificar inconsistencias com o novo modelo comercial do SmartCorretorAI baseado em creditos, campanha demonstrativa unica e recargas com validade de 180 dias.

Nao foram feitas alteracoes nos arquivos auditados.

## Arquivos encontrados

### Paginas legais

- `frontend/src/pages/TermosDeUso.jsx`
- `frontend/src/pages/Privacidade.jsx`

### Rotas legais

- `frontend/src/App.jsx`
  - `/termos`
  - `/privacidade`

### Cadastro e aceite

- `frontend/src/pages/RegisterPage.jsx`

### Outras referencias relevantes encontradas

- `frontend/src/pages/LandingPage.jsx`
- `frontend/src/pages/Planos.jsx`
- `frontend/src/pages/NovaCampanha.jsx`
- `frontend/src/pages/AdminDashboard.jsx`
- `frontend/src/pages/Configuracoes.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/components/layout/Header.jsx`
- `README.md`

## Status geral

### Termos de Uso

Status: ainda estao no modelo antigo.

O arquivo `TermosDeUso.jsx` ainda fala em:

- planos pagos mensais e pacotes avulsos de anuncios;
- anuncios mensais que resetam no dia 1;
- anuncios avulsos que nao expiram;
- multiplos logins apenas no plano Imobiliaria;
- modelo anterior de planos/uso.

Nao cobre adequadamente:

- START, PRO e ELITE por creditos;
- recargas de creditos;
- validade de creditos;
- campanha demonstrativa gratuita unica;
- recursos premium bloqueados no demonstrativo;
- ausencia de garantia de resultado comercial dentro da estrutura de creditos;
- uso promocional de materiais gerados pela plataforma;
- aceite por uso, geracao, contratacao de plano e compra de recarga.

### Politica de Privacidade

Status: parcialmente alinhada, mas precisa atualizacao.

Ja menciona:

- dados pessoais;
- dados de imoveis;
- fotos;
- pagamentos via Stripe;
- Supabase;
- controle de uso de creditos;
- uso de dados para gerar conteudo.

Ainda precisa atualizar:

- fornecedor/modelo de IA citado como `Anthropic (Claude)`;
- uso de imagens e dados enviados para geracao de campanhas;
- possibilidade de uso de exemplos de materiais gerados para demonstracao/portfolio/divulgacao;
- preservacao de identidade do usuario em materiais promocionais;
- regra de nao expor nome, telefone, e-mail, CRECI, endereco especifico ou identidade sem autorizacao especifica;
- aceite de Termos e Politica ao criar conta, usar sistema, gerar campanhas ou contratar planos/recargas.

### Cadastro

Status: ainda esta no modelo antigo.

O arquivo `RegisterPage.jsx` ainda exibe:

- `7 dias gratis, sem cartao de credito`
- `Crie sua conta gratis`
- links de Termos de Uso e Politica de Privacidade com `href="#"`, sem apontar para `/termos` e `/privacidade`

Tambem precisa deixar o aceite mais forte:

- ao criar conta, usar o sistema, gerar campanhas ou contratar planos/recargas, o usuario aceita integralmente Termos e Privacidade.

## Trechos antigos encontrados

### `frontend/src/pages/TermosDeUso.jsx`

Trechos que precisam ser substituidos:

```text
A Plataforma oferece planos pagos mensais e pacotes avulsos de anuncios.
```

```text
Os anuncios mensais resetam no dia 1 de cada mes e nao sao acumulados.
```

```text
Anuncios avulsos nao expiram e ficam disponiveis ate serem utilizados.
```

```text
Multiplos logins estao disponiveis apenas no plano Imobiliaria.
```

Problema:

Esses trechos conflitam diretamente com o modelo atual de creditos, recargas de 180 dias e fim do plano Imobiliaria como plano comercial principal.

### `frontend/src/pages/RegisterPage.jsx`

Trecho antigo:

```text
7 dias gratis, sem cartao de credito.
```

Problema:

O teste gratis nao e mais 7 dias. O modelo atual e:

```text
1 campanha demonstrativa gratuita.
```

### `frontend/src/pages/RegisterPage.jsx`

Trechos de aceite:

```text
Termos de Uso
Politica de Privacidade
```

Problema:

Os links usam `href="#"` e nao levam para `/termos` ou `/privacidade`.

### `frontend/src/pages/Privacidade.jsx`

Trecho a revisar:

```text
Anthropic (Claude): geracao de conteudo por IA
```

Problema:

A marca atual na Landing e `Inteligencia Artificial Multimodelo`, e o projeto usa geracao por Edge Functions/servicos de IA que podem mudar. A politica deve descrever de forma ampla e neutra os operadores/subprocessadores de IA, sem travar em um unico fornecedor se isso nao for a realidade atual do produto.

### `README.md`

Trechos antigos:

- ainda descreve backend Node/Express;
- cita endpoints `/api/subscriptions/checkout` e `/api/subscriptions/webhook`;
- cita variaveis `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`.

Risco:

Embora nao seja tela legal, pode confundir operacao/documentacao, pois a arquitetura atual usa Supabase Edge Functions e ainda nao integrou checkout Stripe.

## Comparacao com o modelo atual

### Planos atuais

Devem aparecer nos Termos:

- START: 1.000 creditos.
- PRO: 2.500 creditos.
- ELITE: 6.000 creditos.

### Recargas atuais

Devem aparecer nos Termos:

- 500 creditos: R$ 59.
- 1.000 creditos: R$ 99.
- 2.000 creditos: R$ 179.

### Validade

Devem aparecer nos Termos:

- creditos da assinatura renovam por ciclo;
- creditos da assinatura podem expirar/zerar conforme o ciclo contratado;
- creditos avulsos expiram em 180 dias apos a compra;
- creditos nao utilizados podem nao ser reembolsaveis, salvo obrigacao legal ou politica comercial expressa.

### Campanha demonstrativa gratuita

Deve substituir qualquer mencao a 7 dias gratis.

Nova regra:

- e uma campanha demonstrativa gratuita unica;
- limitada;
- recursos premium podem ficar bloqueados;
- apos uso, novas geracoes exigem plano pago ou recarga/plano aplicavel.

## Riscos identificados

### Risco 1 - Inconsistencia comercial

Termos dizem anuncios mensais e anuncios avulsos sem expiracao, enquanto a interface atual passou para creditos.

Impacto:

- conflito com o que o usuario compra;
- risco de contestacao;
- risco de suporte/comercial.

### Risco 2 - Promessa de teste gratis incorreta

Cadastro ainda fala em 7 dias gratis.

Impacto:

- usuario pode exigir uso por 7 dias;
- desalinhamento com campanha demonstrativa unica.

### Risco 3 - Aceite fraco

Links de Termos/Privacidade no cadastro apontam para `#`.

Impacto:

- usuario nao consegue abrir facilmente os documentos antes de aceitar;
- enfraquece a prova de aceite.

### Risco 4 - Uso promocional de materiais sem clausula clara

Os Termos atuais dizem que o conteudo pertence ao usuario e concedem licenca limitada para processamento/melhoria, mas nao contemplam uso como portfolio, demonstracao, divulgacao e propaganda da plataforma.

Impacto:

- risco de disputa sobre uso de campanhas geradas em marketing do SmartCorretorAI.

### Risco 5 - Privacidade e identidade

A Politica ainda nao detalha como materiais gerados podem ser usados em exemplos preservando identidade.

Impacto:

- risco LGPD/direito de imagem se forem usadas imagens, endereco, CRECI, telefone ou identidade do corretor sem autorizacao especifica.

### Risco 6 - Subprocessadores de IA desatualizados

Privacidade cita `Anthropic (Claude)` especificamente.

Impacto:

- inconsistencia com branding multimodelo;
- risco de politica ficar errada se o processamento usar outro provedor.

### Risco 7 - Ausencia de regras de creditos em cancelamento/renovacao

Termos nao explicam o que acontece com creditos na renovacao, cancelamento, expiracao e recargas.

Impacto:

- expectativa errada sobre acumulacao, reembolso e uso apos cancelamento.

## Clausulas que precisam ser atualizadas

### 1. Aceitacao dos Termos

Adicionar que o aceite ocorre ao:

- criar conta;
- acessar ou usar a plataforma;
- enviar dados/fotos;
- gerar campanhas;
- contratar planos;
- comprar recargas;
- usar materiais gerados.

Sugestao de conteudo:

```text
Ao criar conta, acessar a plataforma, gerar campanhas, contratar planos, comprar recargas ou utilizar materiais gerados, o Usuario declara que leu, compreendeu e aceita integralmente estes Termos de Uso e a Politica de Privacidade.
```

### 2. Descricao do servico

Atualizar para explicar:

- campanha demonstrativa;
- catalogo/campanhas inteligentes;
- textos, banners, stories, carrosseis e videos conforme plano/creditos;
- recursos premium podem depender de plano pago e saldo.

### 3. Planos, creditos e recargas

Substituir a clausula antiga de anuncios por:

- START: 1.000 creditos;
- PRO: 2.500 creditos;
- ELITE: 6.000 creditos;
- recargas de 500, 1.000 e 2.000 creditos;
- creditos da assinatura renovam por ciclo;
- creditos avulsos expiram em 180 dias;
- textos IA gratuitos;
- banners consomem menos creditos;
- videos consomem mais creditos;
- usuario escolhe formatos e consome creditos conforme campanha.

### 4. Campanha demonstrativa gratuita

Adicionar clausula especifica:

- 1 campanha unica;
- nao e teste por 7 dias;
- limitada;
- nao inclui recursos premium;
- pode bloquear videos premium, banners premium, catalogo completo e campanhas avancadas;
- apos uso, exige plano pago ou recarga/plano aplicavel.

### 5. Pagamentos, renovacao e cancelamento

Atualizar para:

- assinatura recorrente;
- renovacao automatica por ciclo;
- cancelamento com efeito ao final do periodo vigente;
- ausencia de reembolso proporcional, salvo exigencia legal;
- creditos nao utilizados podem expirar conforme regra do plano ou recarga;
- recargas avulsas nao substituem assinatura se algum recurso exigir plano ativo;
- valores podem mudar mediante aviso.

### 6. Ausencia de garantia de resultado comercial

Manter e reforcar:

- nao ha garantia de venda, locacao, leads, visualizacoes, cliques, aprovacao em plataformas de anuncios ou resultado financeiro.

### 7. Conteudo gerado e revisao pelo usuario

Atualizar para:

- usuario deve revisar textos, precos, condicoes, informacoes do imovel, CRECI, telefone, endereco e promessas comerciais;
- usuario responde pela veracidade das informacoes publicadas;
- IA pode cometer erros.

### 8. Uso promocional de materiais gerados

Adicionar clausula solicitada:

```text
O Usuario autoriza a SmartCorretorAI a utilizar exemplos de campanhas, artes, imagens geradas, layouts, textos e demais materiais produzidos pela Plataforma para fins de demonstracao, portfolio, divulgacao, treinamento comercial e propaganda da propria plataforma, preservando a identidade do Usuario sempre que aplicavel.
```

Complemento recomendado:

```text
Quando o material contiver dados pessoais identificaveis, como nome, telefone, e-mail, CRECI, endereco especifico, imagem pessoal, logotipo ou identidade visual do Usuario, a SmartCorretorAI devera anonimizar, mascarar ou obter autorizacao especifica antes de uso promocional publico, salvo quando o proprio Usuario ja tiver publicado ou autorizado expressamente o uso.
```

### 9. Privacidade - dados enviados para geracao

Adicionar:

- dados de imoveis, fotos, localizacao, preco, caracteristicas, informacoes do corretor e preferencias sao usados para gerar campanhas;
- esses dados podem ser processados por provedores de IA, renderizacao, armazenamento e infraestrutura;
- dados pessoais devem ser minimizados quando usados em demonstracoes.

### 10. Privacidade - materiais promocionais

Adicionar:

- exemplos podem ser usados de forma anonimizada;
- nao expor nome, telefone, e-mail, CRECI, endereco especifico ou identidade do usuario sem autorizacao especifica;
- fotos de terceiros, fachadas identificaveis e imagens pessoais exigem cuidado de direito de imagem.

### 11. Subprocessadores

Trocar fornecedor especifico por estrutura mais resiliente:

```text
Provedores de inteligencia artificial e automacao de midia utilizados para processamento dos comandos, textos, imagens, templates, videos e materiais de campanha.
```

Pode manter lista exemplificativa em vez de fechada.

## Sugestao de nova estrutura - Termos de Uso

1. Aceitacao dos Termos e Politica de Privacidade.
2. Descricao da Plataforma.
3. Elegibilidade, cadastro e responsabilidade da conta.
4. Campanha demonstrativa gratuita.
5. Planos, creditos e recargas.
6. Pagamentos, renovacao, cancelamento e expiracao de creditos.
7. Uso adequado da plataforma.
8. Conteudo gerado por IA e responsabilidade de revisao.
9. Uso dos materiais gerados pelo Usuario.
10. Licenca para uso promocional pela SmartCorretorAI.
11. Propriedade intelectual.
12. Privacidade e protecao de dados.
13. Ausencia de garantia de resultado comercial.
14. Limitacao de responsabilidade.
15. Suspensao e encerramento de conta.
16. Modificacoes dos Termos.
17. Foro e lei aplicavel.
18. Contato.

## Sugestao de nova estrutura - Politica de Privacidade

1. Introducao.
2. Quem e o controlador dos dados.
3. Dados pessoais coletados.
4. Dados de imoveis, fotos e materiais enviados.
5. Como usamos os dados.
6. Uso de dados para geracao de campanhas por IA.
7. Uso de exemplos e materiais para demonstracao/portfolio.
8. Como protegemos a identidade do Usuario em divulgacoes.
9. Compartilhamento com operadores e subprocessadores.
10. Pagamentos e dados financeiros.
11. Integracoes com redes sociais.
12. Cookies, analytics e rastreamento.
13. Armazenamento, seguranca e retencao.
14. Direitos do titular LGPD.
15. Exclusao de dados.
16. Menores de idade.
17. Alteracoes da Politica.
18. Contato e DPO.

## Sugestao de nova estrutura - Cadastro/Aceite

Atualizar copy:

```text
1 campanha demonstrativa gratuita, sem cartao de credito.
```

Atualizar checkbox:

```text
Ao criar minha conta, usar o sistema, gerar campanhas ou contratar planos/recargas, declaro que li e aceito os Termos de Uso e a Politica de Privacidade.
```

Atualizar links:

- Termos de Uso -> `/termos`
- Politica de Privacidade -> `/privacidade`

## Prioridade recomendada

### Alta

- Atualizar `TermosDeUso.jsx`.
- Atualizar `RegisterPage.jsx` para remover 7 dias gratis e corrigir links.
- Atualizar clausula de planos/creditos/recargas.
- Adicionar campanha demonstrativa unica.
- Adicionar aceite ampliado.

### Media

- Atualizar `Privacidade.jsx` para uso de imagens/dados enviados e exemplos promocionais.
- Trocar fornecedor IA especifico por descricao multimodelo/subprocessadores.
- Adicionar preservacao de identidade em uso promocional.

### Baixa

- Revisar README para remover arquitetura antiga de backend Node/Express e endpoints Stripe antigos.
- Revisar AdminDashboard, Dashboard, Configuracoes e copy residual de anuncios/imobiliaria.

## Conclusao

Os documentos legais ainda nao estao prontos para o modelo atual de creditos.

O principal risco esta em `TermosDeUso.jsx`, que permanece no modelo antigo de anuncios mensais, anuncios avulsos sem expiracao e plano Imobiliaria.

Antes de ativar cobranca real, recargas, consumo de creditos ou campanha demonstrativa em producao, e recomendado atualizar Termos, Privacidade e fluxo de aceite do cadastro para refletir:

- START, PRO e ELITE por creditos;
- recargas com validade de 180 dias;
- campanha demonstrativa unica;
- recursos premium bloqueados no demonstrativo;
- pagamentos recorrentes e cancelamento;
- ausencia de garantia de resultado comercial;
- uso promocional de materiais gerados com protecao de identidade.
