import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import Header from '../components/layout/Header'
import AppFooter from '../components/layout/AppFooter'
import {
  ProductButton,
  ProductCard,
  ProductSectionHeading,
  SMART_UI,
} from '../components/design-system'

const PLANS_ROUTE = '/planos'
const SMART_TOKENS_LABEL = ['Smart', 'Tokens'].join(' ')
const HOME_PAGE_CLASS = 'mx-auto w-full max-w-[92rem] px-smart-page py-6 sm:py-8'

const mainActions = [
  {
    id: 'smart-tour-ai',
    title: 'Vídeo Imobiliário',
    description: 'Transforme as fotos dos seus imóveis em comerciais profissionais. Escolha o resultado desejado e nossa IA faz o restante.',
    to: '/smart-tour-ai',
    label: 'Criar vídeo',
    tone: 'violet',
  },
  {
    id: 'hero-ia',
    title: 'Banner Imobiliário',
    description: 'Nossa IA transforma as fotos e informações do imóvel em banners profissionais, prontos para divulgar seus imóveis com mais impacto.',
    to: '/hero',
    label: 'Criar Banner',
    tone: 'mint',
  },
  {
    id: 'studio-hero',
    title: 'Studio IA',
    description: 'Crie comerciais imobiliários, vídeos criativos e carrosséis de anúncios com IA.',
    to: '/studio-hero',
    label: 'Abrir Studio IA',
    tone: 'blue',
  },
  {
    id: 'virtual-staging',
    title: 'Virtual Space',
    description: 'Transforme ambientes, crie novas possibilidades visuais e apresente seus imóveis com inteligência artificial.',
    to: '/virtual-staging',
    label: 'Criar projeto',
    tone: 'cyan',
  },
  {
    id: 'banners-rapidos',
    title: 'Banners Rápidos',
    description: 'Use a Biblioteca Profissional para criar materiais prontos e consistentes.',
    to: '/nova-campanha',
    label: 'Criar banners',
    tone: 'peach',
  },
  {
    id: 'campanha-de-textos',
    title: 'Campanha de Textos',
    description: 'Prepare textos completos para portais, redes sociais, WhatsApp e outros canais.',
    to: '/campanha-de-textos',
    label: 'Criar campanha',
    tone: 'gold',
  },
]

const productTones = Object.freeze({
  violet: 'border-violet-200 bg-gradient-to-br from-violet-50 via-violet-100/70 to-indigo-100/80',
  mint: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-teal-100/80',
  blue: 'border-blue-200 bg-gradient-to-br from-blue-50 via-blue-100/70 to-sky-100/80',
  cyan: 'border-cyan-200 bg-gradient-to-br from-cyan-50 via-cyan-100/70 to-sky-100/80',
  peach: 'border-orange-200/80 bg-gradient-to-br from-orange-50 via-orange-50/80 to-amber-100/55',
  gold: 'border-amber-200/80 bg-gradient-to-br from-amber-50 via-amber-50/85 to-yellow-100/55',
})

const faqItems = [
  {
    question: 'Qual produto devo usar para o que preciso criar?',
    answer: 'Para vídeos do imóvel, use Vídeo Imobiliário. Banner Imobiliário cria uma campanha visual guiada, enquanto Banners Rápidos parte de modelos profissionais. Studio IA atende produções visuais e criativas, Virtual Space transforma e apresenta ambientes, e Campanha de Textos prepara conteúdo escrito para diferentes canais.',
  },
  {
    question: `Preciso assinar um plano ou posso comprar ${SMART_TOKENS_LABEL} quando precisar?`,
    answer: `Você tem flexibilidade para escolher um plano, indicado para uso frequente, ou adquirir ${SMART_TOKENS_LABEL} separadamente quando precisar de mais capacidade, conforme as condições comerciais vigentes.`,
    link: { to: PLANS_ROUTE, label: `Ver planos e ${SMART_TOKENS_LABEL}` },
  },
  {
    question: `Como funcionam os ${SMART_TOKENS_LABEL}? E se uma geração der erro?`,
    answer: `${SMART_TOKENS_LABEL} são usados nas criações conforme o recurso escolhido. Quando uma geração falha ou não é concluída corretamente, a reserva é cancelada e os tokens não são consumidos; você não precisa solicitar estorno manual por essa criação.`,
    link: { to: PLANS_ROUTE, label: `Ver ${SMART_TOKENS_LABEL}` },
  },
  {
    question: 'Quais são os planos do SmartCorretorAI?',
    answer: 'Os planos são indicados principalmente para quem cria com frequência e oferecem capacidade recorrente conforme a opção contratada. A página de planos apresenta as alternativas e o que está incluído em cada uma, sem exigir uma escolha antes de você conhecer as condições.',
    link: { to: PLANS_ROUTE, label: 'Ver planos' },
  },
  {
    question: 'Posso cancelar minha assinatura quando quiser?',
    answer: 'Sim. O gerenciamento da assinatura fica sob seu controle e o cancelamento pode ser solicitado a qualquer momento, com efeito ao final do período vigente, conforme os Termos de Uso.',
    link: { to: '/configuracoes?tab=assinatura', label: 'Gerenciar assinatura' },
  },
  {
    question: `Meus ${SMART_TOKENS_LABEL} expiram?`,
    answer: `${SMART_TOKENS_LABEL} comprados separadamente, fora do plano, não expiram. Os tokens incluídos em assinaturas seguem as condições do ciclo e da oferta contratada.`,
  },
  {
    question: 'Como publico minhas criações nas redes sociais?',
    answer: 'Finalize e revise a criação, baixe a mídia e copie o texto preparado, quando houver. Depois, abra a rede desejada, anexe a imagem ou o vídeo, cole o texto, revise novamente e publique. No celular, o compartilhamento nativo do aparelho pode facilitar essas etapas quando estiver disponível.',
  },
  {
    question: 'Posso usar minhas criações no WhatsApp, redes sociais e portais imobiliários?',
    answer: 'Sim, desde que o canal aceite o tipo de material criado. Antes de enviar ou publicar, confira o formato, as dimensões e os requisitos específicos do WhatsApp, da rede social ou do portal imobiliário.',
  },
  {
    question: 'Minhas criações ficam salvas?',
    answer: 'Sua criação fica disponível temporariamente por até 24 horas para você revisar e baixar. Depois desse período, ela é removida automaticamente. Baixe tudo o que deseja guardar, pois o SmartCorretorAI não funciona como galeria ou armazenamento permanente.',
  },
  {
    question: 'O SmartCorretorAI altera meus dados profissionais automaticamente?',
    answer: 'Não. Seus dados profissionais são controlados por você e só devem ser atualizados na área de Perfil Profissional da sua conta.',
    link: { to: '/configuracoes?tab=perfil', label: 'Ir para Perfil Profissional' },
  },
  {
    question: 'Quem é responsável pelas imagens, vídeos e materiais que eu envio?',
    answer: 'Você é responsável pelo conteúdo enviado e deve possuir as autorizações ou os direitos necessários para usar imagens, vídeos, marcas, textos e outros materiais. O SmartCorretorAI não transfere esses direitos para sua conta.',
    link: { to: '/termos', label: 'Ver Termos de Uso' },
  },
  {
    question: 'A inteligência artificial pode cometer erros ou alterar algum detalhe?',
    answer: 'Sim. Conteúdos gerados com IA podem apresentar erros, imprecisões ou variações. Revise as informações do imóvel, os textos e os elementos visuais antes de divulgar ou publicar o material.',
  },
  {
    question: 'Ainda ficou com alguma dúvida ou quer falar com a gente?',
    answer: 'Se você tiver dúvidas, sugestões, precisar de ajuda ou quiser nos contar sobre algum problema, entre em contato com nossa equipe. Vamos analisar sua mensagem e responder assim que possível.',
    link: { href: 'mailto:suporte@smartcorretorai.com.br', label: 'Falar com o SmartCorretorAI' },
  },
]

