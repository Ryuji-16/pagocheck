import { useMemo } from 'react'
import { parseAmount, formatBs } from '../utils/formatters'
import './css/MovementsSummary.css'

function MovementsSummary({ items = [] }) {
  const metrics = useMemo(() => {
    let incomeSum = 0
    let incomeCount = 0
    let vueltosSum = 0
    let vueltosCount = 0

    for (const item of items) {
      if (item.status === 'error') continue
      const amount = parseAmount(item.amount)

      if (item.type === 'vuelto') {
        vueltosSum += amount
        vueltosCount += 1
      } else {
        incomeSum += amount
        incomeCount += 1
      }
    }

    const net = incomeSum - vueltosSum

    return {
      incomeSum,
      incomeCount,
      vueltosSum,
      vueltosCount,
      net,
      totalCount: items.length
    }
  }, [items])

  return (
    <div className="movements-summary-container">
      <div className="movements-summary-grid">
        {/* 1. Ingresos / Validaciones */}
        <div className="movements-summary-card summary-card-income">
          <div className="summary-card-header">
            <span className="summary-card-title">Ingresos Verificados</span>
            <div className="summary-card-icon">✓</div>
          </div>
          <div className="summary-card-value">{formatBs(metrics.incomeSum)}</div>
          <div className="summary-card-subtext">
            <span>{metrics.incomeCount} {metrics.incomeCount === 1 ? 'validación' : 'validaciones'}</span>
          </div>
        </div>

        {/* 2. Egresos / Vueltos */}
        <div className="movements-summary-card summary-card-vueltos">
          <div className="summary-card-header">
            <span className="summary-card-title">Vueltos Entregados</span>
            <div className="summary-card-icon">⇄</div>
          </div>
          <div className="summary-card-value">{formatBs(metrics.vueltosSum)}</div>
          <div className="summary-card-subtext">
            <span>{metrics.vueltosCount} {metrics.vueltosCount === 1 ? 'vuelto' : 'vueltos'}</span>
          </div>
        </div>

        {/* 3. Balance Neto */}
        <div className={`movements-summary-card summary-card-balance ${metrics.net < 0 ? 'negative' : ''}`}>
          <div className="summary-card-header">
            <span className="summary-card-title">Balance Neto</span>
            <div className="summary-card-icon">💰</div>
          </div>
          <div className="summary-card-value">{formatBs(metrics.net)}</div>
          <div className="summary-card-subtext">
            <span>Flujo neto en caja</span>
          </div>
        </div>

        {/* 4. Total Operaciones */}
        <div className="movements-summary-card summary-card-total">
          <div className="summary-card-header">
            <span className="summary-card-title">Operaciones</span>
            <div className="summary-card-icon">📊</div>
          </div>
          <div className="summary-card-value">{metrics.totalCount}</div>
          <div className="summary-card-subtext">
            <span>Transacciones registradas</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MovementsSummary
