import { useState } from 'react'
import './css/Modals.css'
import './css/Vuelto.css'

function Vuelto({ onBack }) {
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    if (!amount.trim() || !phone.trim()) {
      setMessage('Escribe el monto y el teléfono.')
      return
    }

    setMessage('Simulación: el vuelto no se envía todavía. Aquí irá la API de Banesco.')
  }

  return (
    <section className="vuelto-screen">
      <button type="button" className="modal-back-button" onClick={onBack}>
        ← Menú
      </button>

      <div className="app-panel">
        <h2>Dar vuelto</h2>
        <p className="panel-copy">
          Más adelante esta pantalla hablará con Banesco. Hoy solo guarda el flujo.
        </p>

        <form onSubmit={handleSubmit}>
          {message && <p className="app-form-ok">{message}</p>}

          <label className="app-field">
            Monto
            <input
              type="text"
              inputMode="decimal"
              placeholder="Bs. 0,00"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setMessage('')
              }}
            />
          </label>

          <label className="app-field">
            Teléfono
            <input
              type="tel"
              placeholder="0412-0000000"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                setMessage('')
              }}
            />
          </label>

          <button type="submit" className="app-button">
            Enviar vuelto
          </button>
        </form>
      </div>
    </section>
  )
}

export default Vuelto
