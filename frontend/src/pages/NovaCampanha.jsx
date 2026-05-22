import { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, MessageCircle, Copy, Download, CheckCircle2, Plus, Camera, X, Send, AlertCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

// ═══════════════════════════════════════════════════════════════
//  DADOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════════

const CATEGORIAS = [
  { id: 'alto_padrao',    nome: 'Alto Padrão',   icon: '💎', cor: 'from-amber-500 to-yellow-400',   ring: 'ring-amber-400',   badge: 'bg-amber-100 text-amber-800',   desc: 'Luxo e exclusividade' },
  { id: 'medio_padrao',   nome: 'Médio Padrão',  icon: '🏠', cor: 'from-blue-500 to-blue-400',      ring: 'ring-blue-400',    badge: 'bg-blue-100 text-blue-800',     desc: 'Custo-benefício' },
  { id: 'popular_mcmv',   nome: 'Popular/MCMV',  icon: '🤝', cor: 'from-green-500 to-emerald-400',  ring: 'ring-green-400',   badge: 'bg-green-100 text-green-800',   desc: 'Casa própria' },
  { id: 'lancamento',     nome: 'Lançamento',    icon: '🚀', cor: 'from-purple-500 to-violet-400',  ring: 'ring-purple-400',  badge: 'bg-purple-100 text-purple-800', desc: 'Na planta' },
  { id: 'em_construcao',  nome: 'Em Construção', icon: '🏗️', cor: 'from-orange-500 to-amber-400',  ring: 'ring-orange-400',  badge: 'bg-orange-100 text-orange-800', desc: 'Em obra' },
]

const TIPOS = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Sobrado', 'Terreno', 'Sala Comercial', 'Outro']

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const DIFERENCIAIS_PRESET = [
  'Piscina', 'Academia', 'Churrasqueira', 'Varanda / Sacada', 'Vista para o mar',
  'Vista para a cidade', 'Playground', 'Salão de festas', 'Portaria 24h', 'Área verde',
  'Cozinha americana', 'Closet', 'Ar-condicionado', 'Jardim privativo', 'Terraço',
  'Home office', 'Elevador', 'Condomínio fechado', 'Próximo ao metrô',
]

const MSGS_POR_CAT = {
  alto_padrao:   ['Analisando o perfil de luxo...', 'Criando texto sofisticado...', 'Elaborando roteiro cinematográfico...', 'Refinando detalhes exclusivos...'],
  medio_padrao:  ['Analisando os pontos fortes...', 'Criando texto para Instagram...', 'Preparando mensagem de WhatsApp...', 'Quase pronto...'],
  popular_mcmv:  ['Pensando no sonho da casa própria...', 'Criando texto acolhedor...', 'Destacando FGTS e financiamento...', 'Finalizando...'],
  lancamento:    ['Analisando o potencial do lançamento...', 'Criando texto de urgência...', 'Elaborando estratégia de pré-venda...', 'Quase lá...'],
  em_construcao: ['Analisando o progresso da obra...', 'Criando conteúdo transparente...', 'Mostrando valorização...', 'Finalizando...'],
}

const FORMAT_GROUPS = [
  {
    id: 'banners',
    nome: 'Banners',
    icon: '🖼️',
    grid: 'grid-cols-2 sm:grid-cols-5',
    cor: { sel: 'border-primary-400 bg-primary-50 text-primary-800', check: 'border-primary-500 bg-primary-500', btn: 'text-primary-600 hover:bg-primary-50', count: 'text-primary-600' },
    items: [
      { id: '74097a36-5b5d-434a-8db7-4038e4c76f55', nome: 'SC_Banner_Luxo_01',     desc: 'Ideal para portais e Google Ads' },
      { id: 'a637acac-6a7b-42f8-b7d8-e25361eff207', nome: 'SC_Banner_Popular_01',  desc: 'Ideal para portais e Facebook' },
      { id: '7ab695ae-e12b-4322-87dc-eb085760dd01', nome: 'Real Estate Banner',    desc: 'Banner completo com features' },
      { id: 'b0438295-5282-4a5e-b4eb-4fcd3d8d287b', nome: 'Real Estate Card',      desc: 'Card para portais' },
      { id: 'f6054e9d-0d28-40b2-81a9-21d291a9897b', nome: 'Real Estate Detailed',  desc: 'Banner detalhado' },
      { id: '96a25196-5a64-4f65-9b3e-c9c8b0d871f2', nome: 'Triple Slide Carousel', desc: 'Carrossel Instagram' },
      { id: 'ad9f8382-ea38-4ef6-84cc-049f1b289345', nome: 'New Listing Story',     desc: 'Story novo lançamento' },
      { id: '7fc36174-64a6-4dbb-bb92-bb957471577e', nome: 'Photo Montage',         desc: 'Montagem de fotos' },
      { id: '3d72b111-76a7-4c7d-a594-1f75f70be2d2', nome: 'Polaroid Photos',       desc: 'Estilo polaroid diferenciado' },
      { id: '792ad84a-0ab8-4e6c-bda1-400fe9c040cc', nome: 'Animated Review',       desc: 'Review animado' },
    ],
  },
  {
    id: 'videos',
    nome: 'Vídeos',
    icon: '🎬',
    grid: 'grid-cols-2 sm:grid-cols-4',
    cor: { sel: 'border-purple-400 bg-purple-50 text-purple-800', check: 'border-purple-500 bg-purple-500', btn: 'text-purple-600 hover:bg-purple-50', count: 'text-purple-600' },
    items: [
      { id: '13696443-a295-4019-802b-d504e9d3c2ac', nome: 'SC_Video_Cinematic_01',     desc: 'Vídeo cinematic para Reels e TikTok' },
      { id: 'd8310f54-5c9d-4606-ae6a-dacb8c4455ae', nome: 'SC_Reels_Moderno_01',       desc: 'Reels moderno para Instagram' },
      { id: '13008c2d-9e7e-4515-a2ac-649c9ea18409', nome: 'SC_Story_Premium_01',       desc: 'Story premium com CTA' },
      { id: 'c5338ec4-1f93-476a-a81c-ff0e7f2e91cf', nome: 'Real Estate Video Montage', desc: 'Montagem de vídeo profissional' },
    ],
  },
]

const TEXT_FORMATS_FIXOS = [
  { nome: 'Instagram',           desc: 'Legenda + hashtags' },
  { nome: 'WhatsApp',            desc: 'Mensagem completa' },
  { nome: 'Facebook',            desc: 'Texto do post' },
  { nome: 'TikTok',              desc: 'Roteiro cena a cena' },
  { nome: 'LinkedIn',            desc: 'Texto profissional' },
  { nome: 'YouTube',             desc: 'Título + descrição' },
  { nome: 'PDF Catálogo',        desc: 'Ficha completa do imóvel' },
  { nome: 'Roteiro de Locução',  desc: 'Script para narração' },
  { nome: 'Público Google Ads',  desc: 'Segmentação + palavras-chave' },
]

const initFormatosSel = () => {
  const m = {}
  FORMAT_GROUPS.forEach(g => { m[g.id] = new Set() })
  return m
}

const DIAS_SEMANA = [
  { id: 'seg', nome: 'Seg', label: 'Segunda' }, { id: 'ter', nome: 'Ter', label: 'Terça' },
  { id: 'qua', nome: 'Qua', label: 'Quarta' },  { id: 'qui', nome: 'Qui', label: 'Quinta' },
  { id: 'sex', nome: 'Sex', label: 'Sexta' },   { id: 'sab', nome: 'Sáb', label: 'Sábado' },
  { id: 'dom', nome: 'Dom', label: 'Domingo' },
]

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTES — FORMULÁRIO
// ═══════════════════════════════════════════════════════════════

function Counter({ label, value, onChange, max = 9 }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-bold">−</button>
        <span className="w-6 text-center text-base font-bold text-gray-900">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-bold">+</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTE — POPUP DE AGENDAMENTO
// ═══════════════════════════════════════════════════════════════

const PECAS_AGENDA = [
  { id: 'ig_feed',    nome: 'Instagram Feed',    icon: '📸' },
  { id: 'ig_stories', nome: 'Instagram Stories', icon: '📱' },
  { id: 'fb_feed',    nome: 'Facebook Feed',      icon: '👍' },
  { id: 'whatsapp',   nome: 'Mensagem WhatsApp',  icon: '💬' },
  { id: 'tiktok',     nome: 'TikTok / Reels',    icon: '🎵' },
  { id: 'linkedin',   nome: 'LinkedIn',           icon: '💼' },
  { id: 'portal_zap', nome: 'ZAP Imóveis',        icon: '🏠' },
]

function AgendamentoPopup({ titulo, onClose }) {
  const [diasSel, setDiasSel] = useState(new Set(['seg', 'qua', 'sex']))
  const [horario, setHorario] = useState('10:00')
  const [cronograma, setCronograma] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const toggleDia = (id) => setDiasSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const gerar = () => {
    const dias = DIAS_SEMANA.filter(d => diasSel.has(d.id))
    const resultado = dias.map((dia, i) => ({
      dia: dia.label,
      horario,
      peca: PECAS_AGENDA[i % PECAS_AGENDA.length],
    }))
    setCronograma(resultado)
  }

  const copiarTexto = async () => {
    if (!cronograma) return
    const txt = cronograma.map(c => `${c.dia} às ${c.horario} — ${c.peca.icon} ${c.peca.nome}`).join('\n')
    await navigator.clipboard.writeText(`📅 CRONOGRAMA — ${titulo}\n\n${txt}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const baixarIcs = () => {
    if (!cronograma) return
    const hoje = new Date()
    const proximaSegunda = new Date(hoje)
    const diasParaSeg = (8 - hoje.getDay()) % 7 || 7
    proximaSegunda.setDate(hoje.getDate() + diasParaSeg)

    const diasMap = { seg: 0, ter: 1, qua: 2, qui: 3, sex: 4, sab: 5, dom: 6 }
    const [h, m] = horario.split(':').map(Number)

    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SmartCorretorAI//PT\r\n'
    cronograma.forEach(({ dia, peca }) => {
      const diaObj = DIAS_SEMANA.find(d => d.label === dia)
      if (!diaObj) return
      const offset = diasMap[diaObj.id]
      const dt = new Date(proximaSegunda)
      dt.setDate(proximaSegunda.getDate() + offset)
      dt.setHours(h, m, 0, 0)
      const dtEnd = new Date(dt); dtEnd.setMinutes(dt.getMinutes() + 30)
      const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      ics += `BEGIN:VEVENT\r\nDTSTART:${fmt(dt)}\r\nDTEND:${fmt(dtEnd)}\r\nSUMMARY:${peca.icon} ${peca.nome} — ${titulo}\r\nDESCRIPTION:Publicar conteúdo gerado pelo SmartCorretorAI\r\nEND:VEVENT\r\n`
    })
    ics += 'END:VCALENDAR'

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'cronograma-publicacao.ics' })
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Agendar distribuição 📅</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Quer que eu distribua essas peças ao longo da semana?
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        {!cronograma ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Dias da semana</label>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS_SEMANA.map(d => (
                  <button key={d.id} type="button" onClick={() => toggleDia(d.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      diasSel.has(d.id) ? 'gradient-primary text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {d.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Horário de publicação</label>
              <div className="flex gap-2 flex-wrap">
                {['08:00', '10:00', '12:00', '18:00', '19:00', '20:00'].map(h => (
                  <button key={h} type="button" onClick={() => setHorario(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      horario === h ? 'gradient-primary text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {h}
                  </button>
                ))}
                <input type="time" value={horario} onChange={e => setHorario(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Agora não
              </button>
              <button onClick={gerar} disabled={diasSel.size === 0}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" /> Criar cronograma
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 mb-5">
              {cronograma.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c.peca.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{c.peca.nome}</p>
                      <p className="text-xs text-gray-500">{c.dia}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full">
                    {c.horario}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={copiarTexto}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
                {copiado ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
              </button>
              <button onClick={baixarIcs}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
                <Download className="w-3.5 h-3.5" />Baixar .ics
              </button>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />Pronto
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTES — RESULTADO VISUAL
// ═══════════════════════════════════════════════════════════════

function AnimatedCard({ delay = 0, children }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div className={`transition-all duration-700 ease-out ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
      {children}
    </div>
  )
}

function HashtagCloud({ text }) {
  const [count, setCount] = useState(0)
  const tags = (text || '').split(/\s+/).filter(t => t.startsWith('#'))
  useEffect(() => {
    if (!tags.length) return
    let i = 0
    const iv = setInterval(() => { i++; setCount(i); if (i >= tags.length) clearInterval(iv) }, 90)
    return () => clearInterval(iv)
  }, [text]) // eslint-disable-line
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {tags.map((tag, i) => (
        <span key={i} className={`transition-all duration-300 text-xs px-2.5 py-1 rounded-full font-medium bg-primary-100 text-primary-700 ${i < count ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          {tag}
        </span>
      ))}
    </div>
  )
}

function TikTokPlayer({ roteiro }) {
  const cenas = (roteiro || '').split(/\n+/).filter(c => c.trim()).slice(0, 10)
  const [idx, setIdx] = useState(0)
  const [show, setShow] = useState(true)
  const [playing, setPlaying] = useState(true)

  const goTo = useCallback((nextIdx) => {
    setShow(false)
    setTimeout(() => { setIdx((nextIdx + cenas.length) % cenas.length); setShow(true) }, 350)
  }, [cenas.length])

  useEffect(() => {
    if (!playing || cenas.length <= 1) return
    const iv = setInterval(() => goTo(idx + 1), 3800)
    return () => clearInterval(iv)
  }, [playing, idx, goTo, cenas.length])

  return (
    <div className="mx-auto relative rounded-3xl overflow-hidden shadow-2xl border border-white/10"
         style={{ width: '200px', aspectRatio: '9/16', background: 'linear-gradient(135deg, #1a0533, #0d0d0d, #1a0533)' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-transparent to-pink-900/30" />
      <div className="absolute top-4 left-3 right-3 flex gap-0.5">
        {cenas.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/25 overflow-hidden">
            <div className={`h-full rounded-full bg-white transition-all duration-500 ${i < idx ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-3 top-1/3 bottom-24 flex items-center justify-center text-center">
        <p className={`text-white text-xs font-semibold leading-relaxed transition-all duration-350 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
           style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          {cenas[idx] || ''}
        </p>
      </div>
      <div className="absolute right-2.5 bottom-28 flex flex-col gap-3.5 items-center">
        {[['❤️', '2,3k'], ['💬', '84'], ['↗️', '412']].map(([icon, count]) => (
          <div key={icon} className="flex flex-col items-center gap-0.5">
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-white/70 text-xs">{count}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-5 left-3 right-12 flex items-center justify-center gap-2.5">
        <button onClick={() => goTo(idx - 1)} className="w-7 h-7 bg-white/15 rounded-full text-white text-xs flex items-center justify-center hover:bg-white/25">⏮</button>
        <button onClick={() => setPlaying(p => !p)} className="w-9 h-9 bg-white/25 rounded-full text-white text-sm flex items-center justify-center hover:bg-white/35">
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => goTo(idx + 1)} className="w-7 h-7 bg-white/15 rounded-full text-white text-xs flex items-center justify-center hover:bg-white/25">⏭</button>
      </div>
      <div className="absolute top-8 right-3 text-white/50 text-xs">{idx + 1}/{cenas.length}</div>
    </div>
  )
}

function InstagramFeedCard({ dados, gradiente }) {
  return (
    <div className="max-w-xs mx-auto rounded-2xl overflow-hidden shadow-xl border border-gray-100">
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradiente} flex items-center justify-center text-lg`}>🏠</div>
        <div className="flex-1"><p className="text-sm font-semibold text-gray-900">seu.perfil</p><p className="text-xs text-gray-400">Patrocinado</p></div>
        <span className="text-gray-400 text-lg font-bold">···</span>
      </div>
      <div className={`aspect-square bg-gradient-to-br ${gradiente} flex flex-col items-center justify-center p-6 text-white text-center`}>
        <span className="text-7xl mb-3">🏠</span>
        <p className="text-base font-bold uppercase tracking-wide">Imóvel à Venda</p>
        <p className="text-xs text-white/70 mt-1">Deslize para mais →</p>
      </div>
      <div className="px-4 py-2.5 bg-white flex justify-between">
        <div className="flex gap-3 text-2xl">❤️ 💬 📤</div>
        <span className="text-2xl">🔖</span>
      </div>
      <div className="px-4 pb-4 bg-white">
        <p className="text-xs font-semibold text-gray-900 mb-1">seu.perfil</p>
        <p className="text-xs text-gray-800 leading-relaxed">{dados.legenda}</p>
        {dados.cta && <p className="text-xs font-semibold text-primary-600 mt-2">👉 {dados.cta}</p>}
      </div>
    </div>
  )
}

function StoriesCard({ dados, gradiente }) {
  return (
    <div className="mx-auto relative rounded-3xl overflow-hidden shadow-xl" style={{ width: '175px', aspectRatio: '9/16' }}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradiente}`}>
        <div className="absolute top-3 left-3 right-3 flex gap-1">
          {[1,2,3].map(i => <div key={i} className={`h-0.5 flex-1 rounded-full ${i===1?'bg-white':'bg-white/35'}`} />)}
        </div>
        <div className="absolute top-7 left-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-xs">🏠</div>
          <span className="text-white text-xs font-bold">seu.perfil</span>
        </div>
        <div className="absolute inset-x-4 top-[35%] text-center">
          <p className="text-white text-xs font-bold leading-relaxed" style={{ textShadow:'0 1px 4px rgba(0,0,0,0.6)' }}>
            {dados.texto_principal}
          </p>
        </div>
        <div className="absolute bottom-8 left-3 right-3">
          <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-full py-2 text-center">
            <span className="text-white text-xs font-bold">↑ {dados.cta || 'Ver mais'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function WhatsAppCard({ dados }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl max-w-xs mx-auto">
      <div className="bg-green-600 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🏠</div>
        <div><p className="text-white text-sm font-bold">Corretor</p><p className="text-green-200 text-xs">online agora ●</p></div>
      </div>
      <div className="bg-[#e5ddd5] p-4 flex justify-end">
        <div className="bg-[#dcf8c6] rounded-tl-2xl rounded-tr-none rounded-br-2xl rounded-bl-2xl max-w-[90%] px-4 py-3 shadow-sm">
          <p className="text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">{dados.mensagem}</p>
          <div className="flex justify-end items-center gap-1 mt-1.5">
            <span className="text-gray-400 text-xs">18:42</span>
            <span className="text-blue-400 text-sm">✓✓</span>
          </div>
        </div>
      </div>
      <div className="bg-[#e5ddd5] pb-4 flex justify-center">
        <div className="bg-white rounded-full px-5 py-2 text-xs text-gray-500 shadow-sm">📎  Enviar mensagem</div>
      </div>
    </div>
  )
}

function FacebookCard({ dados }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl max-w-xs mx-auto bg-white border border-gray-200">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xl">🏠</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Seu Perfil Imóveis</p>
          <p className="text-xs text-gray-400">Agora · 🌐</p>
        </div>
        <span className="text-gray-400 font-bold">···</span>
      </div>
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-800 leading-relaxed">{dados.texto}</p>
        {dados.cta && <p className="text-xs text-blue-600 font-semibold mt-2">👉 {dados.cta}</p>}
      </div>
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 h-28 flex items-center justify-center">
        <span className="text-white text-5xl">🏠</span>
      </div>
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-400">
        <div>👍❤️😍 <span className="ml-1">1,2 mil</span></div>
        <div className="flex gap-3"><span>84 comentários</span><span>320 compart.</span></div>
      </div>
      <div className="border-t border-gray-100 px-4 py-2 flex justify-around">
        {['👍 Curtir', '💬 Comentar', '↗️ Compartilhar'].map(a => (
          <button key={a} className="text-xs text-gray-600 font-medium">{a}</button>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

async function resizeFoto(file, maxPx = 900) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve({ dados: canvas.toDataURL('image/jpeg', 0.78).split(',')[1], tipo: 'image/jpeg' })
    }
    img.src = url
  })
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function NovaCampanha() {
  const { user: authedUser, session: authedSession, loading: authLoading } = useAuth()
  const [fase, setFase] = useState('form')

  const [categoria, setCategoria] = useState(null)
  const [tipo, setTipo] = useState('')
  const [finalidade, setFinalidade] = useState('Venda')
  const [quartos, setQuartos] = useState(2)
  const [banheiros, setBanheiros] = useState(1)
  const [vagas, setVagas] = useState(1)
  const [area, setArea] = useState('')
  const [preco, setPreco] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cidades, setCidades] = useState([])
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [diferenciais, setDiferenciais] = useState([])
  const [difCustom, setDifCustom] = useState('')
  const [fotos, setFotos] = useState([])
  const [telefone, setTelefone] = useState('')

  const [msgIdx, setMsgIdx] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [campanhaId, setCampanhaId] = useState(null)
  const [copiadoId, setCopiadoId] = useState(null)
  const [igConectado, setIgConectado] = useState(false)
  const [postando, setPostando] = useState(false)
  const [igPostado, setIgPostado] = useState(false)
  const pollRef = useRef(null)
  const fileRef = useRef(null)

  const [formatosSel, setFormatosSel] = useState(initFormatosSel)
  const [showAgendamento, setShowAgendamento] = useState(false)

  const [renders, setRenders] = useState(null)
  const [gerandoBanners, setGerandoBanners] = useState(false)
  const renderPollRef = useRef(null)

  const toggleFormato = (groupId, itemId) => setFormatosSel(prev => {
    const s = new Set(prev[groupId]); s.has(itemId) ? s.delete(itemId) : s.add(itemId)
    return { ...prev, [groupId]: s }
  })
  const toggleGrupo = (groupId) => setFormatosSel(prev => {
    const group = FORMAT_GROUPS.find(g => g.id === groupId)
    const all = group.items.map(i => i.id)
    const allSel = all.every(id => prev[groupId].has(id))
    return { ...prev, [groupId]: allSel ? new Set() : new Set(all) }
  })
  const selecionarTudo = () => {
    const m = {}
    FORMAT_GROUPS.forEach(g => { m[g.id] = new Set(g.items.map(i => i.id)) })
    setFormatosSel(m)
  }

  const [creditos, setCreditos] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    setIgConectado(false)
    setCreditos({
      plano: 'starter',
      limite_mensal: 5,
      restantes_mes: 5,
      creditos_avulsos: 0,
      total_disponivel: 5,
    })
  }, [])

  const catAtual = CATEGORIAS.find(c => c.id === categoria)
  const msgs = MSGS_POR_CAT[categoria] || MSGS_POR_CAT.medio_padrao

  useEffect(() => {
    if (fase !== 'gerando') return
    const iv = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 2500)
    return () => clearInterval(iv)
  }, [fase, msgs.length])

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(renderPollRef.current) }, [])

  // Carrega cidades do IBGE quando o estado muda
  useEffect(() => {
    if (!estado) {
      setCidades([])
      setCarregandoCidades(false)
      return
    }
    let abortado = false
    setCarregandoCidades(true)
    setCidade('') // reseta cidade ao trocar UF
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('IBGE ' + r.status)))
      .then(arr => {
        if (abortado) return
        const nomes = Array.isArray(arr) ? arr.map(m => m?.nome).filter(Boolean) : []
        nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'))
        setCidades(nomes)
      })
      .catch(err => {
        if (abortado) return
        console.error('[IBGE] falha ao carregar municípios:', err)
        setCidades([])
      })
      .finally(() => {
        if (!abortado) setCarregandoCidades(false)
      })
    return () => { abortado = true }
  }, [estado])

  const handleFotos = async (files) => {
    const novos = Array.from(files).slice(0, 4 - fotos.length)
    const processadas = await Promise.all(novos.map(async f => ({
      preview: URL.createObjectURL(f),
      ...(await resizeFoto(f)),
    })))
    setFotos(prev => [...prev, ...processadas].slice(0, 4))
  }

  const removerFoto = (idx) => setFotos(prev => prev.filter((_, i) => i !== idx))

  const toggleDif = (d) => setDiferenciais(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const adicionarDifCustom = () => {
    const v = difCustom.trim()
    if (v && !diferenciais.includes(v)) { setDiferenciais(prev => [...prev, v]); setDifCustom('') }
  }

  const podaGerar = categoria && tipo && bairro.trim() && cidade.trim() && estado && preco

  const confirmarGeracao = () => {
    if (!podaGerar) { toast.error('Preencha os campos obrigatórios'); return }
    setShowConfirm(true)
  }

  // ══════════════════════════════════════════════════════════
  //  GERAÇÃO — CORRIGIDA
  //  Upload de fotos não trava mais o processo.
  //  Se falhar, continua sem fotos e avisa o usuário.
  // ══════════════════════════════════════════════════════════
  const gerarAnuncios = async () => {
    setShowConfirm(false)
    setFase('gerando')
    setMsgIdx(0)

    try {
      console.log('[gerarAnuncios] iniciado | authedUser.id =', authedUser?.id)

      const todosDisferenciais = [
        ...diferenciais,
        ...(difCustom.trim() ? [difCustom.trim()] : []),
      ]

      // Verificação de autenticação — TUDO do AuthContext, ZERO chamadas a
      // supabase.auth.* aqui. O onAuthStateChange já mantém session/user
      // atualizados; o cliente supabase usa o JWT da sua sessão interna em
      // todas as chamadas (storage, edge functions) automaticamente.
      if (authLoading) {
        toast.error('Aguarde — carregando sessão...')
        setFase('form')
        return
      }
      const userId = authedUser?.id
      if (!userId || !authedSession?.access_token) {
        toast.error('Sua sessão expirou. Faça login novamente para continuar.')
        setFase('form')
        return
      }
      console.log('[gerarAnuncios] sessão OK via contexto', { userId, hasToken: !!authedSession.access_token })

      // ── Upload das fotos: sequencial, timeout 120s por tentativa, retry 1x ──
      // Cada foto tem até 2 tentativas; se ambas falharem/expirarem, segue sem ela.
      // invoke da Edge Function é OBRIGATÓRIO — uploads não podem bloquear o fluxo.
      const uploadComTimeout = (path, blob, contentType, ms = 120000) =>
        Promise.race([
          supabase.storage
            .from('smartcorretor-assets')
            .upload(path, blob, { contentType, upsert: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`upload timeout ${ms}ms`)), ms)),
        ])

      const fotos_urls = []
      console.log('[gerarAnuncios] iniciando upload de', fotos.length, 'fotos')
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i]
        const bin = Uint8Array.from(atob(f.dados), (c) => c.charCodeAt(0))
        const blob = new Blob([bin], { type: f.tipo })
        const path = `${userId}/campaigns/${Date.now()}_${i}.jpg`
        let url = null
        for (let tentativa = 1; tentativa <= 2; tentativa++) {
          try {
            const { error: upErr } = await uploadComTimeout(path, blob, f.tipo)
            if (upErr) {
              console.error(`[upload] foto ${i + 1} tentativa ${tentativa} falhou:`, upErr.message)
              continue
            }
            const { data: pub } = supabase.storage
              .from('smartcorretor-assets')
              .getPublicUrl(path)
            url = pub.publicUrl
            console.log('[upload] OK foto', i + 1, tentativa > 1 ? `(tentativa ${tentativa})` : '')
            break
          } catch (uploadErr) {
            console.error(`[upload] foto ${i + 1} tentativa ${tentativa} erro/timeout:`, uploadErr)
          }
        }
        if (url) fotos_urls.push(url)
      }
      console.log('[gerarAnuncios] fim do upload loop. fotos_urls:', fotos_urls.length)

      // ── Disparar gerar-campanha E gerar-banners EM PARALELO (mesmo clique) ──
      console.log('[gerarAnuncios] >>> DISPARANDO invoke(gerar-campanha) + invoke(gerar-banners) em paralelo')

      // Inputs derivados do formulário para o gerar-banners (não dependem do AI ainda)
      const enderecoCompleto = [bairro, cidade].filter(Boolean).join(', ')
        + (estado ? ` - ${estado}` : '')
      const tituloPreliminar = `${tipo || 'Imóvel'} ${quartos ? quartos + 'q ' : ''}em ${bairro || cidade || ''}`.trim()
      const descricaoPreliminar = [
        `${tipo || 'Imóvel'} ${categoria ? '(' + categoria + ')' : ''}`,
        `${quartos} quarto${quartos !== 1 ? 's' : ''}, ${banheiros} banheiro${banheiros !== 1 ? 's' : ''}, ${vagas} vaga${vagas !== 1 ? 's' : ''}`,
        area ? `${area}m²` : '',
        enderecoCompleto,
        todosDisferenciais.length ? `Diferenciais: ${todosDisferenciais.join(', ')}` : '',
      ].filter(Boolean).join('. ')

      setGerandoBanners(true)
      setRenders(null)

      const [campaignResult, bannersResult] = await Promise.allSettled([
        supabase.functions.invoke('gerar-campanha', {
          body: {
            user_id: userId,
            categoria,
            tipo,
            dados: {
              finalidade, quartos, banheiros, vagas,
              area: area || null, preco, bairro, cidade, estado,
              diferenciais: todosDisferenciais,
              telefone_contato: telefone,
              formatos_selecionados: Object.fromEntries(
                Object.entries(formatosSel).map(([gId, s]) => [gId, [...s]])
              ),
            },
            fotos_urls,
            redes_sociais: ['instagram_feed', 'instagram_stories', 'whatsapp', 'facebook', 'tiktok'],
          },
        }),
        supabase.functions.invoke('gerar-banners', {
          body: {
            // campaign_id é opcional agora; vamos linkar depois
            user_id: userId,
            fotos_urls,
            titulo: tituloPreliminar,
            descricao: descricaoPreliminar,
            preco,
            endereco: enderecoCompleto,
            tipo_imovel: tipo,
            corretor_nome: authedUser?.displayName || authedUser?.full_name || authedUser?.nome || authedUser?.email?.split('@')[0] || '',
            marca_imovel: authedUser?.imobiliaria || authedUser?.marca || authedUser?.nome_imobiliaria || '',
          },
        }),
      ])

      console.log('[gerarAnuncios] resultados paralelos:', { campaignResult, bannersResult })

      // ── Processar resultado da CAMPANHA (textos) ──
      if (campaignResult.status === 'rejected') {
        const err = campaignResult.reason
        try {
          const errBody = await err?.context?.json?.()
          throw new Error(errBody?.error || err?.message || 'Erro ao gerar campanha')
        } catch {
          throw err
        }
      }
      const { data, error } = campaignResult.value
      if (error) {
        try {
          const errBody = await error.context?.json?.()
          throw new Error(errBody?.error || error.message || 'Erro desconhecido')
        } catch {
          throw error
        }
      }
      if (!data) throw new Error('Resposta vazia da Edge Function (gerar-campanha)')

      const camp = data.campanha
      if (!camp) throw new Error('Dados da campanha não retornados: ' + JSON.stringify(data))

      setResultado(camp)
      setCampanhaId(camp.id)
      setIgPostado(false)
      setFase('resultado')

      // ── Processar resultado dos BANNERS (renders) ──
      if (bannersResult.status === 'fulfilled') {
        const { data: bData, error: bError } = bannersResult.value
        if (bError) {
          console.error('[gerar-banners] erro:', bError)
          toast.error('Falha ao gerar banners (textos OK)')
        } else if (bData?.renders?.length) {
          const rs = bData.renders
          setRenders(rs)
          if (bData.warning) toast(bData.warning, { icon: '⚠️' })
          toast.success(`${rs.length} render${rs.length > 1 ? 's' : ''} disparado${rs.length > 1 ? 's' : ''}. Processando...`)
          iniciarPollingRenders(rs)
          // Linkar renders à campanha recém-criada (gerar-banners rodou sem campaign_id)
          supabase
            .from('campaigns')
            .update({ banners: rs })
            .eq('id', camp.id)
            .then(({ error: updErr }) => {
              if (updErr) console.warn('[link banners] falhou:', updErr.message)
            })
        } else {
          console.warn('[gerar-banners] sem renders no retorno', bData)
        }
      } else {
        console.error('[gerar-banners] rejeitado:', bannersResult.reason)
        toast.error('Falha ao gerar banners (textos OK)')
      }

      setGerandoBanners(false)
      setTimeout(() => setShowAgendamento(true), 1800)

    } catch (err) {
      console.error('[gerarAnuncios] erro:', err)
      toast.error(err.message || 'Erro ao gerar campanha')
      setGerandoBanners(false)
      setFase('form')
    }
  }

  const copiar = async (texto, id) => {
    await navigator.clipboard.writeText(texto)
    setCopiadoId(id); toast.success('Copiado!')
    setTimeout(() => setCopiadoId(null), 2000)
  }
  const abrirWhatsApp = (texto) => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')

  const baixarTudo = () => {
    if (!resultado?.textos_gerados) return
    const REDES = { instagram_feed: ['📸 INSTAGRAM FEED', 'legenda'], instagram_stories: ['📱 STORIES', 'texto_principal'], whatsapp: ['💬 WHATSAPP', 'mensagem'], facebook: ['👍 FACEBOOK', 'texto'], tiktok: ['🎵 TIKTOK / REELS', 'roteiro'], youtube: ['▶️ YOUTUBE', 'descricao'], linkedin: ['💼 LINKEDIN', 'texto'] }
    let txt = `✅ ANÚNCIOS — ${resultado.titulo}\n${catAtual ? `📂 ${catAtual.nome}\n` : ''}${'─'.repeat(50)}\n\n`
    Object.entries(resultado.textos_gerados).forEach(([rede, dados]) => {
      const [label, campo] = REDES[rede] || ['', 'texto']
      txt += `${label}\n${'─'.repeat(30)}\n${dados[campo] || Object.values(dados)[0] || ''}\n`
      if (dados.hashtags) txt += '\n' + dados.hashtags + '\n'
      txt += '\n\n'
    })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })), download: `anuncios-${resultado.titulo?.replace(/\s+/g, '-').toLowerCase() || 'imovel'}.txt` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const postarNoInstagram = async () => {
    toast('Publicação no Instagram chega em breve.', { icon: '🚧' })
  }

  // Chave Creatomate para polling direto de status no browser.
  // Conforme instruído. Idealmente moveríamos para uma Edge Function proxy.
  const CREATOMATE_API_KEY = '0283795cc6344e2989c19f28f2080624b6ed357a3aa123df81b11dd3d26aea542c4eae9ed5963b58a8db867e02e45bc4'

  const iniciarPollingRenders = (iniciais) => {
    clearInterval(renderPollRef.current)
    let current = [...iniciais]

    const finalizado = (r) => !r.render_id || r.status === 'succeeded' || r.status === 'failed'

    if (current.every(finalizado)) return

    renderPollRef.current = setInterval(async () => {
      try {
        const atualizados = await Promise.all(current.map(async (r) => {
          if (finalizado(r)) return r
          try {
            const res = await fetch(`https://api.creatomate.com/v1/renders/${r.render_id}`, {
              headers: { Authorization: `Bearer ${CREATOMATE_API_KEY}` },
            })
            if (!res.ok) return r
            const body = await res.json()
            return {
              ...r,
              status: body.status || r.status,
              url: body.url || r.url || null,
              snapshot_url: body.snapshot_url || r.snapshot_url || null,
            }
          } catch (err) {
            console.error('[polling] erro em render', r.render_id, err)
            return r
          }
        }))
        current = atualizados
        setRenders(atualizados)
        if (atualizados.every(finalizado)) {
          clearInterval(renderPollRef.current)
          renderPollRef.current = null
          const sucesso = atualizados.filter(r => r.status === 'succeeded').length
          if (sucesso > 0) toast.success(`${sucesso} arquivo${sucesso > 1 ? 's' : ''} pronto${sucesso > 1 ? 's' : ''} para download`)
        }
      } catch (err) {
        console.error('[polling renders] erro geral:', err)
      }
    }, 5000)
  }

  const gerarBanners = async () => {
    if (!campanhaId) return toast.error('Campanha não encontrada — gere os textos primeiro')
    if (gerandoBanners) return

    setGerandoBanners(true)
    setRenders(null)

    try {
      const fotos_urls = resultado?.dados_imovel?.fotos_urls
        || resultado?.fotos_urls
        || []

      const enderecoCompleto = [bairro, cidade].filter(Boolean).join(', ')
        + (estado ? ` - ${estado}` : '')

      const descricaoCurta = resultado?.textos_gerados?.descricao_portal
        || resultado?.textos_gerados?.post_instagram
        || resultado?.textos_gerados?.mensagem_whatsapp
        || ''

      const { data, error } = await supabase.functions.invoke('gerar-banners', {
        body: {
          campaign_id: campanhaId,
          fotos_urls,
          titulo: resultado?.titulo || resultado?.textos_gerados?.titulo_campanha || '',
          descricao: descricaoCurta,
          preco,
          endereco: enderecoCompleto,
          tipo_imovel: tipo,
          corretor_nome: authedUser?.displayName || authedUser?.full_name || authedUser?.nome || authedUser?.email?.split('@')[0] || '',
          marca_imovel: authedUser?.marca || authedUser?.imobiliaria || authedUser?.nome_imobiliaria || '',
        },
      })

      if (error) {
        try {
          const errBody = await error.context?.json?.()
          throw new Error(errBody?.error || error.message || 'Falha na Edge Function')
        } catch {
          throw error
        }
      }

      const rs = Array.isArray(data?.renders) ? data.renders : []
      if (rs.length === 0) throw new Error('Nenhum render foi disparado')

      setRenders(rs)
      if (data?.warning) toast(data.warning, { icon: '⚠️' })
      toast.success(`${rs.length} render${rs.length > 1 ? 's' : ''} disparado${rs.length > 1 ? 's' : ''}. Processando...`)

      iniciarPollingRenders(rs)
    } catch (err) {
      console.error('[gerarBanners] erro:', err)
      toast.error(err.message || 'Falha ao gerar banners')
    } finally {
      setGerandoBanners(false)
    }
  }

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div>
      <Header title="Criar anúncios" subtitle="Preencha os dados básicos e a IA gera tudo" />
      <div className="p-6 max-w-3xl mx-auto">

        {showConfirm && creditos && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Confirmar geração</h3>
                  <p className="text-xs text-gray-500">
                    Você está prestes a usar <strong>1 anúncio</strong>
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Plano <span className="font-semibold capitalize">{creditos.plano}</span> · este mês</span>
                  <span className={`font-bold ${creditos.restantes_mes > 0 ? 'text-primary-700' : 'text-gray-400'}`}>
                    {creditos.restantes_mes} anúncio{creditos.restantes_mes !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${Math.min(100, (creditos.restantes_mes / creditos.limite_mensal) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Anúncios avulsos <span className="text-xs text-gray-400">(não expiram)</span></span>
                  <span className={`font-bold ${creditos.creditos_avulsos > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {creditos.creditos_avulsos}
                  </span>
                </div>
              </div>

              {creditos.total_disponivel > 0 && (
                <div className="p-3 bg-primary-50 rounded-xl text-xs text-primary-800 font-medium mb-4">
                  Após esta geração você terá{' '}
                  <strong>{creditos.total_disponivel - 1} anúncio{creditos.total_disponivel - 1 !== 1 ? 's' : ''} restante{creditos.total_disponivel - 1 !== 1 ? 's' : ''}</strong>.
                </div>
              )}

              {creditos.total_disponivel === 0 && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-700 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Você não tem anúncios disponíveis. Faça upgrade do plano ou compre anúncios avulsos.</span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={gerarAnuncios} disabled={creditos.total_disponivel === 0}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Gerar agora
                </button>
              </div>
            </div>
          </div>
        )}

        {showAgendamento && resultado && (
          <AgendamentoPopup titulo={resultado.titulo} onClose={() => setShowAgendamento(false)} />
        )}

        {fase === 'form' && (
          <div className="space-y-5 animate-fade-in">

            <div className="card p-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">Tipo do imóvel <span className="text-red-400">*</span></h2>
              <p className="text-xs text-gray-500 mb-4">Cada tipo gera texto, tom e roteiro de vídeo completamente diferentes</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CATEGORIAS.map(cat => (
                  <button key={cat.id} type="button" onClick={() => setCategoria(cat.id)}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-center transition-all duration-200 ${
                      categoria === cat.id
                        ? `border-transparent bg-gradient-to-br ${cat.cor} text-white shadow-lg scale-[1.04] ring-2 ring-offset-2 ${cat.ring}`
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}>
                    <span className="text-2xl leading-none">{cat.icon}</span>
                    <span className="text-xs font-bold leading-tight">{cat.nome}</span>
                    <span className={`text-xs leading-tight hidden sm:block ${categoria === cat.id ? 'text-white/80' : 'text-gray-400'}`}>{cat.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-6 space-y-5">
              <h2 className="text-base font-bold text-gray-900">Dados do imóvel</h2>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map(t => (
                    <button key={t} type="button" onClick={() => setTipo(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${tipo === t ? 'gradient-primary text-white border-transparent shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Finalidade <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  {['Venda', 'Aluguel', 'Temporada'].map(f => (
                    <button key={f} type="button" onClick={() => setFinalidade(f)}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-all ${finalidade === f ? 'gradient-primary text-white border-transparent shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Quantidade</label>
                <div className="flex gap-6 flex-wrap">
                  <Counter label="Quartos" value={quartos} onChange={setQuartos} />
                  <Counter label="Banheiros" value={banheiros} onChange={setBanheiros} />
                  <Counter label="Vagas" value={vagas} onChange={setVagas} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Estado <span className="text-red-400">*</span></label>
                  <select value={estado} onChange={e => setEstado(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white">
                    <option value="">UF</option>
                    {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cidade <span className="text-red-400">*</span></label>
                  <select value={cidade} onChange={e => setCidade(e.target.value)}
                    disabled={!estado || carregandoCidades}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white disabled:bg-gray-50 disabled:text-gray-400">
                    <option value="">
                      {!estado ? 'Selecione o estado primeiro' : carregandoCidades ? 'Carregando cidades...' : 'Selecione a cidade'}
                    </option>
                    {cidades.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bairro <span className="text-red-400">*</span></label>
                  <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Moema, Jardins, Copacabana"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Preço (R$) <span className="text-red-400">*</span></label>
                  <input value={preco} onChange={e => setPreco(e.target.value)} type="number" placeholder="Ex: 1200000"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Área (m²) <span className="text-gray-400 font-normal">opcional</span></label>
                  <input value={area} onChange={e => setArea(e.target.value)} type="number" placeholder="Ex: 110"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Diferenciais e comodidades</label>
                <div className="flex flex-wrap gap-2">
                  {DIFERENCIAIS_PRESET.map(d => (
                    <button key={d} type="button" onClick={() => toggleDif(d)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${diferenciais.includes(d) ? 'gradient-primary text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={difCustom} onChange={e => setDifCustom(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarDifCustom())}
                    placeholder="Outro diferencial... (Enter para adicionar)"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
                  <button type="button" onClick={adicionarDifCustom}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors">
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-gray-900">Fotos do imóvel</h2>
                <span className="text-xs text-gray-400 font-medium">{fotos.length}/4 fotos</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                A IA analisa as fotos e descreve os ambientes automaticamente nos textos
              </p>

              {fotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={f.preview} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removerFoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {fotos.length < 4 && (
                <div onClick={() => fileRef.current.click()} onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFotos(e.dataTransfer.files) }}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-all">
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleFotos(e.target.files)} />
                  <Camera className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Clique ou arraste as fotos aqui</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG · até 4 fotos</p>
                </div>
              )}
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-gray-900">Formatos de conteúdo</h2>
                <button type="button" onClick={selecionarTudo}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
                  Selecionar tudo
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-5">
                Independente da seleção, sempre é consumido <strong>1 anúncio</strong> do seu plano.
              </p>

              <div className="space-y-5">
                {FORMAT_GROUPS.map(grupo => {
                  const sel = formatosSel[grupo.id]
                  const allSel = grupo.items.every(i => sel.has(i.id))
                  return (
                    <div key={grupo.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{grupo.icon} {grupo.nome}</span>
                          <span className={`text-xs font-medium ${grupo.cor.count}`}>{sel.size}/{grupo.items.length}</span>
                        </div>
                        <button type="button" onClick={() => toggleGrupo(grupo.id)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${grupo.cor.btn}`}>
                          {allSel ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                      </div>
                      <div className={`${grupo.grid || 'grid-cols-2 sm:grid-cols-4'} grid gap-2`}>
                        {grupo.items.map(item => (
                          <button key={item.id} type="button" onClick={() => toggleFormato(grupo.id, item.id)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                              sel.has(item.id) ? grupo.cor.sel : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                              sel.has(item.id) ? grupo.cor.check : 'border-gray-300 bg-white'
                            }`}>
                              {sel.has(item.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{item.nome}</p>
                              <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-gray-800">📝 Textos, PDF e Segmentação</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">sempre incluídos</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TEXT_FORMATS_FIXOS.map(f => (
                      <div key={f.nome} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-green-900">{f.nome}</p>
                          <p className="text-xs text-green-700">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Seu WhatsApp <span className="text-gray-400 font-normal">(opcional — aparece nos textos)</span>
                </label>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} type="tel" placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
              </div>

              <button onClick={confirmarGeracao} disabled={!podaGerar}
                className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all ${
                  podaGerar ? 'gradient-primary text-white shadow-lg shadow-primary-500/30 hover:opacity-90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                <Sparkles className="w-5 h-5" />
                Gerar anúncios agora
              </button>

              {creditos && creditos.total_disponivel > 0 && (
                <p className="text-center text-xs text-gray-500">
                  Você está usando <strong>1 anúncio</strong> —{' '}
                  <span className={creditos.total_disponivel <= 3 ? 'text-amber-600 font-semibold' : ''}>
                    {creditos.total_disponivel - 1} anúncio{creditos.total_disponivel - 1 !== 1 ? 's' : ''} restante{creditos.total_disponivel - 1 !== 1 ? 's' : ''} após esta geração
                  </span>
                </p>
              )}

              {creditos && creditos.total_disponivel === 0 && (
                <p className="text-center text-xs text-red-500 font-medium">
                  Sem anúncios disponíveis · <a href="/planos" className="underline">Ver planos</a>
                </p>
              )}

              {!podaGerar && (
                <p className="text-center text-xs text-amber-600 font-medium">
                  Preencha: tipo do imóvel · bairro · cidade · preço
                </p>
              )}
            </div>
          </div>
        )}

        {fase === 'gerando' && (
          <div className="card p-14 text-center animate-fade-in">
            <div className={`w-24 h-24 bg-gradient-to-br ${catAtual?.cor || 'from-primary-500 to-primary-400'} rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-2xl`}>
              <span className="text-5xl">{catAtual?.icon || '✨'}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Criando seus anúncios...</h2>
            <p className="text-primary-600 font-semibold text-lg min-h-[28px]" key={msgIdx}>{msgs[msgIdx]}</p>
            <p className="text-gray-400 text-sm mt-3">A IA está pesquisando o bairro e criando textos personalizados</p>
            <div className="mt-8 flex justify-center gap-2">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          </div>
        )}

        {fase === 'resultado' && resultado && (() => {
          const tg = resultado.textos_gerados || {}
          const grad = catAtual?.cor || 'from-primary-500 to-primary-400'

          const textosEdge = [
            { key: 'titulo_campanha',         icon: '🏷️', titulo: 'Título da Campanha' },
            { key: 'descricao_portal',        icon: '🏠', titulo: 'Descrição para Portal' },
            { key: 'post_instagram',          icon: '📸', titulo: 'Post Instagram' },
            { key: 'script_video_reels',      icon: '🎬', titulo: 'Script Vídeo / Reels' },
            { key: 'carrossel_passo_a_passo', icon: '🎠', titulo: 'Carrossel Passo a Passo' },
            { key: 'mensagem_whatsapp',       icon: '💬', titulo: 'Mensagem WhatsApp' },
          ]
          const getTextoEdge = (k) => {
            const v = resultado[k] ?? tg[k]
            if (v == null) return ''
            if (Array.isArray(v)) {
              return v
                .map((item) => `📍 ${typeof item === 'string' ? item : JSON.stringify(item)}`)
                .join('\n')
            }
            return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
          }

          return (
            <div className="space-y-6">

              <AnimatedCard delay={0}>
                <div className="card p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-gray-900 text-xl">Anúncios prontos! 🎉</h2>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-gray-500">{resultado.titulo}</p>
                          {catAtual && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${catAtual.badge}`}>{catAtual.icon} {catAtual.nome}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={baixarTudo}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      <Download className="w-4 h-4" />
                      Baixar tudo em .txt
                    </button>
                  </div>
                </div>
              </AnimatedCard>

              {textosEdge.map((item, idx) => {
                const conteudo = getTextoEdge(item.key)
                if (!conteudo) return null
                const copyId = `edge_${item.key}`
                return (
                  <AnimatedCard key={item.key} delay={100 + idx * 100}>
                    <div className="card p-5">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{item.icon}</span>
                          <h3 className="font-bold text-gray-900 text-lg">{item.titulo}</h3>
                        </div>
                        <button onClick={() => copiar(conteudo, copyId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === copyId ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                        {conteudo}
                      </div>
                    </div>
                  </AnimatedCard>
                )
              })}

              {tg.instagram_feed && (
                <AnimatedCard delay={300}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">📸</span><h3 className="font-bold text-gray-900 text-lg">Instagram Feed</h3></div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => copiar([tg.instagram_feed.legenda, tg.instagram_feed.hashtags, tg.instagram_feed.cta ? `👉 ${tg.instagram_feed.cta}` : ''].filter(Boolean).join('\n\n'), 'ig_feed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === 'ig_feed' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                        <button onClick={() => abrirWhatsApp([tg.instagram_feed.legenda, tg.instagram_feed.hashtags].filter(Boolean).join('\n\n'))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600">
                          <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                        </button>
                      </div>
                    </div>
                    <InstagramFeedCard dados={tg.instagram_feed} gradiente={grad} />
                    <HashtagCloud text={tg.instagram_feed.hashtags} />
                  </div>
                </AnimatedCard>
              )}

              {tg.instagram_stories && (
                <AnimatedCard delay={600}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">📱</span><h3 className="font-bold text-gray-900 text-lg">Instagram Stories</h3></div>
                      <button onClick={() => copiar([tg.instagram_stories.texto_principal, tg.instagram_stories.cta].filter(Boolean).join('\n\n'), 'stories')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        {copiadoId === 'stories' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                      </button>
                    </div>
                    <StoriesCard dados={tg.instagram_stories} gradiente={grad} />
                  </div>
                </AnimatedCard>
              )}

              {tg.whatsapp && (
                <AnimatedCard delay={900}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">💬</span><h3 className="font-bold text-gray-900 text-lg">WhatsApp</h3></div>
                      <div className="flex gap-2">
                        <button onClick={() => copiar(tg.whatsapp.mensagem, 'wa')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === 'wa' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                        <button onClick={() => abrirWhatsApp(tg.whatsapp.mensagem)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600">
                          <MessageCircle className="w-3.5 h-3.5" />Enviar agora
                        </button>
                      </div>
                    </div>
                    <WhatsAppCard dados={tg.whatsapp} />
                  </div>
                </AnimatedCard>
              )}

              {tg.facebook && (
                <AnimatedCard delay={1200}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">👍</span><h3 className="font-bold text-gray-900 text-lg">Facebook</h3></div>
                      <div className="flex gap-2">
                        <button onClick={() => copiar([tg.facebook.texto, tg.facebook.cta ? `👉 ${tg.facebook.cta}` : ''].filter(Boolean).join('\n\n'), 'fb')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === 'fb' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                        <button onClick={() => abrirWhatsApp([tg.facebook.texto, tg.facebook.cta].filter(Boolean).join('\n\n'))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600">
                          <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                        </button>
                      </div>
                    </div>
                    <FacebookCard dados={tg.facebook} />
                  </div>
                </AnimatedCard>
              )}

              {tg.tiktok && (
                <AnimatedCard delay={1500}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2"><span className="text-2xl">🎵</span><h3 className="font-bold text-gray-900 text-lg">TikTok / Reels</h3><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">▶ Automático</span></div>
                      <button onClick={() => copiar([tg.tiktok.roteiro, tg.tiktok.hashtags].filter(Boolean).join('\n\n'), 'tiktok')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        {copiadoId === 'tiktok' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar roteiro</>}
                      </button>
                    </div>
                    <TikTokPlayer roteiro={tg.tiktok.roteiro} />
                    <HashtagCloud text={tg.tiktok.hashtags} />
                  </div>
                </AnimatedCard>
              )}

              <AnimatedCard delay={2400}>
                <div className="card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shrink-0">
                      <span className="text-lg">🎨</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">Banners e Vídeos profissionais</h3>
                      <p className="text-xs text-gray-500">Gerados automaticamente com suas fotos e dados</p>
                    </div>
                  </div>
                  <button onClick={gerarBanners}
                    disabled={gerandoBanners || !!(renders && renders.length > 0)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
                    {gerandoBanners
                      ? <><span className="animate-spin">⏳</span> Disparando renders...</>
                      : renders && renders.length > 0
                        ? <><CheckCircle2 className="w-4 h-4" /> Renders disparados</>
                        : <><span>✨</span> Gerar banners e vídeos</>}
                  </button>
                </div>
              </AnimatedCard>

              {renders && renders.length > 0 && (
                <AnimatedCard delay={2700}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🖼️</span>
                        <h3 className="font-bold text-gray-900 text-lg">Banners e Vídeos</h3>
                      </div>
                      <span className="text-xs text-gray-500">
                        {renders.filter(r => r.status === 'succeeded').length}/{renders.length} prontos
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {renders.map((r, i) => {
                        const ok = r.status === 'succeeded'
                        const falhou = r.status === 'failed' || !!r.erro
                        const ehVideo = r.url && /\.(mp4|webm|mov)$/i.test(r.url)
                        return (
                          <div key={r.render_id || `r-${i}`} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white">
                            <div className="p-3 pb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-gray-700 truncate">{r.template_nome || 'Template'}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                ok ? 'bg-green-100 text-green-700'
                                  : falhou ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {ok ? 'pronto' : falhou ? 'falhou' : (r.status || 'processando')}
                              </span>
                            </div>
                            <div className="bg-gray-100 aspect-video flex items-center justify-center overflow-hidden">
                              {ok && ehVideo ? (
                                <video src={r.url} controls className="w-full h-full object-contain bg-black" />
                              ) : ok && r.url ? (
                                <img src={r.snapshot_url || r.url} alt={r.template_nome} className="w-full h-full object-contain" />
                              ) : r.snapshot_url ? (
                                <img src={r.snapshot_url} alt={r.template_nome} className="w-full h-full object-contain opacity-70" />
                              ) : (
                                <div className="text-xs text-gray-500 px-3 py-6 text-center">
                                  {falhou ? (r.erro || 'falhou') : 'Renderizando...'}
                                </div>
                              )}
                            </div>
                            <div className="p-3 pt-2">
                              {ok && r.url ? (
                                <a href={r.url} download target="_blank" rel="noopener noreferrer"
                                  className="block text-xs font-bold text-center py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                                  <Download className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                                  Download
                                </a>
                              ) : (
                                <div className="text-[11px] text-gray-400 text-center py-2">
                                  {falhou ? 'arquivo indisponível' : 'aguardando…'}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </AnimatedCard>
              )}

              <AnimatedCard delay={3000}>
                <div className="card p-5 text-center">
                  <p className="text-gray-500 text-sm mb-4">Quer criar anúncios para outro imóvel?</p>
                  <button
                    onClick={() => {
                      setFase('form'); setCategoria(null); setTipo(''); setFinalidade('Venda')
                      setQuartos(2); setBanheiros(1); setVagas(1); setArea(''); setPreco('')
                      setBairro(''); setCidade(''); setEstado(''); setDiferenciais([]); setFotos([]); setTelefone('')
                      setResultado(null); setCampanhaId(null); setIgPostado(false)
                      setFormatosSel(initFormatosSel()); setShowAgendamento(false)
                      setRenders(null); setGerandoBanners(false); clearInterval(renderPollRef.current)
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" />
                    Criar anúncio para outro imóvel
                  </button>
                </div>
              </AnimatedCard>

            </div>
          )
        })()}

      </div>
    </div>
  )
}
