// Aggregate reads only. Never return session identifiers, network hashes or artifacts.
export async function loadGuestBannerMetrics(supabase: any, since: string | null) {
  const definitions = [
    ['landingStarts', 'guest_banner_events', 'event_type', 'guest_landing_started'],
    ['bannerStarts', 'guest_banner_events', 'event_type', 'guest_banner_started'],
    ['requests', 'guest_banner_requests', null, null],
    ['completed', 'guest_banner_requests', 'status', 'completed'],
    ['failed', 'guest_banner_requests', 'status', 'failed'],
    ['reserved', 'guest_banner_requests', 'status', 'reserved'],
    ['dispatching', 'guest_banner_requests', 'status', 'dispatching'],
    ['unknown', 'guest_banner_requests', 'status', 'unknown'],
    ['cancelled', 'guest_banner_requests', 'status', 'cancelled'],
  ] as const
  const entries = await Promise.all(definitions.map(async ([key, table, column, value]) => {
    try {
      let query = supabase.from(table).select('*', { count: 'exact', head: true })
      if (column) query = query.eq(column, value)
      if (since) query = query.gte('created_at', since)
      const { count, error } = await query
      return [key, !error && Number.isSafeInteger(count) && count >= 0 ? count : null]
    } catch {
      // Missing schema and read failures are unavailable, never a false zero.
      return [key, null]
    }
  }))
  return { metrics: Object.fromEntries(entries), since }
}
