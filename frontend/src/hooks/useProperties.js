import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import toast from 'react-hot-toast'

export function useProperties() {
  const { user } = useAuth()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const fetch = async () => {
    try {
      setLoading(true)
      if (!user?.id) return

      const { data, error, count } = await supabase
        .from('properties')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProperties(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error('Erro ao carregar imóveis')
    } finally {
      setLoading(false)
    }
  }

  const create = async (payload) => {
    try {
      if (!user?.id) throw new Error('Sessão expirada — faça login novamente')
      const { data, error } = await supabase
        .from('properties')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      setProperties((prev) => [data, ...prev])
      toast.success('Imóvel cadastrado!')
      return data
    } catch (err) {
      toast.error('Erro ao cadastrar imóvel')
      throw err
    }
  }

  const update = async (id, payload) => {
    try {
      if (!user?.id) throw new Error('SessÃ£o expirada â€” faÃ§a login novamente')
      const { data, error } = await supabase
        .from('properties')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setProperties((prev) => prev.map((p) => p.id === id ? data : p))
      toast.success('Imóvel atualizado!')
      return data
    } catch (err) {
      toast.error('Erro ao atualizar imóvel')
      throw err
    }
  }

  const remove = async (id) => {
    try {
      if (!user?.id) throw new Error('SessÃ£o expirada â€” faÃ§a login novamente')
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setProperties((prev) => prev.filter((p) => p.id !== id))
      toast.success('Imóvel removido!')
    } catch (err) {
      toast.error('Erro ao remover imóvel')
    }
  }

  useEffect(() => {
    if (user?.id) fetch()
  }, [user?.id])

  return { properties, loading, total, fetch, create, update, remove }
}
