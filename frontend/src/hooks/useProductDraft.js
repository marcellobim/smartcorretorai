import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clearProductDraft, readProductDraft, writeProductDraft } from '../lib/product-draft'

function getSessionStorage() {
  try { return globalThis.sessionStorage || null } catch { return null }
}

export function useProductDraft({ productKey, schemaVersion = 1, userId, debounceMs = 400, enabled = true }) {
  const optionsRef = useRef({ productKey, schemaVersion, userId, enabled })
  optionsRef.current = { productKey, schemaVersion, userId, enabled }
  const timerRef = useRef(null)
  const pendingRef = useRef(null)
  const discardedRef = useRef(false)
  const [restoredDraft, setRestoredDraft] = useState(() => enabled
    ? readProductDraft(getSessionStorage(), { productKey, schemaVersion, userId })
    : null)

  const flushPending = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending) writeProductDraft(getSessionStorage(), pending)
  }, [])

  useEffect(() => {
    discardedRef.current = false
    flushPending()
    setRestoredDraft(enabled
      ? readProductDraft(getSessionStorage(), { productKey, schemaVersion, userId })
      : null)
  }, [enabled, flushPending, productKey, schemaVersion, userId])

  useEffect(() => () => flushPending(), [flushPending])

  const save = useCallback((data) => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    const options = optionsRef.current
    if (discardedRef.current || !options.enabled || !options.userId) return false
    pendingRef.current = { ...options, data }
    timerRef.current = window.setTimeout(() => {
      flushPending()
    }, debounceMs)
    return true
  }, [debounceMs, flushPending])

  const replace = useCallback((data) => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = null
    const options = optionsRef.current
    if (discardedRef.current || !options.enabled || !options.userId) return false
    const written = writeProductDraft(getSessionStorage(), { ...options, data })
    if (written) setRestoredDraft(data)
    return written
  }, [])

  const clear = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = null
    const options = optionsRef.current
    if (options.productKey) clearProductDraft(getSessionStorage(), options)
    setRestoredDraft(null)
  }, [])

  const discard = useCallback(() => {
    discardedRef.current = true
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = null
    const options = optionsRef.current
    if (options.productKey) clearProductDraft(getSessionStorage(), options)
    setRestoredDraft(null)
  }, [])

  const restore = useCallback(() => {
    const options = optionsRef.current
    const restored = options.enabled
      ? readProductDraft(getSessionStorage(), options)
      : null
    setRestoredDraft(restored)
    return restored
  }, [])

  return useMemo(
    () => ({ restoredDraft, save, replace, clear, discard, restore }),
    [clear, discard, replace, restore, restoredDraft, save],
  )
}
