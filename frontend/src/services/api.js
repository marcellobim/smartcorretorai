import { supabase } from '../lib/supabase'

export const api = {
  from: (table) => supabase.from(table),
  invoke: (fn, payload) => supabase.functions.invoke(fn, { body: payload }),
  storage: supabase.storage,
  auth: supabase.auth,
}

export default api
export { supabase }
