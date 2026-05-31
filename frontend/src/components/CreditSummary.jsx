import { AlertCircle, CheckCircle2, Coins, WalletCards } from 'lucide-react'
import { CAMPAIGN_MODES } from '../data/campaignModes'
import { TEMPLATE_CATALOG } from '../data/templateCatalog'

const currency = new Intl.NumberFormat('pt-BR')

const getSelectedCatalogItems = (selectedTemplateIds = []) => {
  const selected = new Set(selectedTemplateIds)
  return TEMPLATE_CATALOG.filter((template) => selected.has(template.templateId))
}

export default function CreditSummary({
  simulatedBalance = 150,
  modeId = 'economica',
  selectedTemplateIds = [],
}) {
  const mode = CAMPAIGN_MODES[modeId] || CAMPAIGN_MODES.economica
  const selectedItems = getSelectedCatalogItems(selectedTemplateIds)
  const selectedCost = selectedItems.reduce((sum, item) => sum + item.creditWeight, 0)
  const estimatedCost = selectedCost > 0 ? selectedCost : mode.creditCost
  const balanceAfter = simulatedBalance - estimatedCost
  const insufficientBalance = balanceAfter < 0
  const selectedVideos = selectedItems.filter((item) => ['video', 'reels', 'story'].includes(item.type)).length
  const selectedArts = Math.max(0, selectedItems.length - selectedVideos)
  const economySuggestion = selectedItems.some((item) => ['video', 'reels'].includes(item.type))
    ? 'Sugestao de economia: remova videos ou reels e mantenha artes + textos IA.'
    : 'Sugestao de economia: escolha apenas formatos essenciais, como banner feed e story.'

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Resumo de creditos</h2>
              <p className="text-xs text-gray-500">Visual temporario. Nenhum credito sera debitado nesta fase.</p>
            </div>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
          Simulado
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold mb-1">
            <WalletCards className="w-4 h-4" />
            Saldo atual
          </div>
          <p className="text-2xl font-black text-gray-900">{currency.format(simulatedBalance)}</p>
          <p className="text-xs text-gray-500">creditos de marketing</p>
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
          <p className="text-gray-500 text-xs font-semibold mb-1">Custo estimado</p>
          <p className="text-2xl font-black text-gray-900">{currency.format(estimatedCost)}</p>
          <p className="text-xs text-gray-500">
            {selectedItems.length > 0 ? `${selectedItems.length} item(ns) selecionado(s)` : `Pacote ${mode.label}`}
          </p>
        </div>

        <div className={`rounded-xl border p-4 ${insufficientBalance ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <p className={`text-xs font-semibold mb-1 ${insufficientBalance ? 'text-red-600' : 'text-emerald-700'}`}>
            Saldo apos gerar
          </p>
          <p className={`text-2xl font-black ${insufficientBalance ? 'text-red-700' : 'text-emerald-800'}`}>
            {currency.format(balanceAfter)}
          </p>
          <p className={`text-xs ${insufficientBalance ? 'text-red-600' : 'text-emerald-700'}`}>
            {insufficientBalance ? 'creditos insuficientes' : 'creditos restantes'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
          Modo: {mode.label}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
          Artes: {selectedArts}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
          Videos: {selectedVideos}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
          Textos IA: 0 creditos
        </span>
      </div>

      {selectedItems.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Itens considerados no custo</p>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {item.publicName}
              </span>
            ))}
          </div>
        </div>
      )}

      {insufficientBalance && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p>Creditos insuficientes para esta geracao. Recarregue creditos ou escolha uma opcao mais economica.</p>
            <p className="mt-1 text-xs">{economySuggestion}</p>
          </div>
        </div>
      )}

      {!insufficientBalance && selectedItems.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{economySuggestion}</span>
        </div>
      )}
    </section>
  )
}
