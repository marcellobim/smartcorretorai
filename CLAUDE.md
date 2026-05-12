# 📋 SmartCorretor AI — Memória Completa do Projeto
> Cole este arquivo no início de cada nova conversa com Claude

---

## 🎯 O PRODUTO

SaaS imobiliário premium. Corretor entra com foto + dados do imóvel, sai com pacote completo de marketing pronto para postar em todas as plataformas. Zero edição manual. Zero configuração por imóvel. Tudo automático via IA + Creatomate.

---

## 🏗️ INFRAESTRUTURA

| Serviço | Info |
|---------|------|
| Frontend | https://smartcorretorai.vercel.app |
| Backend | https://smartcorretorai-production.up.railway.app |
| GitHub | github.com/marcellobim/smartcorretorai |
| Railway | soothing-gentleness |
| Meta App ID | 1166177798972049 |
| Domínio | smartcorretorai.com.br (a configurar) |

**Stack:** Node.js + Railway + Vercel + Creatomate + Meta Graph API + Stripe

---

## 📦 O QUE O PRODUTO ENTREGA

### Vídeos
- 9:16 (Reels/Stories/TikTok), 16:9 (YouTube/LinkedIn), 1:1 e 4:5 (Feed)
- Narração voz over automática + trilha sonora por categoria

### Banners
- Meta, Google Ads, TikTok, LinkedIn, Portais, WhatsApp
- Banner CTA clicável → WhatsApp do corretor

### Textos
- Copy para todas as redes sociais
- Descrição técnica + emocional para portais
- Hashtags, Google Ads titles, mensagem WhatsApp

---

## 🧠 DIRETRIZES DA IA

- Identifica categoria: Luxo / Investimento / Padrão Médio / MCMV / Comercial
- Tom e trilha adaptados por categoria
- Nunca repete padrão ou texto
- Explora bairro, lifestyle, diferenciais
- Insere imagens extras de lifestyle além das fotos do corretor
- Público adulto, compra séria — premium sempre

---

## ✅ JÁ FEITO
- Backend + Frontend deployados
- GitHub configurado
- Meta App ID configurado
- Diretrizes do produto documentadas
- Roteiro vídeo explainer criado
- Skill + arquivo de contexto criados
- **Creatomate integrado** — 46 templates listados via API, 22 mapeados por categoria e formato em `backend/src/services/creatomate.js` (5 famílias SC_ + new_listing_story, searchlight, photo_montage, triple_carousel, real_estate_card em 9:16/1:1/4:5/16:9)
- **Rotas de render** — `POST /api/render/campaign/:id` e `GET /api/render/campaign/:id/status` (controller + routes + integração no `app.js`)
- **Upload de fotos no Supabase Storage** — fluxo automático no `generateController` antes de disparar Creatomate
- **Frontend NovaCampanha** — botão "Gerar banners e vídeos", polling de status (6s), thumbnails + downloads por render
- **Stripe configurado** — 5 produtos criados, Price IDs listados via API e salvos no `.env` (START R$ 97, PRO R$ 187, ENTERPRISE R$ 417, AVULSO1 R$ 38,97, AVULSO2 R$ 57,97)
- **Backend online no Railway** — bug `authenticate → authMiddleware` em `routes/render.js` corrigido, deploy automático via GitHub

## 🔴 PRÓXIMO (prioridade máxima)
1. **Rodar migrações no Supabase Dashboard** — tabelas `profiles`, `properties`, `campaigns`, `subscriptions`, `password_resets` ainda não existem (apenas `social_connections` está OK). Usar SQL com `DROP TRIGGER/POLICY IF EXISTS` (Postgres 15 não suporta `CREATE ... IF NOT EXISTS` para triggers/policies) e finalizar com `NOTIFY pgrst, 'reload schema'`
2. **Adicionar env vars no Railway Dashboard** (Variables → Raw Editor): `CREATOMATE_API_KEY`, `CREATOMATE_PUBLIC_TOKEN`, `STRIPE_PRICE_START/PRO/ENTERPRISE/AVULSO1/AVULSO2` — token UUID disponível é project-scoped, não dá acesso à API pessoal
3. Testar geração end-to-end: cadastro → campanha → renders Creatomate
4. Testar pagamento Stripe checkout

## 🟡 DEPOIS
- Domínio GoDaddy → Vercel (A: @ → 76.76.21.21 / CNAME: www → cname.vercel-dns.com)
- Compliance CRECI no cadastro
- Meta Graph API → postagem direta Instagram
- Dashboard métricas
- Reorganizar UX (planos só na aba de planos)
- Vídeo explainer na home

---

## 💡 DECISÕES TOMADAS
- Creatomate escolhido para geração visual
- Templates escolhidos automaticamente pela IA — ninguém configura nada
- Planos só aparecem na aba dedicada e após fim do teste grátis
- Home começa com vídeo explainer

---

*Atualizado: 2026-05-12*
