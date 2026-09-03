import { useState } from 'react'
import BankSelect from './BankSelect'
import './css/ManualVerification.css'
import './css/Modals.css'

function formatToday() {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${today.getFullYear()}`
}

function isValidDisplayDate(value) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return false

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const parsed = new Date(year, month - 1, day)

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

function ManualVerification({ onVerify, onBack, isVerifying, initialValues = {} }) {
  const [date, setDate] = useState(initialValues.date || formatToday)
  const [reference, setReference] = useState(initialValues.reference || '')
  const [phone, setPhone] = useState(initialValues.phone || '')
  const [bank, setBank] = useState(initialValues.bank || '')
  const [formError, setFormError] = useState('')
  const fromOcr = Boolean(initialValues.source === 'ocr')

  function handleSubmit() {
    if (isVerifying) return

    setFormError('')

    if (!isValidDisplayDate(date.trim())) {
      setFormError('Escribe la fecha como DD/MM/AAAA.')
      return
    }

    if (!reference.trim()) {
      setFormError('Ingresa el número de referencia.')
      return
    }

    if (!phone.trim()) {
      setFormError('Ingresa el número de teléfono.')
      return
    }

    if (!bank) {
      setFormError('Selecciona el banco.')
      return
    }

    onVerify({
      date: date.trim(),
      reference: reference.trim(),
      phone: phone.trim(),
      bank
    })
  }

  return (
    <div className="manual-verification">
      <button type="button" className="modal-back-button" onClick={onBack}>
        ← Cambiar método
      </button>

      <div className="modal-header">
        <div className="modal-icon">✏️</div>
        <h2 className="modal-title">Datos del pago</h2>
        <p className="modal-description">
          {fromOcr
            ? 'Revisa lo que se leyó de la foto. Completa lo que falte y verifica.'
            : 'Introduce los datos de la operación manualmente.'}
        </p>
      </div>

      <div className="manual-form">
        <label>
          Fecha
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD/MM/AAAA"
            maxLength={10}
            value={date}
            onChange={(event) => {
              const raw = event.target.value.replace(/[^\d]/g, '').slice(0, 8)
              let next = raw
              if (raw.length > 4) {
                next = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`
              } else if (raw.length > 2) {
                next = `${raw.slice(0, 2)}/${raw.slice(2)}`
              }
              setDate(next)
              setFormError('')
            }}
          />
        </label>

        <label>
          Referencia
          <input
            type="text"
            value={reference}
            placeholder="Número de referencia"
            onChange={(event) => {
              setReference(event.target.value)
              setFormError('')
            }}
          />
        </label>

        <label>
          Teléfono
          <input
            type="tel"
            value={phone}
            placeholder="Número de teléfono"
            onChange={(event) => {
              setPhone(event.target.value)
              setFormError('')
            }}
          />
        </label>

        <BankSelect
          value={bank}
          onChange={(nextBank) => {
            setBank(nextBank)
            setFormError('')
          }}
        />

        {formError && <p className="form-error">{formError}</p>}

        <button
          type="button"
          className="verify-button"
          onClick={handleSubmit}
          disabled={isVerifying}
        >
          {isVerifying ? '🔄Verificando...' : '✓ Verificar pago'}
        </button>
      </div>
    </div>
  )
}

export default ManualVerification
