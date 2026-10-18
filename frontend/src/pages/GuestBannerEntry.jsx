import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../lib/auth-context'
import { trackGuestEntry } from '../lib/guest-acquisition'
import { useLocale } from '../i18n/useLocale'
import HeroNext from './HeroNext'

// One official Banner component; identity/economy are selected by context.
// Public generation remains hard-blocked until the subsequent server gates pass.
export default function GuestBannerEntry() {
  const { user, loading } = useAuthStore()
  const { t } = useLocale()
  useEffect(() => {
    if (!loading && !user) void trackGuestEntry('guest_banner_started')
  }, [loading, user])
  if (loading) return <main className="min-h-screen bg-[#050816] p-8 text-white" role="status">{t('banner.guest.loading')}</main>
  if (user) return <Navigate to="/hero" replace />
  return <HeroNext guestMode />
}
