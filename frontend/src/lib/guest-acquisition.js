// No identifiers or briefing content in browser storage, URLs or analytics payloads.
// Serialize first entry events so simultaneous mounts cannot race session cookies.
const ENTRY_EVENTS = new Set(['guest_landing_started', 'guest_banner_started'])
let pending = Promise.resolve()

export function trackGuestEntry(eventType) {
  if (!ENTRY_EVENTS.has(eventType)) return Promise.resolve(false)
  pending = pending.catch(() => false).then(async () => {
    try {
      const response = await fetch('/api/guest-banner', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'event', eventType }),
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      // Tracking must never block navigation. No request body/error logging.
      return false
    }
  })
  return pending
}
