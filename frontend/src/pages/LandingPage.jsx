import { RAIO_X_AVAILABLE, visibleProducts, TRIAL_OFFERED_LABEL } from '../config/productAvailability'
import { BRAND } from '../config/brand'
import { SHORT_VIDEOS_VISIBLE } from '../config/shortVideos'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ChevronDown, Download, Facebook, FileText, Gauge,
  Image as ImageIcon, Instagram, Layers3, LayoutTemplate, Menu,
  Play, Radar, Route, UploadCloud, Video, Wand2, X,
} from 'lucide-react'
import BrandMark from '../components/brand/BrandMark'
import FirstCreationEntry from '../components/landing/FirstCreationEntry'
import { useAnalytics } from '../components/analytics/AnalyticsProvider'
const VIRTUAL_STAGING_BEFORE_IMAGE = '/landing/virtual-staging-before.jpg'
const VIRTUAL_STAGING_AFTER_IMAGE = '/landing/virtual-staging-after.webp'
const VIRTUAL_STAGING_SPOTLIGHT_PAIRS = {
  living: { id: 'living', label: 'Sala integrada', before: '/virtual-staging/virtual-staging-before.jpg', after: '/virtual-staging/virtual-staging-after.png' },
  balcony: { id: 'balcony', label: 'Varanda', before: '/virtual-staging/example-01-before.jpg', after: '/virtual-staging/example-01-after.jpg' },
  bathroom: { id: 'bathroom', label: 'Banheiro', before: '/virtual-staging/example-02-before.jpg', after: '/virtual-staging/example-02-after.jpg' },
  bedroom: { id: 'bedroom', label: 'Quarto e home office', before: '/virtual-staging/example-03-before.jpg', after: '/virtual-staging/example-03-after.jpg' },
  dining: { id: 'dining', label: 'Sala de jantar', before: '/virtual-staging/example-04-before.jpg', after: '/virtual-staging/example-04-after.jpg' },
  kitchen: { id: 'kitchen', label: 'Cozinha integrada', before: '/virtual-staging/example-05-before.jpg', after: '/virtual-staging/example-05-after.jpg' },
  office: { id: 'office', label: 'Escritório', before: '/virtual-staging/example-06-before.jpg', after: '/virtual-staging/example-06-after.jpg' },
}
const VIRTUAL_STAGING_PHONE_SEQUENCES = [
  [VIRTUAL_STAGING_SPOTLIGHT_PAIRS.bedroom, VIRTUAL_STAGING_SPOTLIGHT_PAIRS.bathroom, VIRTUAL_STAGING_SPOTLIGHT_PAIRS.living],
  [VIRTUAL_STAGING_SPOTLIGHT_PAIRS.kitchen, VIRTUAL_STAGING_SPOTLIGHT_PAIRS.dining],
  [VIRTUAL_STAGING_SPOTLIGHT_PAIRS.balcony, VIRTUAL_STAGING_SPOTLIGHT_PAIRS.office],
]
const NAV_ITEMS = [
  { label: 'Produtos', href: '#produtos' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'Planos', to: '/planos' },
  { label: 'FAQ', href: '#faq' },
]
const VIDEO_POSTERS = Object.freeze({
  '/demos-videos/animar-imagens.mp4': '/landing/posters/animar-imagens.webp',
  '/demos-videos/video-campanha.mp4': '/landing/posters/video-campanha.webp',
  '/demos-videos/video-narrado.mp4': '/landing/posters/video-narrado.webp',
  '/demos-videos/corretor-virtual.mp4': '/landing/posters/corretor-virtual.webp',
  '/demos-videos/short-video-1.mp4': '/landing/posters/short-video-1.webp',
  '/showcase/smart-studio-gallery/venda1lapa.mp4': '/landing/posters/studio-comercial.webp',
  '/showcase/studio/showcase-captacao-venda.mp4': '/landing/posters/studio-criativo.webp',
  '/showcase/smartcarrossel/showcase-carrossel.mp4': '/landing/posters/studio-carrossel.webp',
  '/demos-videos/vida-no-imovel.mp4': '/landing/posters/vida-no-imovel.webp',
  '/demos-videos/apresentacao-pelo-proprio-corretor.mp4': '/landing/posters/apresentacao-corretor.webp',
  '/previews/produto3/story-premium-preview-1x1.mp4': '/landing/posters/banner-story.webp',
  '/previews/produto3/card-imobiliario-premium-preview-1x1.mp4': '/landing/posters/banner-card.webp',
})
const HERO_ROTATION_INTERVAL_MS = 5200
const HERO_PRODUCT_SLIDES = visibleProducts([
  { id: 'video-imobiliario', name: 'Vídeo Imobiliário', type: 'video', src: '/demos-videos/video-campanha.mp4', label: `Vídeo imobiliário criado no ${BRAND.name}` },
  { id: 'virtual-staging', name: 'Smart Space', type: 'image', src: VIRTUAL_STAGING_AFTER_IMAGE, label: `Ambiente criado com Smart Space no ${BRAND.name}` },
  { id: 'banner-imobiliario', name: 'Banner Imobiliário', type: 'image', src: '/showcase/hero/hero-18semimagem.jpg', label: `Banner imobiliário criado no ${BRAND.name}` },
  { id: 'banners-rapidos', name: 'Banners Rápidos', type: 'image', src: '/previews/produto3/anuncio-premium-preview-1x1.jpg', label: `Banner rápido criado no ${BRAND.name}` },
  { id: 'studio-ia', name: 'Studio IA', type: 'video', src: '/showcase/smart-studio-gallery/venda1lapa.mp4', label: 'Comercial imobiliário criado no Studio IA' },
])
const PRODUCT_FAMILIES = visibleProducts([
  {
    id: 'video-imobiliario', name: 'Vídeo Imobiliário', number: '01',
    headline: 'Faça suas fotos ganharem movimento.',
    description: 'Transforme imagens e informações do imóvel em apresentações profissionais prontas para divulgação.',
    icon: Video,
    items: [
      { id: 'movimento', title: 'Fotos em Movimento', type: 'video', src: '/demos-videos/animar-imagens.mp4' },
      { id: 'legendas', title: 'Legendas na Tela', type: 'video', src: '/demos-videos/video-campanha.mp4' },
      { id: 'narracao', title: 'Narração Profissional', type: 'video', src: '/demos-videos/video-narrado.mp4' },
      { id: 'corretor', title: 'Corretor Virtual IA', type: 'video', src: '/demos-videos/corretor-virtual.mp4' },
      { id: 'shorts', title: 'Short Videos', type: 'video', src: '/demos-videos/short-video-1.mp4' },
    ],
  },
  {
    id: 'banner-imobiliario', name: 'Banner Imobiliário', number: '02',
    headline: 'Do imóvel para uma campanha visual profissional.',
    description: 'Responda às perguntas sobre o imóvel e prepare peças profissionais para diferentes formatos de divulgação.',
    icon: ImageIcon,
    items: [
      { id: 'vertical', title: 'Vertical', type: 'image', src: '/showcase/hero/hero-18semimagem.jpg' },
      { id: 'quadrado', title: 'Quadrado', type: 'image', src: '/showcase/hero/hero-captacao3.jpg' },
      { id: 'horizontal', title: 'Horizontal', type: 'image', src: '/showcase/hero/hero-principal 1.jpg' },
      { id: 'premium', title: 'Peça premium', type: 'image', src: '/showcase/hero/hero-teste5.jpg' },
    ],
  },
  {
    id: 'studio-ia', name: 'Studio IA', number: '03',
    headline: 'Quando o imóvel pede uma apresentação com mais impacto.',
    description: 'Crie peças cinematográficas para apresentar imóveis, oportunidades e sua atuação profissional.',
    icon: Wand2,
    items: [
      { id: 'comercial', title: 'Comercial Imobiliário', type: 'video', src: '/showcase/smart-studio-gallery/venda1lapa.mp4' },
      { id: 'criativo', title: 'Vídeo Criativo', type: 'video', src: '/showcase/studio/showcase-captacao-venda.mp4' },
      { id: 'carrossel', title: 'Carrossel de Anúncios', type: 'video', src: '/showcase/smartcarrossel/showcase-carrossel.mp4' },
    ],
  },
  {
    id: 'virtual-staging', name: 'Smart Space', number: '04',
    headline: 'Mostre o que aquele espaço pode se tornar.',
    description: 'Transforme ambientes vazios, represente cenas de uso ou apresente o imóvel com sua própria imagem.',
    icon: Layers3,
    items: [
      { id: 'staging', title: 'Smart Space', type: 'comparison', beforeSrc: VIRTUAL_STAGING_BEFORE_IMAGE, src: VIRTUAL_STAGING_AFTER_IMAGE },
      { id: 'vida', title: 'Vida no Imóvel', type: 'video', src: '/demos-videos/vida-no-imovel.mp4' },
      { id: 'apresentacao', title: 'Apresentação pelo Corretor', type: 'video', src: '/demos-videos/apresentacao-pelo-proprio-corretor.mp4' },
    ],
  },
  {
    id: 'banners-rapidos', name: 'Banners Rápidos', number: '05',
    headline: 'Precisa divulgar agora?',
    description: 'Escolha o formato, informe os dados e prepare seu material em poucos passos.',
    icon: LayoutTemplate,
    items: [
      { id: 'anuncio', title: 'Anúncio premium', type: 'image', src: '/previews/produto3/anuncio-premium-preview-1x1.jpg' },
      { id: 'story', title: 'Story premium', type: 'video', src: '/previews/produto3/story-premium-preview-1x1.mp4' },
      { id: 'card', title: 'Card imobiliário', type: 'video', src: '/previews/produto3/card-imobiliario-premium-preview-1x1.mp4' },
    ],
  },
  {
    id: 'campanha-de-textos', name: 'Campanha de Textos', number: '06',
    headline: 'Uma informação. Várias formas de comunicar.',
    description: 'Transforme os mesmos dados do imóvel em textos para portal, redes sociais, WhatsApp e Google Ads.',
    icon: FileText,
    items: [{ id: 'campanha', title: 'Campanha completa', type: 'text' }],
  },
]).map(group => ({ ...group, items: visibleProducts(group.items).filter(item => SHORT_VIDEOS_VISIBLE || !['shorts', 'short-videos'].includes(item.id)) }))
const DELIVERY_GROUPS = visibleProducts([
  {
    id: 'videos',
    eyebrow: 'Criações em vídeo',
    title: 'Veja tudo o que você pode criar.',
    ctaTitle: 'Quer apresentar seus imóveis de novas formas?',
    ctaLabel: 'Experimentar grátis',
    items: [
      { id: 'fotos-em-movimento', title: 'Fotos em Movimento', description: 'Transforme fotos do imóvel em cenas com movimento para criar uma apresentação mais dinâmica.', type: 'video', orientation: 'vertical', src: '/demos-videos/animar-imagens.mp4', campaignIncluded: true },
      { id: 'legendas-na-tela', title: 'Legendas na Tela', description: 'Apresente informações e destaques do imóvel diretamente no vídeo.', type: 'video', orientation: 'vertical', src: '/demos-videos/video-campanha.mp4', campaignIncluded: true },
      { id: 'narracao-profissional', title: 'Narração Profissional', description: 'Dê voz à apresentação do imóvel com uma narração preparada para acompanhar as cenas.', type: 'video', orientation: 'vertical', src: '/demos-videos/video-narrado.mp4', campaignIncluded: true },
      { id: 'corretor-virtual-ia', title: 'Corretor Virtual IA', description: 'Apresente o imóvel com um corretor virtual integrado ao vídeo.', type: 'video', orientation: 'vertical', src: '/demos-videos/corretor-virtual.mp4', campaignIncluded: true },
      { id: 'short-videos', title: 'Short Videos', description: 'Crie vídeos curtos para manter seus imóveis presentes em formatos rápidos de divulgação.', type: 'video', orientation: 'vertical', src: '/demos-videos/short-video-1.mp4', campaignIncluded: true },
      { id: 'comercial-imobiliario', title: 'Comercial Imobiliário', description: 'Crie uma apresentação com linguagem de comercial para imóveis e oportunidades que pedem mais impacto.', type: 'video', orientation: 'vertical', src: '/showcase/smart-studio-gallery/venda1lapa.mp4', campaignIncluded: true },
      { id: 'video-criativo', title: 'Vídeo Criativo', description: 'Explore uma apresentação mais criativa para destacar imóveis, campanhas e oportunidades.', type: 'video', orientation: 'vertical', src: '/showcase/studio/showcase-captacao-venda.mp4', campaignIncluded: true },
      { id: 'vida-no-imovel', title: 'Vida no Imóvel', description: 'Mostre situações e cenas que ajudam a imaginar como aquele espaço pode ser vivido.', type: 'video', orientation: 'vertical', src: '/demos-videos/vida-no-imovel.mp4', campaignIncluded: true },
      { id: 'apresentacao-corretor', title: 'Apresentação pelo Corretor', description: 'Use a imagem do corretor no contexto previsto pelo produto para apresentar o imóvel de forma mais pessoal.', type: 'video', orientation: 'vertical', src: '/demos-videos/apresentacao-pelo-proprio-corretor.mp4', campaignIncluded: true },
      { id: 'carrossel-anuncios', title: 'Carrossel de Anúncios', description: 'Organize imagens e informações em uma apresentação em movimento para divulgar a oportunidade.', type: 'video', orientation: 'vertical', src: '/showcase/smartcarrossel/showcase-carrossel.mp4', campaignIncluded: true },
    ],
  },
  {
    id: 'imagens-campanhas',
    eyebrow: 'Criações em imagens',
    title: 'Veja tudo o que você pode criar.',
    ctaTitle: 'Faça mais com as imagens que você já tem.',
    ctaLabel: 'Começar a criar',
    items: [
      { id: 'banner-imobiliario', title: 'Banner Imobiliário', description: 'Prepare uma campanha visual profissional em diferentes formatos de divulgação.', type: 'image', src: '/showcase/hero/hero-18semimagem.jpg', campaignIncluded: true },
      { id: 'banners-rapidos', title: 'Banners Rápidos', description: 'Escolha o formato, informe os dados e prepare peças para divulgar em poucos passos.', type: 'image', src: '/previews/produto3/anuncio-premium-preview-1x1.jpg', campaignIncluded: true },
    ],
  },
  {
    id: 'textos-campanhas',
    eyebrow: 'Textos e campanhas',
    title: 'Textos e campanhas',
    description: 'Uma informação se transforma em mensagens coerentes para diferentes canais.',
    ctaTitle: 'Da imagem ao texto, sua campanha em um só lugar.',
    ctaLabel: 'Experimentar grátis',
    items: [
      { id: 'campanha-completa', title: 'Campanha de Textos', description: 'Crie uma campanha completa para Portal, Redes sociais, WhatsApp e Google Ads.', type: 'text' },
    ],
  },
]).map(group => ({ ...group, items: visibleProducts(group.items).filter(item => SHORT_VIDEOS_VISIBLE || !['shorts', 'short-videos'].includes(item.id)) }))
const REAL_USES = [
  ['Venda', 'Imóveis usados, prontos, novos ou em estoque também precisam continuar chamando atenção. Apresente diferenciais e varie a forma de mostrar cada oportunidade.'],
  ['Locação', 'Locação não precisa ficar limitada a fotos e uma descrição básica. Crie materiais para apresentar melhor o imóvel e manter a oferta presente.'],
  ['Lançamentos', 'Transforme imagens, informações e condições comerciais em diferentes materiais para sua campanha.'],
  ['Captação de imóveis', 'Os materiais podem apoiar a apresentação da sua estratégia de divulgação ao proprietário.'],
  ['Captação de profissionais', 'Crie campanhas para apresentar oportunidades e atrair novos corretores e profissionais para equipes e imobiliárias.'],
]
const IMAGE_SHOWCASE_EXAMPLES = {
  'banner-imobiliario': [
    '/showcase/hero/hero-18semimagem.jpg',
    '/showcase/hero/hero-captacao3.jpg',
    '/showcase/hero/hero-principal 1.jpg',
    '/showcase/hero/hero-teste5.jpg',
  ],
  'banners-rapidos': [
    { type: 'image', src: '/previews/produto3/anuncio-premium-preview-1x1.jpg' },
    { type: 'video', src: '/previews/produto3/video-tour-preview-1x1.mp4' },
    { type: 'video', src: '/previews/produto3/imovel-detalhes-preview-1x1.mp4' },
  ],
}
const TEXT_CAMPAIGN_CHANNELS = [
  {
    id: 'hashtags', title: 'Hashtags',
    pieces: [{ label: 'Hashtags estratégicas', type: 'tags', values: ['#ApartamentoAVenda', '#Moema', '#ImoveisSP', '#ApartamentoEmMoema', '#VarandaIntegrada', '#DuasVagas', '#ImovelComVaranda', '#Apartamento2Dormitorios', '#Suite', '#92m2', '#ComprarApartamento', '#SmartCorretorAI'] }],
  },
  {
    id: 'portal', title: 'Portal',
    pieces: [
      { label: 'Título do anúncio', text: 'Apartamento com varanda integrada e duas vagas em Moema' },
      { label: 'Descrição para portal', text: 'Apartamento de 92 m² em Moema, com dois dormitórios, uma suíte e duas vagas. A varanda integrada amplia a área de convivência e favorece a entrada de luz natural. Uma opção para quem procura ambientes bem distribuídos e praticidade para a rotina.' },
      { label: 'Anúncio curto', text: '92 m² em Moema, varanda integrada, dois dormitórios, uma suíte e duas vagas.' },
    ],
  },
  {
    id: 'redes', title: 'Redes sociais',
    pieces: [
      { label: 'Instagram — comercial', text: 'Apartamento de 92 m² em Moema, com varanda integrada, dois dormitórios, uma suíte e duas vagas. Conheça esta oportunidade.' },
      { label: 'Instagram — emocional', text: 'Luz natural, varanda integrada e ambientes que se conectam para acompanhar diferentes momentos da rotina.' },
      { label: 'Instagram — oportunidade', text: 'Procurando um apartamento com dois dormitórios e duas vagas em Moema? Veja os detalhes desta opção de 92 m².' },
      { label: 'Facebook — comercial', text: 'Conheça este apartamento em Moema: 92 m², dois dormitórios, uma suíte, duas vagas e varanda integrada.' },
      { label: 'Facebook — emocional', text: 'Uma varanda integrada e espaços bem distribuídos criam um ambiente convidativo para viver e receber.' },
      { label: 'Facebook — oportunidade', text: 'Uma opção em Moema para quem valoriza dois dormitórios, suíte, duas vagas e boa integração entre os ambientes.' },
    ],
  },
  {
    id: 'whatsapp', title: 'WhatsApp',
    pieces: [
      { label: 'WhatsApp individual', text: 'Olá! Separei um apartamento de 92 m² em Moema, com varanda integrada, dois dormitórios, uma suíte e duas vagas. Quer conhecer os detalhes?' },
      { label: 'WhatsApp carteira/lista', text: 'Nova oportunidade em Moema: apartamento de 92 m², varanda integrada, dois dormitórios, uma suíte e duas vagas. Fale comigo para saber mais.' },
      { label: 'WhatsApp curto', text: 'Apartamento em Moema com 92 m², varanda integrada e duas vagas. Quer receber mais informações?' },
    ],
  },
  {
    id: 'google-ads', title: 'Google Ads',
    pieces: [
      { label: 'Títulos curtos — 3 opções', type: 'list', values: ['Apartamento em Moema', 'Varanda e Duas Vagas', 'Apartamento de 92 m²'] },
      { label: 'Título longo', text: 'Apartamento de 92 m² em Moema com varanda integrada, suíte e duas vagas' },
      { label: 'Descrições — 2 opções', type: 'list', values: ['Conheça um apartamento em Moema com varanda integrada e ambientes bem distribuídos.', 'São 92 m², dois dormitórios, uma suíte e duas vagas. Solicite mais informações.'] },
      { label: 'Chamada', text: 'Saiba mais' },
      { label: 'Palavras-chave sugeridas', type: 'tags', values: ['apartamento à venda em Moema', 'comprar apartamento em Moema', 'apartamento com varanda em Moema', 'apartamento 2 dormitórios em Moema', 'apartamento com duas vagas em Moema'] },
    ],
  },
]
const POSITIONING = [
  ['6', 'SOLUÇÕES', 'Para diferentes momentos da divulgação.'],
  ['∞', 'POSSIBILIDADES', 'Para criar e apresentar seus imóveis.'],
  ['1', 'PLATAFORMA', 'Vídeos, imagens e textos em um só lugar.'],
  ['100%', 'IMOBILIÁRIA', 'Criada para quem trabalha divulgando imóveis.'],
]
const BENEFITS = [
  ['Feito para divulgação imobiliária', 'Produtos e perguntas pensados para imóveis, corretores e campanhas reais.', LayoutTemplate],
  ['Você é guiado do início ao fim', 'Cada fluxo mostra o que enviar, o que responder e o que acontece depois.', Route],
  ['Um imóvel, várias formas de apresentar', 'O mesmo material pode ganhar movimento, imagem, voz, formato e texto.', Layers3],
  ['Resultado profissional com menos ferramentas', 'Crie sem precisar dominar vários editores e serviços separados.', Wand2],
]
// Conteúdo ilustrativo separado para aprovação visual local; substituir ou remover antes de produção.
const DEMO_TESTIMONIALS = [
  ['A demonstração do produto ficou muito mais clara quando reuni vídeo, imagem e texto no mesmo fluxo.', 'Nome ilustrativo', 'Corretor(a) de imóveis — conteúdo demo'],
  ['O formato guiado ajuda a transformar o material do imóvel em uma apresentação consistente.', 'Nome ilustrativo', 'Profissional imobiliário — conteúdo demo'],
  ['Conseguir visualizar diferentes entregas para o mesmo imóvel deixa a campanha mais organizada.', 'Nome ilustrativo', 'Corretor(a) de imóveis — conteúdo demo'],
]
const FAQ_ITEMS = [
  ['Preciso saber usar IA?', 'Não. Os produtos apresentam perguntas e etapas guiadas. Você escolhe o que deseja criar, envia o material necessário e acompanha a preparação da entrega.'],
  ['Preciso ter imagens para começar?', 'Não em todos os casos. Alguns produtos usam fotos ou vídeos; outros fluxos permitem começar apenas com as informações da campanha.'],
  ['Posso usar para venda e locação?', 'Sim. Você pode criar materiais para apresentar oportunidades de venda e locação em diferentes formatos.'],
  ['Posso usar para captação de imóveis?', 'Sim. Os materiais podem apoiar a apresentação da sua estratégia de divulgação ao proprietário.'],
  ['Posso criar campanhas para captação de profissionais?', 'Sim. A Campanha de Textos permite preparar mensagens para apresentar oportunidades e atrair profissionais para equipes e imobiliárias.'],
  ['As imagens e vídeos gerados são sempre fiéis ao imóvel?', `${BRAND.name} foi desenvolvido para preservar ao máximo as características do material enviado. Como algumas criações utilizam inteligência artificial, podem ocorrer adaptações, variações ou pequenas alterações para compor o resultado. Revise sempre o material antes de divulgar, especialmente características do imóvel que possam influenciar a decisão de um interessado. Quando se tratar de Smart Space, a imagem representa uma proposta visual do ambiente e pode incluir mobiliário, decoração ou elementos que não existem fisicamente no imóvel.`],
  ['Quem é responsável pelas informações e materiais divulgados?', 'O usuário é responsável por revisar e confirmar as informações, imagens, vídeos e textos antes da publicação. Preço, metragem, localização, características, condições comerciais e demais informações do imóvel devem estar corretos e atualizados antes da divulgação.'],
  ['Preciso revisar o conteúdo antes de publicar?', 'Sim. A inteligência artificial ajuda na criação, mas a revisão final continua sendo importante. Confira textos, informações comerciais e materiais visuais antes de utilizá-los em anúncios, campanhas ou outros canais de divulgação.'],
  ['O que são Smart Tokens?', `Smart Tokens representam sua capacidade de criação dentro do ${BRAND.name}. Cada recurso informa a quantidade necessária antes de iniciar.`],
  ['Preciso ter assinatura?', 'Não. Os planos são indicados para quem cria com frequência, mas também é possível adquirir Smart Tokens separadamente.'],
  ['Posso comprar Smart Tokens separadamente?', 'Sim. As recargas podem ser usadas para começar sem assinatura ou complementar um plano.'],
  ['Como funciona o teste grátis?', `Após confirmar seu e-mail, você recebe uma única concessão de 200 Smart Tokens, sem cartão e sem prazo de expiração, para usar em ${TRIAL_OFFERED_LABEL}. Os demais produtos podem exigir assinatura ou compra de Smart Tokens.`],
  ['O que acontece se uma geração falhar?', 'Quando uma geração falha e não conclui a entrega correspondente, a reserva de Smart Tokens é liberada conforme o fluxo do produto.'],
  ['Posso cancelar minha assinatura?', 'Sim. O cancelamento pode ser solicitado pelo portal seguro de assinatura e ocorre ao final do período já pago.'],
  ['Como gerencio minha assinatura?', 'Acesse Configurações → Plano e Assinatura e selecione “Gerenciar assinatura” para abrir o portal seguro da Stripe.'],
  ['Como funciona a publicação direta em redes sociais?', `Nos produtos compatíveis, você pode conectar uma conta do Instagram ou Facebook e publicar diretamente pelo ${BRAND.name}. Cada publicação depende da sua escolha e confirmação: antes do envio, você pode revisar a legenda, editar parte do texto, substituí-lo ou apagá-lo. Se preferir, também pode baixar o material e fazer a publicação manualmente no canal desejado.`],
  ['Como falar com o suporte?', `Envie sua mensagem para ${BRAND.supportEmail}.`, `mailto:${BRAND.supportEmail}`],
]
const focusRing = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/45'

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}

