# Instruções para Verificar Status do Railway e Logs

## Problema Identificado
O Railway CLI não está autenticado. É necessário fazer login primeiro.

## Passos para Verificar Status e Logs

### 1. Fazer Login no Railway CLI

Abra um terminal e execute:

```bash
railway login
```

Isso abrirá uma janela do navegador para você fazer login. Após autenticar, volte ao terminal.

### 2. Vincular ao Projeto (se necessário)

Se o projeto não estiver vinculado, execute:

```bash
railway link
```

Selecione o projeto **smartcorretorai** da lista.

### 3. Verificar Status do Deploy

```bash
railway status
```

Este comando mostrará:
- Status atual do serviço (Running, Crashed, Building, etc.)
- Última versão deployada
- Informações sobre o ambiente

### 4. Obter as Últimas 50 Linhas dos Logs

Para ver os logs mais recentes:

```bash
railway logs --tail 50
```

Para ver apenas logs de erro:

```bash
railway logs --tail 50 2>&1 | findstr /i "error"
```

Para seguir os logs em tempo real:

```bash
railway logs --follow
```

### 5. Verificar Logs de Deploy Específico

Para ver logs de um deploy específico:

```bash
railway logs --deployment
```

## Alternativa: Via Dashboard Web

Se preferir usar a interface web:

1. Acesse: https://railway.app/dashboard
2. Selecione o projeto **smartcorretorai**
3. Clique no serviço do backend
4. Vá para a aba **"Deployments"** para ver o status
5. Clique em **"View Logs"** para ver os logs completos
6. Use o filtro para mostrar apenas erros

## Informações do Projeto

- **URL do Backend**: https://smartcorretorai-production.up.railway.app
- **Projeto**: smartcorretorai
- **Configuração**: Node.js 20 com Nixpacks
- **Start Command**: npm start

## Comandos Úteis Adicionais

```bash
# Ver variáveis de ambiente
railway variables

# Ver informações do projeto
railway environment

# Fazer redeploy
railway up

# Ver lista de deployments
railway deployment list
```
