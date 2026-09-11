import { useEffect, useRef } from 'react'
import { useAuth } from '../../lib/auth-context'
import { trackAccountAnalyticsEvent } from '../../lib/account-analytics'

export default function AccountAnalyticsRoute({ productId, children }) {
  const { accessToken, user } = useAuth()
  const trackedRoute = useRef(null)

  useEffect(() => {
    const routeKey = user?.id && productId ? `${user.id}:${productId}` : null
    if (!routeKey || !accessToken || trackedRoute.current === routeKey) return
    trackedRoute.current = routeKey
    void trackAccountAnalyticsEvent({ eventType: 'product_opened', productId, accessToken })
  }, [accessToken, productId, user?.id])

  return children
}
