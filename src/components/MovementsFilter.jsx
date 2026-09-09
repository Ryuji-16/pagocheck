import './css/MovementsFilter.css'

function MovementsFilter({
  filters,
  onFilterChange,
  onReset,
  cajas = [],
  filteredCount = 0,
  totalCount = 0
}) {
  const hasActiveFilters = Boolean(
    filters.caja || filters.type || filters.status || filters.search
  )

  return (
    <div className="movements-filter-container">
      <div className="movements-filter-header">
        <span className="movements-filter-title">
          <span>🔍</span> Filtros avanzados
        </span>
        <span className="movements-filter-count">
          Mostrando {filteredCount} de {totalCount}
        </span>
      </div>

      <div className="movements-filter-grid">
        <div className="movements-filter-field">
          <label htmlFor="filter-caja">Caja / Terminal</label>
          <select
            id="filter-caja"
            value={filters.caja}
            onChange={(e) => onFilterChange('caja', e.target.value)}
          >
            <option value="">Todas las cajas</option>
            {cajas.map((caja) => (
              <option key={caja.key} value={caja.key}>
                {caja.label}
              </option>
            ))}
          </select>
        </div>

        <div className="movements-filter-field">
          <label htmlFor="filter-type">Tipo de movimiento</label>
          <select
            id="filter-type"
            value={filters.type}
            onChange={(e) => onFilterChange('type', e.target.value)}
          >
            <option value="">Todos los tipos</option>
            <option value="validacion">Validación</option>
            <option value="vuelto">Vuelto</option>
          </select>
        </div>

        <div className="movements-filter-field">
          <label htmlFor="filter-status">Estado</label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="confirmed">Confirmado</option>
            <option value="simulado">Simulado</option>
            <option value="not-found">No encontrado</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="movements-filter-field">
          <label htmlFor="filter-search">Búsqueda rápida</label>
          <input
            id="filter-search"
            type="text"
            placeholder="Ref, tlf, banco, cédula..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          className="movements-filter-reset"
          onClick={onReset}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

export default MovementsFilter
