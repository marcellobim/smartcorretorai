const META_CONNECTION_FUNCTION = 'instagram-connection'
const META_OAUTH_HOSTS = new Set(['facebook.com', 'www.facebook.com'])
const META_OAUTH_RESPONSE_KEYS = new Set(['ok', 'authorization_url'])

const currentAuthenticatedSession = async (client) => {
  const { data, error } = await client.auth.getSession()
  const session = data?.session
  if (error || !session?.access_token || !session?.user?.id) {
    throw new Error('meta_session_required')
  }
  return session
}

const invokeConnection = async (client, session, method) => {
  const { data, error } = await client.functions.invoke(META_CONNECTION_FUNCTION, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error || !data?.ok) throw new Error('meta_connection_unavailable')
  return data
}

export const getMetaConnectionStatus = async (client) => {
  const session = await currentAuthenticatedSession(client)
  const data = await invokeConnection(client, session, 'GET')
  return {
    connected: data.connected === true,
    status: typeof data.status === 'string' ? data.status : 'disconnected',
    username: typeof data.instagram_username === 'string' ? data.instagram_username : null,
    pageName: typeof data.facebook_page_name === 'string' ? data.facebook_page_name : null,
    selectionRequired: data.selection_required === true,
    expiresAt: typeof data.token_expires_at === 'string' ? data.token_expires_at : null,
  }
}

const parseOfficialMetaOAuthUrl = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_meta_oauth_response')
  if (Object.keys(data).some(key => !META_OAUTH_RESPONSE_KEYS.has(key))) throw new Error('unsafe_meta_oauth_response')
  if (typeof data.authorization_url !== 'string') throw new Error('invalid_meta_oauth_response')

  let url
  try {
    url = new URL(data.authorization_url)
  } catch {
    throw new Error('invalid_meta_oauth_url')
  }
  if (url.protocol !== 'https:' || !META_OAUTH_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('invalid_meta_oauth_url')
  }
  if (!/^\/v\d+(?:\.\d+)?\/dialog\/oauth\/?$/i.test(url.pathname)) {
    throw new Error('invalid_meta_oauth_url')
  }
  for (const forbidden of ['access_token', 'client_secret', 'app_secret']) {
    if (url.searchParams.has(forbidden)) throw new Error('unsafe_meta_oauth_url')
  }
  return url.toString()
}

export const startMetaOAuthConnection = async (client) => {
  const session = await currentAuthenticatedSession(client)
  const data = await invokeConnection(client, session, 'POST')
  return parseOfficialMetaOAuthUrl(data)
}

export const redirectToMetaOAuth = async (client, assign) => {
  if (typeof assign !== 'function') throw new Error('invalid_meta_oauth_redirect')
  const authorizationUrl = await startMetaOAuthConnection(client)
  assign(authorizationUrl)
  return authorizationUrl
}

export const META_CONNECTION_ENDPOINT = META_CONNECTION_FUNCTION
