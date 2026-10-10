import { useMemo, useState } from 'react'
import { ProductButton } from '../design-system'
import { buildProfessionalIdentity, normalizeProfessionalIdentity, professionalIdentityMissingFields, professionalIdentityProfilePatch } from '../../config/professionalProfile'

const fieldMeta = (market, field) => ({
  professionalName: market === 'US' ? ['Legal/real name', 'Your legal or real professional name'] : ['Nome real', 'Seu nome profissional real'],
  displayName: market === 'US' ? ['Professional/display name', 'Your professional or display name'] : ['Nome comercial', 'Seu nome comercial'],
  creciType: ['Tipo de CRECI', 'F ou J'],
  creciNumber: ['Número do CRECI', '12345'],
  licenseNumber: ['License number', 'Your license number'],
  state: market === 'US' ? ['State', 'FL'] : ['UF', 'SP'],
}[field] || [field, ''])

export default function ProfessionalIdentityQuestion({ market = 'BR', profile, value, onChange, onComplete, onSaveProfile, busy = false }) {
  const selection = normalizeProfessionalIdentity(value, market)
  const [pending, setPending] = useState(value?.pending || {})
  const [saveError, setSaveError] = useState('')
  const identity = useMemo(() => buildProfessionalIdentity(profile, selection, market), [profile, selection, market])
  const missing = professionalIdentityMissingFields(profile, selection, market)
  const us = market === 'US'
  const copy = us ? {
    question: 'Would you like to include your professional information?', yes: 'Yes', no: 'No', credential: 'Which credential would you like to show?', brazil: 'Brazil / CRECI', unitedStates: 'United States / License', name: 'Which name would you like to use?', legal: 'Legal/real name', display: 'Professional/display name', save: 'Save these details to your profile', continue: 'Continue without professional information', confirm: 'Save and use this information', saving: 'Saving…', failure: 'We could not save your profile. Your draft is still here; try again.', review: 'This will be saved to your profile:',
  } : {
    question: 'Deseja incluir sua identificação profissional?', yes: 'Sim', no: 'Não', credential: 'Qual credencial deseja exibir?', brazil: 'Brasil / CRECI', unitedStates: 'Estados Unidos / License', name: 'Qual nome deseja usar?', legal: 'Nome real', display: 'Nome comercial', save: 'Salvar estes dados no seu perfil', continue: 'Continuar sem identificação profissional', confirm: 'Salvar e usar esta identificação', saving: 'Salvando…', failure: 'Não foi possível salvar seu perfil. Seu rascunho foi preservado; tente novamente.', review: 'Estes dados serão salvos no seu perfil:',
  }
  const chooseEnabled = enabled => {
    const next = { enabled, name_source: null, credential_source: enabled ? null : 'none', market }
    onChange(next)
    if (!enabled) onComplete?.(next, '')
  }
  const chooseCredential = credential_source => onChange({ enabled: true, name_source: null, credential_source, market })
  const chooseName = name_source => {
    const next = { enabled: true, name_source, credential_source: selection.credential_source, market, pending }
    onChange(next)
    if (!professionalIdentityMissingFields(profile, next, market).length) onComplete?.(next, buildProfessionalIdentity(profile, next, market)?.formatted || '')
  }
  const save = async () => {
    setSaveError('')
    const patch = professionalIdentityProfilePatch(profile, pending, selection.credential_source)
    if (!Object.keys(patch).length) return
    try {
      const savedProfile = await onSaveProfile?.(patch)
      const merged = { ...profile, ...patch, ...(savedProfile || {}) }
      const next = { ...selection, pending }
      const resolved = buildProfessionalIdentity(merged, next, market)
      if (!resolved) throw new Error('identity_incomplete')
      onChange(next)
      onComplete?.(next, resolved.formatted)
    } catch {
      setSaveError(copy.failure)
    }
  }
  if (!selection.enabled && value?.enabled !== false) return <div className="space-y-3"><p className="text-sm font-semibold text-slate-700">{copy.question}</p><div className="flex flex-wrap gap-2"><ProductButton type="button" onClick={() => chooseEnabled(true)}>{copy.yes}</ProductButton><ProductButton type="button" variant="secondary" onClick={() => chooseEnabled(false)}>{copy.no}</ProductButton></div></div>
  if (selection.enabled && !selection.credential_source) return <div className="space-y-3"><p className="text-sm font-semibold text-slate-700">{copy.credential}</p><div className="flex flex-wrap gap-2"><ProductButton type="button" onClick={() => chooseCredential('br_creci')}>{copy.brazil}</ProductButton><ProductButton type="button" variant="secondary" onClick={() => chooseCredential('us_license')}>{copy.unitedStates}</ProductButton></div><ProductButton type="button" variant="ghost" onClick={() => chooseEnabled(false)}>{copy.continue}</ProductButton></div>
  if (selection.enabled && !selection.name_source) return <div className="space-y-3"><p className="text-sm font-semibold text-slate-700">{copy.name}</p><div className="flex flex-wrap gap-2"><ProductButton type="button" onClick={() => chooseName('real')}>{copy.legal}</ProductButton><ProductButton type="button" variant="secondary" onClick={() => chooseName('display')}>{copy.display}</ProductButton></div></div>
  if (selection.enabled && missing.length) return <div className="space-y-4"><p className="text-sm font-semibold text-slate-700">{copy.review}</p>{missing.map(field => { const credentialMarket = selection.credential_source === 'us_license' ? 'US' : 'BR'; const [label, placeholder] = fieldMeta(credentialMarket, field); return <label key={field} className="block text-sm font-bold text-slate-700">{label}<input value={pending[field] || ''} placeholder={placeholder} onChange={event => { const next = { ...pending, [field]: event.target.value }; setPending(next); onChange({ ...selection, pending: next }) }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label> })}{saveError && <p role="alert" className="text-sm font-semibold text-red-700">{saveError}</p>}<div className="flex flex-wrap gap-2"><ProductButton type="button" disabled={busy || missing.some(field => !String(pending[field] || '').trim())} onClick={save}>{busy ? copy.saving : copy.confirm}</ProductButton><ProductButton type="button" variant="secondary" onClick={() => { const next = { enabled: false, name_source: null, credential_source: 'none', market }; onChange(next); onComplete?.(next, '') }}>{copy.continue}</ProductButton></div></div>
  return <div className="space-y-3"><p className="text-sm font-semibold text-slate-700">{identity?.formatted}</p><ProductButton type="button" onClick={() => onComplete?.(selection, identity?.formatted || '')}>{us ? 'Continue' : 'Continuar'}</ProductButton></div>
}
