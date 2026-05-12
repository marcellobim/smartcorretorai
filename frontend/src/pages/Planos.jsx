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
    desc:
   
