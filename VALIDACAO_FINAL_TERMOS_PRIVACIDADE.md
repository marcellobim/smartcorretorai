# Validacao Final Termos e Privacidade

## Objetivo

Revisar visualmente as paginas legais e de cadastro apos a atualizacao para o modelo de creditos.

Paginas verificadas:

- `/termos`
- `/privacidade`
- `/cadastro`
- `/register`

Observacao: no roteamento atual do app, a rota de cadastro existente e `/cadastro`. A rota `/register` nao existe e redireciona para a Home.

## Ambiente

URL local:

`http://127.0.0.1:5173`

Validacao feita com navegador headless local e screenshots full-page.

## Screenshots

- `screenshots/validacao-final-termos.png`
- `screenshots/validacao-final-privacidade.png`
- `screenshots/validacao-final-cadastro.png`
- `screenshots/validacao-final-register.png`

## Resultado por pagina

### `/termos`

Status: aprovado com observacao.

Confirmado visualmente:

- pagina abre corretamente;
- link de voltar aparece;
- rodape aponta para Politica de Privacidade;
- nao foram encontrados termos proibidos;
- inclui campanha demonstrativa;
- inclui creditos;
- inclui validade de 180 dias;
- inclui uso promocional;
- inclui revisao obrigatoria de conteudo gerado por IA;
- inclui ausencia de garantia de resultado comercial.

Observacao:

- a pagina usa a ideia de que IA pode cometer erros, mas nao usa literalmente a palavra `imprecisoes`.
- nao foi encontrada a expressao literal `informacoes de mercado`; ha mencoes a resultado comercial, marketing e plataformas externas.

### `/privacidade`

Status: aprovado com observacao.

Confirmado visualmente:

- pagina abre corretamente;
- link de voltar aparece;
- rodape aponta para Termos de Uso;
- nao foram encontrados termos proibidos;
- inclui creditos;
- inclui uso promocional;
- inclui protecao de identidade do usuario;
- inclui uso de dados, fotos e materiais enviados para geracao por IA;
- remove fornecedor antigo citado nominalmente.

Observacao:

- nao foi encontrada a expressao literal `180 dias`, pois essa regra ficou concentrada nos Termos de Uso.
- nao foi encontrada a expressao literal `informacoes de mercado`.
- nao foi encontrada a palavra literal `imprecisoes`, embora os Termos cubram que IA pode cometer erros.

### `/cadastro`

Status: aprovado.

Confirmado visualmente:

- pagina abre corretamente;
- nao aparece mais `7 dias gratis`;
- aparece `1 campanha demonstrativa gratuita, sem cartao de credito`;
- aceite foi ampliado para conta, uso do sistema, geracao de campanhas e contratacao de planos/recargas;
- link `Termos de Uso` aponta para `/termos`;
- link `Politica de Privacidade` aponta para `/privacidade`;
- nao existem links legais `href="#"`.

### `/register`

Status: rota inexistente no app atual.

Resultado:

- acessar `/register` redireciona para `/`;
- a tela exibida e a Landing Page;
- nao foi encontrado conteudo proibido nessa tela durante a validacao.

Recomendacao:

- se `/register` for uma URL esperada comercialmente, criar redirect explicito para `/cadastro` em tarefa futura.
- se nao for esperada, manter `/cadastro` como rota oficial.

## Termos proibidos

Busca visual/textual nas paginas verificadas nao encontrou:

- `7 dias gratis`;
- `Imobiliaria` como plano antigo;
- `anuncios avulsos`;
- `15 anuncios`;
- `35 anuncios`;
- `80 anuncios`.

Tambem nao foram encontrados:

- `Anthropic`;
- `Claude`;
- links legais `href="#"` no cadastro.

## Itens solicitados

### Links funcionam corretamente

Parcialmente confirmado:

- em `/cadastro`, links legais existem e apontam corretamente para `/termos` e `/privacidade`;
- `/termos` e `/privacidade` abrem diretamente;
- `/register` nao existe e redireciona para a Home.

### Campanha demonstrativa

Confirmado em:

- `/termos`;
- `/cadastro`;
- Landing exibida no redirecionamento de `/register`.

### Creditos

Confirmado em:

- `/termos`;
- `/privacidade`;
- `/cadastro` no texto de planos/recargas do aceite.

### Validade de 180 dias

Confirmado em:

- `/termos`.

Nao aparece em:

- `/privacidade`;
- `/cadastro`.

### Uso promocional

Confirmado em:

- `/termos`;
- `/privacidade`.

### Informacoes de mercado

Nao encontrado literalmente.

Observacao:

- os textos cobrem marketing, resultado comercial e plataformas externas, mas nao ha uma clausula especifica com a expressao `informacoes de mercado`.

### IA pode conter imprecisoes

Parcialmente confirmado.

Observacao:

- os Termos dizem que a IA pode cometer erros, omitir informacoes ou gerar textos que precisem de revisao;
- a palavra literal `imprecisoes` nao aparece.

## Conclusao

A atualizacao esta visualmente consistente com o modelo de creditos e removeu as referencias antigas mais criticas.

Pontos aprovados:

- paginas legais abrem;
- cadastro usa campanha demonstrativa;
- links legais do cadastro funcionam;
- nao ha referencias antigas a 7 dias gratis, anuncios avulsos, 15/35/80 anuncios ou plano Imobiliaria;
- Termos cobrem creditos, 180 dias, renovacao, cancelamento e uso promocional;
- Privacidade cobre dados, fotos, IA, materiais gerados e preservacao de identidade.

Pontos para decisao antes de commit/deploy:

- decidir se `/register` deve redirecionar para `/cadastro`;
- decidir se deseja incluir literalmente `informacoes de mercado`;
- decidir se deseja trocar a frase `IA pode cometer erros` por `IA pode conter imprecisoes`.

Nao houve alteracao de codigo, commit ou deploy nesta validacao.
