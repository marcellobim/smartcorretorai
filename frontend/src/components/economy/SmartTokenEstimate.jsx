import { Link } from 'react-router-dom'
import { useSmartTokens } from '../../hooks/useSmartTokens'
import { formatSmartTokens } from '../../lib/smart-tokens'

export default function SmartTokenEstimate({ cost, quantityLabel = '', className = '' }) {
  const { balance, trial } = useSmartTokens()
  if (trial) return null

  const normalizedCost = Math.max(0, Number(cost) || 0)
  const insufficient = balance !== null && balance < normalizedCost

  return (
    <div className={`space-y-1 text-sm font-semibold text-slate-600 ${className}`.trim()} data-smart-token-estimate>
      {quantityLabel && <p className="text-xs text-slate-500">{quantityLabel}</p>}
      <p>Esta criação: <strong className="text-slate-900">{formatSmartTokens(normalizedCost)} ST</strong></p>
      {balance !== null && <p>Saldo disponível: <strong className="text-slate-900">{formatSmartTokens(balance)} ST</strong></p>}
      {insufficient && (
        <p className="text-amber-700" role="alert">
          Você precisa de mais Smart Tokens para esta criação.{' '}
          <Link to="/planos" className="font-black underline underline-offset-2">Adicionar Smart Tokens</Link>
        </p>
      )}
    </div>
  )
}