function useLandingCtaTracking(ctaLocation) {
  const { trackEvent } = useAnalytics()
  return useCallback(ctaName => trackEvent('landing_cta_click', {
    cta_name: ctaName,
    cta_location: ctaLocation,
  }), [ctaLocation, trackEvent])
}

function BeforeAfter({ beforeSrc, afterSrc, compact = false, contain = false }) {
  const [position, setPosition] = useState(52)
  return (
    <div className="relative h-full min-h-[300px] overflow-hidden bg-slate-200" aria-label="Comparação interativa antes e depois">
      <img src={afterSrc} alt="Ambiente mobiliado depois do Smart Space" loading="lazy" className={`absolute inset-0 h-full w-full ${contain ? 'object-contain' : 'object-cover'}`} />
      {contain ? <img src={beforeSrc} alt="Ambiente vazio antes do Smart Space" loading="lazy" className="absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} /> : <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${position}%` }}><img src={beforeSrc} alt="Ambiente vazio antes do Smart Space" loading="lazy" className="h-full max-w-none object-cover" style={{ width: compact ? '560px' : '900px' }} /></div>}
      <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white" style={{ left: `${position}%` }}><span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950 shadow-xl">↔</span></div>
      <span className="absolute left-4 top-4 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-black text-white backdrop-blur">Antes</span>
      <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-950 backdrop-blur">Depois</span>
      <input className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0" type="range" min="18" max="82" value={position} onChange={event => setPosition(Number(event.target.value))} aria-label="Mover comparação entre antes e depois" />
    </div>
  )
}

function TextCampaignPreview() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = TEXT_CAMPAIGN_CHANNELS[activeIndex]
  return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b1022] lg:grid-cols-[320px_minmax(0,1fr)]" aria-label="Demonstração interativa de uma campanha completa de textos">
    <div className="min-w-0 border-b border-white/10 p-4 lg:border-b-0 lg:border-r lg:p-5">
      <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
        {TEXT_CAMPAIGN_CHANNELS.map((channel, index) => <button key={channel.id} type="button" onClick={() => setActiveIndex(index)} aria-pressed={activeIndex === index} className={`flex min-w-[150px] items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-black lg:min-w-0 ${activeIndex === index ? 'border-violet-400 bg-violet-600 text-white' : 'border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.06]'} ${focusRing}`}><span className="text-[10px] text-violet-200">0{index + 1}</span>{channel.title}</button>)}
      </div>
    </div>
    <div className="min-h-[320px] min-w-0 p-5 sm:p-7 lg:h-[430px] lg:p-6">
      <article key={active.id} className="h-full min-w-0 overflow-y-auto pr-1"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">{active.title}</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{active.pieces.map(piece => <div key={piece.label} className={`min-w-0 rounded-2xl border border-white/10 bg-white/[.04] p-3 ${piece.text?.length > 180 ? 'sm:col-span-2' : ''} ${active.pieces.length === 1 ? 'lg:col-span-3' : piece.type === 'tags' ? 'lg:col-span-2' : ''}`}><h3 className="text-[11px] font-black text-violet-200">{piece.label}</h3>{piece.type === 'tags' ? <div className="mt-2 flex flex-wrap gap-1.5">{piece.values.map(value => <span key={value} className="max-w-full break-words rounded-full border border-white/10 bg-white/[.05] px-2.5 py-1 text-xs font-bold leading-5 text-slate-200">{value}</span>)}</div> : piece.type === 'list' ? <ul className="mt-2 space-y-1">{piece.values.map(value => <li key={value} className="break-words text-xs font-semibold leading-5 text-slate-200">{value}</li>)}</ul> : <p className="mt-2 break-words text-xs font-semibold leading-5 text-slate-200">{piece.text}</p>}</div>)}</div></article>
    </div>
  </div>
}

