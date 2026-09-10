import { useEffect, useState } from 'react'
import BankSelect from './BankSelect'
import VueltoReceiptModal from './VueltoReceiptModal'
import { fetchBcvUsdRate } from '../services/rateService'
import { saveMovement } from '../services/historyService'
import { formatPhoneNumber, isValidVePhone } from '../utils/formatters'
import './css/ManualVerification.css'
import './css/Modals.css'
import './css/Vuelto.css'

const RATE_KEY = 'pagocheck-usd-rate'

function readRate() {
  try {
    const stored = localStorage.getItem(RATE_KEY)
    if (!stored) return ''
    const num = parseAmount(stored)
    return Number.isFinite(num) && num > 0 ? `Bs. ${num.toFixed(2)}` : stored
  } catch {
    return ''
  }
}

function parseAmount(value) {
  let normalized = String(value || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/Bs\.?/gi, '')
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
  const [ves, setVes] = useState('')
  const [rate, setRate] = useState(readRate)
  const [rateMeta, setRateMeta] = useState('')
  const [usd, setUsd] = useState('')
  const [concept, setConcept] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    fetchBcvUsdRate()
      .then((result) => {
        if (cancelled) return
        const num = Number(result.usd)
        const nextFormatted = Number.isFinite(num) && num > 0 ? `Bs. ${num.toFixed(2)}` : String(result.usd)
        setRate(nextFormatted)
        localStorage.setItem(RATE_KEY, nextFormatted)
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

  function handlePhoneChange(event) {
    const formatted = formatPhoneNumber(event.target.value)
    setPhone(formatted)
    setFormError('')
  }

  function handleVesChange(event) {
    const val = event.target.value
    setVes(val)
    setFormError('')

    const vesNum = parseAmount(val)
    const rateNum = parseAmount(rate)
    if (Number.isFinite(vesNum) && vesNum > 0 && Number.isFinite(rateNum) && rateNum > 0) {
      const calcUsd = (vesNum / rateNum).toFixed(2).replace('.', ',')
      setUsd(calcUsd)
    } else if (!val.trim()) {
      setUsd('')
    }
  }

  function handleUsdChange(event) {
    const val = event.target.value
    setUsd(val)
    setFormError('')

    const usdNum = parseAmount(val)
    const rateNum = parseAmount(rate)
    if (Number.isFinite(usdNum) && usdNum > 0 && Number.isFinite(rateNum) && rateNum > 0) {
      const calcVes = formatBs(usdNum * rateNum)
      setVes(calcVes)
    } else if (!val.trim()) {
      setVes('')
    }
  }

  function handleRateChange(event) {
    const val = event.target.value
    setRate(val)
    setFormError('')

    const rateNum = parseAmount(val)
    const usdNum = parseAmount(usd)
    const vesNum = parseAmount(ves)

    if (Number.isFinite(rateNum) && rateNum > 0) {
      if (Number.isFinite(usdNum) && usdNum > 0) {
        setVes(formatBs(usdNum * rateNum))
      } else if (Number.isFinite(vesNum) && vesNum > 0) {
        setUsd((vesNum / rateNum).toFixed(2).replace('.', ','))
      }
    }
  }

  function handleRateBlur() {
    const rateNum = parseAmount(rate)
    if (Number.isFinite(rateNum) && rateNum > 0) {
      const formatted = `Bs. ${rateNum.toFixed(2)}`
      setRate(formatted)
      localStorage.setItem(RATE_KEY, formatted)
    }
  }

  function handleNewVuelto() {
    setReceipt(null)
    setVes('')
    setUsd('')
    setPhone('')
    setCedula('')
    setConcept('')
    setFormError('')
    setMessage('')
  }

  async function handleSubmit(event) {
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

    if (!isValidVePhone(phone)) {
      setFormError(
        'El teléfono debe tener 11 dígitos y comenzar con un prefijo válido (0412, 0422, 0414, 0424, 0416 o 0426).'
      )
      return
    }

    if (!cedula.trim()) {
      setFormError('Ingresa el número de cédula.')
      return
    }

    const amountValue = parseAmount(ves)
    if (!amountValue) {
      setFormError('Ingresa el monto en bolívares.')
      return
    }

    const referenceCode = `VLT-${Math.floor(100000 + Math.random() * 900000)}`
    const nowFormatted = new Date().toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })

    const newMovement = await saveMovement({
      type: 'vuelto',
      status: 'simulado',
      amount: `Bs. ${formatBs(amountValue)}`,
      reference: referenceCode,
      phone: phone.trim(),
      bank,
      cedula: `${idType}-${cedula.trim()}`,
      note: concept.trim() || 'Vuelto pago móvil'
    })

    const finalReference = newMovement?.reference || referenceCode

    setReceipt({
      amountBs: `Bs. ${formatBs(amountValue)}`,
      amountUsd: usd || null,
      bank,
      cedula: `${idType}-${cedula.trim()}`,
      phone: phone.trim(),
      concept: concept.trim() || 'Vuelto pago móvil',
      reference: finalReference,
      date: nowFormatted
    })

    setMessage(
      `Simulación: se enviaría Bs. ${formatBs(amountValue)}${usd ? ` ($${usd})` : ''} a ${phone.trim()} (${idType}-${cedula.trim()}) por ${bank}${concept.trim() ? ` — Concepto: ${concept.trim()}` : ''}. Aquí irá la API de Banesco.`
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
          {/* 1. Documento y Número de documento */}
          <div className="document-row">
            <label className="document-type-field">
              <span>Documento</span>
              <select
                value={idType}
                onChange={(event) => setIdType(event.target.value)}
              >
                <option value="V">V</option>
                <option value="E">E</option>
                <option value="J">J</option>
                <option value="G">G</option>
              </select>
            </label>

            <label className="document-number-field">
              <span>Número de documento</span>
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
            </label>
          </div>

          {/* 2. Banco beneficiario (apertura hacia abajo) */}
          <BankSelect
            label="Banco beneficiario"
            direction="down"
            value={bank}
            onChange={(nextBank) => {
              setBank(nextBank)
              setFormError('')
            }}
          />

          {/* 3. Teléfono de beneficiario */}
          <label>
            <span>Teléfono de beneficiario</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="0412-0000000"
              maxLength={12}
              value={phone}
              onChange={handlePhoneChange}
            />
          </label>

          {/* 4. Monto Bs. (Ancho completo) */}
          <label>
            <span>Monto Bs.</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={ves}
              onChange={handleVesChange}
            />
          </label>

          {/* 5. Tasa USD y Monto USD (2 Columnas) */}
          <div className="tasa-monto-row">
            <label>
              <span>Tasa USD</span>
              <input
                type="text"
                className="tasa-usd-input"
                placeholder="Bs. 0,00"
                value={rate}
                title={rateMeta}
                onChange={handleRateChange}
                onBlur={handleRateBlur}
              />
            </label>

            <label>
              <span>Monto USD</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={usd}
                onChange={handleUsdChange}
              />
            </label>
          </div>

          {/* 6. Concepto */}
          <label>
            <span>Concepto</span>
            <input
              type="text"
              placeholder="Concepto de la operación"
              value={concept}
              onChange={(event) => {
                setConcept(event.target.value)
                setFormError('')
              }}
            />
          </label>

          {formError && <p className="form-error">{formError}</p>}
          {message && <p className="app-form-ok">{message}</p>}

          <button type="submit" className="verify-button">
            Enviar vuelto
          </button>
        </form>
      </div>

      {receipt && (
        <VueltoReceiptModal
          receipt={receipt}
          onClose={() => setReceipt(null)}
          onNewVuelto={handleNewVuelto}
        />
      )}
    </section>
  )
}

export default Vuelto
