import { useState } from 'react'
import { BRAND } from '../config/brand'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BrandMark from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth-context'
import { peekPostAuthDestination, takePostAuthDestination } from '../lib/post-auth-destination'
import { useLocale } from '../i18n/useLocale'

export default function LegalOnboardingPage() {
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { user, loading, onboardingState, acceptLegalDocuments, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useLocale()
  const [postLegalDestination] = useState(() => peekPostAuthDestination() || '/dashboard')

  if (loading || onboardingState === 'checking') return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-800" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (onboardingState === 'accepted') return <Navigate to={takePostAuthDestination() || postLegalDestination} replace />
  if (onboardingState === 'admin_blocked' || onboardingState === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl">
          <p role="alert" className="text-sm font-semibold leading-6 text-red-800">{t('legalOnboarding.documentsError')}</p>
          <button type="button" onClick={() => signOut()} className="mt-6 text-sm font-bold text-primary-700 hover:underline">{t('authCallback.backToLogin')}</button>
        </section>
      </main>
    )
  }

  const submit = async event => {
    event.preventDefault()
    if (!accepted) {
      setError(t('legalOnboarding.required'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await acceptLegalDocuments()
      navigate(takePostAuthDestination() || postLegalDestination, { replace: true })
    } catch {
      setError(t('legalOnboarding.saveError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="flex items-center gap-3"><BrandMark size={36} decorative /><span className="font-black">{BRAND.name}</span></div>
        <h1 className="mt-7 text-2xl font-black text-slate-950">{t('legalOnboarding.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('legalOnboarding.description')}</p>
        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
            <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <span>{t('legalOnboarding.acceptancePrefix')} <Link to="/termos" target="_blank" rel="noreferrer" className="font-semibold text-primary-700 hover:underline">{t('legalOnboarding.terms')}</Link> {t('legalOnboarding.connector')} <Link to="/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-primary-700 hover:underline">{t('legalOnboarding.privacy')}</Link>{t('legalOnboarding.acceptanceSuffix')}</span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" loading={submitting} disabled={!accepted} className="w-full">{t('legalOnboarding.accept')}</Button>
        </form>
        <button type="button" onClick={() => signOut()} className="mt-5 w-full text-sm font-semibold text-slate-500 hover:text-slate-700">{t('legalOnboarding.leave')}</button>
      </section>
    </main>
  )
}