function DeliveryVideo({ item, onPlay }) {
  const video = <video key={item.src} src={item.src} poster={VIDEO_POSTERS[item.src]} muted playsInline controls preload="metadata" aria-label={item.title} onPlay={event => onPlay(event.currentTarget)} className="smart-presentation-media bg-black" />
  if (item.orientation !== 'vertical') return <div className="aspect-video w-full overflow-hidden rounded-[1.75rem] border border-white/15 bg-black shadow-2xl">{video}</div>
  return <div className="relative aspect-[9/16] h-[340px] max-w-full overflow-hidden rounded-[1.75rem] border border-white/15 bg-black shadow-2xl sm:h-[360px]">{video}</div>
}

function VideoCreationGroup({ items, onPlay }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const item = items[activeIndex]
  return <article className="flex min-w-0 flex-col rounded-[1.75rem] border border-white/10 bg-[#0b1022] p-4 sm:p-5">
    <div className="flex justify-center"><DeliveryVideo item={item} onPlay={onPlay} /></div>
    <h3 className="mt-5 text-2xl font-black leading-[1.08] tracking-[-.04em]">{item.title}</h3>
    <p className="mt-3 min-h-[72px] text-sm font-medium leading-6 text-slate-300">{item.description}</p>
    <div className="mt-4 flex flex-wrap gap-2" aria-label={`Opções de ${items[0].title} a ${items.at(-1).title}`}>{items.map((entry, index) => <button key={entry.id} type="button" onClick={() => setActiveIndex(index)} aria-pressed={activeIndex === index} className={`rounded-full border px-3 py-2 text-xs font-black ${activeIndex === index ? 'border-violet-500 bg-violet-600 text-white' : 'border-white/15 text-slate-300 hover:bg-white/5'} ${focusRing}`}>{entry.title}</button>)}</div>
  </article>
}

