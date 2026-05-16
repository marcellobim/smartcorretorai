import { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, MessageCircle, Copy, Download, CheckCircle2, Plus, Camera, X, Send, AlertCircle, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import api from '../services/api'

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
      { id: 'banner_principal', nome: 'Banner Principal',    desc: 'Foto · preço · m²' },
      { id: 'banner_dif1',      nome: 'Diferencial 1',       desc: 'Principal ponto forte' },
      { id: 'banner_dif2',      nome: 'Diferencial 2',       desc: 'Segundo ponto forte' },
      { id: 'stories_enquete',  nome: 'Stories Enquete',     desc: 'Você moraria aqui? Sim/Não' },
      { id: 'stories_contato',  nome: 'Stories Contato',     desc: 'Card WhatsApp direto' },
      { id: 'banner_feed',      nome: 'Feed Insta/Facebook', desc: 'Post quadrado para feed' },
      { id: 'banner_linkedin',  nome: 'LinkedIn',            desc: 'Perfil profissional' },
      { id: 'banner_google',    nome: 'Google Ads',          desc: 'Banner horizontal busca' },
      { id: 'banner_portal',    nome: 'Portal Imobiliário',  desc: 'Otimizado para busca' },
      { id: 'banner_whatsapp',  nome: 'WhatsApp Card',       desc: 'Envio direto' },
    ],
  },
  {
    id: 'videos',
    nome: 'Vídeos',
    icon: '🎬',
    grid: 'grid-cols-2 sm:grid-cols-4',
    cor: { sel: 'border-purple-400 bg-purple-50 text-purple-800', check: 'border-purple-500 bg-purple-500', btn: 'text-purple-600 hover:bg-purple-50', count: 'text-purple-600' },
    items: [
      { id: 'video_reels',   nome: 'Reels Descoberta', desc: 'Alcançar novos clientes' },
      { id: 'video_tiktok',  nome: 'TikTok Dinâmico',  desc: 'Tendência + viralização' },
      { id: 'video_stories', nome: 'Stories com CTA',  desc: 'Arraste para cima' },
      { id: 'video_feed',    nome: 'Feed Quadrado',    desc: 'Visualização rápida' },
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
            {/* Seleção de dias */}
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

            {/* Horário */}
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

      {/* Progress bars */}
      <div className="absolute top-4 left-3 right-3 flex gap-0.5">
        {cenas.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/25 overflow-hidden">
            <div className={`h-full rounded-full bg-white transition-all duration-500 ${i < idx ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>

      {/* Cena */}
      <div className="absolute inset-x-3 top-1/3 bottom-24 flex items-center justify-center text-center">
        <p className={`text-white text-xs font-semibold leading-relaxed transition-all duration-350 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
           style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          {cenas[idx] || ''}
        </p>
      </div>

      {/* Side actions */}
      <div className="absolute right-2.5 bottom-28 flex flex-col gap-3.5 items-center">
        {[['❤️', '2,3k'], ['💬', '84'], ['↗️', '412']].map(([icon, count]) => (
          <div key={icon} className="flex flex-col items-center gap-0.5">
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-white/70 text-xs">{count}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
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
  // Fases: 'form' | 'gerando' | 'resultado'
  const [fase, setFase] = useState('form')

  // Formulário
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
  const [diferenciais, setDiferenciais] = useState([])
  const [difCustom, setDifCustom] = useState('')
  const [fotos, setFotos] = useState([]) // { preview, dados, tipo }
  const [telefone, setTelefone] = useState('')

  // Geração
  const [msgIdx, setMsgIdx] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [campanhaId, setCampanhaId] = useState(null)
  const [copiadoId, setCopiadoId] = useState(null)
  const [igConectado, setIgConectado] = useState(false)
  const [postando, setPostando] = useState(false)
  const [igPostado, setIgPostado] = useState(false)
  const pollRef = useRef(null)
  const fileRef = useRef(null)

  // Seleção de formatos por grupo
  const [formatosSel, setFormatosSel] = useState(initFormatosSel)
  const [showAgendamento, setShowAgendamento] = useState(false)

  // Creatomate — geração de banners e vídeos
  const [renders, setRenders] = useState(null) // _renders do DB
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

  // Anúncios disponíveis e popup de confirmação
  const [creditos, setCreditos] = useState(null) // { plano, limite_mensal, restantes_mes, creditos_avulsos, total_disponivel }
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    api.get('/social/instagram/status')
      .then(d => setIgConectado(!!d?.conectado))
      .catch(() => {})
    api.get('/generate/credits')
      .then(d => setCreditos(d))
      .catch(() => {})
  }, [])

  const catAtual = CATEGORIAS.find(c => c.id === categoria)
  const msgs = MSGS_POR_CAT[categoria] || MSGS_POR_CAT.medio_padrao

  useEffect(() => {
    if (fase !== 'gerando') return
    const iv = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 2500)
    return () => clearInterval(iv)
  }, [fase, msgs.length])

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(renderPollRef.current) }, [])

  // ── Fotos ──
  const handleFotos = async (files) => {
    const novos = Array.from(files).slice(0, 4 - fotos.length)
    const processadas = await Promise.all(novos.map(async f => ({
      preview: URL.createObjectURL(f),
      ...(await resizeFoto(f)),
    })))
    setFotos(prev => [...prev, ...processadas].slice(0, 4))
  }

  const removerFoto = (idx) => setFotos(prev => prev.filter((_, i) => i !== idx))

  // ── Diferenciais ──
  const toggleDif = (d) => setDiferenciais(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const adicionarDifCustom = () => {
    const v = difCustom.trim()
    if (v && !diferenciais.includes(v)) { setDiferenciais(prev => [...prev, v]); setDifCustom('') }
  }

  // ── Validação ──
  const podaGerar = categoria && tipo && bairro.trim() && cidade.trim() && preco

  // ── Abre popup de confirmação ──
  const confirmarGeracao = () => {
    if (!podaGerar) { toast.error('Preencha os campos obrigatórios'); return }
    
    // Validar se pelo menos um formato foi selecionado
    const totalSelecionados = Object.values(formatosSel).reduce((acc, set) => acc + set.size, 0)
    if (totalSelecionados === 0) {
      toast.error('Selecione pelo menos um formato para gerar sua campanha.')
      return
    }
    
    setShowConfirm(true)
  }

  // ── Geração real (chamada após confirmação) ──
  const gerarAnuncios = async () => {
    setShowConfirm(false)
    setFase('gerando')
    setMsgIdx(0)
    try {
      const todosDisferenciais = [
        ...diferenciais,
        ...(difCustom.trim() ? [difCustom.trim()] : []),
      ]
      const data = await api.post('/generate/campaign', {
        categoria, tipo, finalidade, quartos, banheiros, vagas,
        area: area || null, preco, bairro, cidade,
        diferenciais: todosDisferenciais,
        telefone_contato: telefone,
        fotos: fotos.map(f => ({ dados: f.dados, tipo: f.tipo })),
        redes_sociais: ['instagram_feed', 'instagram_stories', 'whatsapp', 'facebook', 'tiktok'],
        formatos_selecionados: Object.fromEntries(
          Object.entries(formatosSel).map(([gId, s]) => [gId, [...s]])
        ),
      })
      const id = data.campaign.id
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/generate/campaign/${id}/status`)
          const camp = res.campaign
          if (camp.status === 'concluido') {
            clearInterval(pollRef.current)
            setResultado(camp)
            setCampanhaId(camp.id)
            setIgPostado(false)
            setFase('resultado')
            api.get('/generate/credits').then(d => setCreditos(d)).catch(() => {})
            // Pergunta sobre agendamento após 1.8s (tempo das animações)
            setTimeout(() => setShowAgendamento(true), 1800)
          } else if (camp.status === 'erro') {
            clearInterval(pollRef.current)
            const errorMsg = camp.error_message || 'Ocorreu um erro ao gerar os anúncios. Tente novamente.'
            toast.error(errorMsg, { duration: 6000 })
            setFase('form')
          }
        } catch { /* ignora */ }
      }, 3000)
    } catch { setFase('form') }
  }

  // ── Copiar / WA / Download ──
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
    if (!campanhaId) return
    setPostando(true)
    try {
      await api.post('/social/instagram/post', { campaign_id: campanhaId })
      toast.success('Publicado no Instagram!')
      setIgPostado(true)
    } catch (err) {
      toast.error(err.message || 'Erro ao postar no Instagram')
    } finally {
      setPostando(false)
    }
  }

  // ── Gerar banners e vídeos via Creatomate ──
  const gerarBanners = async () => {
    if (!campanhaId || gerandoBanners) return
    setGerandoBanners(true)
    try {
      await api.post(`/render/campaign/${campanhaId}`, { fotos: fotos.map(f => ({ dados: f.dados, tipo: f.tipo })) })
      toast.success('Geração de banners iniciada!')
      renderPollRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/render/campaign/${campanhaId}/status`)
          const r = res.renders
          if (!r) return
          setRenders(r)
          const emAndamento = Object.values(r).some(x => x.status === 'planned' || x.status === 'rendering')
          if (!emAndamento) {
            clearInterval(renderPollRef.current)
            setGerandoBanners(false)
          }
        } catch { /* ignora */ }
      }, 6000)
    } catch (err) {
      toast.error(err.message || 'Erro ao iniciar geração de banners')
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

        {/* ═══ POPUP DE CONFIRMAÇÃO ═══ */}
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

              {/* Saldo atual */}
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

              {/* Aviso principal */}
              {creditos.total_disponivel > 0 && (
                <div className="p-3 bg-primary-50 rounded-xl text-xs text-primary-800 font-medium mb-4">
                  Após esta geração você terá{' '}
                  <strong>{creditos.total_disponivel - 1} anúncio{creditos.total_disponivel - 1 !== 1 ? 's' : ''} restante{creditos.total_disponivel - 1 !== 1 ? 's' : ''}</strong>.
                  {creditos.restantes_mes === 0 && creditos.creditos_avulsos > 0 && (
                    <span className="block mt-1 text-amber-700">
                      Seus anúncios mensais acabaram — será usado 1 anúncio avulso.
                    </span>
                  )}
                </div>
              )}

              {creditos.total_disponivel === 0 && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-700 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Você não tem anúncios disponíveis. Faça upgrade do plano ou compre anúncios avulsos.</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={gerarAnuncios}
                  disabled={creditos.total_disponivel === 0}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Gerar agora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ POPUP DE AGENDAMENTO ═══ */}
        {showAgendamento && resultado && (
          <AgendamentoPopup titulo={resultado.titulo} onClose={() => setShowAgendamento(false)} />
        )}

        {/* ═══ FORMULÁRIO ═══ */}
        {fase === 'form' && (
          <div className="space-y-5 animate-fade-in">

            {/* 1 · Categoria */}
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

            {/* 2 · Dados principais */}
            <div className="card p-6 space-y-5">
              <h2 className="text-base font-bold text-gray-900">Dados do imóvel</h2>

              {/* Tipo */}
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

              {/* Finalidade */}
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

              {/* Contadores */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Quantidade</label>
                <div className="flex gap-6 flex-wrap">
                  <Counter label="Quartos" value={quartos} onChange={setQuartos} />
                  <Counter label="Banheiros" value={banheiros} onChange={setBanheiros} />
                  <Counter label="Vagas" value={vagas} onChange={setVagas} />
                </div>
              </div>

              {/* Localização + Área */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bairro <span className="text-red-400">*</span></label>
                  <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Moema"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cidade <span className="text-red-400">*</span></label>
                  <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: São Paulo"
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

              {/* Diferenciais */}
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

            {/* 3 · Fotos */}
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

            {/* 4 · Formatos de conteúdo */}
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

                {/* Textos sempre incluídos */}
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

            {/* 5 · Contato + Botão */}
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

        {/* ═══ GERANDO ═══ */}
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

        {/* ═══ RESULTADO — SHOW VISUAL ═══ */}
        {fase === 'resultado' && resultado && (() => {
          const tg = resultado.textos_gerados || {}
          const grad = catAtual?.cor || 'from-primary-500 to-primary-400'

          return (
            <div className="space-y-6">

              {/* Header */}
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

              {/* Instagram Feed */}
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
                        {igConectado && (
                          <button onClick={postarNoInstagram} disabled={postando || igPostado}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60 ${
                              igPostado
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90'
                            }`}>
                            {igPostado ? <><CheckCircle2 className="w-3.5 h-3.5" />Publicado!</> : postando ? <>Publicando...</> : <><Send className="w-3.5 h-3.5" />Postar no Instagram</>}
                          </button>
                        )}
                      </div>
                    </div>
                    <InstagramFeedCard dados={tg.instagram_feed} gradiente={grad} />
                    <HashtagCloud text={tg.instagram_feed.hashtags} />
                  </div>
                </AnimatedCard>
              )}

              {/* Stories */}
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

              {/* WhatsApp */}
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

              {/* Facebook */}
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

              {/* TikTok / Reels */}
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

              {/* Portais Imobiliários */}
              {tg.portais && (
                <AnimatedCard delay={1800}>
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <span className="text-2xl">🏢</span>
                      <h3 className="font-bold text-gray-900 text-lg">Portais Imobiliários</h3>
                    </div>
                    <div className="space-y-4">
                      {[
                        { key: 'zap_imoveis',  nome: 'ZAP Imóveis', icon: '🏠', bg: 'bg-red-50',    border: 'border-red-200' },
                        { key: 'olx',          nome: 'OLX',         icon: '🔶', bg: 'bg-orange-50', border: 'border-orange-200' },
                        { key: 'vivareal',     nome: 'Viva Real',   icon: '🏡', bg: 'bg-blue-50',   border: 'border-blue-200' },
                        { key: 'imovelweb',    nome: 'ImovelWeb',   icon: '🌐', bg: 'bg-purple-50', border: 'border-purple-200' },
                      ].map(({ key, nome, icon, bg, border }) => {
                        const portal = tg.portais[key]
                        if (!portal) return null
                        return (
                          <div key={key} className={`rounded-xl border p-4 ${bg} ${border}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{icon}</span>
                                <span className="font-bold text-gray-900 text-sm">{nome}</span>
                              </div>
                              <button onClick={() => copiar([portal.titulo, portal.descricao].join('\n\n'), key)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50">
                                {copiadoId === key ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                              </button>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 mb-2">{portal.titulo}</p>
                            <p className="text-xs text-gray-600 leading-relaxed mb-3">{portal.descricao}</p>
                            {portal.destaques?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {portal.destaques.map((d, i) => (
                                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600">✓ {d}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </AnimatedCard>
              )}

              {/* PDF Catálogo */}
              {tg.catalogo_pdf && (
                <AnimatedCard delay={2100}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📄</span>
                        <h3 className="font-bold text-gray-900 text-lg">PDF Catálogo do Imóvel</h3>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => copiar([
                          tg.catalogo_pdf.titulo,
                          tg.catalogo_pdf.subtitulo,
                          '',
                          tg.catalogo_pdf.descricao_principal,
                          '',
                          'SOBRE O IMÓVEL',
                          tg.catalogo_pdf.sobre_o_imovel,
                          '',
                          'SOBRE O BAIRRO',
                          tg.catalogo_pdf.sobre_o_bairro,
                          '',
                          'PONTOS FORTES',
                          ...(tg.catalogo_pdf.pontos_fortes || []).map(p => `• ${p}`),
                          '',
                          tg.catalogo_pdf.cta,
                        ].filter(Boolean).join('\n'), 'catalogo')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          {copiadoId === 'catalogo' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
                        </button>
                        <button onClick={() => {
                          const w = window.open('', '_blank')
                          w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tg.catalogo_pdf.titulo}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;color:#1a1a1a}h1{font-size:24px;font-weight:700;margin-bottom:4px}h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin:20px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}.sub{color:#666;font-size:13px;margin-bottom:24px}p{font-size:13px;line-height:1.75;color:#333}.pontos{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.ponto{background:#f5f5f5;border-radius:999px;padding:4px 14px;font-size:12px}.cta{margin-top:28px;padding:14px;background:#eff6ff;border-radius:10px;text-align:center;font-weight:600;font-size:14px}@media print{body{margin:0}}</style></head><body><h1>${tg.catalogo_pdf.titulo}</h1><p class="sub">${tg.catalogo_pdf.subtitulo || ''}</p><p>${tg.catalogo_pdf.descricao_principal || ''}</p><h2>Sobre o Imóvel</h2><p>${tg.catalogo_pdf.sobre_o_imovel || ''}</p><h2>Sobre o Bairro</h2><p>${tg.catalogo_pdf.sobre_o_bairro || ''}</p><h2>Pontos Fortes</h2><div class="pontos">${(tg.catalogo_pdf.pontos_fortes || []).map(p => `<span class="ponto">✓ ${p}</span>`).join('')}</div><div class="cta">${tg.catalogo_pdf.cta || ''}</div><script>setTimeout(()=>window.print(),400)</script></body></html>`)
                          w.document.close()
                        }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium hover:opacity-90">
                          <Download className="w-3.5 h-3.5" />Baixar PDF
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
                      <div>
                        <h4 className="text-base font-bold text-gray-900">{tg.catalogo_pdf.titulo}</h4>
                        {tg.catalogo_pdf.subtitulo && <p className="text-sm text-gray-500 mt-0.5">{tg.catalogo_pdf.subtitulo}</p>}
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">{tg.catalogo_pdf.descricao_principal}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Sobre o Imóvel</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{tg.catalogo_pdf.sobre_o_imovel}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Sobre o Bairro</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{tg.catalogo_pdf.sobre_o_bairro}</p>
                        </div>
                      </div>
                      {tg.catalogo_pdf.pontos_fortes?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Pontos Fortes</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {tg.catalogo_pdf.pontos_fortes.map((p, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                                {p}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {tg.catalogo_pdf.cta && (
                        <div className="bg-primary-50 rounded-lg px-4 py-3 text-sm font-semibold text-primary-800 text-center">
                          {tg.catalogo_pdf.cta}
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedCard>
              )}

              {/* Roteiro de Locução */}
              {tg.roteiro_locucao && (
                <AnimatedCard delay={2400}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎙️</span>
                        <h3 className="font-bold text-gray-900 text-lg">Roteiro de Locução</h3>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">45-60 segundos</span>
                      </div>
                      <button onClick={() => copiar(tg.roteiro_locucao, 'locucao')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        {copiadoId === 'locucao' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar script</>}
                      </button>
                    </div>
                    <div className="bg-gray-900 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-gray-400 text-xs font-mono font-bold uppercase tracking-widest">Script · Locutor Profissional</span>
                      </div>
                      <pre className="text-gray-100 text-sm leading-relaxed font-mono whitespace-pre-wrap">{tg.roteiro_locucao}</pre>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      💡 [pausa] = momento para respirar · MAIÚSCULAS = ênfase na leitura · [respira] = pausa longa
                    </p>
                  </div>
                </AnimatedCard>
              )}

              {/* Google Ads */}
              {tg.google_ads && (
                <AnimatedCard delay={2700}>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        <h3 className="font-bold text-gray-900 text-lg">Público-alvo · Google Ads</h3>
                      </div>
                      <button onClick={() => copiar([
                        `PÚBLICO: ${tg.google_ads.publico_descricao}`,
                        `Faixa etária: ${tg.google_ads.faixa_etaria}`,
                        `Renda estimada: ${tg.google_ads.renda_estimada}`,
                        `Raio: ${tg.google_ads.raio_km}km`,
                        '',
                        `HEADLINE 1: ${tg.google_ads.headline1}`,
                        `HEADLINE 2: ${tg.google_ads.headline2}`,
                        `HEADLINE 3: ${tg.google_ads.headline3}`,
                        `DESCRIÇÃO 1: ${tg.google_ads.descricao1}`,
                        `DESCRIÇÃO 2: ${tg.google_ads.descricao2}`,
                        '',
                        'PALAVRAS-CHAVE:',
                        ...(tg.google_ads.palavras_chave || []),
                        '',
                        'INTERESSES:',
                        ...(tg.google_ads.interesses || []),
                      ].join('\n'), 'gads')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        {copiadoId === 'gads' ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar segmentação</>}
                      </button>
                    </div>

                    {/* Perfil do público */}
                    <div className="bg-blue-50 rounded-xl p-4 mb-4">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Perfil do Público</p>
                      <p className="text-sm text-blue-900 mb-3">{tg.google_ads.publico_descricao}</p>
                      <div className="flex flex-wrap gap-4">
                        <div><p className="text-xs text-blue-400">Faixa etária</p><p className="text-sm font-bold text-blue-800">{tg.google_ads.faixa_etaria}</p></div>
                        <div><p className="text-xs text-blue-400">Renda estimada</p><p className="text-sm font-bold text-blue-800">{tg.google_ads.renda_estimada}</p></div>
                        <div><p className="text-xs text-blue-400">Raio de alcance</p><p className="text-sm font-bold text-blue-800">{tg.google_ads.raio_km}km</p></div>
                      </div>
                    </div>

                    {/* Prévia do anúncio */}
                    <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-white">
                      <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-semibold">Prévia do anúncio</p>
                      <p className="text-xs text-green-700 mb-1">www.seusite.com.br/imoveis</p>
                      <p className="text-base font-bold text-blue-700 mb-1 leading-tight">
                        {[tg.google_ads.headline1, tg.google_ads.headline2, tg.google_ads.headline3].filter(Boolean).join(' | ')}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed">{tg.google_ads.descricao1}</p>
                      {tg.google_ads.descricao2 && <p className="text-xs text-gray-600 leading-relaxed">{tg.google_ads.descricao2}</p>}
                    </div>

                    {/* Keywords + Interesses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-2">Palavras-chave</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(tg.google_ads.palavras_chave || []).map((kw, i) => (
                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">{kw}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-2">Interesses do público</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(tg.google_ads.interesses || []).map((int, i) => (
                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">{int}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </AnimatedCard>
              )}

              {/* Banners e Vídeos Creatomate */}
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

                  {!renders && !gerandoBanners && (
                    <button onClick={gerarBanners}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md">
                      <span>✨</span> Gerar banners e vídeos
                    </button>
                  )}

                  {gerandoBanners && !renders && (
                    <div className="flex items-center justify-center gap-3 py-4">
                      <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">Iniciando geração...</span>
                    </div>
                  )}

                  {renders && (
                    <div className="space-y-2">
                      {Object.entries(renders).map(([key, r]) => {
                        const label = {
                          banner_luxo: 'Banner Luxo',
                          banner_popular: 'Banner Popular',
                          story_premium: 'Story Premium',
                          reels_moderno: 'Reels Moderno',
                          video_cinematico: 'Vídeo Cinematográfico',
                        }[key] || key

                        const isOk = r.status === 'succeeded'
                        const isFail = r.status === 'failed'
                        const isPending = !isOk && !isFail

                        return (
                          <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${isOk ? 'bg-green-100' : isFail ? 'bg-red-100' : 'bg-purple-100'}`}>
                              {isOk ? '✅' : isFail ? '❌' : '⏳'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900">{label}</p>
                              <p className="text-xs text-gray-400 capitalize">
                                {isOk ? 'Pronto' : isFail ? (r.error || 'Falhou') : 'Gerando...'}
                              </p>
                            </div>
                            {isOk && r.url && (
                              <a href={r.url} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-semibold text-purple-600 hover:text-purple-800 shrink-0">
                                Baixar
                              </a>
                            )}
                            {isOk && r.snapshot_url && (
                              <img src={r.snapshot_url} alt={label}
                                className="w-14 h-8 object-cover rounded-lg border border-gray-200 shrink-0" />
                            )}
                          </div>
                        )
                      })}

                      {gerandoBanners && (
                        <div className="flex items-center gap-2 pt-1">
                          <div className="w-3 h-3 border border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                          <span className="text-xs text-gray-400">Aguardando renders...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AnimatedCard>

              {/* Novo anúncio */}
              <AnimatedCard delay={3000}>
                <div className="card p-5 text-center">
                  <p className="text-gray-500 text-sm mb-4">Quer criar anúncios para outro imóvel?</p>
                  <button
                    onClick={() => {
                      setFase('form'); setCategoria(null); setTipo(''); setFinalidade('Venda')
                      setQuartos(2); setBanheiros(1); setVagas(1); setArea(''); setPreco('')
                      setBairro(''); setCidade(''); setDiferenciais([]); setFotos([]); setTelefone('')
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
