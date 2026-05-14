# 📱 Integração Instagram — Resumo Técnico

## 🎯 O que foi implementado

A integração completa com a **Meta Graph API** para permitir que corretores publiquem automaticamente posts, vídeos e reels no Instagram Business diretamente do SmartCorretor AI.

---

## 📂 Arquivos Modificados/Criados

### Backend

#### 1. **`backend/src/services/instagramService.js`** ✅ ATUALIZADO
- **Adicionado**: Suporte para postagem de vídeos e reels
- **Função `postCampaign()`**: Agora aceita parâmetro `options` com:
  - `videoUrl`: URL pública do vídeo (ex: render do Creatomate)
  - `isReel`: Boolean para definir se é Reel ou vídeo normal
  - `coverUrl`: Thumbnail do vídeo (opcional)
  - `shareToFeed`: Se o Reel deve aparecer no feed (opcional)
- **Processamento assíncrono**: Aguarda o Instagram processar o vídeo (até 2 minutos)
- **Fallback**: Se não passar `videoUrl`, gera banner 1080x1080 automaticamente (comportamento original)

#### 2. **`backend/src/controllers/socialController.js`** ✅ ATUALIZADO
- **Função `postarInstagram()`**: Atualizada para receber parâmetros de vídeo
- **Body aceito**:
  ```json
  {
    "campaign_id": "uuid",
    "video_url": "https://...",  // opcional
    "is_reel": true,              // opcional
    "cover_url": "https://...",   // opcional
    "share_to_feed": true         // opcional
  }
  ```
- **Response**: Retorna tipo de mídia publicada (image/video/reel)

#### 3. **`META_INSTAGRAM_SETUP.md`** ✅ CRIADO
Documentação completa com:
- Passo a passo para configurar o Meta for Developers
- Permissões necessárias e como solicitá-las
- Configuração de variáveis de ambiente no Railway
- Exemplos de uso das rotas da API
- Troubleshooting de erros comuns
- Limites da API e requisitos de mídia

#### 4. **`CLAUDE.md`** ✅ ATUALIZADO
- Adicionada linha no "JÁ FEITO" documentando a integração

---

## 🔌 Rotas da API

### Já existentes (mantidas):
- `GET /api/social/instagram/connect` — Inicia OAuth
- `GET /api/social/instagram/callback` — Callback do Facebook
- `GET /api/social/instagram/status` — Verifica conexão
- `DELETE /api/social/instagram/disconnect` — Remove conexão

### Atualizada:
- `POST /api/social/instagram/post` — **Agora suporta vídeos e reels**

---

## 🎬 Como Usar

### 1. Publicar Post com Imagem (comportamento original)
```bash
POST /api/social/instagram/post
Authorization: Bearer {token}
Content-Type: application/json

{
  "campaign_id": "uuid-da-campanha"
}
```
→ Gera banner 1080x1080 automaticamente e publica

### 2. Publicar Reel com vídeo do Creatomate
```bash
POST /api/social/instagram/post
Authorization: Bearer {token}
Content-Type: application/json

{
  "campaign_id": "uuid-da-campanha",
  "video_url": "https://cdn.creatomate.com/renders/abc123.mp4",
  "is_reel": true,
  "share_to_feed": true
}
```
→ Publica o vídeo como Reel no Instagram

### 3. Publicar Vídeo normal (IGTV)
```bash
POST /api/social/instagram/post
Authorization: Bearer {token}
Content-Type: application/json

{
  "campaign_id": "uuid-da-campanha",
  "video_url": "https://cdn.creatomate.com/renders/abc123.mp4",
  "is_reel": false
}
```
→ Publica como vídeo normal (não aparece na aba Reels)

---

## 🔑 Permissões Necessárias no Meta for Developers

| Permissão | Status | Uso |
|-----------|--------|-----|
| `instagram_basic` | ✅ Necessária | Identificar conta Instagram Business |
| `instagram_content_publish` | ✅ Necessária | Publicar posts, vídeos e reels |
| `pages_show_list` | ✅ Necessária | Listar Páginas do Facebook |
| `pages_read_engagement` | ✅ Necessária | Obter token da Página |

**⚠️ IMPORTANTE**: Essas permissões precisam ser solicitadas no painel do Meta for Developers e aprovadas pela Meta (1-3 dias úteis).

---

## ⚙️ Variáveis de Ambiente Necessárias

### No Railway (backend):
```bash
META_APP_ID=1166177798972049
META_APP_SECRET=sua-chave-secreta-aqui
META_REDIRECT_URI=https://smartcorretorai-production.up.railway.app/api/social/instagram/callback
FRONTEND_URL=https://smartcorretorai.vercel.app
STORAGE_BUCKET=smartcorretor-assets
```