function ProductMedia({ item, active }) {
  if (item.type === 'text') return <TextCampaignPreview />
  if (item.type === 'comparison') return <BeforeAfter beforeSrc={item.beforeSrc} afterSrc={item.src} />
  if (item.type === 'video') return <video key={item.src} src={item.src} poster={VIDEO_POSTERS[item.src]} muted playsInline controls preload={active ? 'metadata' : 'none'} aria-label={item.title} className="h-full w-full bg-[#050816] object-contain" />
  return <img src={item.src} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
}

function LandingHeader() {
  const [open, setOpen] = useState(false)
  const trackCta = useLandingCtaTracking('header')
  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  const navClass = `rounded-lg px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white ${focusRing}`
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/90 text-white backdrop-blur-xl"><div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10"><Link to="/" aria-label={`${BRAND.name} — início`} className={`flex items-center gap-2.5 rounded-xl ${focusRing}`}><BrandMark size={38} decorative /><span className="text-sm font-black sm:text-base">{BRAND.name}</span></Link><nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">{NAV_ITEMS.map(item => item.to ? <Link key={item.label} to={item.to} onClick={() => item.to === '/planos' && trackCta('view_plans')} className={navClass}>{item.label}</Link> : <a key={item.label} href={item.href} className={navClass}>{item.label}</a>)}</nav><div className="flex items-center gap-2"><Link to="/login" onClick={() => trackCta('login')} className={`hidden rounded-xl px-3 py-2 text-sm font-black text-slate-200 sm:inline-flex ${focusRing}`}>Entrar</Link><Link to="/cadastro" onClick={() => trackCta('start_free')} className={`inline-flex whitespace-nowrap rounded-xl bg-violet-600 px-3 py-2.5 text-[11px] font-black text-white shadow-lg hover:bg-violet-500 sm:px-4 sm:text-sm ${focusRing}`}>Experimentar grátis</Link><button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="landing-mobile-menu" aria-label={open ? 'Fechar menu' : 'Abrir menu'} className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 lg:hidden ${focusRing}`}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div></div>{open && <nav id="landing-mobile-menu" aria-label="Navegação mobile" className="border-t border-white/10 bg-[#080c19] px-4 py-4 lg:hidden"><div className="grid gap-1">{NAV_ITEMS.map(item => item.to ? <Link key={item.label} to={item.to} onClick={() => { if (item.to === '/planos') trackCta('view_plans'); setOpen(false) }} className={navClass}>{item.label}</Link> : <a key={item.label} href={item.href} onClick={() => setOpen(false)} className={navClass}>{item.label}</a>)}<Link to="/login" onClick={() => { trackCta('login'); setOpen(false) }} className={`${navClass} sm:hidden`}>Entrar</Link></div></nav>}</header>
}

function HeroMedia({ slide, active }) {
  const videoRef = useRef(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) void video.play().catch(() => {})
    else video.pause()
  }, [active])

  if (slide.type === 'comparison') return <BeforeAfter beforeSrc={slide.beforeSrc} afterSrc={slide.src} compact />
  if (slide.type === 'video') return <video ref={videoRef} src={slide.src} poster={VIDEO_POSTERS[slide.src]} autoPlay={active} muted playsInline loop preload={active ? 'metadata' : 'none'} aria-label={slide.label} className="h-full w-full object-cover" />
  return <img src={slide.src} alt={slide.label} loading={active ? 'eager' : 'lazy'} className="h-full w-full object-contain" />
}

