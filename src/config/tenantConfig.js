const TENANT_CONFIG_KEY = 'pagocheck-tenant-config'

export const defaultTenantConfig = {
  tenantId: 'pitapollo-01',
  businessName: 'Pitapollo',
  bot: {
    name: 'Asistente Virtual',
    alias: 'Pitín',
    greeting: '¡Hola! Bienvenido a Pitapollo. ¿Qué te gustaría ordenar hoy?',
    serviceUsername: 'bot_service',
    serviceLabel: 'Asistente WhatsApp',
    branch: 'WhatsApp / Delivery'
  },
  defaultCurrency: 'VES',
  supportedBanks: ['Banesco', 'Banco de Venezuela', 'Mercantil', 'Provincial'],
  defaultRetentionDays: 7
}

/**
 * Obtiene la configuración activa del tenant.
 * Si existe una configuración personalizada en localStorage, se fusiona
 * con la configuración por defecto para garantizar consistencia.
 *
 * @returns {typeof defaultTenantConfig} Configuración del tenant activa.
 */
export function getTenantConfig() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(TENANT_CONFIG_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === 'object') {
          return {
            ...defaultTenantConfig,
            ...parsed,
            bot: {
              ...defaultTenantConfig.bot,
              ...(parsed.bot || {})
            },
            supportedBanks: Array.isArray(parsed.supportedBanks)
              ? parsed.supportedBanks
              : defaultTenantConfig.supportedBanks
          }
        }
      }
    } catch (error) {
      console.warn('Error al leer la configuración del tenant desde localStorage:', error)
    }
  }

  return {
    ...defaultTenantConfig,
    bot: { ...defaultTenantConfig.bot }
  }
}

/**
 * Guarda o actualiza la configuración personalizada del tenant en localStorage.
 * Si se pasa null o vacío, restablece la configuración por defecto eliminando el override.
 *
 * @param {Partial<typeof defaultTenantConfig> | null} customConfig
 * @returns {typeof defaultTenantConfig} Configuración resultante.
 */
export function setTenantConfig(customConfig) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...defaultTenantConfig, ...(customConfig || {}) }
  }

  try {
    if (!customConfig) {
      window.localStorage.removeItem(TENANT_CONFIG_KEY)
      return {
        ...defaultTenantConfig,
        bot: { ...defaultTenantConfig.bot }
      }
    }

    const current = getTenantConfig()
    const updated = {
      ...current,
      ...customConfig,
      bot: {
        ...current.bot,
        ...(customConfig.bot || {})
      },
      supportedBanks: Array.isArray(customConfig.supportedBanks)
        ? customConfig.supportedBanks
        : current.supportedBanks
    }

    window.localStorage.setItem(TENANT_CONFIG_KEY, JSON.stringify(updated))
    return updated
  } catch (error) {
    console.error('Error al guardar la configuración del tenant en localStorage:', error)
    return getTenantConfig()
  }
}
