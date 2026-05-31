# Fase 4.1 - Interface Visual do Catalogo Premium

## Objetivo

Criar apenas a interface visual do Catalogo Premium, substituindo a exposicao visual de templates por escolha de campanhas inteligentes.

Nao foram alterados:

- backend;
- Stripe;
- Supabase;
- geracao;
- APIs;
- logica real de creditos;
- Edge Functions;
- migrations;
- deploy.

## Arquivo alterado

- `frontend/src/pages/NovaCampanha.jsx`

## O que foi implementado

Na tela Nova Campanha, a area do Catalogo Premium Visual agora exibe 6 cards de campanhas inteligentes:

1. Venda Rapida.
2. Luxo Premium.
3. Lancamento.
4. Minha Casa Minha Vida.
5. Airbnb / Temporada.
6. Comercial.

Cada card possui:

- titulo;
- descricao curta;
- beneficios;
- quantidade de pecas recomendadas conforme o pacote visual selecionado;
- botao `Selecionar`;
- estado visual de campanha selecionada.

## Como selectedTemplates foi preservado

A interface deixou de exibir os templates tecnicos para o cliente.

Ao selecionar uma campanha, o frontend usa o mapa ja existente `CAMPAIGN_TEMPLATES` para preencher internamente o mesmo estado que ja era usado pelos templates.

Com isso:

- o cliente escolhe uma campanha inteligente;
- a interface nao mostra IDs tecnicos;
- `selectedTemplates` continua sendo montado internamente;
- o backend continua recebendo o mesmo contrato atual;
- nenhuma Edge Function foi alterada.

## Relacao com pacotes sugeridos

Os pacotes sugeridos continuam existindo:

- Economica;
- Premium IA;
- Completa.

Ao trocar o pacote visual, se ja houver uma campanha selecionada, a selecao interna e recalculada usando o mesmo mapa de campanha + modo.

Essa mudanca nao altera backend nem consumo real de creditos.

## Visual

O visual dos cards segue a linha premium da Landing atual:

- fundo escuro em gradiente;
- destaque em amarelo para quantidade de pecas;
- borda/ring no card selecionado;
- botao claro para campanha ativa;
- grid responsivo em 1, 2 ou 3 colunas.

## Validacao tecnica

Comando executado:

```bash
npm run build
```

Resultado: passou.

Observacao: Vite exibiu apenas o aviso conhecido de chunk maior que 500 kB apos minificacao.

## Validacao no navegador

A aplicacao local estava disponivel em:

`http://127.0.0.1:5173`

Ao abrir:

`http://127.0.0.1:5173/nova-campanha`

a aplicacao redirecionou para:

`http://127.0.0.1:5173/login`

Motivo:

- a rota Nova Campanha exige usuario autenticado;
- o navegador de validacao nao possuia sessao ativa.

Portanto, a tela protegida nao foi visualizada autenticada nesta validacao.

Foi exibida a tela de login no navegador como confirmacao de que a rota protegida esta ativa.

## Screenshot

Screenshot disponivel na conversa: tela de login exibida apos tentativa de acessar `/nova-campanha` sem sessao autenticada.

## Riscos

### 1. UI antiga de templates ficou oculta

Para minimizar risco nesta fase, a UI antiga de templates foi ocultada visualmente, e nao removida integralmente.

Risco:

- o arquivo `NovaCampanha.jsx` continua grande e com codigo legado oculto.

Mitigacao futura:

- remover ou extrair a UI antiga apos validacao autenticada da nova experiencia.

### 2. Validacao visual autenticada pendente

A interface completa precisa ser revisada com usuario logado.

Risco:

- algum ajuste fino de espacamento, responsividade ou hierarquia pode aparecer apenas na tela real.

Mitigacao:

- validar com sessao autenticada antes de commit final ou antes de iniciar a proxima etapa.

### 3. Campanha selecionada altera selecao interna

O clique em campanha agora preenche internamente os templates recomendados.

Risco:

- se algum mapeamento em `CAMPAIGN_TEMPLATES` estiver errado, a campanha pode gerar formatos diferentes do esperado.

Mitigacao:

- testar cada uma das 6 campanhas com `selectedTemplates` antes de deploy.

## Proximo passo sugerido

Validar a tela Nova Campanha autenticada, confirmar visualmente os 6 cards e testar se cada campanha preenche `selectedTemplates` corretamente sem alterar backend.
