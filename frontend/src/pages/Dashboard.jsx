import { Link } from 'react-router-dom'
import { Building2, Sparkles, Package, TrendingUp, ArrowRight, Clock, Zap } from 'lucide-react'
import Header from '../components/layout/Header'
import { StatsCard } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth-context'
import { formatDateTime } from '../utils/formatters'

const recentActivity = [
  { id: 1, type: 'campanha', desc: 'Apartamento 3 quartos - Moema', time: new Date(Date.now() - 3600000) },
  { id: 2, type: 'imovel', desc: 'Casa em Condomínio - Alphaville', time: new Date(Date.now() - 7200000) },
  { id: 3, type: 'campanha', desc: 'Loft moderno - Vila Madalena', time: new Date(Date.now() - 86400000) },
]

const quickActions = [
  { to: '/nova-campanha', icon: Sparkles, label: 'Nova Campanha', desc: 'Crie seu marketing imobiliário completo', color: 'from-primary-500 to-primary-700' },
  { to: '/meus-imoveis', icon: Building2, label: 'Cadastrar Imóvel', desc: 'Adicione um novo imóvel para suas campanhas', color: 'from-blue-500 to-blue-700' },
  { to: '/pacotes-gerados', icon: Package, label: 'Ver Campanhas', desc: 'Acesse suas campanhas geradas', color: 'from-emerald-500 to-emerald-700' },
]

export default function Dashboard() {
  const { user, isPro } = useAuth()

  const firstName = user?.nome?.split(' ')[0] || 'Corretor'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-6 space-y-6">
        {/* Welcome */}
        <div className="gradient-hero rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">{greeting},</p>
              <h2 className="text-2xl font-bold mt-0.5">{firstName}! 👋</h2>
              <p className="text-white/70 text-sm mt-2">
                {isPro ? 'Plano Pro ativo — recursos ilimitados disponíveis.' : 'Você está no plano gratuito. Faça upgrade para desbloquear tudo.'}
              </p>
            </div>
            {!isPro && (
              <Link to="/planos" className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white text-sm font-semibold transition-colors">
                <Zap className="w-4 h-4 text-yellow-300" />
                Upgrade Pro
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Imóveis Cadastrados" value="12" change={8} icon={Building2} color="primary" />
          <StatsCard title="Campanhas Geradas" value="38" change={23} icon={Sparkles} color="orange" />
          <StatsCard title="Campanhas Baixadas" value="27" change={15} icon={Package} color="green" />
          <StatsCard title="Alcance Estimado" value="14.2k" change={31} icon={TrendingUp} color="blue" />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ações rápidas</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {quickActions.map(({ to, icon: Icon, label, desc, color }) => (
              <Link
                key={to}
                to={to}
                className="card p-5 hover:shadow-md transition-all duration-200 group"
              >
                <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-3 shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{label}</p>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
                <div className="flex items-center gap-1 mt-3 text-xs font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Acessar <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Atividade recente</h3>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="divide-y divide-gray-50">
              {recentActivity.map((item) => (
                <div key={item.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.type === 'campanha' ? 'bg-primary-50' : 'bg-blue-50'
                  }`}>
                    {item.type === 'campanha'
                      ? <Sparkles className="w-4 h-4 text-primary-600" />
                      : <Building2 className="w-4 h-4 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.desc}</p>
                    <p className="text-xs text-gray-400">
                      {item.type === 'campanha' ? 'Campanha gerada' : 'Imóvel cadastrado'} • {formatDateTime(item.time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-50">
              <Link to="/pacotes-gerados" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Ver tudo →
              </Link>
            </div>
          </div>

          {/* Dica do dia */}
          <div className="card overflow-hidden">
            <div className="gradient-primary p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-yellow-300" />
                <span className="font-semibold text-sm">Dica do dia</span>
              </div>
              <h3 className="font-bold text-lg leading-snug">
                Publique em 3 redes diferentes para alcançar 5x mais pessoas
              </h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">
                Imóveis publicados no Instagram, Facebook e WhatsApp simultaneamente geram em média 5x mais contatos do que publicações em apenas uma rede. Crie sua campanha e publique agora!
              </p>
              <Link to="/nova-campanha">
                <Button className="mt-4 w-full">
                  <Sparkles className="w-4 h-4" />
                  Gerar nova campanha
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
