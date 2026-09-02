import { useEffect, useRef, useState } from 'react'
import { BANKS, formatBankLabel } from '../services/banks'
import './css/ManualVerification.css'

function BankSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const rootRef = useRef(null)

  const filteredBanks = BANKS.filter((item) =>
    formatBankLabel(item).toLowerCase().includes(search.toLowerCase())
  )

  function selectBank(item) {
    onChange(formatBankLabel(item))
    setSearch('')
    setIsOpen(false)
    setHighlightedIndex(0)
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <label className="bank-field">
      <span>Banco</span>

      <div
        className="bank-select"
        ref={rootRef}
        onKeyDown={(event) => {
          if (!isOpen) return

          if (event.key === 'Escape') {
            event.preventDefault()
            setIsOpen(false)
            setSearch('')
            setHighlightedIndex(0)
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (filteredBanks.length === 0) return
            setHighlightedIndex((current) =>
              current < filteredBanks.length - 1 ? current + 1 : 0
            )
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (filteredBanks.length === 0) return
            setHighlightedIndex((current) =>
              current > 0 ? current - 1 : filteredBanks.length - 1
            )
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            if (filteredBanks[highlightedIndex]) {
              selectBank(filteredBanks[highlightedIndex])
            }
          }
        }}
      >
        <button
          type="button"
          className="bank-select-button"
          onClick={() => {
            setIsOpen((open) => !open)
            setHighlightedIndex(0)
          }}
        >
          <span>{value || 'Selecciona un banco'}</span>
          <span className="bank-select-arrow">{isOpen ? '▴' : '▾'}</span>
        </button>

        {isOpen && (
          <div
            className="bank-select-menu"
            onTouchMove={(event) => event.stopPropagation()}
          >
            <input
              type="text"
              className="bank-search"
              placeholder="Buscar banco o código..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="bank-options">
              {filteredBanks.length > 0 ? (
                filteredBanks.map((item, index) => (
                  <button
                    key={item.code}
                    type="button"
                    className={
                      index === highlightedIndex
                        ? 'bank-option highlighted'
                        : 'bank-option'
                    }
                    onClick={() => selectBank(item)}
                  >
                    {formatBankLabel(item)}
                  </button>
                ))
              ) : (
                <p className="bank-no-results">No se encontró ningún banco</p>
              )}
            </div>
          </div>
        )}
      </div>
    </label>
  )
}

export default BankSelect
