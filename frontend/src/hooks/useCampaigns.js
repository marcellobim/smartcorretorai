import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetch = async (params = {}) => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCampaigns(data || [])
    } catch (err) {
      toast.error('Erro ao carregar campanhas')
    } finally {
      setLoading(false)
    }
  }

  const generate = async (payload) => {
    try {
      setGenerating(true)
      const data = await api.post('/gerar-campanha', payload)
      setCampaigns((prev) => [data.campanha, ...prev])
      toast.success('Campanha gerada com sucesso!')
      return data
    } catch (err) {
      toast.error(err.message || 'Erro ao gerar campanha')
      throw err
    } finally {
      setGenerating(false)
    }
  }

  const remove = async (id) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)

      if (error) throw error
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      toast.success('Campanha removida')
    } catch (err) {
      toast.error('Erro ao remover campanha')
    }
  }

  useEffect(() => { fetch() }, [])

  return { campaigns, loading, generating, fetch, generate, remove }
}
