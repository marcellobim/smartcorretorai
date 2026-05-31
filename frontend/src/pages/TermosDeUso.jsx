import { Link } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
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
              <p>
                Ao criar conta, acessar a plataforma, enviar dados ou fotos, gerar campanhas, contratar planos,
                comprar recargas de créditos ou utilizar materiais gerados, você declara que leu, compreendeu e
                aceita integralmente estes Termos de Uso e a Política de Privacidade.
              </p>
              <p className="mt-2">
                Se você não concordar com qualquer regra, não utilize a SmartCorretorAI.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">2. Descrição da Plataforma</h2>
              <p>
                A SmartCorretorAI é uma plataforma de inteligência artificial para marketing imobiliário. A partir
                dos dados do imóvel e dos materiais enviados pelo usuário, o sistema pode gerar textos, hashtags,
                descrições para portais, posts, roteiros, banners, stories, carrosséis, vídeos e outros materiais
                promocionais, conforme o plano, saldo de créditos e formatos selecionados.
              </p>
              <p className="mt-2">
                Recursos premium, vídeos, banners avançados, catálogo completo e campanhas avançadas podem depender
                de plano pago, créditos disponíveis ou regras específicas da oferta vigente.
              </p>
              <p className="mt-2">
                A SmartCorretorAI poderá adicionar, remover, substituir ou aperfeiçoar campanhas, formatos, templates,
                recursos e funcionalidades ao longo do tempo. A composição dos materiais entregues poderá evoluir sem
                obrigação de manter exatamente os mesmos formatos, campanhas, templates ou recursos existentes hoje.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">3. Cadastro e Conta</h2>
              <p>Para utilizar a Plataforma, o usuário deve:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>ter no mínimo 18 anos;</li>
                <li>fornecer informações verdadeiras, completas e atualizadas;</li>
                <li>manter seus dados de acesso em sigilo;</li>
                <li>responder por todas as atividades realizadas em sua conta.</li>
              </ul>
              <p className="mt-2">
                A SmartCorretorAI poderá suspender ou encerrar contas usadas de forma irregular, fraudulenta ou em
                desacordo com estes Termos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">4. Campanha Demonstrativa Gratuita</h2>
              <p>
                A oferta gratuita da SmartCorretorAI corresponde a 1 campanha demonstrativa gratuita, única e
                limitada, destinada a apresentar o funcionamento do produto.
              </p>
              <p className="mt-2">No plano demonstrativo, podem ficar bloqueados:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>vídeos premium, narrados ou cinematográficos;</li>
                <li>banners premium;</li>
                <li>catálogo completo;</li>
                <li>campanhas avançadas;</li>
                <li>downloads ou usos comerciais não liberados pela oferta demonstrativa.</li>
              </ul>
              <p className="mt-2">
                Após utilizar a campanha demonstrativa, novas gerações, recursos premium ou downloads podem exigir
                contratação de plano pago ou compra de créditos, conforme as regras comerciais vigentes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">5. Planos, Créditos e Recargas</h2>
              <p>A Plataforma trabalha com créditos de marketing. Os planos comerciais atuais são:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>START:</strong> 1.000 créditos por ciclo;</li>
                <li><strong>PRO:</strong> 2.500 créditos por ciclo;</li>
                <li><strong>ELITE:</strong> 6.000 créditos por ciclo.</li>
              </ul>
              <p className="mt-2">Também podem ser oferecidas recargas avulsas:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>500 créditos — R$ 59;</li>
                <li>1.000 créditos — R$ 99;</li>
                <li>2.000 créditos — R$ 179.</li>
              </ul>
              <p className="mt-2">
                Textos gerados por IA podem ser gratuitos. Banners normalmente consomem menos créditos, enquanto
                vídeos e recursos premium consomem mais créditos. A quantidade debitada pode variar conforme os
                formatos escolhidos, pacote, campanha, custo operacional e regras comerciais vigentes.
              </p>
              <p className="mt-2">
                Créditos não possuem valor monetário fora da Plataforma, não são moeda, não são transferíveis entre
                contas e não podem ser convertidos em dinheiro. Créditos consumidos na geração, renderização ou
                liberação de materiais não são reembolsáveis, salvo obrigação legal ou decisão expressa da
                SmartCorretorAI. Créditos avulsos expiram conforme a política vigente informada na contratação.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">6. Validade, Renovação e Cancelamento</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Créditos de assinatura renovam a cada ciclo contratado e podem não acumular para ciclos futuros.</li>
                <li>Créditos avulsos comprados em recargas expiram em 180 dias após a compra, salvo condição diferente informada no momento da contratação.</li>
                <li>Assinaturas são recorrentes e podem renovar automaticamente até o cancelamento.</li>
                <li>O cancelamento pode ser feito a qualquer momento, com efeito ao final do período vigente.</li>
                <li>Não há reembolso proporcional por cancelamento antecipado, salvo obrigação legal ou política comercial expressa.</li>
                <li>Créditos não utilizados podem expirar conforme o tipo de crédito, ciclo contratado ou regra da oferta.</li>
              </ul>
              <p className="mt-2">
                Valores, planos, benefícios e custos em créditos podem ser alterados mediante comunicação ou
                atualização da página de planos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">7. Uso Adequado</h2>
              <p>O usuário concorda em utilizar a Plataforma apenas para fins lícitos. É proibido:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>informar dados falsos ou enganosos sobre imóveis;</li>
                <li>violar direitos de imagem, privacidade ou propriedade intelectual de terceiros;</li>
                <li>usar a Plataforma para fraude, spam ou publicidade ilícita;</li>
                <li>tentar acessar contas, dados ou sistemas de outros usuários;</li>
                <li>copiar, revender, explorar ou fazer engenharia reversa da Plataforma sem autorização.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">8. Conteúdo Gerado por IA</h2>
              <p>
                Os materiais gerados pela Plataforma são produzidos com apoio de inteligência artificial e automações
                de mídia. A IA pode cometer erros, omitir informações ou gerar textos que precisem de revisão.
              </p>
              <p className="mt-2">
                Conteúdos gerados por inteligência artificial podem conter imprecisões, interpretações incorretas,
                omissões ou informações desatualizadas.
              </p>
              <p className="mt-2">
                Antes de publicar qualquer material, o usuário deve revisar preços, condições, endereço, bairro,
                metragem, características do imóvel, telefone, CRECI, promessas comerciais e conformidade com normas
                do CRECI, CONAR, plataformas de mídia e legislação aplicável.
              </p>
              <p className="mt-2">
                O usuário é responsável pela veracidade das informações publicadas e pelo uso final dos materiais.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">9. Informações de Mercado e Ferramentas de Apoio</h2>
              <p>
                A Plataforma pode utilizar dados públicos, pesquisas automatizadas, inteligência artificial e outras
                ferramentas de apoio para sugerir textos, argumentos, contexto de bairro, referências comerciais e
                informações de mercado.
              </p>
              <p className="mt-2">
                Essas informações têm caráter exclusivamente informativo. Elas não substituem PTAM, laudo técnico,
                avaliação profissional, análise jurídica, análise documental ou orientação de especialista habilitado.
              </p>
              <p className="mt-2">
                O usuário deve validar todas as informações antes de publicar, apresentar a clientes, tomar decisões
                comerciais ou utilizar os materiais em negociações.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">10. Uso dos Materiais pelo Usuário</h2>
              <p>
                Após a geração e observadas as regras do plano, pagamento, créditos e downloads liberados, o usuário
                pode utilizar os materiais gerados em suas campanhas imobiliárias.
              </p>
              <p className="mt-2">
                Materiais gerados no plano demonstrativo podem ter uso limitado e não devem ser tratados como liberação
                irrestrita para uso comercial quando a interface ou oferta indicar bloqueio de download ou uso premium.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">11. Uso Promocional pela SmartCorretorAI</h2>
              <p>
                O usuário autoriza a SmartCorretorAI a utilizar exemplos de campanhas, artes, imagens geradas, layouts,
                textos e demais materiais produzidos pela Plataforma para fins de demonstração, portfólio, divulgação,
                treinamento comercial e propaganda da própria plataforma.
              </p>
              <p className="mt-2">
                Quando o material contiver dados pessoais identificáveis, como nome, telefone, e-mail, CRECI, endereço
                específico, imagem pessoal, logotipo ou identidade visual do usuário, a SmartCorretorAI deverá
                anonimizar, mascarar ou obter autorização específica antes de uso promocional público, sempre que
                aplicável.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">12. Propriedade Intelectual</h2>
              <p>
                A Plataforma, marca, layout, tecnologia, código, fluxos, catálogos, templates internos e sistemas de
                automação pertencem à SmartCorretorAI ou a seus licenciantes. O usuário não recebe licença para copiar
                ou explorar a Plataforma fora do uso normal contratado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">13. Ausência de Garantia de Resultado Comercial</h2>
              <p>
                A SmartCorretorAI não garante venda, locação, captação de clientes, leads, cliques, visualizações,
                aprovação em plataformas externas, valorização do imóvel ou qualquer resultado financeiro ou
                comercial. A Plataforma é uma ferramenta de criação de materiais, não uma garantia de performance.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">14. Limitação de Responsabilidade</h2>
              <p>A SmartCorretorAI não se responsabiliza por:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>uso indevido dos materiais pelo usuário;</li>
                <li>informações incorretas inseridas pelo usuário;</li>
                <li>falhas de internet, redes sociais, provedores de IA, renderização, pagamento ou infraestrutura de terceiros;</li>
                <li>remoção, reprovação ou bloqueio de materiais por plataformas externas;</li>
                <li>danos indiretos, lucros cessantes ou perdas de oportunidade.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">15. Privacidade e Dados</h2>
              <p>
                O tratamento de dados pessoais, dados de imóveis, imagens, arquivos enviados e materiais gerados é
                descrito na <Link to="/privacidade" className="text-primary-600 hover:underline">Política de Privacidade</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">16. Alterações dos Termos</h2>
              <p>
                A SmartCorretorAI pode atualizar estes Termos a qualquer momento. Alterações relevantes poderão ser
                comunicadas por e-mail, aviso na Plataforma ou atualização desta página. O uso continuado após a
                alteração implica aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">17. Foro e Lei Aplicável</h2>
              <p>
                Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo/SP, salvo
                disposição legal obrigatória em sentido diverso.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">18. Contato</h2>
              <p>
                Dúvidas sobre estes Termos podem ser enviadas para:{' '}
                <a href="mailto:contato@smartcorretorai.com.br" className="text-primary-600 hover:underline">
                  contato@smartcorretorai.com.br
                </a>
              </p>
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
