import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BrandMark from '../components/brand/BrandMark'

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <BrandMark size={28} decorative />
            <span className="font-bold text-gray-900">SmartCorretorAI</span>
          </div>
        </div>

        <div className="card p-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Política de Privacidade</h1>
          <p className="text-sm text-gray-400 mb-8">Última atualização: agosto de 2026</p>

          <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">1. Introdução</h2>
              <p>
                A SmartCorretorAI respeita a sua privacidade e trata dados pessoais conforme a Lei Geral de Proteção
                de Dados (LGPD). Esta Política explica quais dados coletamos, como usamos, com quem podemos compartilhar
                e quais direitos você possui.
              </p>
              <p className="mt-2">
                Ao criar conta, usar a Plataforma, gerar campanhas, contratar planos ou comprar Smart Tokens, você declara
                ciência e concordância com esta Política e com os Termos de Uso.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">2. Dados que Coletamos</h2>
              <p>Podemos coletar os seguintes dados:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, WhatsApp, CRECI, estado e dados de login;</li>
                <li><strong>Autenticação com Google, quando escolhida:</strong> identificador da conta, e-mail e seu estado de verificação, nome e foto de perfil quando disponibilizados pelo Google;</li>
                <li><strong>Dados de perfil profissional:</strong> nome profissional, telefone, WhatsApp, CRECI, estado, empresa, logotipo, foto e preferências de marca;</li>
                <li><strong>Dados de imóveis:</strong> tipo, finalidade, preço, endereço, bairro, cidade, características, diferenciais e descrição;</li>
                <li><strong>Fotos e arquivos:</strong> imagens do imóvel, fachada, áreas internas, lazer, planta, bairro e materiais enviados pelo usuário;</li>
                <li><strong>Dados de geração:</strong> campanhas criadas, formatos escolhidos, Smart Tokens, histórico de uso e resultados produzidos;</li>
                <li><strong>Dados de pagamento:</strong> informações necessárias para cobrança, processadas por gateway seguro;</li>
                <li><strong>Dados técnicos e de segurança:</strong> IP, navegador, dispositivo, sistema operacional, logs, horários de uso e dados necessários à autenticação, prevenção de abuso e proteção da conta;</li>
                <li><strong>Dados de depoimentos:</strong> texto enviado voluntariamente, profissão informada, consentimentos de publicação e identificação e registros de análise da campanha.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">3. Como Usamos os Dados</h2>
              <p>Utilizamos seus dados para:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>criar, autenticar e proteger sua conta;</li>
                <li>gerar campanhas imobiliárias, textos, imagens, banners, vídeos e materiais promocionais;</li>
                <li>personalizar conteúdos com dados reais do imóvel e do corretor;</li>
                <li>calcular, exibir e controlar planos, Smart Tokens, recargas e consumo;</li>
                <li>processar pagamentos, renovações, cancelamentos e suporte financeiro;</li>
                <li>melhorar a Plataforma, corrigir erros e prevenir fraudes;</li>
                <li>enviar comunicações sobre conta, suporte, segurança, produto e novidades;</li>
                <li>receber, analisar e, quando autorizado, publicar depoimentos de usuários;</li>
                <li>cumprir obrigações legais, regulatórias e ordens de autoridades competentes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">4. Uso de Dados para Geração por IA</h2>
              <p>
                Para gerar campanhas, a Plataforma pode processar dados do imóvel, fotos, localização, preço,
                características, informações do corretor e preferências de comunicação por meio de provedores de
                inteligência artificial, automação de mídia, renderização, armazenamento e infraestrutura.
              </p>
              <p className="mt-2">
                Conteúdos gerados por inteligência artificial podem conter imprecisões, interpretações incorretas,
                omissões ou informações desatualizadas.
              </p>
              <p className="mt-2">
                Esses provedores podem atuar como operadores ou subprocessadores para executar e proteger os serviços
                necessários à geração, conforme contratos e políticas aplicáveis.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">5. Informações de Mercado e Ferramentas de Apoio</h2>
              <p>
                A SmartCorretorAI pode utilizar dados públicos, pesquisas automatizadas, inteligência artificial e
                ferramentas de apoio para enriquecer campanhas com contexto, referências comerciais e informações de
                mercado.
              </p>
              <p className="mt-2">
                Essas informações têm caráter informativo e não substituem PTAM, laudo, avaliação profissional,
                análise jurídica, análise documental ou validação por especialista. O usuário deve validar as
                informações antes de usar os materiais em atendimento, divulgação ou negociação.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">6. Uso Promocional de Materiais Gerados</h2>
              <p>
                A SmartCorretorAI poderá utilizar exemplos de campanhas, artes, imagens geradas, layouts, textos e
                materiais produzidos pela Plataforma para demonstração, portfólio, divulgação, treinamento comercial e
                propaganda da própria plataforma.
              </p>
              <p className="mt-2">
                Sempre que aplicável, a SmartCorretorAI buscará preservar a identidade do usuário. Materiais com nome,
                telefone, e-mail, CRECI, endereço específico, imagem pessoal, logotipo ou identidade visual do usuário
                deverão ser anonimizados, mascarados ou usados mediante autorização específica antes de divulgação
                promocional pública.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">7. Compartilhamento de Dados</h2>
              <p>Não vendemos seus dados pessoais. Podemos compartilhar dados apenas quando necessário com:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Supabase:</strong> autenticação, banco de dados, armazenamento e infraestrutura;</li>
                <li><strong>Google OAuth:</strong> autenticação opcional da conta, sem acesso a Gmail, Drive, contatos ou Calendar;</li>
                <li><strong>Stripe ou gateways de pagamento:</strong> processamento de pagamentos, assinaturas e recargas;</li>
                <li><strong>provedores de inteligência artificial:</strong> geração de textos, imagens, vídeos e outros materiais solicitados;</li>
                <li><strong>provedores de renderização e mídia:</strong> criação de banners, vídeos e arquivos finais;</li>
                <li><strong>provedores de hospedagem, e-mail, segurança e suporte:</strong> operação da Plataforma, comunicações transacionais, prevenção de abuso e atendimento;</li>
                <li><strong>autoridades públicas:</strong> quando exigido por lei, ordem judicial ou obrigação regulatória.</li>
              </ul>
              <p className="mt-2">
                Buscamos trabalhar com parceiros que adotam medidas adequadas de segurança e privacidade.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">8. Pagamentos e Smart Tokens</h2>
              <p>
                Dados financeiros são processados por provedores de pagamento seguros. A SmartCorretorAI não armazena
                dados completos de cartão. Podemos armazenar registros de plano, assinatura, recargas, Smart Tokens,
                consumo, vencimentos, notas fiscais e histórico necessário para suporte, auditoria e obrigações legais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">9. Depoimentos e Compartilhamento</h2>
              <p>
                O envio de depoimento é voluntário. Antes de qualquer publicação, o depoimento passa por análise e
                somente poderá ser publicado quando houver consentimento específico do usuário.
              </p>
              <p className="mt-2">
                A autorização para publicar o texto é separada da autorização para exibir nome e profissão. O usuário
                pode enviar um depoimento sem autorizar sua publicação ou identificação. Depoimentos enviados podem
                participar de campanha com benefício de 500 Smart Tokens, conforme análise e regras vigentes, sem que
                o benefício dependa de avaliação positiva e sem obrigação de publicação.
              </p>
              <p className="mt-2">
                A publicação em redes sociais é realizada atualmente pelo próprio usuário, que baixa o material ou
                copia o texto e escolhe o canal em que deseja compartilhá-lo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">10. Cookies e Analytics</h2>
              <p>
                Utilizamos tecnologias essenciais para funcionamento, autenticação e segurança da Plataforma, incluindo
                mecanismos de sessão e verificação antiabuso. Com seu consentimento, utilizamos Google Analytics 4 para
                medir páginas visitadas, origem do tráfego e interações agregadas, com a finalidade de melhorar o produto
                e apoiar ações de marketing. Não enviamos ao Analytics dados de cadastro, conteúdos privados, uploads,
                informações de pagamento ou identificadores internos de usuários.
              </p>
              <p className="mt-2">
                Cookies analíticos permanecem desativados até sua autorização e podem ser recusados sem afetar as funções
                essenciais. A preferência pode ser alterada a qualquer momento pelo controle “Cookies” exibido na
                Plataforma. Quando autorizados, os cookies próprios do GA4 podem permanecer por até dois anos, conforme a
                configuração padrão do Google, e são removidos localmente quando a autorização é revogada. Não utilizamos
                Google Tag Manager, Google Signals, remarketing ou personalização de anúncios nesta implementação.
                O Google OAuth, quando habilitado, é usado somente para autenticação e é distinto do Google Analytics 4
                e dos provedores de inteligência artificial, como Gemini ou Veo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">11. Armazenamento, Segurança e Retenção</h2>
              <p>
                Usamos medidas técnicas e organizacionais para proteger dados contra acesso não autorizado, perda,
                alteração, divulgação ou destruição. Nenhum sistema é totalmente imune a riscos, mas buscamos aplicar
                boas práticas de segurança.
              </p>
              <p className="mt-2">Mantemos dados pelo tempo necessário para:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>prestar o serviço e manter a conta ativa;</li>
                <li>cumprir obrigações legais, fiscais e regulatórias;</li>
                <li>resolver disputas, prevenir fraude e proteger direitos;</li>
                <li>atender solicitações de suporte e auditoria.</li>
              </ul>
              <p className="mt-2">
                A SmartCorretorAI não oferece galeria ou armazenamento permanente das criações. O usuário deve baixar
                e guardar os resultados que desejar conservar. Isso não impede a manutenção, pelo período necessário,
                de registros de conta, pagamentos, Smart Tokens, consentimentos, segurança e auditoria conforme suas
                finalidades e obrigações aplicáveis.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">12. Direitos do Titular</h2>
              <p>Nos termos da LGPD, você pode solicitar:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>confirmação da existência de tratamento;</li>
                <li>acesso, correção ou atualização de dados;</li>
                <li>anonimização, bloqueio ou eliminação quando aplicável;</li>
                <li>portabilidade, informação sobre compartilhamento e revisão de decisões automatizadas quando cabível;</li>
                <li>revogação de consentimento e oposição a tratamentos irregulares.</li>
              </ul>
              <p className="mt-2">
                Para exercer seus direitos, entre em contato pelo e-mail{' '}
                <a href="mailto:suporte@smartcorretorai.com" className="text-primary-600 hover:underline">
                  suporte@smartcorretorai.com
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">13. Exclusão de Dados</h2>
              <p>
                Você pode solicitar a exclusão de seus dados. Alguns registros poderão ser mantidos pelo prazo necessário
                para obrigações legais, fiscais, prevenção de fraude, defesa de direitos ou cumprimento de contratos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">14. Menores de Idade</h2>
              <p>
                A Plataforma não é destinada a menores de 18 anos. Caso identifiquemos uso por menor de idade, a conta
                poderá ser encerrada e os dados excluídos conforme a lei.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">15. Alterações nesta Política</h2>
              <p>
                Podemos atualizar esta Política periodicamente. Alterações relevantes poderão ser comunicadas por e-mail,
                aviso na Plataforma ou atualização desta página.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">16. Contato</h2>
              <p>Para questões sobre privacidade e proteção de dados:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  E-mail geral:{' '}
                  <a href="mailto:suporte@smartcorretorai.com" className="text-primary-600 hover:underline">
                    suporte@smartcorretorai.com
                  </a>
                </li>
                <li>
                  E-mail privacidade:{' '}
                  <a href="mailto:suporte@smartcorretorai.com" className="text-primary-600 hover:underline">
                    suporte@smartcorretorai.com
                  </a>
                </li>
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
