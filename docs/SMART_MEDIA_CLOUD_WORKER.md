# Smart Media Worker — operação 24/7

## Arquitetura

O frontend continua chamando apenas as Edge Functions do Supabase. A fila
persistente continua sendo `video_jobs`, e o bucket privado continua sendo
`studio-videos`. Um container Node dedicado consulta a fila, faz claim atômico,
renderiza com FFmpeg e grava o mesmo `final.mp4` já consumido pelo preview e pelo
download.

Nenhuma rota de produção usa a ponte local. Ela permanece no mesmo worker para
DEV, mas só ativa com `SMART_MEDIA_LOCAL_BRIDGE=1`, escuta `127.0.0.1` e é
recusada quando `NODE_ENV=production`.

## Isolamento dos ambientes

Use três projetos Supabase distintos. Os nomes internos permanecem compatíveis
(`video_jobs` e `studio-videos`), mas banco, Auth, Storage, secrets e URLs ficam
fisicamente isolados.

| Ambiente | Supabase | Worker | Frontend | Feature flags |
| --- | --- | --- | --- | --- |
| DEV | projeto local/dev | container local | Vite local | `.env` local |
| STAGING | projeto exclusivo | serviço exclusivo | domínio de staging | secrets de staging |
| PRODUÇÃO | projeto exclusivo | serviço exclusivo | domínio comercial | secrets de produção |

O worker exige `SMART_MEDIA_EXPECTED_PROJECT_REF` em produção e encerra se a
URL do Supabase não corresponder. Isso impede apontar acidentalmente um worker
de staging para produção. Nunca reutilize um arquivo de secrets entre ambientes.

## Variáveis obrigatórias

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (somente secret manager do worker)
- `SMART_MEDIA_ENV`: `dev`, `staging` ou `production`
- `SMART_MEDIA_EXPECTED_PROJECT_REF`
- `SMART_MEDIA_WORKER_ID`: identificador não secreto e único

As demais variáveis e valores seguros estão em `.env.smart-media.example`.
O bucket deve continuar `studio-videos`, porque esse é o contrato validado pelas
Edge Functions e pelas políticas de ownership.

## STAGING

1. Criar/selecionar um projeto Supabase exclusivo de staging.
2. Aplicar nele as migrations existentes, incluindo
   `20260710230000_add_video_job_worker_leases.sql`.
3. Implantar as duas Edge Functions já existentes no projeto de staging.
4. Criar um serviço Railway dedicado; `railway.json` aponta para
   `Dockerfile.smart-media-worker` e configura `/health`, restart e draining.
5. Configurar os secrets do exemplo com valores somente de staging.
6. Usar uma instância com ao menos 2 GB RAM e 1 CPU para o primeiro teste real.
7. Confirmar `/health`, criar um job pela interface de staging e acompanhar logs
   por `jobId` até `completed`.
8. Executar os testes de reinício, lease, duplicidade, Smart Video e Super
   Carrossel antes de promover a mesma imagem imutável.

Railway é uma nova hospedagem apenas para este worker; não reativa o backend
Express removido e não recebe chamadas do frontend.

## PRODUÇÃO

1. Aprovar explicitamente provedor, plano e custo.
2. Fazer backup do banco e aplicar a migration de lease em janela controlada.
3. Criar um serviço Docker exclusivo, sem volume persistente (Supabase é a fonte
   de verdade; `/tmp` é descartável).
4. Inserir secrets de produção no secret manager do provedor.
5. Manter uma réplica inicialmente; o claim atômico já permite escalar depois.
6. Fazer deploy da mesma imagem aprovada em staging e validar healthcheck.
7. Habilitar alertas para container indisponível, `failed`, lease expirada e
   crescimento de jobs `queued`.
8. Fazer smoke test de ambos os produtos e confirmar preview/download.

## Falhas e reinício

- O claim usa `FOR UPDATE SKIP LOCKED`; somente um worker recebe o job.
- O heartbeat renova a lease durante download/render/upload.
- Se o processo morrer, a próxima chamada de claim devolve o job abandonado à
  fila; ao atingir `max_attempts`, ele termina em `failed`.
- Erros de contrato são permanentes. Falhas transitórias de rede, Storage,
  Supabase ou FFmpeg podem tentar novamente até o limite.
- Antes de renderizar, o worker verifica o caminho final. Se o MP4 já existe,
  conclui o job sem render ou upload duplicado.
- Cada execução usa diretório temporário exclusivo, removido em `finally`.
- Em SIGTERM/SIGINT o worker para de buscar novos jobs e termina o job corrente;
  se for morto à força, a lease permite recuperação.

## Comandos locais

```text
docker compose -f docker-compose.smart-media.yml build
docker compose -f docker-compose.smart-media.yml up -d
docker compose -f docker-compose.smart-media.yml ps
docker compose -f docker-compose.smart-media.yml down
```

Não versionar `.env.smart-media.local` nem qualquer saída de renderização.
