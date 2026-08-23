import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import BrandMark from '../brand/BrandMark'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'

export default function AdminMfaGate({ children }) {
  const [status, setStatus] = useState('loading')
  const [factor, setFactor] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]).then(([assurance, factors]) => {
      if (!active) return
      if (assurance.error || factors.error) return setStatus('error')
      if (assurance.data?.currentLevel === 'aal2') return setStatus('verified')
      const verifiedTotp = factors.data?.totp?.find(item => item.status === 'verified')
      setFactor(verifiedTotp || null)
      setStatus(verifiedTotp ? 'challenge' : 'enroll')
    }).catch(() => active && setStatus('error'))
    return () => { active = false }
  }, [])

  const beginEnrollment = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'SmartCorretorAI Admin',
      })
      if (error || !data?.id || !data?.totp?.qr_code) throw error || new Error('mfa_enrollment_failed')
      setEnrollment(data)
      setFactor({ id: data.id })
    } catch {
      toast.error('Não foi possível iniciar a configuração do MFA.')
    } finally {
      setBusy(false)
    }
  }

  const verify = async event => {
    event.preventDefault()
    if (!factor?.id || !/^\d{6}$/.test(code)) {
      toast.error('Informe o código de 6 dígitos do autenticador.')
      return
    }
    setBusy(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeError || !challenge?.id) throw challengeError || new Error('mfa_challenge_failed')
      const { error } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code,
      })
      if (error) throw error
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError || assurance?.currentLevel !== 'aal2') throw assuranceError || new Error('aal2_not_reached')
      setCode('')
      setStatus('verified')
    } catch {
      toast.error('Código inválido ou expirado. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'verified') return children
  if (status === 'error') return <Navigate to="/dashboard" replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="flex items-center gap-3">
          <BrandMark size={36} decorative />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-primary-700">Área administrativa</p>
            <h1 className="text-xl font-black text-slate-950">Verificação em duas etapas</h1>
          </div>
        </div>

        {status === 'loading' && <p className="mt-6 text-sm text-slate-600">Verificando proteção da sessão…</p>}

        {status === 'enroll' && !enrollment && (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl bg-primary-50 p-4 text-sm leading-6 text-primary-900">
              <ShieldCheck className="mb-2 h-6 w-6" />
              Administradores precisam cadastrar um aplicativo autenticador antes de acessar dados ou ações administrativas.
            </div>
            <Button type="button" onClick={beginEnrollment} loading={busy} className="w-full">
              Configurar aplicativo autenticador
            </Button>
          </div>
        )}

        {enrollment && (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-slate-600">Leia o QR Code com seu aplicativo autenticador e confirme o código gerado.</p>
            <img src={enrollment.totp.qr_code} alt="QR Code para configurar autenticação em duas etapas" className="mx-auto h-52 w-52" />
            <p className="break-all rounded-xl bg-slate-100 p-3 text-center font-mono text-xs text-slate-700" aria-label="Chave manual do autenticador">
              {enrollment.totp.secret}
            </p>
          </div>
        )}

        {(status === 'challenge' || enrollment) && (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><KeyRound className="h-4 w-4" /> Confirme sua identidade</div>
            <Input
              label="Código do autenticador"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            <Button type="submit" loading={busy} className="w-full">Verificar e acessar</Button>
          </form>
        )}
      </section>
    </main>
  )
}
