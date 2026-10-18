import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../lib/auth-context'
import { preserveVirtualStagingTrialReturn, virtualStagingTrialPath } from '../lib/virtual-staging-trial'

// Public Landing entry only. The product route remains authenticated because uploads
// and results are private to the account that owns the trial request.
export default function VirtualStagingTrialEntry() {
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (!loading && !user) preserveVirtualStagingTrialReturn()
  }, [loading, user])

  if (loading) return <main className="min-h-screen bg-[#050816] p-8 text-white" role="status">Loading…</main>
  return <Navigate to={user ? virtualStagingTrialPath() : '/login'} replace />
}