function Hero() {
  const trackCta = useLandingCtaTracking('hero')
  const reducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const activeSlide = HERO_PRODUCT_SLIDES[activeIndex]

  useEffect(() => {
    if (reducedMotion || HERO_PRODUCT_SLIDES.length < 2) return undefined
    const timer = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % HERO_PRODUCT_SLIDES.length)
    }, HERO_ROTATION_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return (
    <section className="relative overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-violet-700/20 blur-[110px]" />
      <div className="relative mx-auto grid min-h-[700px] max-w-[92rem] items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[720px] lg:grid-cols-[minmax(0,.85fr)_minmax(560px,1.15fr)] lg:px-10 lg:py-16">
        <div className="relative z-10 max-w-2xl">
          <p className="inline-flex rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-200">Marketing imobiliário</p>
          <h1 className="mt-6 text-[2rem] font-black leading-[1.05] tracking-[-.055em] sm:text-5xl sm:leading-[1.03] lg:text-[3.55rem]"><span className="block [text-wrap:balance]">Crie vídeos, imagens e campanhas para vender, alugar e captar imóveis ou profissionais.</span><span className="mt-4 block text-[.58em] leading-[1.2] tracking-[-.035em] text-white [text-wrap:balance]">E <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">publique diretamente</span> no Instagram e Facebook, em poucos passos.</span></h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-slate-300 sm:text-lg">Com fotos, vídeos ou apenas as informações que você já tem, o {BRAND.name} ajuda você a criar materiais para venda, locação, lançamentos, captação de imóveis e captação de profissionais.</p>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-6 text-violet-200 sm:text-base">Crie, revise e publique sem sair do {BRAND.name}.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link to="/cadastro" onClick={() => trackCta('start_free')} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 text-sm font-black text-white hover:bg-violet-500 ${focusRing}`}>Experimentar grátis<ArrowRight className="h-4 w-4" /></Link>
            <a href="#formas-de-criar" onClick={() => trackCta('explore_products')} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-6 py-4 text-sm font-black text-white hover:bg-white/5 ${focusRing}`}><Play className="h-4 w-4" />Ver tudo o que posso criar</a>
          </div>
          <p className="mt-5 text-xs font-bold text-slate-400">Comece grátis com 200 Smart Tokens após confirmar seu e-mail. Sem cartão.</p>
        </div>
        <div className="relative mx-auto w-full max-w-[800px] py-6 sm:px-8 lg:px-0">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#0b1022] shadow-[0_50px_100px_-35px_rgba(76,29,149,.8)]">
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#080b16]/85 px-4 py-3 backdrop-blur">
              <span className="text-xs font-black" data-hero-product-title>{activeSlide.name}</span>
              <span className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-400" /><i className="h-2 w-2 rounded-full bg-amber-300" /><i className="h-2 w-2 rounded-full bg-emerald-400" /></span>
            </div>
            <div className="h-full pt-10"><div className="relative h-full overflow-hidden bg-[#050816]">{HERO_PRODUCT_SLIDES.map((slide, index) => {
              const active = activeIndex === index
              return <div key={slide.id} aria-hidden={!active} className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}><HeroMedia slide={slide} active={active} /></div>
            })}</div></div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PositioningStrip() {
  const startingPoints = [
    ['Já tenho fotos ou vídeos', 'Use o material que você já tem para criar novas formas de apresentar e divulgar seus imóveis.'],
    ['Tenho apenas as informações', 'Ainda não tem imagens? Tudo bem. Comece pelas informações e crie materiais para venda, locação, lançamentos, captação de imóveis ou captação de profissionais.'],
  ]
  return <>
    <section id="formas-de-criar" className="scroll-mt-20 border-y border-white/10 bg-[#090d1b] text-white">
      <div className="mx-auto grid max-w-[92rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:px-10 lg:py-20">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Novas formas de divulgar</p>
          <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.03] tracking-[-.05em] sm:text-6xl">As mesmas imagens. Novas formas de chamar atenção.</h2>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-slate-300">Seu anúncio não precisa aparecer sempre do mesmo jeito. Use as fotos e informações que você já tem para criar novas maneiras de apresentar o imóvel — em vídeo, imagem, banner, carrossel ou texto.</p>
        </div>
        <div className="border-l-2 border-violet-500 pl-6 sm:pl-8">
          <p className="text-2xl font-black tracking-[-.035em] text-violet-300 sm:text-3xl">Divulgue mais. Divulgue diferente.</p>
          <p className="mt-4 text-sm font-medium leading-7 text-slate-400">Venda, locação, lançamentos ou captação: mantenha-se presente e apresente seus imóveis de novas formas todos os dias.</p>
        </div>
      </div>
    </section>
    <section className="bg-white pb-12 pt-20 sm:pb-14 sm:pt-24">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10">
        <p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">Comece com o que você tem</p>
        <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.04] tracking-[-.05em] text-slate-950 sm:text-5xl">Com imagens ou sem imagens, você pode começar a criar.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-200 md:grid-cols-2">
          {startingPoints.map(([title, copy], index) => <article key={title} className="bg-[#f8f7fb] p-7 sm:p-10"><span className="text-xs font-black text-violet-700">0{index + 1}</span><h3 className="mt-8 text-2xl font-black tracking-[-.035em] text-slate-950">{title}</h3><p className="mt-4 max-w-xl text-sm font-medium leading-7 text-slate-600">{copy}</p></article>)}
        </div>
      </div>
    </section>
  </>
}

function ListingXraySpotlight() {
  const capabilities = [
    'Análise pelo link ou por capturas',
    'Qualidade do Anúncio',
    'Potencial de Atração',
    'Sugestões prontas para melhorar',
    'Recomendações para ampliar a divulgação',
  ]

  return <section id="raio-x" className="bg-[#07111f] py-16 text-white sm:py-20">
    <div className="mx-auto grid max-w-[92rem] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] lg:items-center lg:px-10">
      <div>
        <div className="flex items-center gap-3 text-cyan-300">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 ring-1 ring-cyan-200/20"><Radar className="h-6 w-6" aria-hidden="true" /></span>
          <p className="text-xs font-black uppercase tracking-[.2em]">Raio-X</p>
        </div>
        <p className="mt-5 text-sm font-black text-cyan-100">Não sabe por onde começar?</p>
        <h2 className="mt-3 max-w-4xl text-4xl font-black leading-[1.04] tracking-[-.05em] sm:text-5xl">Seu anúncio está publicado, mas poderia chamar mais atenção?</h2>
        <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-slate-300">Envie o link ou capturas. O {BRAND.name} analisa a qualidade do anúncio, o potencial de atração, mostra o que pode melhorar e entrega sugestões prontas para usar.</p>
        <Link to="/raio-x-anuncio" className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 ${focusRing}`}>Experimentar o Raio-X<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[.06] p-6 shadow-[0_35px_80px_-45px_rgba(34,211,238,.55)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Analisar → Melhorar → Criar → Divulgar</p>
        <ul className="mt-6 space-y-3">
          {capabilities.map(capability => <li key={capability} className="flex items-start gap-3 rounded-2xl bg-white/[.05] px-4 py-3 text-sm font-bold leading-6 text-slate-100"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />{capability}</li>)}
        </ul>
      </div>
    </div>
  </section>
}

function DeliveryPanel({ group }) {
  const playingVideoRef = useRef(null)
  const trackCta = useLandingCtaTracking('product_section')
  const handlePlay = video => {
    if (playingVideoRef.current && playingVideoRef.current !== video) playingVideoRef.current.pause()
    playingVideoRef.current = video
  }
  // Keep the real-estate video modes together, followed by the other video products.
  const otherProductsIndex = group.items.findIndex(item => item.id === 'comercial-imobiliario')
  const midpoint = otherProductsIndex > 0 ? otherProductsIndex : Math.ceil(group.items.length / 2)
  const groups = [group.items.slice(0, midpoint), group.items.slice(midpoint)].filter(items => items.length)
  return <section id={group.id} className="scroll-mt-20 bg-[#080c19] py-12 text-white">
    <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10">
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">{group.eyebrow}</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">{group.title}</h2>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Criações em vídeo">{groups.map((items, index) => <VideoCreationGroup key={index} items={items} onPlay={handlePlay} />)}</div>
      <div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center"><p className="text-lg font-black tracking-[-.03em]">{group.ctaTitle}</p><Link to="/cadastro" onClick={() => trackCta('start_free')} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white ${focusRing}`}>{group.ctaLabel}<ArrowRight className="h-4 w-4" /></Link></div>
    </div>
  </section>
}

function ImagePreviewCard({ item }) {
  const reducedMotion = useReducedMotion()
  const examples = IMAGE_SHOWCASE_EXAMPLES[item.id] || [item.src]
  const [exampleIndex, setExampleIndex] = useState(0)
  const example = typeof examples[exampleIndex] === 'string' ? { type: 'image', src: examples[exampleIndex] } : examples[exampleIndex]
  useEffect(() => {
    if (reducedMotion || examples.length < 2) return undefined
    const timer = window.setInterval(() => setExampleIndex(index => (index + 1) % examples.length), 5200)
    return () => window.clearInterval(timer)
  }, [examples.length, reducedMotion])
  return <article className="mx-auto w-full">
    <div className="h-[310px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_24px_54px_-34px_rgba(15,23,42,.55)] sm:h-[330px]">
      <div className="h-full overflow-hidden rounded-[1.35rem] bg-slate-100">
        {item.type === 'comparison' ? <BeforeAfter beforeSrc={item.beforeSrc} afterSrc={item.src} compact contain /> : example.type === 'video' ? <video key={example.src} src={example.src} aria-label={`Exemplo real animado de ${item.title}`} autoPlay muted loop playsInline preload="auto" className="h-full w-full bg-slate-100 object-contain" /> : <img key={example.src} src={example.src} alt={`Exemplo real de ${item.title}`} loading="lazy" className="h-full w-full object-contain transition-opacity duration-500 motion-reduce:transition-none" />}
      </div>
    </div>
    <h3 className="mt-4 text-center text-lg font-black tracking-[-.03em] text-slate-950">{item.title}</h3>
    <p className="mt-2 text-center text-xs font-medium leading-5 text-slate-600">{item.description}</p>
  </article>
}

function ImageShowcase({ group }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const trackCta = useLandingCtaTracking('product_section')
  return <section id={group.id} className="scroll-mt-20 bg-[#f4f3f8] py-12 text-slate-950">
    <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10">
      <p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">{group.eyebrow}</p>
      <h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">{group.title}</h2>
      <div className={`mx-auto mt-7 hidden gap-6 md:grid ${group.items.length === 1 ? 'max-w-2xl grid-cols-1' : 'max-w-5xl grid-cols-2'}`}>{group.items.map(item => <ImagePreviewCard key={item.id} item={item} />)}</div>
      <div className="mt-8 md:hidden"><div className="flex flex-wrap gap-2 pb-4">{group.items.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-pressed={activeIndex === index} className={`rounded-full border px-4 py-2 text-xs font-black ${activeIndex === index ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-600'} ${focusRing}`}>{item.title}</button>)}</div><ImagePreviewCard item={group.items[activeIndex]} /></div>
      <div className="mt-8 flex flex-col justify-between gap-4 border-t border-slate-300 pt-6 sm:flex-row sm:items-center"><p className="text-lg font-black tracking-[-.03em]">{group.ctaTitle}</p><Link to="/cadastro" onClick={() => trackCta('start_free')} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white ${focusRing}`}>{group.ctaLabel}<ArrowRight className="h-4 w-4" /></Link></div>
    </div>
  </section>
}

function TextCampaignSection() {
  const trackCta = useLandingCtaTracking('product_section')
  return <section id="textos-campanhas" className="scroll-mt-20 bg-[#080c19] py-14 text-white sm:py-16"><div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Textos e campanhas</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">Criar campanha de textos.</h2><p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-300">Converse com nossa IA e receba textos preparados para diferentes canais.</p><div className="mt-8"><TextCampaignPreview /></div><div className="mt-6 flex justify-end"><Link to="/cadastro" onClick={() => trackCta('start_free')} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white ${focusRing}`}>Experimentar grátis<ArrowRight className="h-4 w-4" /></Link></div></div></section>
}

