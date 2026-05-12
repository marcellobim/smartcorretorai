import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fetch = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const data = await api.get('/campaigns', { params })
      setCampaigns(data.campaigns)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const generate = useCallback(async (payload) => {
    setGenerating(true)
    try {
      const data = await api.post('/generate/campaign', payload)
      setCampaigns((prev) => [data.campaign, ...prev])
      toast.success('Pacote de marketing gerado com sucesso!')
      return data.campaign
    } catch (err) {
      toast.error(err.message)
      throw err
    } finally {
      setGenerating(false)
    }
  }, [])

  const remove = useCallback(async (id) => {
    await api.delete(`/campaigns/${id}`)
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { campaigns, loading, generating, fetch, generate, remove }
}
