import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authEntryPath } from '../../lib/post-auth-destination'
import { ChevronDown } from 'lucide-react'
import { useOptionalAuth } from '../../lib/auth-context'
import { trackGuestEntry } from '../../lib/guest-acquisition'
import { useLocale } from '../../i18n/useLocale'

export default function FirstCreationEntry() {
  const auth = useOptionalAuth()
  const { t } = useLocale()
  useEffect(() => {
    if (auth && !auth.loading && !auth.user) void trackGuestEntry('guest_landing_started')
  }, [auth?.loading, auth?.user])

  return (
    <section aria-labelledby="first-creation-title" className="bg-[#050816] px-4 py-20 text-center text-white sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <h2 id="first-creation-title" className="text-4xl font-black leading-[1.1] tracking-[-.045em] [text-wrap:balance] sm:text-6xl">{t('landing.firstCreation.title')}</h2>
        <Link to={authEntryPath('/cadastro', 'real_estate_banner')} className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-600 px-8 py-4 text-base font-black text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#050816]">{t('landing.firstCreation.cta')}</Link>
        <a href="#conheca-a-plataforma" className="mx-auto mt-10 flex w-fit flex-col items-center rounded-lg px-3 py-2 text-xs leading-6 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
          <span>{t('landing.firstCreation.explorePrefix')}<br />{t('landing.firstCreation.exploreSuffix')}</span>
          <ChevronDown aria-hidden="true" className="mt-2 h-5 w-5" />
        </a>
      </div>
    </section>
  )
}
