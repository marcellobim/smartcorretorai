import { Link } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'

export default function Privacidade() {
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
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Política de Privacidade</h1>
          <p className="text-sm text-gray-400 mb-8">Última atualização: maio de 2026</p>

          <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-600 leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">1. Introdução</h2>
              <p>A SmartCorretorAI respeita a sua privacidade e está comprometida com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). Esta Política descreve como coletamos, usamos, armazenamos e protegemos suas informações.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">2. Dados que Coletamos</h2>
              <p>Coletamos os seguintes tipos de dados:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone e número de CRECI;</li>
                <li><strong>Dados de imóveis:</strong> endereço, características, fotos e informações inseridas pelo Usuário;</li>
                <li><strong>Dados de pagamento:</strong> processados por gateway seguro (Stripe) — não armazenamos dados de cartão;</li>
                <li><strong>Dados de uso:</strong> páginas acessadas, funcionalidades utilizadas, horários de acesso;</li>
                <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, dispositivo e sistema operacional;</li>
                <li><strong>Dados de redes sociais:</strong> quando o Usuário conecta sua conta do Instagram/Facebook, coletamos token de acesso, ID da página e dados necessários para publicação — nunca acessamos mensagens privadas, contatos ou dados além do escopo autorizado.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">3. Como Usamos seus Dados</h2>
              <p>Utilizamos seus dados para:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Criar e gerenciar sua conta na Plataforma;</li>
                <li>Gerar conteúdo de marketing com base nos imóveis cadastrados;</li>
                <li>Processar pagamentos e controlar o uso de créditos;</li>
                <li>Publicar conteúdo no Instagram e Facebook mediante autorização expressa do Usuário;</li>
                <li>Enviar comunicações sobre sua conta, atualizações e novidades;</li>
                <li>Melhorar continuamente os modelos de IA e a experiência do usuário;</li>
                <li>Cumprir obrigações legais e regulatórias.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">4. Integração com Meta (Facebook e Instagram)</h2>
              <p>A SmartCorretorAI utiliza a API oficial da Meta para publicação de conteúdo. Ao conectar sua conta:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Solicitamos apenas as permissões estritamente necessárias para publicação de posts e stories;</li>
                <li>Nunca acessamos mensagens privadas, lista de amigos, dados financeiros ou informações além do escopo autorizado;</li>
                <li>O token de acesso é armazenado de forma criptografada e usado exclusivamente para publicação autorizada pelo Usuário;</li>
                <li>Você pode revogar o acesso a qualquer momento nas configurações da sua conta Meta em <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">facebook.com/settings</a>;</li>
                <li>Cumprimos integralmente a <a href="https://developers.facebook.com/policy/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Política de Dados da Meta para Desenvolvedores</a> e os Termos de Serviço da Plataforma Meta.</li>
              </ul>
              <p className="mt-2">Os dados obtidos via API da Meta são usados exclusivamente para a funcionalidade de publicação e nunca são compartilhados com terceiros nem usados para fins publicitários.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">5. Integração com Google</h2>
              <p>Caso a Plataforma utilize serviços do Google (como Google Analytics ou Google Ads), informamos que:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Utilizamos Google Analytics para análise de uso da Plataforma de forma agregada e anonimizada;</li>
                <li>Não compartilhamos dados pessoais identificáveis com o Google além do necessário para funcionamento dos serviços;</li>
                <li>Cumprimos a <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Política de Privacidade do Google</a>;</li>
                <li>Você pode optar por não ser rastreado pelo Google Analytics instalando o <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">complemento de desativação</a>.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">6. Compartilhamento de Dados</h2>
              <p>Não vendemos seus dados. Podemos compartilhá-los apenas com:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Stripe:</strong> processamento de pagamentos;</li>
                <li><strong>Supabase:</strong> armazenamento seguro de dados;</li>
                <li><strong>Anthropic (Claude):</strong> geração de conteúdo por IA;</li>
                <li><strong>Meta (Instagram/Facebook):</strong> publicação de conteúdo autorizada pelo Usuário;</li>
                <li><strong>Google:</strong> analytics e serviços de infraestrutura;</li>
                <li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>
              </ul>
              <p className="mt-2">Todos os parceiros seguem padrões rigorosos de segurança e privacidade.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">7. Armazenamento e Segurança</h2>
              <p>Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS) e em repouso. Adotamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">8. Retenção de Dados</h2>
              <p>Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Dados de cadastro são excluídos em até 90 dias;</li>
                <li>Dados financeiros são mantidos por 5 anos para fins fiscais e legais;</li>
                <li>Logs de acesso são mantidos por 6 meses conforme Marco Civil da Internet;</li>
                <li>Tokens de acesso de redes sociais são revogados e excluídos imediatamente.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">9. Seus Direitos (LGPD)</h2>
              <p>Como titular dos dados, você tem direito a:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Confirmar a existência de tratamento de seus dados;</li>
                <li>Acessar seus dados pessoais;</li>
                <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
                <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                <li>Portabilidade dos dados a outro fornecedor;</li>
                <li>Revogar o consentimento a qualquer momento;</li>
                <li>Opor-se ao tratamento em caso de descumprimento da LGPD.</li>
              </ul>
              <p className="mt-2">Para exercer seus direitos, entre em contato: <a href="mailto:privacidade@smartcorretorai.com.br" className="text-primary-600 hover:underline">privacidade@smartcorretorai.com.br</a></p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">10. Exclusão de Dados</h2>
              <p>Você pode solicitar a exclusão completa dos seus dados a qualquer momento. Para isso:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Acesse Configurações → Conta → Excluir conta; ou</li>
                <li>Envie e-mail para <a href="mailto:privacidade@smartcorretorai.com.br" className="text-primary-600 hover:underline">privacidade@smartcorretorai.com.br</a> com o assunto "Exclusão de Dados".</li>
              </ul>
              <p className="mt-2">Processaremos sua solicitação em até 15 dias úteis. Esta funcionalidade atende aos requisitos da Meta para apps que utilizam Login com Facebook.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">11. Cookies</h2>
              <p>Utilizamos cookies essenciais para funcionamento da Plataforma e cookies analíticos para entender como os usuários interagem com o serviço. Você pode desativar cookies nas configurações do seu navegador, mas isso pode afetar algumas funcionalidades.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">12. Menores de Idade</h2>
              <p>A Plataforma não é destinada a menores de 18 anos. Não coletamos conscientemente dados de menores. Caso identifiquemos tal situação, a conta será imediatamente encerrada.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">13. Alterações nesta Política</h2>
              <p>Podemos atualizar esta Política periodicamente. Alterações significativas serão comunicadas por e-mail ou notificação na Plataforma com antecedência mínima de 15 dias.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">14. Contato e DPO</h2>
              <p>Para questões sobre privacidade e proteção de dados:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>E-mail geral: <a href="mailto:contato@smartcorretorai.com.br" className="text-primary-600 hover:underline">contato@smartcorretorai.com.br</a></li>
                <li>E-mail privacidade: <a href="mailto:privacidade@smartcorretorai.com.br" className="text-primary-600 hover:underline">privacidade@smartcorretorai.com.br</a></li>
              </ul>
            </section>

          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          © 2026 SmartCorretorAI · <Link to="/termos" className="hover:underline">Termos de Uso</Link>
        </p>
      </div>
    </div>
  )
}