function DeliveryShowcase() {
  return <div id="produtos"><section className="bg-[#f4f3f8] pb-14 pt-12 text-slate-950 sm:pb-16 sm:pt-14"><div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">O que você pode criar</p><h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.03] tracking-[-.05em] sm:text-6xl">Uma plataforma. Muitas formas de divulgar.</h2><p className="mt-6 max-w-4xl text-base font-medium leading-7 text-slate-600">Vídeos, imagens, banners, carrosséis e textos para transformar suas informações e materiais em novas formas de apresentar, divulgar e manter suas oportunidades presentes.</p><p className="mt-6 text-xs font-black uppercase tracking-[.12em] text-violet-700">Venda <span className="mx-2 text-slate-300">·</span> Locação <span className="mx-2 text-slate-300">·</span> Lançamentos <span className="mx-2 text-slate-300">·</span> Captação de imóveis <span className="mx-2 text-slate-300">·</span> Captação de profissionais</p></div></section>{DELIVERY_GROUPS.map((group, index) => group.id === 'videos' ? <DeliveryPanel key={group.id} group={group} /> : group.id === 'imagens-campanhas' ? <ImageShowcase key={group.id} group={group} /> : <TextCampaignSection key={group.id} />)}</div>
}

function ProductShowcase() {
  const [productIndex, setProductIndex] = useState(0)
  const [itemIndex, setItemIndex] = useState(0)
  const tabRefs = useRef([])
  const product = PRODUCT_FAMILIES[productIndex]
  const item = product.items[itemIndex] || product.items[0]
  const selectProduct = index => { setProductIndex(index); setItemIndex(0) }
  const handleTabs = event => {
    const last = PRODUCT_FAMILIES.length - 1
    let next = productIndex
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = productIndex === last ? 0 : productIndex + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = productIndex === 0 ? last : productIndex - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault(); selectProduct(next); tabRefs.current[next]?.focus()
  }
  return <section id="produtos" className="scroll-mt-20 bg-[#f4f3f8] py-20 text-slate-950 sm:py-28"><div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"><div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">Produtos</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.05em] sm:text-6xl">Crie do seu jeito.<br />Divulgue em qualquer canal.</h2><p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600">Seis soluções conectadas por uma experiência guiada e feita para o mercado imobiliário.</p></div><div className="mt-12 grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_35px_100px_-60px_rgba(15,23,42,.45)] lg:grid-cols-[310px_minmax(0,1fr)]"><div role="tablist" aria-label={`Produtos do ${BRAND.name}`} onKeyDown={handleTabs} className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 lg:block lg:overflow-visible lg:border-b-0 lg:border-r lg:p-4">{PRODUCT_FAMILIES.map((entry, index) => { const Icon = entry.icon; const selected = productIndex === index; return <button ref={node => { tabRefs.current[index] = node }} key={entry.id} id={`product-tab-${entry.id}`} type="button" role="tab" aria-selected={selected} aria-controls="product-panel" tabIndex={selected ? 0 : -1} onClick={() => selectProduct(index)} className={`min-w-[220px] rounded-2xl p-4 text-left transition lg:min-w-0 lg:w-full ${selected ? 'bg-[#0b1022] text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'} ${focusRing}`}><span className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-700'}`}><Icon className="h-4 w-4" /></span><span><span className="block text-[10px] font-black text-violet-400">{entry.number}</span><span className="block text-sm font-black">{entry.name}</span></span></span></button> })}</div><div id="product-panel" role="tabpanel" aria-labelledby={`product-tab-${product.id}`} className="min-w-0 bg-[#080c19] text-white"><div className="grid min-h-[650px] lg:grid-cols-[minmax(300px,.72fr)_minmax(0,1.28fr)]"><div className="flex flex-col justify-between p-6 sm:p-9 lg:p-10"><div><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">{product.number} · {product.name}</p><h3 className="mt-5 text-3xl font-black leading-[1.06] tracking-[-.045em] sm:text-4xl">{product.headline}</h3><p className="mt-5 text-sm font-medium leading-7 text-slate-300 sm:text-base">{product.description}</p></div><div className="mt-9"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Explore as entregas</p><div className="mt-3 flex flex-wrap gap-2">{product.items.map((entry, index) => <button key={entry.id} type="button" onClick={() => setItemIndex(index)} aria-pressed={itemIndex === index} className={`rounded-full border px-3.5 py-2 text-xs font-black ${itemIndex === index ? 'border-violet-400 bg-violet-500 text-white' : 'border-white/15 bg-white/[.04] text-slate-300'} ${focusRing}`}>{entry.title}</button>)}</div><Link to="/cadastro" className={`mt-7 inline-flex items-center gap-2 text-sm font-black text-violet-300 ${focusRing}`}>Experimentar grátis<ArrowRight className="h-4 w-4" /></Link></div></div><div className="min-h-[430px] border-t border-white/10 p-3 sm:p-5 lg:border-l lg:border-t-0"><div className="h-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#050816]"><ProductMedia item={item} active /></div></div></div></div></div></div></section>
}

