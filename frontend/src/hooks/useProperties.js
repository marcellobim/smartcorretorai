import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export function useProperties() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const fetch = async (params = {}) => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error, count } = await supabase
        .from('properties')
        .select('*', { count: 'exact' })
        .eq('user_id', session.user.id)
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
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase
        .from('properties')
        .insert({ ...payload, user_id: session.user.id })
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
      const { data, error } = await supabase
        .from('properties')
        .update(payload)
        .eq('id', id)
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
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id)

      if (error) throw error
      setProperties((prev) => prev.filter((p) => p.id !== id))
      toast.success('Imóvel removido!')
    } catch (err) {
      toast.error('Erro ao remover imóvel')
    }
  }

  useEffect(() => { fetch() }, [])

  return { properties, loading, total, fetch, create, update, remove }
}
