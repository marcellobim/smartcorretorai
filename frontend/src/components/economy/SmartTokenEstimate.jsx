import { Link } from 'react-router-dom'
import { useSmartTokens } from '../../hooks/useSmartTokens'
import { formatSmartTokens } from '../../lib/smart-tokens'
import { useLocale } from '../../i18n/useLocale'

export default function SmartTokenEstimate({ cost, quantityLabel = '', className = '' }) {
  const { balance, trial } = useSmartTokens()
  const { locale, t } = useLocale()
  if (trial) return null

  const normalizedCost = Math.max(0, Number(cost) || 0)
  const insufficient = balance !== null && balance < normalizedCost
  const copy = locale === 'en-US'
    ? { creation: 'This creation', available: 'Available balance', insufficient: 'You need more Smart Tokens for this creation.', add: 'Add Smart Tokens' }
    : { creation: 'Esta criação', available: 'Saldo disponível', insufficient: 'Você precisa de mais Smart Tokens para esta criação.', add: 'Adicionar Smart Tokens' }

  return (
    <div className={`space-y-1 text-sm font-semibold text-slate-600 ${className}`.trim()} data-smart-token-estimate>
      {quantityLabel && <p className="text-xs text-slate-500">{quantityLabel}</p>}
      <p>{copy.creation}: <strong className="text-slate-900">{formatSmartTokens(normalizedCost, locale)} {t('sidebar.smartTokens.unit')}</strong></p>
      {balance !== null && <p>{copy.available}: <strong className="text-slate-900">{formatSmartTokens(balance, locale)} {t('sidebar.smartTokens.unit')}</strong></p>}
      {insufficient && (
        <p className="text-amber-700" role="alert">
          {copy.insufficient}{' '}
          <Link to="/planos" className="font-black underline underline-offset-2">{copy.add}</Link>
        </p>
      )}
    </div>
  )
}