function VirtualStagingPhone({ sequence, slot, reducedMotion }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    setFrame(0)
    if (reducedMotion) return undefined
    let rotationTimer
    const startTimer = window.setTimeout(() => {
      setFrame(1)
      rotationTimer = window.setInterval(() => setFrame(current => current + 1), 3600 + slot * 650)
    }, 1000 + slot * 700)
    return () => {
      window.clearTimeout(startTimer)
      if (rotationTimer) window.clearInterval(rotationTimer)
    }
  }, [reducedMotion, sequence.length, slot])
  const pair = sequence[Math.floor(frame / 2) % sequence.length]
  const showAfter = frame % 2 === 1
  const shellPosition = slot === 0 ? 'col-span-2 mx-auto max-w-[280px] lg:col-span-1 lg:max-w-[300px]' : 'max-w-[170px] sm:max-w-[210px] lg:max-w-[300px]'
  return <article data-virtual-staging-phone={slot + 1} className={`w-full ${shellPosition}`} aria-label={`${pair.label}: comparação antes e depois`}>
    <div className="relative aspect-[9/18.5] overflow-hidden rounded-[2rem] border-[5px] border-[#111528] bg-[#050816] shadow-[0_28px_65px_-30px_rgba(15,23,42,.8)] sm:border-[6px]">
      <span className="absolute left-1/2 top-2 z-30 h-3.5 w-14 -translate-x-1/2 rounded-full bg-[#070a13]" aria-hidden="true" />
      <div className="absolute inset-px overflow-hidden rounded-[1.55rem] bg-slate-200">
        {reducedMotion ? <>
          <img src={pair.after} alt={`${pair.label} depois do Smart Space`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden border-r border-white"><img src={pair.before} alt={`${pair.label} antes do Smart Space`} loading="lazy" className="h-full w-[200%] max-w-none object-cover" /></div>
          <span className="absolute left-3 top-9 rounded-full bg-slate-950/80 px-2.5 py-1 text-[9px] font-black tracking-[.14em] text-white">ANTES</span>
          <span className="absolute right-3 top-9 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black tracking-[.14em] text-slate-950">DEPOIS</span>
        </> : <>
          <img key={`${pair.id}-before`} src={pair.before} alt={`${pair.label} antes do Smart Space`} loading={slot === 0 && frame === 0 ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-cover" />
          <img key={`${pair.id}-after`} src={pair.after} alt={`${pair.label} depois do Smart Space`} loading={slot === 0 && frame === 0 ? 'eager' : 'lazy'} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${showAfter ? 'opacity-100' : 'opacity-0'}`} />
          <span className={`absolute left-1/2 top-9 -translate-x-1/2 rounded-full px-3 py-1 text-[9px] font-black tracking-[.14em] shadow-lg backdrop-blur transition-colors duration-700 ${showAfter ? 'bg-white/90 text-slate-950' : 'bg-slate-950/80 text-white'}`}>{showAfter ? 'DEPOIS' : 'ANTES'}</span>
        </>}
        <span className="absolute inset-x-3 bottom-3 rounded-xl border border-white/20 bg-[#050816]/75 px-3 py-2 text-center text-[10px] font-black text-white backdrop-blur">{pair.label}</span>
      </div>
    </div>
  </article>
}

function VirtualStagingSpotlight() {
  const reducedMotion = useReducedMotion()
  const trackCta = useLandingCtaTracking('product_section')
  return <section id="virtual-staging-destaque" className="scroll-mt-20 overflow-hidden bg-white py-20 text-slate-950 sm:py-28">
    <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:items-end">
        <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">Smart Space</p><p className="mt-3 text-sm font-black text-slate-500">Antes e depois com inteligência artificial</p><h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-6xl">Pare de anunciar ambientes sem graça.<br /><span className="text-violet-700">Mostre o potencial do seu imóvel.</span></h2></div>
        <div className="min-w-0 lg:pb-1"><p className="max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">Transforme ambientes e mostre novas possibilidades para cada espaço.</p><Link to="/virtual-staging" onClick={() => trackCta('explore_products')} className={`mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 text-sm font-black text-white hover:bg-violet-500 ${focusRing}`}>Transformar espaço<ArrowRight className="h-4 w-4" /></Link></div>
      </div>
      <div className="relative mt-12 overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_50%_25%,#312e81_0%,#11152d_34%,#060914_78%)] px-4 pb-8 pt-10 shadow-[0_40px_100px_-55px_rgba(15,23,42,.75)] sm:px-8 sm:pb-10 sm:pt-12 lg:px-14 lg:pb-14">
        <div className="pointer-events-none absolute inset-x-1/4 top-0 h-40 rounded-full bg-violet-500/20 blur-[70px]" />
        <div className="relative mx-auto grid max-w-5xl grid-cols-2 items-start justify-items-center gap-5 sm:gap-8 lg:grid-cols-3 lg:gap-10">{VIRTUAL_STAGING_PHONE_SEQUENCES.map((sequence, slot) => <VirtualStagingPhone key={sequence[0].id} sequence={sequence} slot={slot} reducedMotion={reducedMotion} />)}</div>
        <p className="relative mx-auto mt-10 max-w-3xl text-center text-xs font-semibold leading-5 text-slate-400 lg:mt-12">Imagens geradas com inteligência artificial. O resultado representa uma possibilidade visual de ambientação.</p>
      </div>
    </div>
  </section>
}

function HowItWorks() {
  const trackCta = useLandingCtaTracking('product_section')
  const steps = [['01', 'Escolha', 'Defina o que vamos criar juntos.'], ['02', 'Informe', 'Converse com nossa IA e vamos montar sua campanha.'], ['03', 'Receba', `${BRAND.name} prepara sua criação e entrega o material pronto para você divulgar.`]]
  return <section id="como-funciona" className="scroll-mt-20 bg-white py-20 sm:py-24"><div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">Como funciona</p><h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl">Você escolhe o que precisa. A gente simplifica o caminho.</h2><p className="mt-5 max-w-3xl text-base font-medium leading-7 text-slate-600">Sem prompts complicados, sem escolher modelos e sem descobrir qual ferramenta usar.</p><div className="mt-12 grid border-y border-slate-200 md:grid-cols-3">{steps.map(([number, title, description], index) => <article key={number} className={`py-8 md:px-8 md:py-10 ${index > 0 ? 'border-t border-slate-200 md:border-l md:border-t-0' : ''}`}><span className="text-sm font-black text-violet-600">{number}</span><h3 className="mt-10 text-2xl font-black text-slate-950">{title}</h3><p className="mt-3 text-sm font-medium leading-6 text-slate-600">{description}</p></article>)}</div><div className="mt-8 flex flex-col justify-between gap-6 rounded-2xl bg-[#f4f3f8] p-6 sm:flex-row sm:items-center"><p className="max-w-3xl text-sm font-bold leading-6 text-slate-700">Tem imagens? Ótimo. Ainda não tem? Alguns produtos permitem começar apenas com as informações da campanha.</p><Link to="/cadastro" onClick={() => trackCta('start_free')} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-black text-white ${focusRing}`}>Experimentar grátis<ArrowRight className="h-4 w-4" /></Link></div></div></section>
}

function BenefitsSection() {
  return <>
    <section id="recursos" className="scroll-mt-20 bg-[#f4f3f8] py-20 sm:py-24"><div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">Usos reais</p><h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.04] tracking-[-.05em] text-slate-950 sm:text-5xl">Para cada oportunidade, uma nova forma de apresentar.</h2><div className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-3">{REAL_USES.map(([title, copy], index) => <article key={title} className={`bg-white p-7 sm:p-8 ${index === 3 ? 'lg:col-span-2' : ''}`}><h3 className="text-xl font-black uppercase tracking-[-.025em] text-slate-950">{title}</h3>{title === 'Captação de imóveis' && <p className="mt-4 text-lg font-black leading-7 text-violet-700">Antes de divulgar o imóvel, mostre ao proprietário como você pretende divulgá-lo.</p>}<p className="mt-4 text-sm font-medium leading-7 text-slate-600">{copy}</p></article>)}</div></div></section>
    <section className="border-y border-white/10 bg-[#090d1b] py-16 text-white sm:py-20"><div className="mx-auto grid max-w-[92rem] gap-6 px-4 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-10"><h2 className="text-3xl font-black leading-[1.05] tracking-[-.045em] sm:text-5xl">Para quem cria sozinho. Para quem precisa criar em volume.</h2><p className="text-base font-medium leading-7 text-slate-300">Do corretor autônomo às equipes, gerentes e imobiliárias: crie materiais para diferentes imóveis, oportunidades e campanhas com a mesma facilidade.</p></div></section>
  </>
}

function TokensSection() {
  const trackCta = useLandingCtaTracking('product_section')
  const facts = [
    ['Teste grátis', 'Confirme seu e-mail e receba 200 Smart Tokens para experimentar recursos selecionados, sem cartão.'],
    ['Sem precisar assinar', 'Crie também sem plano mensal. Quando precisar, adicione Smart Tokens e continue criando.'],
    ['Tudo em um só lugar', 'Menos ferramentas para aprender e administrar. Vídeos, imagens e campanhas reunidos no mesmo ambiente.'],
  ]
  return <section className="relative overflow-hidden bg-gradient-to-br from-[#11152d] via-[#15132f] to-[#090b18] py-20 text-white sm:py-24"><div className="relative mx-auto grid max-w-[92rem] gap-12 px-4 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10"><div><p className="text-xs font-black uppercase tracking-[.18em] text-violet-200">Smart Tokens</p><h2 className="mt-5 text-4xl font-black leading-[1.05] tracking-[-.05em] sm:text-5xl">Crie no seu ritmo.</h2><p className="mt-5 text-xl font-black leading-8 text-white">Comece grátis, escolha um plano quando fizer sentido ou adicione Smart Tokens quando precisar.</p><p className="mt-4 text-sm font-medium leading-7 text-slate-400">Em vez de depender de várias ferramentas de IA para criar seus materiais, concentre diferentes formas de criação para marketing imobiliário no {BRAND.name}.</p><Link to="/planos" onClick={() => trackCta('view_plans')} className={`mt-8 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-black text-white ${focusRing}`}>Ver planos e Smart Tokens<ArrowRight className="h-4 w-4" /></Link></div><div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[.04]">{facts.map(([title, copy], index) => <div key={title} className={`p-6 ${index ? 'border-t border-white/10' : ''}`}><h3 className="text-sm font-black uppercase tracking-[.1em] text-violet-200">{title}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-300">{copy}</p></div>)}</div></div></section>
}

