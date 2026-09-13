import { supabase, isRemoteDbEnabled } from './supabaseClient.js'
import { compressImageToBlob } from '../utils/imageUtils.js'

const BUCKET_NAME = 'receipts'
const SIGNED_URL_TTL_SECONDS = 3600 // 1 hora

// Caché en memoria para evitar pedir URLs firmadas redundantes a Supabase
const signedUrlCache = new Map()

/**
 * Convierte un nombre de sucursal en un slug seguro para rutas de almacenamiento.
 * Ejemplo: "Tienda 1 (Bella Vista)" -> "tienda-1-bella-vista"
 *
 * @param {string} branch
 * @returns {string}
 */
export function slugifyBranch(branch) {
  if (!branch || typeof branch !== 'string') return 'general'

  return branch
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general'
}

/**
 * Genera la ruta estructurada de almacenamiento para un comprobante:
 * "{branch_slug}/{YYYY-MM}/rec_{timestamp}_{reference}.jpg"
 *
 * @param {string} [branch] - Nombre de la sucursal
 * @param {string} [reference] - Número de referencia del pago
 * @returns {string}
 */
export function buildReceiptStoragePath(branch, reference) {
  const branchSlug = slugifyBranch(branch)
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cleanRef = reference ? String(reference).replace(/[^a-zA-Z0-9]/g, '').slice(-8) : ''
  const uniqueId = cleanRef || Math.random().toString(36).substring(2, 8)
  const timestamp = Date.now()

  return `${branchSlug}/${yearMonth}/rec_${timestamp}_${uniqueId}.jpg`
}

/**
 * Sube una captura de comprobante a Supabase Storage en el bucket 'receipts'.
 * Comprime la imagen a un Blob JPEG ligero antes de enviarla.
 *
 * @param {File|Blob} fileOrBlob - Imagen original capturada o pegada
 * @param {object} [options]
 * @param {string} [options.branch] - Sucursal activa
 * @param {string} [options.reference] - Referencia del pago
 * @returns {Promise<{ path: string|null, error: any|null }>}
 */
export async function uploadReceiptImage(fileOrBlob, options = {}) {
  if (!fileOrBlob) {
    return { path: null, error: new Error('No se proporcionó ningún archivo de imagen.') }
  }

  if (!isRemoteDbEnabled() || !supabase?.storage) {
    return { path: null, error: new Error('Almacenamiento remoto no disponible (modo offline).') }
  }

  try {
    // 1. Optimizar la imagen mediante compresión binaria
    let uploadBlob = fileOrBlob
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const compressed = await compressImageToBlob(fileOrBlob, 1200, 1200, 0.8)
      if (compressed) {
        uploadBlob = compressed
      }
    }

    // 2. Construir ruta estructurada
    const storagePath = buildReceiptStoragePath(options.branch, options.reference)

    // 3. Subir al bucket privado
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, uploadBlob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.warn('Error al subir comprobante a Supabase Storage:', error)
      return { path: null, error }
    }

    return { path: data?.path || storagePath, error: null }
  } catch (err) {
    console.error('Excepción al procesar subida de comprobante:', err)
    return { path: null, error: err }
  }
}

/**
 * Resuelve la URL visualizable de un comprobante.
 * - Si es una imagen en base64 (data:image/...) o URL http, la retorna directamente.
 * - Si es una ruta de Supabase Storage, genera una URL firmada con expiración de 1h.
 * - Mantiene una caché en memoria para alto rendimiento.
 *
 * @param {string} pathOrUrl - Ruta de Storage o Data URL base64
 * @returns {Promise<string>} URL accesible de la imagen
 */
export async function resolveReceiptUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return ''
  if (pathOrUrl === 'purged') return 'purged'

  // Si ya es un data URL base64, URL externa o blob URL, no requiere firma
  if (
    pathOrUrl.startsWith('data:') ||
    pathOrUrl.startsWith('http://') ||
    pathOrUrl.startsWith('https://') ||
    pathOrUrl.startsWith('blob:')
  ) {
    return pathOrUrl
  }

  // Verificar caché en memoria
  const cached = signedUrlCache.get(pathOrUrl)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url
  }

  if (!isRemoteDbEnabled() || !supabase?.storage) {
    return ''
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(pathOrUrl, SIGNED_URL_TTL_SECONDS)

    if (error || !data?.signedUrl) {
      // Fallback a URL pública en caso de que el bucket haya sido configurado como público
      const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(pathOrUrl)
      if (pubData?.publicUrl) {
        return pubData.publicUrl
      }
      return ''
    }

    const signedUrl = data.signedUrl

    // Guardar en caché con margen de seguridad de 60 segundos antes de expirar
    signedUrlCache.set(pathOrUrl, {
      url: signedUrl,
      expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000
    })

    return signedUrl
  } catch (err) {
    console.warn('No se pudo resolver la URL firmada del comprobante:', err)
    return ''
  }
}

/**
 * Limpia la caché en memoria de URLs firmadas (útil para pruebas o cierre de sesión).
 */
export function clearReceiptUrlCache() {
  signedUrlCache.clear()
}
