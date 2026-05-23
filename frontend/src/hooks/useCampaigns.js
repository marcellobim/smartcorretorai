import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import toast from 'react-hot-toast'

export function useCampaigns() {
  const { user, accessToken } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetch = async () => {
    try {
      setLoading(true)
      if (!user?.id) return

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
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
      if (!accessToken) throw new Error('Sessão expirada — faça login novamente')
      const { data, error } = await supabase.functions.invoke('gerar-campanha', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: payload,
      })
      if (error) throw error
      if (data?.campanha) setCampaigns((prev) => [data.campanha, ...prev])
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

  useEffect(() => {
    if (user?.id) fetch()
  }, [user?.id])

  return { campaigns, loading, generating, fetch, generate, remove }
}
