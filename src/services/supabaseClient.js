import { createClient } from '@supabase/supabase-js'

const env = (typeof import.meta !== 'undefined' && import.meta.env) || (typeof globalThis !== 'undefined' && globalThis.process?.env) || {}
const rawUrl = env.VITE_SUPABASE_URL || ''
const anonKey = env.VITE_SUPABASE_ANON_KEY || ''

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

const remoteConfig = getRemoteConfig()

export const supabase = isRemoteDbEnabled()
  ? createClient(remoteConfig.url, remoteConfig.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null

export async function remoteRequest(path, options = {}) {
  const { url, key } = getRemoteConfig()
  const separator = path.includes('?') ? '&' : '?'
  const target = `${url}/rest/v1/${path.replace(/^\//, '')}${options.single ? `${separator}select=${options.select || '*'}` : ''}`

  let authToken = key
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.access_token) {
        authToken = data.session.access_token
      }
    } catch {
      // Usar apikey/anon como fallback
    }
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${authToken}`,
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation' } : {})
  }

  const response = await fetch(options.fullUrl || target, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const text = await response.text()
  let data
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

