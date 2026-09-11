# Golden Production

Base de entrada: `75a6a0611c8cc7bbfa038817f129c3ad60477bb9`.
O commit que contém esta consolidação é a nova base Golden. O SHA ativo é publicado em `/production-release.json` e nos metadados Vercel; não há um SHA fixo que fique desatualizado.

## Regressão comprovada e restauração

| Área | Ausência | Último estado aprovado | Diff restaurado |
|---|---|---|---|
| Admin 2.0 | Último login/atividade/produto, timeline e funil | `3245c29` / `f3b0e47` | AdminDashboard.jsx |
| Analytics Admin | Abertura, etapas e Gerar em produtos; evento de login | `f3b0e47` | App.jsx, AccountAnalyticsRoute, chamadas de analytics nas páginas e auth-context |
| Fonte do backend Admin | Checkout local anterior ao runtime publicado | admin-api vigente, baixado para comparação | index.ts/runtime.ts alinhados ao backend; nenhum redeploy backend necessário |

A linha de `75a6a06` não continha os commits Admin acima. O backend já publicado mantém as funções e a correção posterior de falhas pré-backend. Há eventos reais persistidos; nenhuma geração foi necessária para verificar isso.

## Matriz não destrutiva

A matriz executável está em `scripts/production/smoke.mjs`. Ela verifica rotas, componentes, estados/etapas e conexão da ação final; o build valida os imports. O smoke de Home renderiza o componente real. Os testes Admin exercitam timeline/funil a partir de evidências persistidas, sem inferir etapas inexistentes.

| Produto | Rota | Caminho da geração | Resultado local |
|---|---|---|---|
| Vídeo Imobiliário | /smart-tour-ai | smart-tour-generate | PASS |
| Banner | /hero | gerar-hero-ia | PASS |
| Smart Space | /virtual-staging | virtual-staging-image-test | PASS |
| Banners Rápidos | /nova-campanha | gerar-banners | PASS |
| Comercial Imobiliário | /studio-hero | criar-video-ia | PASS |
| Vídeo Criativo | /studio-hero | criar-video-ia | PASS |
| Smart Carrossel | /smart-carrossel | smart-carousel-creatomate | PASS |
| Campanha de Textos | /campanha-de-textos | generate-text-campaign | PASS |
| Raio-X | /raio-x-anuncio | raio-x-anuncio | PASS |

CTA, rota guest, chat sequencial, quatro imagens, principal e payload são obrigatórios. Home mantém os quatro grupos. Nenhuma outra funcionalidade ausente foi identificada no escopo desta matriz; isso não substitui teste pago de todos os providers.

## Publicação e limite da proteção

Executar `node scripts/production/deploy.mjs` no checkout com checkpoint limpo. Configurar apenas o caminho de `VERCEL_CLI` se necessário; a autenticação continua no armazenamento seguro da CLI. O script consulta o SHA atualmente oficial, bloqueia ancestralidade divergente, cria um pacote exato com prova de commits e hashes, executa smoke novamente no build Vercel e verifica que Production não mudou antes de promover. O pós-deploy confere SHA/alias e HTTP, sem geração.

A proteção é do fluxo oficial e do build deste repositório. Um proprietário da conta Vercel com permissão para alterar configuração/publicar fora desse fluxo pode contorná-la; impedir também esse acesso exige controle de permissões externo ao código. Nenhuma política de acesso da conta foi modificada.
