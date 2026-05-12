import { Link } from 'react-router-dom'
import { Check, Zap, ArrowLeft, Sparkles, Info } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useState } from 'react'

const RECURSOS = [
  'Textos prontos para Instagram, WhatsApp e Facebook',
  'Hashtags geradas automaticamente',
  'Roteiro para vídeos e Reels',
  'Texto para LinkedIn e YouTube',
  'Postar no Instagram com 1 clique',
  'Suporte por WhatsApp',
]

const REGRAS = [
  { icon: '🔄', texto: 'Anúncios mensais não acumulam — resetam no dia 1° de cada mês' },
  { icon: '🔒', texto: 'Planos intransferíveis — vinculados ao e-mail do titular' },
  { icon: '👥', texto: 'Múltiplos logins apenas no plano Imobiliária' },
  { icon: '♾️', texto: 'Anúncios avulsos não expiram — ficam disponíveis até serem usados' },
]

const allPlans = [
  {
    id: 'free',
    tipo: 'plano',
    nome: 'Teste Grátis',
    preco: null,
    periodo: null,
    anuncios: 1,
    logins: 1,
    desc: 'Experimente sem pagar nada',
    destaque: false,
    cta: 'Criar conta grátis',
    link: '/cadastro',
  },
  {
    id: 'avulso1',
    tipo: 'avulso',
    nome: 'Avulso · 5 anúncios',
    preco: '38,97',
    periodo: null,
    anuncios: 5,
    desc: 'Sem mensalidade · não expiram',
    destaque: false,
    cta: 'Comprar',
  },
  {
    id: 'avulso2',
    tipo: 'avulso',
    nome: 'Avulso · 10 anúncios',
    preco: '57,97',
    periodo: null,
    anuncios: 10,
    desc: 'Sem mensalidade · não expiram',
    destaque: false,
    cta: 'Comprar',
  },
  {
    id: 'start',
    tipo: 'plano',
    nome: 'Start',
    preco: '97',
    periodo: '/mês',
    anuncios: 15,
    logins: 1,
    desc: 'Para corretores que estão começando',
    destaque: false,
    cta: 'Assinar Start',
  },
  {
    id: 'pro',
    tipo: 'plano',
    nome: 'Pro',
    preco: '187',
    periodo: '/mês',
    anuncios: 35,
    logins: 1,
    desc: 'O favorito dos corretores ativos',
    destaque: true,
    cta: 'Assinar Pro',
  },
  {
    id: 'enterprise',
    tipo: 'plano',
    nome: 'Imobiliária',
    preco: '417',
    periodo: '/mês',
    anuncios: 80,
    logins: null,
    desc: 'Para imobiliárias e equipes',
    destaque: false,
    cta: 'Falar com a equipe',
    link: 'mailto:contato@smartcorretorai.com.br',
  },
]

export default function Planos() {
  const { user, isAuthenticated } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState(null)

  const assinar = async (planId) => {
    if (!isAuthenticated) return
    setLoadingPlan(planId)
    try {
      const res = await api.post('/subscriptions/checkout', { plan_id: planId })
      window.location.href = res.checkout_url
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="
