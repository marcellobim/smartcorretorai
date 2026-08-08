export function normalizeGeneratedHashtags(hashtags) {
  if (!Array.isArray(hashtags)) return []

  const seen = new Set()
  return hashtags.reduce((normalized, hashtag) => {
    if (typeof hashtag !== 'string') return normalized
    const value = hashtag.trim()
    const key = value.toLocaleLowerCase('pt-BR')
    if (!value || seen.has(key)) return normalized
    seen.add(key)
    normalized.push(value)
    return normalized
  }, [])
}

export function mergeSmartTourCampaignHashtags(campaignPackage, hashtags) {
  const normalizedHashtags = normalizeGeneratedHashtags(hashtags)
  if (!normalizedHashtags.length || !Array.isArray(campaignPackage?.aiCampaigns)) {
    return campaignPackage
  }

  return {
    ...campaignPackage,
    aiCampaigns: campaignPackage.aiCampaigns.map((campaign) => ({
      ...campaign,
      hashtags: normalizedHashtags,
    })),
  }
}
