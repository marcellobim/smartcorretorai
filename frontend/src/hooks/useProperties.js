import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import toast from 'react-hot-toast'

const MASTER_MARKER = '[[SMARTCORRETORAI_MASTER_PROPERTY_V1]]'

const OPTIONAL_PROPERTY_COLUMNS = [
  'area',
  'quartos',
  'banheiros',
  'vagas',
  'cep',
  'endereco',
  'fotos',
  'destaque',
  'ativo',
]

const getMissingColumnName = (error) => {
  const message = String(error?.message || error?.details || '')
  const match = message.match(/'([^']+)'\s+column/)
  return match?.[1] || null
}

const stripColumn = (payload, column) => {
  if (!column || !(column in payload)) return payload
  const next = { ...payload }
  delete next[column]
  return next
}

const stripOptionalColumns = (payload) => {
  const next = { ...payload }
  OPTIONAL_PROPERTY_COLUMNS.forEach((column) => {
    delete next[column]
  })
  return next
}

const parseMasterProperty = (description = '') => {
  const raw = String(description || '')
  const markerIndex = raw.indexOf(MASTER_MARKER)
  if (markerIndex === -1) return null

  try {
    return JSON.parse(raw.slice(markerIndex + MASTER_MARKER.length).trim())
  } catch {
    return null
  }
}

const hydrateProperty = (property) => {
  if (!property) return property
  const master = parseMasterProperty(property.descricao)
  if (!master) return property

  return {
    ...property,
    perfil_imovel: property.perfil_imovel ?? master.perfil_imovel ?? '',
    estado_imovel: property.estado_imovel ?? master.estado_imovel ?? '',
    area: property.area ?? master.area ?? '',
    quartos: property.quartos ?? master.dormitorios ?? 0,
    suites: property.suites ?? master.suites ?? master.banheiros ?? 0,
    banheiros: property.banheiros ?? master.suites ?? master.banheiros ?? 0,
    vagas: property.vagas ?? master.vagas ?? 0,
    fotos: Array.isArray(property.fotos) && property.fotos.length > 0
      ? property.fotos
      : Array.isArray(master.fotos_imovel)
        ? master.fotos_imovel
        : property.fotos,
  }
}

async function insertProperty(payload) {
  let { data, error } = await supabase
    .from('properties')
    .insert(payload)
    .select()
    .single()

  if (error) {
    const missingColumn = getMissingColumnName(error)
    if (missingColumn && missingColumn in payload) {
      const retry = await supabase
        .from('properties')
        .insert(stripColumn(payload, missingColumn))
        .select()
        .single()
      data = retry.data
      error = retry.error
    }
  }

  if (error && getMissingColumnName(error)) {
    const retry = await supabase
      .from('properties')
      .insert(stripOptionalColumns(payload))
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  return { data, error }
}

async function updateProperty(id, userId, payload) {
  let { data, error } = await supabase
    .from('properties')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    const missingColumn = getMissingColumnName(error)
    if (missingColumn && missingColumn in payload) {
      const retry = await supabase
        .from('properties')
        .update(stripColumn(payload, missingColumn))
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }
  }

  if (error && getMissingColumnName(error)) {
    const retry = await supabase
      .from('properties')
      .update(stripOptionalColumns(payload))
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  return { data, error }
}

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
      setProperties((data || []).map(hydrateProperty))
      setTotal(count || 0)
    } catch (err) {
      toast.error('Erro ao carregar imóveis')
    } finally {
      setLoading(false)
    }
  }

  const create = async (payload) => {
    try {
      if (!user?.id) throw new Error('Sessão expirada - faça login novamente')
      const { data, error } = await insertProperty({ ...payload, user_id: user.id })

      if (error) throw error
      const hydrated = hydrateProperty(data)
      setProperties((prev) => [hydrated, ...prev])
      toast.success('Imóvel cadastrado!')
      return hydrated
    } catch (err) {
      toast.error('Erro ao cadastrar imóvel')
      throw err
    }
  }

  const update = async (id, payload) => {
    try {
      if (!user?.id) throw new Error('Sessão expirada - faça login novamente')
      const { data, error } = await updateProperty(id, user.id, payload)

      if (error) throw error
      const hydrated = hydrateProperty(data)
      setProperties((prev) => prev.map((p) => (p.id === id ? hydrated : p)))
      toast.success('Imóvel atualizado!')
      return hydrated
    } catch (err) {
      toast.error('Erro ao atualizar imóvel')
      throw err
    }
  }

  const remove = async (id) => {
    try {
      if (!user?.id) throw new Error('Sessão expirada - faça login novamente')
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