function SocialProof() {
  return <section className="bg-white py-20 sm:py-24"><div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"><h2 className="max-w-4xl text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl">Por que os corretores escolhem o {BRAND.name}</h2><div className="mt-10 grid gap-4 lg:grid-cols-3">{DEMO_TESTIMONIALS.map(([quote], index) => <blockquote key={quote} data-demo-placeholder="true" data-demo-index={index + 1} className="flex min-h-[280px] flex-col justify-center rounded-[1.75rem] border border-slate-200 bg-[#f7f6fa] p-7"><p className="text-xl font-bold leading-8 text-slate-900">“{quote}”</p></blockquote>)}</div></div></section>
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0)
  return <section id="faq" className="scroll-mt-20 bg-[#f4f3f8] py-20 sm:py-24"><div className="mx-auto grid max-w-[92rem] gap-10 px-4 sm:px-6 lg:grid-cols-[.65fr_1.35fr] lg:px-10"><h2 className="text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl">Perguntas frequentes</h2><div className="border-t border-slate-300">{FAQ_ITEMS.map(([question, answer, link], index) => { const open = openIndex === index; const answerId = `landing-faq-answer-${index}`; return <div key={question} className="border-b border-slate-300"><button type="button" onClick={() => setOpenIndex(current => current === index ? -1 : index)} aria-expanded={open} aria-controls={answerId} className={`flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-black text-slate-950 sm:text-base ${focusRing}`}>{question}<ChevronDown className={`h-5 w-5 shrink-0 text-violet-700 transition motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} /></button>{open && <div id={answerId} className="max-w-2xl pb-6 text-sm font-medium leading-7 text-slate-600"><p>{answer}</p>{link && <a href={link} className={`mt-3 inline-flex font-black text-violet-700 underline ${focusRing}`}>Falar com o suporte</a>}</div>}</div> })}</div></div></section>
}

function FinalCta() {
  const trackCta = useLandingCtaTracking('final_section')
  return <section className="bg-[#050816] px-4 py-20 text-white sm:px-6 sm:py-28"><div className="mx-auto max-w-[92rem] rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-700/25 to-white/[.03] px-6 py-14 text-center sm:px-10 sm:py-20"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Comece agora</p><h2 className="mx-auto mt-5 max-w-5xl text-4xl font-black leading-[1.03] tracking-[-.055em] sm:text-6xl">Divulgue mais. Divulgue diferente.</h2><p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-7 text-slate-300">Venda, locação, lançamento ou captação. Crie novas formas de apresentar suas oportunidades com o {BRAND.name}.</p><Link to="/cadastro" onClick={() => trackCta('start_free')} className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 text-sm font-black text-white ${focusRing}`}>Experimentar grátis<ArrowRight className="h-4 w-4" /></Link><p className="mt-4 text-xs font-bold text-slate-400">Comece grátis com 200 Smart Tokens após confirmar seu e-mail. Sem cartão.</p></div></section>
}

function LandingFooter() {
  const { openCookiePreferences } = useAnalytics()
  const groups = [
    [BRAND.name, [{ label: 'FAQ', href: '#faq' }, { label: 'Planos e Smart Tokens', to: '/planos' }]],
    ['Suporte e legal', [{ label: 'Contato', href: `mailto:${BRAND.supportEmail}` }, { label: BRAND.supportEmail, href: `mailto:${BRAND.supportEmail}` }, { label: 'Termos de Uso', to: '/termos' }, { label: 'Política de Privacidade', to: '/privacidade' }]],
  ]
  return <footer className="border-t border-white/10 bg-[#050816] text-white"><div className="mx-auto grid max-w-[92rem] gap-12 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1.2fr_.7fr] lg:px-10"><div><div className="flex items-center gap-3"><BrandMark size={42} decorative /><span className="text-lg font-black">{BRAND.name}</span></div><p className="mt-4 text-sm font-black text-violet-300">Inteligência que vende</p></div>{groups.map(([title, links]) => <div key={title}><h2 className="text-xs font-black uppercase tracking-[.16em] text-violet-300">{title}</h2><ul className="mt-5 space-y-3">{links.map(link => <li key={link.label}>{link.to ? <Link to={link.to} className="text-sm font-semibold text-slate-400 hover:text-white">{link.label}</Link> : <a href={link.href} className="text-sm font-semibold text-slate-400 hover:text-white">{link.label}</a>}</li>)}{title === 'Suporte e legal' && <li><button type="button" onClick={openCookiePreferences} className={`text-left text-sm font-semibold text-slate-400 hover:text-white ${focusRing}`}>Preferências de cookies</button></li>}</ul></div>)}<div><h2 className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Redes sociais</h2><div className="mt-5 flex gap-3"><a href="https://www.instagram.com/smartcorretorai/" target="_blank" rel="noopener noreferrer" aria-label={`Instagram oficial do ${BRAND.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-500"><Instagram className="h-4 w-4" /></a><a href="https://www.facebook.com/profile.php?id=61589717755129" target="_blank" rel="noopener noreferrer" aria-label={`Facebook oficial do ${BRAND.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-500"><Facebook className="h-4 w-4" /></a></div></div></div><div className="border-t border-white/10"><div className="mx-auto max-w-[92rem] px-4 py-5 text-xs font-semibold text-slate-600 sm:px-6 lg:px-10">© 2026 {BRAND.name}. Todos os direitos reservados.</div></div></footer>
}

export default function LandingPage() {
  return <div className="min-h-screen overflow-x-hidden bg-[#050816] text-slate-950 selection:bg-violet-300 selection:text-violet-950"><LandingHeader /><main><FirstCreationEntry /><div id="conheca-a-plataforma" className="scroll-mt-20"><Hero /></div><PositioningStrip />{RAIO_X_AVAILABLE && <ListingXraySpotlight />}<DeliveryShowcase /><VirtualStagingSpotlight /><BenefitsSection /><HowItWorks /><TokensSection /><SocialProof /><FaqSection /><FinalCta /></main><LandingFooter /></div>
}
