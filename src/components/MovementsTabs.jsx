function MovementsTabs({ activeTab, onTabChange, counts = {}, periodLabel = 'hoy', currentCount = 0 }) {
  const tabs = [
    { key: 'all', label: 'Todas', count: counts.all ?? 0 },
    { key: 'validacion', label: 'Validaciones', count: counts.validacion ?? 0 },
    { key: 'vuelto', label: 'Vueltos', count: counts.vuelto ?? 0 }
  ]

  return (
    <div className="movements-tabs-container">
      <div className="movements-tabs" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`movements-tab ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="movements-tab-badge">{tab.count}</span>
            </button>
          )
        })}
      </div>

      <div className="movements-tabs-summary">
        Mostrando <strong>{currentCount}</strong> {currentCount === 1 ? 'movimiento' : 'movimientos'} {periodLabel}
      </div>
    </div>
  )
}

export default MovementsTabs
