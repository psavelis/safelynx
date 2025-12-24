import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  totalItems: number
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalItems,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4 glass rounded-lg">
      <div className="flex items-center gap-3">
        <label htmlFor="pageSize" className="menu-item text-surface-400">
          Items per page:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg 
                     text-surface-100 hover:border-surface-600 focus:outline-none 
                     focus:border-lynx-500 focus:ring-1 focus:ring-lynx-500/30 
                     transition-all duration-200 cursor-pointer"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="menu-item text-surface-400">
        Showing {startItem} to {endItem} of {totalItems} items
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={clsx(
            'inline-flex items-center justify-center gap-2 px-3 py-2',
            'rounded-lg font-medium transition-all duration-200',
            currentPage === 1
              ? 'bg-surface-800 text-surface-500 cursor-not-allowed'
              : 'bg-surface-800 hover:bg-surface-700 text-surface-100'
          )}
          title="Previous page"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            const isVisible =
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1)

            if (!isVisible) {
              if (page === currentPage - 2) {
                return (
                  <span key="ellipsis-left" className="px-2 text-surface-500">
                    ...
                  </span>
                )
              }
              if (page === currentPage + 2) {
                return (
                  <span key="ellipsis-right" className="px-2 text-surface-500">
                    ...
                  </span>
                )
              }
              return null
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={clsx(
                  'w-10 h-10 rounded-lg font-semibold transition-all duration-200',
                  page === currentPage
                    ? 'bg-lynx-600 text-white hover:bg-lynx-500'
                    : 'bg-surface-800 text-surface-100 hover:bg-surface-700'
                )}
              >
                {page}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={clsx(
            'inline-flex items-center justify-center gap-2 px-3 py-2',
            'rounded-lg font-medium transition-all duration-200',
            currentPage === totalPages
              ? 'bg-surface-800 text-surface-500 cursor-not-allowed'
              : 'bg-surface-800 hover:bg-surface-700 text-surface-100'
          )}
          title="Next page"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
