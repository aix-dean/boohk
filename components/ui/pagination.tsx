import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  itemsPerPage: number
  totalItems: number // This will be the count of items on the current page, not the total across all pages
  totalOverall?: number // Total items across all pages for display
  onNextPage: () => void
  onPreviousPage: () => void
  hasMore: boolean
}

export function Pagination({
  currentPage,
  itemsPerPage,
  totalItems,
  totalOverall,
  onNextPage,
  onPreviousPage,
  hasMore,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = startItem + totalItems - 1
  const displayTotal = totalOverall ?? totalItems

  return (
    <div className="flex items-center justify-between px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <Button onClick={onPreviousPage} disabled={currentPage === 1} variant="outline" size="sm">
          Previous
        </Button>
        <Button onClick={onNextPage} disabled={!hasMore} variant="outline" size="sm">
          Next
        </Button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="mr-4">
          <p className="text-sm text-gray-700">
            Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{Math.ceil(displayTotal / itemsPerPage) || 1}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex space-x-1 rounded-md shadow-sm" aria-label="Pagination">
            <Button
              onClick={onPreviousPage}
              disabled={currentPage === 1}
              variant="outline"
              className="relative inline-flex items-center rounded-l-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            {/* Current Page Number - For simplicity, we'll just show current page and next/prev */}
            <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
              {currentPage}
            </span>
            <Button
              onClick={onNextPage}
              disabled={!hasMore}
              variant="outline"
              className="relative inline-flex items-center rounded-r-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </nav>
        </div>
      </div>
    </div>
  )
}
