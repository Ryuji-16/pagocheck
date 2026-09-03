const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function isRemoteDbEnabled() {
  return Boolean(rawUrl && anonKey)
}

export function getRemoteConfig() {
  const cleaned = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
  return {
    url: cleaned,
    key: anonKey
  }
}

export async function remoteRequest(path, options = {}) {
  const { url, key } = getRemoteConfig()
  const separator = path.includes('?') ? '&' : '?'
  const target = `${url}/rest/v1/${path.replace(/^\//, '')}${options.single ? `${separator}select=${options.select || '*'}` : ''}`

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation' } : {})
  }

  const response = await fetch(options.fullUrl || `${url}/rest/v1/${path.replace(/^\//, '')}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message =
      (data && data.message) ||
      (data && data.error_description) ||
      `Error ${response.status}`
    return { data: null, error: { message, status: response.status } }
  }

  return { data, error: null }
}

export const supabase = null
