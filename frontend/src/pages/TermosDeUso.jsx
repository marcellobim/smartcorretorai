import { Link } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">SmartCorretorAI</span>
          </div>
        </div>

        <div className="card p-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Termos de Uso</h1>
          <p className="text-sm text-gray-400 mb-8">Última atualização: maio de 2026</p>

          <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-600 leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">1. Aceitação dos Termos</h2>
              <p>Ao acessar ou utilizar a plataforma SmartCorretorAI ("Plataforma"), você ("Usuário") concorda com estes Termos de Uso. Se não concordar com qualquer parte destes termos, não utilize a Plataforma.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">2. Descrição do Serviço</h2>
              <p>A SmartCorretorAI é uma plataforma de inteligência artificial voltada para corretores de imóveis e imobiliárias, que gera automaticamente conteúdo de marketing imobiliário — incluindo textos para redes sociais, hashtags, roteiros para vídeos e materiais promocionais — a partir do cadastro de imóveis.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">3. Elegibilidade e Cadastro</h2>
              <p>Para utilizar a Plataforma, o Usuário deve:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Ter no mínimo 18 anos de idade;</li>
                <li>Fornecer informações verdadeiras, precisas e completas no cadastro;</li>
                <li>Manter seus dados de acesso em sigilo e não compartilhá-los com terceiros;</li>
                <li>Ser responsável por todas as atividades realizadas com sua conta.</li>
              </ul>
              <p className="mt-2">O Usuário é responsável pela veracidade das informações fornecidas. A SmartCorretorAI reserva-se o direito de suspender ou encerrar contas com informações falsas ou incompletas.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">4. Planos e Pagamentos</h2>
              <p>A Plataforma oferece planos pagos mensais e pacotes avulsos de anúncios. Ao contratar um plano:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Os anúncios mensais resetam no dia 1° de cada mês e não são acumulados;</li>
                <li>Anúncios avulsos não expiram e ficam disponíveis até serem utilizados;</li>
                <li>Os planos são intransferíveis e vinculados ao e-mail do titular;</li>
                <li>Múltiplos logins estão disponíveis apenas no plano Imobiliária;</li>
                <li>O cancelamento pode ser feito a qualquer momento, sem multa, com efeito ao final do período vigente;</li>
                <li>Não há reembolso proporcional por cancelamento antecipado, salvo disposição legal em contrário.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">5. Uso Adequado da Plataforma</h2>
              <p>O Usuário concorda em utilizar a Plataforma apenas para fins lícitos e de acordo com estes Termos. É vedado:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Utilizar a Plataforma para fins fraudulentos ou enganosos;</li>
                <li>Publicar informações falsas sobre imóveis;</li>
                <li>Tentar acessar sistemas ou dados de outros usuários;</li>
                <li>Realizar engenharia reversa ou copiar o código da Plataforma;</li>
                <li>Utilizar bots, scrapers ou automações não autorizadas;</li>
                <li>Violar direitos de propriedade intelectual de terceiros.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">6. Conteúdo Gerado por IA</h2>
              <p>Os textos, hashtags e roteiros gerados pela Plataforma são produzidos por inteligência artificial com base nas informações fornecidas pelo Usuário. A SmartCorretorAI não garante que o conteúdo gerado esteja isento de erros ou seja adequado para todos os contextos. O Usuário é responsável por revisar e validar o conteúdo antes de publicá-lo, especialmente no que se refere a:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Conformidade com o Código de Ética do CRECI e normas da profissão;</li>
                <li>Veracidade das informações sobre os imóveis anunciados;</li>
                <li>Adequação às normas do CONAR e legislação de publicidade vigente;</li>
                <li>Respeito aos direitos de imagem e privacidade de terceiros.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">7. Propriedade Intelectual</h2>
              <p>A Plataforma, seu código, design, marca e tecnologia são de propriedade exclusiva da SmartCorretorAI. O conteúdo gerado a partir dos dados do Usuário pertence ao Usuário, que concede à SmartCorretorAI licença limitada para processamento e melhoria do serviço.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">8. Limitação de Responsabilidade</h2>
              <p>A SmartCorretorAI não se responsabiliza por:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Resultados comerciais decorrentes do uso do conteúdo gerado;</li>
                <li>Falhas de conexão à internet ou indisponibilidade de terceiros (redes sociais, APIs);</li>
                <li>Uso indevido do conteúdo gerado pelo Usuário;</li>
                <li>Danos indiretos, lucros cessantes ou perdas de oportunidade.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">9. Modificações dos Termos</h2>
              <p>A SmartCorretorAI pode atualizar estes Termos a qualquer momento. Alterações relevantes serão comunicadas por e-mail ou notificação na Plataforma. O uso continuado após as alterações implica aceitação dos novos termos.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">10. Foro e Lei Aplicável</h2>
              <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes deste instrumento.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">11. Contato</h2>
              <p>Dúvidas sobre estes Termos podem ser enviadas para: <a href="mailto:contato@smartcorretorai.com.br" className="text-primary-600 hover:underline">contato@smartcorretorai.com.br</a></p>
            </section>

          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          © 2026 SmartCorretorAI · <Link to="/privacidade" className="hover:underline">Política de Privacidade</Link>
        </p>
      </div>
    </div>
  )
}
