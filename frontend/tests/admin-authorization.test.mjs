import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const auth = read('../src/lib/auth-context.jsx')
const app = read('../src/App.jsx')
const sidebar = read('../src/components/layout/Sidebar.jsx')
const dashboard = read('../src/pages/AdminDashboard.jsx')
const api = read('../src/lib/admin-api.js')

test('frontend Admin state comes only from the protected self-status RPC', () => {
  assert.match(auth, /fetchAdminStatusDirect/)
  assert.match(auth, /rest\/v1\/rpc\/is_authorized_admin/)
  assert.match(auth, /const isAdmin = adminAuthorized/)
  assert.doesNotMatch(auth, /user_metadata\?*\.role|riccieri68@gmail\.com/i)
})

test('AdminRoute and Sidebar use trusted presentation state', () => {
  assert.match(app, /const \{ user, loading, isAdmin \} = useAuthStore\(\)/)
  assert.match(app, /if \(!isAdmin\) return <Navigate to="\/dashboard" replace \/>/)
  assert.match(sidebar, /const \{ user, logout, isAdmin \} = useAuth\(\)/)
  assert.match(sidebar, /\{isAdmin && \(/)
  assert.doesNotMatch(`${app}\n${sidebar}`, /user\?*\.role/)
})

test('Admin dashboard uses the protected backend and cannot edit membership', () => {
  assert.match(api, /supabase\.functions\.invoke\('admin-api'/)
  assert.match(dashboard, /adminRequest\('list_users'\)/)
  assert.match(dashboard, /Admin oficial/)
  assert.match(dashboard, /Gerenciada exclusivamente no backend/)
  assert.doesNotMatch(dashboard, /\.from\('profiles'\)|value=\{selectedUser\.user\.role/)
})
