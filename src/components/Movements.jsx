import { useEffect, useMemo, useState } from 'react'
import { listMovements } from '../services/historyService'
import { exportMovementsToExcel } from '../services/exportService'
import { isDateInPreset, parseAmount, parseDate } from '../utils/formatters'
import MovementsTabs from './MovementsTabs'
import MovementsToolbar from './MovementsToolbar'
import MovementsTable from './MovementsTable'
import MovementsPagination from './MovementsPagination'
import MovementsSummary from './MovementsSummary'
import ReceiptViewerModal from './ReceiptViewerModal'
import './css/Movements.css'
import './css/MovementsToolbar.css'
import './css/MovementsTable.css'
import './css/MovementsPagination.css'

function Movements({ session, onBack }) {
  const [items, setItems] = useState([])
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'validacion' | 'vuelto'
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedCaja, setSelectedCaja] = useState('')
  const [selectedBank, setSelectedBank] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [datePreset, setDatePreset] = useState('today') // 'today' | 'yesterday' | 'week' | 'all'
  const [sortField, setSortField] = useState('date') // 'date' | 'amount'
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' | 'asc'
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    let cancelled = false
    listMovements(session).then((rows) => {
      if (!cancelled) setItems(rows || [])
    })
    return () => {
      cancelled = true
    }
  }, [session])

  // Opciones de sucursal para el selector de Admin
  const branchesOptions = useMemo(() => {
    const set = new Set()
    for (const item of items) {
      if (item.branch) set.add(item.branch)
    }
    const defaultBranches = [
      'Tienda 1 - Centro',
      'Tienda 2 - Norte',
      'Tienda 3 - Sur',
      'Camión Móvil'
    ]
    for (const b of defaultBranches) {
      set.add(b)
    }
    return Array.from(set)
  }, [items])

  // Opciones de caja para el selector de Admin (filtradas por sucursal si hay una seleccionada)
  const cajasOptions = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      if (selectedBranch && item.branch && item.branch !== selectedBranch) {
        continue
      }
      const key = item.username || item.label
      if (key && !map.has(key)) {
        map.set(key, item.label || item.username)
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [items, selectedBranch])

  // Opciones de banco para el selector de Admin
  const banksOptions = useMemo(() => {
    const set = new Set()
    for (const item of items) {
      if (item.bank) set.add(item.bank)
    }
    const defaultBanks = ['Banesco', 'Banco de Venezuela', 'Banco Exterior', 'Mercantil']
    for (const b of defaultBanks) {
      set.add(b)
    }
    return Array.from(set)
  }, [items])

  // Conteos para las pestañas según la fecha activa
  const tabCounts = useMemo(() => {
    const itemsInPeriod = items.filter((item) => {
      const rawDate = item.at || item.created_at || item.date || item.timestamp
      return isDateInPreset(rawDate, datePreset)
    })

    const all = itemsInPeriod.length
    const validacion = itemsInPeriod.filter((i) => i.type === 'validacion').length
    const vuelto = itemsInPeriod.filter((i) => i.type === 'vuelto').length

    return { all, validacion, vuelto }
  }, [items, datePreset])

  // Filtrado de movimientos
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // 1. Filtro por Sucursal (solo Admin)
        if (isAdmin && selectedBranch) {
          if (item.branch !== selectedBranch) return false
        }

        // 2. Filtro por Caja (solo Admin)
        if (isAdmin && selectedCaja) {
          const itemKey = item.username || item.label
          if (itemKey !== selectedCaja) return false
        }

        // 3. Filtro por Banco
        if (selectedBank && item.bank !== selectedBank) {
          return false
        }

        // 4. Filtro por Pestaña activa (Todas / Validaciones / Vueltos)
        if (activeTab === 'validacion' && item.type !== 'validacion') return false
        if (activeTab === 'vuelto' && item.type !== 'vuelto') return false

        // 5. Filtro por Estado
        if (statusFilter && item.status !== statusFilter) return false

        // 6. Filtro por Período / Fecha
        const rawDate = item.at || item.created_at || item.date || item.timestamp
        if (!isDateInPreset(rawDate, datePreset)) return false

        // 7. Búsqueda por texto (referencia, teléfono, cédula, banco, etc.)
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase()
          const combinedText = [
            item.reference,
            item.phone,
            item.cedula,
            item.bank,
            item.branch,
            item.label,
            item.username,
            item.note,
            item.amount
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          if (!combinedText.includes(q)) return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortField === 'amount') {
          const amountA = parseAmount(a.amount)
          const amountB = parseAmount(b.amount)
          return sortOrder === 'asc' ? amountA - amountB : amountB - amountA
        }

        // Ordenamiento por fecha por defecto
        const dateA = parseDate(a.at || a.created_at || a.date || a.timestamp)?.getTime() || 0
        const dateB = parseDate(b.at || b.created_at || b.date || b.timestamp)?.getTime() || 0
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
  }, [items, isAdmin, selectedBranch, selectedCaja, selectedBank, activeTab, statusFilter, datePreset, searchQuery, sortField, sortOrder])

  // Movimientos filtrados por período, sucursal y caja para el arqueo financiero consolidado
  const summaryItems = useMemo(() => {
    return items.filter((item) => {
      if (isAdmin && selectedBranch && item.branch !== selectedBranch) {
        return false
      }
      if (isAdmin && selectedCaja && item.username !== selectedCaja && item.label !== selectedCaja) {
        return false
      }
      if (selectedBank && item.bank !== selectedBank) {
        return false
      }
      const rawDate = item.at || item.created_at || item.date || item.timestamp
      return isDateInPreset(rawDate, datePreset)
    })
  }, [items, isAdmin, selectedBranch, selectedCaja, selectedBank, datePreset])

  // Paginación segura derivada del total de páginas
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, safeCurrentPage, pageSize])

  function handleTabChange(tab) {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  function handleSortChange(field) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  function handleResetFilters() {
    setSelectedBranch('')
    setSelectedCaja('')
    setSelectedBank('')
    setSearchQuery('')
    setStatusFilter('')
    setDatePreset('today')
    setCurrentPage(1)
  }

  const hasActiveFilters = Boolean(
    selectedBranch || selectedCaja || selectedBank || searchQuery || statusFilter || datePreset !== 'today'
  )

  const datePresetLabels = {
    today: 'hoy',
    yesterday: 'ayer',
    week: 'en los últimos 7 días',
    all: 'en total'
  }

  async function handleExport() {
    if (filteredItems.length === 0) {
      setFeedback({
        type: 'error',
        text: 'No hay validaciones ni vueltos para exportar con los filtros seleccionados.'
      })
      return
    }

    setExporting(true)
    setFeedback(null)

    try {
      const isOnlyToday = datePreset === 'today'
      const result = await exportMovementsToExcel(filteredItems, { onlyToday: isOnlyToday })
      const valids = result.validacionesCount ?? 0
      const vueltos = result.vueltosCount ?? 0
      const cajasCount = result.sheetsCount ?? 1
      const totalRecords = result.totalRecords ?? (valids + vueltos)

      let detail = ''
      if (valids > 0 && vueltos > 0) {
        detail = `${valids} validación${valids > 1 ? 'es' : ''} y ${vueltos} vuelto${vueltos > 1 ? 's' : ''}`
      } else if (valids > 0) {
        detail = `${valids} validación${valids > 1 ? 'es' : ''}`
      } else if (vueltos > 0) {
        detail = `${vueltos} vuelto${vueltos > 1 ? 's' : ''}`
      } else {
        detail = `${totalRecords} registro${totalRecords > 1 ? 's' : ''}`
      }

      const periodDesc = isOnlyToday ? 'del día de hoy' : 'del período seleccionado'
      setFeedback({
        type: 'success',
        text: `Excel descargado con éxito: ${detail} ${periodDesc} en ${cajasCount} caja${cajasCount > 1 ? 's' : ''}.`
      })
    } catch (err) {
      console.error('Error al exportar movimientos:', err)
      setFeedback({
        type: 'error',
        text: err.message || 'Ocurrió un error al generar el archivo Excel.'
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="movements-screen">
      {/* 1. Miga de pan / Navegación */}
      <div className="movements-breadcrumb">
        <button type="button" className="modal-back-button" onClick={onBack}>
          ← Menú
        </button>
      </div>

      {/* 2. Cabecera principal y botón Exportar */}
      <div className="movements-header">
        <div className="movements-header-text">
          <h1>Movimientos</h1>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="movements-export-button"
            onClick={handleExport}
            disabled={exporting || items.length === 0}
            title="Exportar a Excel los movimientos seleccionados organizados por caja"
          >
            <span>📊</span> {exporting ? 'Exportando...' : 'Exportar a Excel'}
          </button>
        )}
      </div>

      {/* 3. Feedback tras exportar u operar */}
      {feedback && (
        <div className={`movements-feedback ${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      {/* Control Financiero y Arqueo Consolidado en tiempo real (solo visible para Administrador) */}
      {isAdmin && <MovementsSummary items={summaryItems} />}

      {/* 4. Pestañas superiores (Todas | Validaciones | Vueltos) */}
      <MovementsTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={tabCounts}
        periodLabel={datePresetLabels[datePreset] || 'en este período'}
        currentCount={filteredItems.length}
      />

      {/* 5. Barra unificada de búsqueda y filtros */}
      <MovementsToolbar
        isAdmin={isAdmin}
        branches={branchesOptions}
        selectedBranch={selectedBranch}
        onBranchChange={(branch) => {
          setSelectedBranch(branch)
          setSelectedCaja('')
          setCurrentPage(1)
        }}
        cajas={cajasOptions}
        selectedCaja={selectedCaja}
        onCajaChange={(caja) => {
          setSelectedCaja(caja)
          setCurrentPage(1)
        }}
        banks={banksOptions}
        selectedBank={selectedBank}
        onBankChange={(bank) => {
          setSelectedBank(bank)
          setCurrentPage(1)
        }}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q)
          setCurrentPage(1)
        }}
        datePreset={datePreset}
        onDatePresetChange={(preset) => {
          setDatePreset(preset)
          setCurrentPage(1)
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(st) => {
          setStatusFilter(st)
          setCurrentPage(1)
        }}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* 6. Tabla de datos (con ordenamiento, referencia y visor de recibo) */}
      <MovementsTable
        items={paginatedItems}
        sortField={sortField}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        onViewReceipt={setSelectedReceipt}
        emptyMessage={
          items.length === 0
            ? 'Aún no hay movimientos registrados.'
            : 'No se encontraron movimientos con los filtros aplicados.'
        }
      />

      {/* 7. Paginación */}
      {filteredItems.length > 0 && (
        <MovementsPagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          totalItems={filteredItems.length}
        />
      )}

      {/* 8. Modal visor táctil de comprobante auditado (El "Ojo") */}
      {selectedReceipt && (
        <ReceiptViewerModal
          item={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </section>
  )
}

export default Movements
