import { useState } from 'react'
import { ProductButton } from '../design-system'
import { formatPhone, isPhoneCompatibleWithMarket, normalizePhone } from '../../utils/phoneFormatters'

// Kept at the point of use so registration never needs to collect a phone
// number that a creator may not choose to publish.
export default function ProfilePhoneQuestion({ market = 'BR', profile = {}, onSaveProfile, onComplete, busy = false }) {
  const us = market === 'US'
  const current = String(profile.whatsapp || profile.telefone || profile.phone || profile.phone_number || '')
  const [value, setValue] = useState(() => formatPhone(current, market))
  const [error, setError] = useState('')
  const copy = us
    ? { prompt: 'Add the phone number you would like to show. We will save it to your profile for future creations.', placeholder: '(555) 555-5555', save: 'Save and use this phone number', saving: 'Saving…', invalid: 'Enter a valid US phone number.', failure: 'We could not save your phone number. Your draft is still here.' }
    : { prompt: 'Informe o telefone que deseja divulgar. Vamos salvá-lo no seu perfil para as próximas criações.', placeholder: '(11) 99999-9999', save: 'Salvar e usar este telefone', saving: 'Salvando…', invalid: 'Informe um telefone brasileiro válido.', failure: 'Não foi possível salvar seu telefone. Seu rascunho foi preservado.' }
  const save = async () => {
    if (!isPhoneCompatibleWithMarket(value, market)) return setError(copy.invalid)
    setError('')
    try {
      const normalized = normalizePhone(value, market)
      await onSaveProfile?.({ telefone: normalized })
      onComplete?.(formatPhone(normalized, market))
    } catch {
      setError(copy.failure)
    }
  }
  return <div className="space-y-3"><p className="text-sm font-semibold text-slate-700">{copy.prompt}</p><input value={value} inputMode="tel" placeholder={copy.placeholder} onChange={event => { setValue(formatPhone(event.target.value, market)); setError('') }} className="w-full rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-semibold" />{error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}<ProductButton type="button" disabled={busy || !isPhoneCompatibleWithMarket(value, market)} onClick={save}>{busy ? copy.saving : copy.save}</ProductButton></div>
}
