import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

export function useProperties() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const fetch = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const data = await api.get('/properties', { params })
      setProperties(data.properties)
      setTotal(data.total)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const create = useCallback(async (payload) => {
    const data = await api.post('/properties', payload)
    setProperties((prev) => [data.property, ...prev])
    setTotal((t) => t + 1)
    return data.property
  }, [])

  const update = useCallback(async (id, payload) => {
    const data = await api.put(`/properties/${id}`, payload)
    setProperties((prev) => prev.map((p) => (p.id === id ? data.property : p)))
    return data.property
  }, [])

  const remove = useCallback(async (id) => {
    await api.delete(`/properties/${id}`)
    setProperties((prev) => prev.filter((p) => p.id !== id))
    setTotal((t) => t - 1)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { properties, loading, total, fetch, create, update, remove }
}
