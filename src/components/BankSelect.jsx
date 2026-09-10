import { useEffect, useRef, useState } from 'react'
import { BANKS, formatBankLabel } from '../services/banks'
import './css/ManualVerification.css'

function BankSelect({ value, onChange, label = 'Banco', direction = 'up' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const rootRef = useRef(null)
  const searchInputRef = useRef(null)

  const filteredBanks = BANKS.filter((item) =>
    formatBankLabel(item).toLowerCase().includes(search.toLowerCase())
  )

  function selectBank(item) {
    onChange(formatBankLabel(item))
    setSearch('')
    setIsOpen(false)
    setHighlightedIndex(0)
  }

  // Cerrar al hacer clic fuera
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

  // Enfocar el input de búsqueda automáticamente al abrir el menú
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  function handleKeyDown(event) {
    // 1. Cuando el menú está cerrado (!isOpen)
    if (!isOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const currentIndex = BANKS.findIndex(
          (item) => formatBankLabel(item) === value
        )
        const nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(currentIndex + 1, BANKS.length - 1)
        selectBank(BANKS[nextIndex])
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = BANKS.findIndex(
          (item) => formatBankLabel(item) === value
        )
        const prevIndex =
          currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0)
        selectBank(BANKS[prevIndex])
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setIsOpen(true)
        const currentIndex = BANKS.findIndex(
          (item) => formatBankLabel(item) === value
        )
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
        return
      }

      // Búsqueda rápida / typeahead al teclear letra o número
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const char = event.key.toLowerCase()
        const match = BANKS.find((item) => {
          const formatted = formatBankLabel(item).toLowerCase()
          return (
            formatted.startsWith(char) ||
            item.name.toLowerCase().startsWith(char) ||
            item.code.startsWith(char)
          )
        })
        if (match) {
          selectBank(match)
        }
        return
      }

      return
    }

    // 2. Cuando el menú está abierto (isOpen)
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
  }

  const menuDirectionClass =
    direction === 'down' ? 'direction-down' : 'direction-up'

  return (
    <label className="bank-field">
      <span>{label}</span>

      <div className="bank-select" ref={rootRef} onKeyDown={handleKeyDown}>
        <button
          type="button"
          className="bank-select-button"
          onClick={() => {
            setIsOpen((open) => !open)
            const currentIndex = BANKS.findIndex(
              (item) => formatBankLabel(item) === value
            )
            setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
          }}
        >
          <span>{value || 'Selecciona un banco'}</span>
          <span className="bank-select-arrow">{isOpen ? '▴' : '▾'}</span>
        </button>

        {isOpen && (
          <div
            className={`bank-select-menu ${menuDirectionClass}`}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <input
              ref={searchInputRef}
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