export default function Dashboard() {
  return (
    <div className="min-w-0">
      <Header title="Home" subtitle="Sua central de criação imobiliária" />

      <main className={`${HOME_PAGE_CLASS} min-w-0`}>
        <ProductCard className="relative isolate overflow-hidden border-violet-200 bg-gradient-to-br from-violet-100 via-blue-50 to-cyan-100/90 p-6 shadow-violet-200/50 sm:p-8 lg:p-10">
          <div className="max-w-6xl">
            <h1 className="text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
              O que vamos criar para o seu imóvel hoje?
            </h1>
            <p className={`${SMART_UI.body} mt-4 max-w-5xl`}>
              Escolha o que deseja criar. A IA guia você na criação de vídeos, imagens ou textos, do briefing ao material pronto, sem termos técnicos.
            </p>
          </div>
        </ProductCard>

        <section className="mt-8" aria-labelledby="home-products-title">
          <ProductSectionHeading
            id="home-products-title"
            eyebrow="Produtos"
            title="Escolha sua próxima criação"
            description="Seis caminhos diretos para produzir e divulgar seus imóveis com consistência."
          />

          <div data-home-product-grid className="mt-6 grid min-w-0 auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {mainActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="home-faq-title">
          <ProductSectionHeading
            id="home-faq-title"
            eyebrow="Ajuda rápida"
            title="Dúvidas frequentes e uso"
            description="Encontre o produto certo e acesse rapidamente as áreas mais importantes da sua conta."
          />

          <ProductCard className="mt-6 divide-y divide-slate-200 overflow-hidden" data-home-faq>
            {faqItems.map((item, index) => (
              <FaqItem key={item.question} item={item} defaultOpen={index === 0} />
            ))}
          </ProductCard>
        </section>
      </main>
      <AppFooter />
    </div>
  )
}

function ActionCard({ action }) {
  const content = (
    <ProductCard
      as="article"
      data-home-product={action.id}
      className={`group flex h-full min-w-0 flex-col border p-5 transition-transform motion-reduce:transition-none sm:p-6 xl:hover:-translate-y-1 ${productTones[action.tone]}`}
    >
      <div className="flex-1">
        <h2 className="text-lg font-black tracking-tight text-slate-950">{action.title}</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{action.description}</p>
      </div>
      <div className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-smart-control border border-primary-200 bg-white px-4 py-2.5 text-sm font-black text-primary-800 transition group-hover:border-primary-400 group-hover:bg-primary-50 sm:w-fit">
        {action.label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </div>
    </ProductCard>
  )

  return (
    <Link to={action.to} className={`block h-full min-w-0 rounded-3xl ${SMART_UI.focus}`}>
      {content}
    </Link>
  )
}

function FaqItem({ item, defaultOpen = false }) {
  return (
    <details className="group px-5 py-1 sm:px-6" open={defaultOpen || undefined}>
      <summary className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-black text-slate-950 marker:hidden sm:text-base ${SMART_UI.focus}`}>
        <span>{item.question}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-primary-600 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="max-w-3xl pb-5 pr-8">
        <p className="text-sm font-medium leading-7 text-slate-600">{item.answer}</p>
        {item.link && (
          <ProductButton as={item.link.href ? 'a' : Link} href={item.link.href} to={item.link.to} variant="ghost" size="sm" className="mt-3 -ml-3">
            {item.link.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ProductButton>
        )}
      </div>
    </details>
  )
}
