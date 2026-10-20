import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../lib/auth-context'
import { authEntryPath } from '../lib/post-auth-destination'

// Legacy public URL retained for old landing links. It now starts the normal,
// authenticated product flow rather than a constrained product-specific trial.
export default function VirtualStagingTrialEntry() {
  const { user, loading } = useAuthStore()
  if (loading) return <main className="min-h-screen bg-[#050816] p-8 text-white" role="status">Loading…</main>
  return <Navigate to={user ? '/virtual-staging' : authEntryPath('/cadastro', 'virtual_staging')} replace />
}
