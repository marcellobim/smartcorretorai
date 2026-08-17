import { supabase } from './supabase'

export async function adminRequest(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action, ...payload },
  })
  if (error) throw new Error('Operação administrativa indisponível.')
  if (data?.error) throw new Error(data.error)
  return data || {}
}
