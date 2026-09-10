import { useState } from 'react'

function MovementsToolbar({
  isAdmin,
  cajas = [],
  selectedCaja,
  onCajaChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  datePreset,
  onDatePresetChange,
  statusFilter,
  onStatusFilterChange,
  onResetFilters,
  hasActiveFilters
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [localSearch, setLocalSearch] = useState(searchQuery)

  function handleSearchSubmit(e) {
    if (e) e.preventDefault()
    onSearchChange(localSearch)
    if (onSearchSubmit) onSearchSubmit(localSearch)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleSearchSubmit(e)
    }
  }

  // Etiqueta legible de hoy para el selector de fecha
  const now = new Date()
  const todayLabel = now.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'short'
  })

  return (
    <div className="movements-toolbar-wrapper">
      <div className="movements-toolbar">
        {/* Lado izquierdo: Selector de Caja (Solo Admin) */}
        {isAdmin ? (
          <div className="movements-caja-select-container">
            <select
              className="movements-caja-select"
              value={selectedCaja}
              onChange={(e) => onCajaChange(e.target.value)}
              title="Filtrar por caja o terminal"
            >
              <option value="">Todas las cajas</option>
              {cajas.map((caja) => (
                <option key={caja.key} value={caja.key}>
                  {caja.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="movements-caja-badge-fixed">
            <span>Terminal</span>
          </div>
        )}

        {/* Centro: Buscador unificado con botón Buscar */}
        <div className="movements-search-box">
          <input
            type="text"
            className="movements-search-input"
            placeholder="Ref, tlf, banco, cédula..."
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value)
              onSearchChange(e.target.value)
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="movements-search-button"
            onClick={handleSearchSubmit}
          >
            Buscar
          </button>
        </div>

        {/* Lado derecho: Botón Filtros y Selector de Fecha */}
        <div className="movements-toolbar-actions">
          <button
            type="button"
            className={`movements-filters-toggle ${showAdvanced ? 'open' : ''} ${hasActiveFilters ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Mostrar más filtros"
          >
            <svg
              className="funnel-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filtros</span>
            {hasActiveFilters && <span className="filter-active-dot" />}
          </button>

          <div className="movements-date-select-container">
            <select
              className="movements-date-select"
              value={datePreset}
              onChange={(e) => onDatePresetChange(e.target.value)}
            >
              <option value="today">📅 Hoy, {todayLabel}</option>
              <option value="yesterday">📅 Ayer</option>
              <option value="week">📅 Últimos 7 días</option>
              <option value="all">📅 Todos los días</option>
            </select>
          </div>
        </div>
      </div>

      {/* Panel colapsable de filtros avanzados */}
      {showAdvanced && (
        <div className="movements-advanced-filters">
          <div className="movements-advanced-group">
            <label htmlFor="status-filter-select">Estado:</label>
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="confirmed">Confirmado</option>
              <option value="simulado">Simulado</option>
              <option value="not-found">No encontrado</option>
              <option value="error">Error</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="movements-reset-link"
              onClick={() => {
                setLocalSearch('')
                onResetFilters()
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default MovementsToolbar
