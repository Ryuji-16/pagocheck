function MovementsPagination({
  currentPage = 1,
  totalPages = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange
}) {
  if (totalPages <= 1 && pageSize >= 50) return null

  // Generar lista de páginas para mostrar
  function getPageNumbers() {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      let start = Math.max(1, currentPage - 2)
      let end = Math.min(totalPages, start + maxVisible - 1)

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1)
      }

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
    }
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="movements-pagination-container">
      {/* Selector de filas por página */}
      <div className="movements-page-size">
        <span>Movimientos por página</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Controles de página */}
      <div className="movements-page-nav">
        <button
          type="button"
          className="page-nav-arrow"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Página anterior"
        >
          ‹
        </button>

        {pageNumbers.map((p) => {
          const isActive = p === currentPage
          return (
            <button
              key={p}
              type="button"
              className={`page-nav-number ${isActive ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        })}

        <button
          type="button"
          className="page-nav-arrow"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>
    </div>
  )
}

export default MovementsPagination
