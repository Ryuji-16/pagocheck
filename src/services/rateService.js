export async function fetchBcvUsdRate() {
  const response = await fetch('https://bcv.today/api/v1/rate.json', {
    cache: 'no-cache'
  })

  if (!response.ok) {
    throw new Error('No se pudo leer la tasa BCV')
  }

  const data = await response.json()
  const usd = Number(data.USD)

  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error('La tasa BCV no es válida')
  }

  return {
    usd,
    date: data.effective_date || data.date || '',
    source: 'BCV'
  }
}
