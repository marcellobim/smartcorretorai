import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BrandMark from '../components/brand/BrandMark'

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
            <BrandMark size={28} decorative />
            <span className="font-bold text-gray-900">SmartCorretorAI</span>
          </div>
        </div>

        <div className="card p-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Termos de Uso</h1>
          <p className="text-sm text-gray-400 mb-8">Última atualização: agosto de 2026</p>

          <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">1. Aceitação dos Termos</h2>
              <p>
                Ao criar conta, acessar a plataforma, enviar dados ou fotos, gerar campanhas, contratar planos,
                comprar recargas de Smart Tokens ou utilizar materiais gerados, você declara que leu, compreendeu e
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
                promocionais e, nos recursos compatíveis, permitir sua publicação direta no Instagram ou Facebook,
                conforme o plano, saldo de Smart Tokens, formatos selecionados e disponibilidade da integração.
              </p>
              <p className="mt-2">
                Recursos premium, vídeos, banners avançados, catálogo completo e campanhas avançadas podem depender
                de plano pago, Smart Tokens disponíveis ou regras específicas da oferta vigente.
              </p>
              <p className="mt-2">
                A SmartCorretorAI poderá adicionar, remover, substituir ou aperfeiçoar campanhas, formatos, templates,
                recursos e funcionalidades ao longo do tempo. A composição dos materiais entregues poderá evoluir sem
                obrigação de manter exatamente os mesmos formatos, campanhas, templates ou recursos existentes hoje.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">3. Publicação direta em redes sociais</h2>
              <p>
                Em recursos compatíveis, o usuário pode conectar contas do Instagram ou Facebook e solicitar a
                publicação direta de uma criação. A simples conexão da conta não inicia nem autoriza qualquer
                publicação. Cada publicação depende da escolha do conteúdo e do destino e da confirmação do usuário,
                que pode revisar, editar, substituir ou apagar a legenda antes do envio.
              </p>
              <p className="mt-2">
                O usuário é responsável pelo conteúdo final confirmado, pela veracidade das informações, pela
                conformidade da publicação com a legislação e pelas autorizações e direitos necessários sobre imagens,
                vídeos, textos, marcas e demais materiais. O usuário também declara possuir autorização para conectar,
                administrar e publicar nas contas e Páginas selecionadas.
              </p>
              <p className="mt-2">
                A função depende das APIs, permissões, regras e disponibilidade da Meta, do Instagram e do Facebook.
                Esses terceiros podem alterar requisitos, limitar ou interromper funcionalidades, exigir nova
                autorização, atrasar ou rejeitar publicações e remover conteúdos. A SmartCorretorAI não garante a
                disponibilidade contínua da integração, a aprovação do conteúdo nem a permanência da publicação nas
                plataformas externas, e a continuidade do uso pode exigir reconexão.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">4. Cadastro e Conta</h2>
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
              <h2 className="text-lg font-bold text-gray-800 mb-2">5. Teste Gratuito</h2>
              <p>
                Após confirmar o e-mail, cada conta elegível recebe uma única concessão de 200 Smart Tokens,
                sem necessidade de cartão, para experimentar recursos selecionados da Plataforma.
              </p>
              <p className="mt-2">O teste gratuito permite utilizar os seguintes produtos:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Campanha de Textos;</li>
                <li>Banners Rápidos;</li>
                <li>Smart Carrossel.</li>
              </ul>
              <p className="mt-2">
                Os resultados entregues podem ser copiados, baixados e utilizados normalmente, sob responsabilidade
                do usuário e conforme estes Termos. Após a primeira assinatura ou recarga confirmada, eventual saldo
                demonstrativo não utilizado permanece como bônus comum da conta. O benefício não expira, não é
                concedido novamente em novos acessos e não pode ser transferido entre contas.
              </p>
              <p className="mt-2">
                Os demais produtos podem exigir assinatura ou compra de Smart Tokens, conforme a oferta apresentada
                na Plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">6. Planos, Smart Tokens e Recargas</h2>
              <p>A Plataforma utiliza Smart Tokens como capacidade de criação. Os planos comerciais atuais são:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>START:</strong> 6.350 Smart Tokens por ciclo;</li>
                <li><strong>PRO:</strong> 10.850 Smart Tokens por ciclo;</li>
                <li><strong>ELITE:</strong> 26.350 Smart Tokens por ciclo.</li>
              </ul>
              <p className="mt-2">Também podem ser oferecidas recargas avulsas:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>2.000 Smart Tokens — R$ 49,90;</li>
                <li>4.000 Smart Tokens — R$ 97,90.</li>
              </ul>
              <p className="mt-2">
                Cada produto informa a quantidade de Smart Tokens necessária antes da criação. A oferta gratuita
                descrita na seção 5 se aplica somente a recursos selecionados; os demais produtos seguem o saldo de
                assinatura, recarga ou bônus disponível e as regras comerciais vigentes.
              </p>
              <p className="mt-2">
                Smart Tokens não possuem valor monetário fora da Plataforma, não são moeda, não são transferíveis entre
                contas e não podem ser convertidos em dinheiro. Smart Tokens consumidos na geração, renderização ou
                liberação de materiais não são reembolsáveis, salvo obrigação legal ou decisão expressa da
                SmartCorretorAI. Smart Tokens de recargas expiram conforme a política informada na contratação.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">7. Validade, Renovação e Cancelamento</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Smart Tokens de assinatura renovam a cada ciclo contratado e podem não acumular para ciclos futuros.</li>
                <li>Smart Tokens comprados em recargas expiram em 30 dias após a compra, salvo condição diferente informada no momento da contratação.</li>
                <li>Assinaturas são recorrentes e podem renovar automaticamente até o cancelamento.</li>
                <li>O cancelamento pode ser feito a qualquer momento, com efeito ao final do período vigente.</li>
                <li>Não há reembolso proporcional por cancelamento antecipado, salvo obrigação legal ou política comercial expressa.</li>
                <li>Smart Tokens não utilizados podem expirar conforme sua origem, ciclo contratado ou regra da oferta.</li>
              </ul>
              <p className="mt-2">
                Valores, planos, benefícios e custos em Smart Tokens podem ser alterados mediante comunicação ou
                atualização da página de planos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">8. Uso Adequado</h2>
              <p>O usuário concorda em utilizar a Plataforma apenas para fins lícitos. É proibido:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>informar dados falsos ou enganosos sobre imóveis;</li>
                <li>violar direitos de imagem, privacidade ou propriedade intelectual de terceiros;</li>
                <li>enviar imagens, vídeos, marcas, textos ou outros materiais sem possuir os direitos, licenças ou autorizações necessários;</li>
                <li>usar a Plataforma para fraude, spam ou publicidade ilícita;</li>
                <li>tentar acessar contas, dados ou sistemas de outros usuários;</li>
                <li>copiar, revender, explorar ou fazer engenharia reversa da Plataforma sem autorização.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">9. Conteúdo Gerado por IA</h2>
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
              <h2 className="text-lg font-bold text-gray-800 mb-2">10. Informações de Mercado e Ferramentas de Apoio</h2>
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
              <h2 className="text-lg font-bold text-gray-800 mb-2">11. Uso dos Materiais pelo Usuário</h2>
              <p>
                Após a geração e observadas as regras do plano, pagamento e Smart Tokens, o usuário
                pode utilizar os materiais gerados em suas campanhas imobiliárias.
              </p>
              <p className="mt-2">
                A SmartCorretorAI não oferece galeria ou armazenamento permanente das criações. O usuário deve baixar
                e conservar em seu computador ou celular os resultados que desejar guardar.
              </p>
              <p className="mt-2">
                Todo resultado deve ser revisado pelo usuário antes da publicação ou uso, inclusive quanto à exatidão
                das informações, aos elementos visuais e aos direitos de terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">12. Uso Promocional pela SmartCorretorAI</h2>
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
              <h2 className="text-lg font-bold text-gray-800 mb-2">13. Propriedade Intelectual</h2>
              <p>
                A Plataforma, marca, layout, tecnologia, código, fluxos, catálogos, templates internos e sistemas de
                automação pertencem à SmartCorretorAI ou a seus licenciantes. O usuário não recebe licença para copiar
                ou explorar a Plataforma fora do uso normal contratado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">14. Ausência de Garantia de Resultado Comercial</h2>
              <p>
                A SmartCorretorAI não garante venda, locação, captação de clientes, leads, cliques, visualizações,
                aprovação em plataformas externas, valorização do imóvel ou qualquer resultado financeiro ou
                comercial. A Plataforma é uma ferramenta de criação de materiais, não uma garantia de performance.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">15. Limitação de Responsabilidade</h2>
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
              <h2 className="text-lg font-bold text-gray-800 mb-2">16. Privacidade e Dados</h2>
              <p>
                O tratamento de dados pessoais, dados de imóveis, imagens, arquivos enviados e materiais gerados é
                descrito na <Link to="/privacidade" className="text-primary-600 hover:underline">Política de Privacidade</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">17. Alterações dos Termos</h2>
              <p>
                A SmartCorretorAI pode atualizar estes Termos a qualquer momento. Alterações relevantes poderão ser
                comunicadas por e-mail, aviso na Plataforma ou atualização desta página. O uso continuado após a
                alteração implica aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">18. Foro e Lei Aplicável</h2>
              <p>
                Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo/SP, salvo
                disposição legal obrigatória em sentido diverso.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">19. Contato</h2>
              <p>
                Dúvidas sobre estes Termos podem ser enviadas para:{' '}
                <a href="mailto:suporte@smartcorretorai.com" className="text-primary-600 hover:underline">
                  suporte@smartcorretorai.com
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
