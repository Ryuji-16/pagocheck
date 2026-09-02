import { useEffect, useMemo, useState } from 'react'
import BankSelect from './BankSelect'
import { fetchBcvUsdRate } from '../services/rateService'
import './css/ManualVerification.css'
import './css/Modals.css'
import './css/Vuelto.css'

const RATE_KEY = 'pagocheck-usd-rate'

function readRate() {
  try {
    return localStorage.getItem(RATE_KEY) || ''
  } catch {
    return ''
  }
}

function parseAmount(value) {
  let normalized = String(value || '').trim().replace(/\s/g, '')
  if (!normalized) return NaN

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.')
  }

  return Number(normalized)
}

function formatBs(value) {
  if (!Number.isFinite(value)) return ''
  return value.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function Vuelto({ onBack }) {
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('')
  const [idType, setIdType] = useState('V')
  const [cedula, setCedula] = useState('')
  const [mode, setMode] = useState('ves')
  const [rate, setRate] = useState(readRate)
  const [rateMeta, setRateMeta] = useState('')
  const [usd, setUsd] = useState('')
  const [ves, setVes] = useState('')
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    fetchBcvUsdRate()
      .then((result) => {
        if (cancelled) return
        const next = String(result.usd)
        setRate(next)
        localStorage.setItem(RATE_KEY, next)
        setRateMeta(
          result.date
            ? `Tasa BCV del ${result.date}`
            : 'Tasa BCV automática'
        )
      })
      .catch(() => {
        if (cancelled) return
        setRateMeta('No se pudo leer el BCV. Puedes poner la tasa a mano.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const convertedBs = useMemo(() => {
    const usdValue = parseAmount(usd)
    const rateValue = parseAmount(rate)
    if (!usdValue || !rateValue) return ''
    return formatBs(usdValue * rateValue)
  }, [usd, rate])

  const amountBs = mode === 'usd' ? convertedBs : ves

  function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setMessage('')

    if (!bank) {
      setFormError('Selecciona el banco.')
      return
    }

    if (!phone.trim()) {
      setFormError('Ingresa el número de teléfono.')
      return
    }

    if (!cedula.trim()) {
      setFormError('Ingresa el número de cédula.')
      return
    }

    const amountValue = parseAmount(amountBs)
    if (!amountValue) {
      setFormError('Ingresa el monto en bolívares.')
      return
    }

    if (mode === 'usd' && !parseAmount(rate)) {
      setFormError('Ingresa la tasa USD a Bs.')
      return
    }

    setMessage(
      `Simulación: se enviaría Bs. ${formatBs(amountValue)} a ${phone.trim()} (${idType}-${cedula.trim()}) por ${bank}. Aquí irá la API de Banesco.`
    )
  }

  return (
    <section className="vuelto-screen">
      <div className="modal">
        <button type="button" className="modal-back-button" onClick={onBack}>
          ← Menú
        </button>

        <div className="modal-header">
          <div className="modal-icon">⇄</div>
          <h2 className="modal-title">Dar vuelto</h2>
          <p className="modal-description">
            Datos de un pago móvil. Todavía no se envía al banco.
          </p>
        </div>

        <form className="manual-form" onSubmit={handleSubmit}>
          <BankSelect
            value={bank}
            onChange={(nextBank) => {
              setBank(nextBank)
              setFormError('')
            }}
          />

          <label>
            Teléfono
            <input
              type="tel"
              inputMode="numeric"
              placeholder="0412-0000000"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                setFormError('')
              }}
            />
          </label>

          <label>
            Cédula
            <div className="cedula-row">
              <select
                value={idType}
                onChange={(event) => setIdType(event.target.value)}
              >
                <option value="V">V</option>
                <option value="E">E</option>
                <option value="J">J</option>
                <option value="G">G</option>
              </select>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Número de cédula"
                value={cedula}
                onChange={(event) => {
                  setCedula(event.target.value.replace(/[^\d]/g, ''))
                  setFormError('')
                }}
              />
            </div>
          </label>

          <div className="amount-mode">
            <button
              type="button"
              className={mode === 'ves' ? 'active' : ''}
              onClick={() => setMode('ves')}
            >
              Manual Bs
            </button>
            <button
              type="button"
              className={mode === 'usd' ? 'active' : ''}
              onClick={() => setMode('usd')}
            >
              Desde USD
            </button>
          </div>

          {mode === 'usd' && (
            <>
              <label>
                Tasa BCV (Bs por 1 USD)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Se carga sola"
                  value={rate}
                  onChange={(event) => {
                    const next = event.target.value
                    setRate(next)
                    localStorage.setItem(RATE_KEY, next)
                    setRateMeta('Tasa editada a mano')
                    setFormError('')
                  }}
                />
              </label>
              {rateMeta && <p className="rate-note">{rateMeta}</p>}

              <label>
                Monto USD
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="3"
                  value={usd}
                  onChange={(event) => {
                    setUsd(event.target.value)
                    setFormError('')
                  }}
                />
              </label>

              <label>
                Monto a enviar (Bs)
                <input type="text" readOnly value={convertedBs} placeholder="0,00" />
              </label>
            </>
          )}

          {mode === 'ves' && (
            <label>
              Monto Bs
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={ves}
                onChange={(event) => {
                  setVes(event.target.value)
                  setFormError('')
                }}
              />
            </label>
          )}

          {formError && <p className="form-error">{formError}</p>}
          {message && <p className="app-form-ok">{message}</p>}

          <button type="submit" className="verify-button">
            Enviar vuelto
          </button>
        </form>
      </div>
    </section>
  )
}

export default Vuelto