### No `.env` local (desenvolvimento):
```bash
META_APP_ID=1166177798972049
META_APP_SECRET=sua-chave-secreta
META_REDIRECT_URI=http://localhost:3001/api/social/instagram/callback
FRONTEND_URL=http://localhost:5173
```

---

## 🔄 Fluxo de Autenticação OAuth

```
1. Usuário clica "Conectar Instagram" no frontend
   ↓
2. Frontend chama GET /api/social/instagram/connect
   ↓
3. Backend retorna URL do Facebook OAuth
   ↓
4. Frontend redireciona usuário para Facebook
   ↓
5. Usuário autoriza o app
   ↓
6. Facebook redireciona para /api/social/instagram/callback
   ↓
7. Backend:
   - Troca code por access_token
   - Troca short-lived por long-lived token (60 dias)
   - Busca Páginas do Facebook do usuário
   - Encontra Instagram Business vinculado
   - Salva tokens na tabela social_connections
   ↓
8. Backend redireciona para frontend com status de sucesso
```

---

## 📊 Dados Armazenados

### Tabela `social_connections`:
```sql
- user_id: UUID (FK para profiles)
- platform: 'instagram'
- access_token: Token long-lived do usuário (60 dias)
- page_access_token: Token da Página (não expira)
- page_id: ID da Página do Facebook
- ig_user_id: ID da conta Instagram Business
- ig_username: Nome de usuário do Instagram
- token_expires_at: Data de expiração do token
```

### Tabela `campaigns`:
```sql
- instagram_post_id: ID do post publicado (adicionado após publicação)
```

---

## 🎥 Processamento de Vídeos

### Fluxo:
1. Backend envia vídeo para Instagram via Graph API
2. Instagram cria um "container" de mídia (status: `PENDING`)
3. Backend faz polling a cada 4 segundos (máx 30 tentativas = 2 minutos)
4. Quando status = `FINISHED`, publica o container
5. Se status = `ERROR` ou timeout, retorna erro

### Requisitos de Vídeo:
- **Formato**: MP4, MOV
- **Tamanho**: Máximo 100 MB
- **Duração**: 3-90 segundos (Reels), até 60 min (vídeos)
- **Aspect ratio**: 9:16 (vertical, recomendado para Reels)
- **Codec**: H.264, AAC audio
- **URL**: Deve ser pública e acessível pelo Instagram

---

## 🚀 Próximos Passos (Melhorias Futuras)

### 1. Integração com Creatomate
- [ ] Adicionar botão "Publicar no Instagram" na página de campanhas
- [ ] Permitir escolher qual render publicar (9:16 para Reel, 1:1 para Feed)
- [ ] Pré-visualização antes de publicar

### 2. Agendamento
- [ ] Permitir agendar posts para data/hora específica
- [ ] Sistema de filas (Bull/BullMQ)
- [ ] Notificação quando post for publicado

### 3. Carrossel
- [ ] Suporte para posts com múltiplas imagens
- [ ] Endpoint: `media_type=CAROUSEL`

### 4. Stories
- [ ] Publicação de Stories (24h)
- [ ] Endpoint: `media_type=STORIES`

### 5. Analytics
- [ ] Buscar métricas de posts publicados
- [ ] Dashboard com insights: alcance, engajamento, salvamentos

### 6. Renovação Automática de Tokens
- [ ] Cronjob para renovar tokens antes de expirar
- [ ] Notificar usuário se renovação falhar

---

## 🐛 Erros Comuns e Soluções

### "Nenhuma Página do Facebook encontrada"
**Causa**: Usuário não tem Página do Facebook vinculada ao Instagram  
**Solução**: Criar Página no Facebook e vincular ao Instagram

### "Nenhuma conta do Instagram Comercial encontrada"
**Causa**: Conta do Instagram é pessoal  
**Solução**: Converter para Conta Comercial ou Criador

### "Meta API: (#100) Invalid OAuth 2.0 Access Token"
**Causa**: Token expirado (60 dias)  
**Solução**: Usuário precisa reconectar (desconectar e conectar novamente)

### "Timeout ao processar vídeo"
**Causa**: Vídeo muito grande ou processamento lento  
**Solução**: Reduzir tamanho/duração ou tentar novamente

---

## 📚 Referências

- [Meta Graph API - Instagram](https://developers.facebook.com/docs/instagram-api)
- [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login)

---

**Implementado em**: 2026-05-14  
**Versão da API**: Graph API v19.0  
**Status**: ✅ Pronto para uso (após configurar permissões no Meta for Developers)
