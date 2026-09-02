import { useEffect, useRef, useState } from 'react'
import './css/ManualVerification.css'
import './css/Modals.css'

function ManualVerification({
  onVerify,
  onBack,
  isVerifying
}) {
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

  const [date, setDate] = useState(formatToday)
  const [reference, setReference] = useState('')
  const [phone, setPhone] = useState('')
  const [bank, setBank] = useState('')
  const [formError, setFormError] = useState('')
  const [isBankOpen, setIsBankOpen] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const bankSelectRef = useRef(null)
  const [highlightedBankIndex, setHighlightedBankIndex] = useState(0)
  const banks = [
    'Banesco',
    'Banco de Venezuela',
    'Mercantil',
    'BBVA Provincial',
    'Banco Nacional de Crédito',
    'Bancamiga',
    'Banco del Tesoro',
    'Banco Exterior',
    'Banplus',
    'Banco Activo',
    'Banco Caroní',
    'Banco Plaza',
    'Otro'
  ]
  const filteredBanks = banks.filter((bankName) =>
    bankName.toLowerCase().includes(bankSearch.toLowerCase())
)

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

useEffect(() => {
  const handleClickOutside = (event) => {
    if (
      bankSelectRef.current &&
      !bankSelectRef.current.contains(event.target)
    ) {
      setIsBankOpen(false)
      setBankSearch('')
    }
  }

  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('touchstart', handleClickOutside)

  return () => {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('touchstart', handleClickOutside)
  }
}, [])

  return (
    <div className="manual-verification">

      <button
        type="button"
        className="modal-back-button"
        onClick={onBack}
      >
        ← Cambiar método
      </button>

      <div className="modal-header">
        <div className="modal-icon">
          ✏️
        </div>

        <h2 className="modal-title">Datos del pago</h2>

        <p className="modal-description">
          Introduce los datos de la operación manualmente.
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
  onChange={(event) => {
    setReference(event.target.value)
    setFormError('')
  }}
  placeholder="Número de referencia"
/>
        </label>

        <label>
          Teléfono

          <input
  type="tel"
  value={phone}
  onChange={(event) => {
    setPhone(event.target.value)
    setFormError('')
  }}
  placeholder="Número de teléfono"
/>
        </label>

        <label className="bank-field">
  <span>Banco</span>

  <div
  className="bank-select"
  ref={bankSelectRef}
  onKeyDown={(event) => {
  if (!isBankOpen) return

  if (event.key === 'Escape') {
    event.preventDefault()

    setIsBankOpen(false)
    setBankSearch('')
    setHighlightedBankIndex(0)

    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()

    if (filteredBanks.length === 0) return

    setHighlightedBankIndex((current) =>
      current < filteredBanks.length - 1
        ? current + 1
        : 0
    )

    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()

    if (filteredBanks.length === 0) return

    setHighlightedBankIndex((current) =>
      current > 0
        ? current - 1
        : filteredBanks.length - 1
    )

    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()

    if (filteredBanks.length === 0) return

    const selectedBank =
      filteredBanks[highlightedBankIndex]

    setBank(selectedBank)
setBankSearch('')
setIsBankOpen(false)
setHighlightedBankIndex(0)
setFormError('')
  }
}}
>
    <button
  type="button"
  className="bank-select-button"
  onClick={() => {
    setIsBankOpen(!isBankOpen)
    setHighlightedBankIndex(0)
  }}
  onKeyDown={(event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()

      if (!isBankOpen) {
        setIsBankOpen(true)

        const currentIndex = filteredBanks.indexOf(bank)

        setHighlightedBankIndex(
          currentIndex >= 0 ? currentIndex : 0
        )
      }
    }
  }}
>
  <span>
    {isBankOpen && filteredBanks.length > 0
      ? filteredBanks[highlightedBankIndex]
      : bank || 'Selecciona un banco'}
  </span>

  <span className="bank-select-arrow">
    {isBankOpen ? '▴' : '▾'}
  </span>
</button>

    {isBankOpen && (
      <div className="bank-select-menu">
        <input
          type="text"
          className="bank-search"
          placeholder="Buscar banco..."
          value={bankSearch}
          onChange={(event) =>
            setBankSearch(event.target.value)
          }
          autoFocus
        />

        <div className="bank-options">
          {filteredBanks.length > 0 ? (
            filteredBanks.map((bankName, index) => (
  <button
    key={bankName}
    type="button"
    className={
      index === highlightedBankIndex
        ? 'bank-option highlighted'
        : 'bank-option'
    }
    onClick={() => {
      setBank(bankName)
setBankSearch('')
setIsBankOpen(false)
setHighlightedBankIndex(0)
setFormError('')
    }}
  >
    {bankName}
  </button>
))
          ) : (
            <p className="bank-no-results">
              No se encontró ningún banco
            </p>
          )}
        </div>
      </div>
    )}
  </div>

</label>

       {formError && (
         <p className="form-error">
           {formError}
         </p>
        )}

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