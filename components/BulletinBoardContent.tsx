import { Pagination } from "@/components/ui/pagination"
import { BookingCard } from "./BookingCard"
import type { Product, ServiceAssignment } from "@/lib/firebase-service"
import type { ReportData } from "@/lib/report-service"

interface Booking {
  id: string
  product_id?: string
  product_owner?: string
  client_name?: string
  start_date?: any
  end_date?: any
  status?: string
  created?: any
  quotation_id?: string
  project_name?: string
  reservation_id?: string
}

interface BulletinBoardContentProps {
  title?: string
  showTitle?: boolean
  showSearch?: boolean
  containerClassName?: string
  paginationClassName?: string
  linkPrefix?: string
  latestJoIds?: { [productId: string]: string }
  onClick?: (product: Product) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  loading: boolean
  bookings: Booking[]
  products: Product[]
  currentPage: number
  itemsPerPage: number
  totalPages: number
  handleNextPage: () => void
  handlePreviousPage: () => void
  reports: { [bookingId: string]: ReportData[] }
  reportsLoading: boolean
  serviceAssignments: { [bookingId: string]: ServiceAssignment[] }
  serviceAssignmentsLoading: boolean
}

export const BulletinBoardContent = ({
  title = "Bulletin Board",
  showTitle = true,
  showSearch = true,
  containerClassName = "bg-neutral-50 min-h-screen px-4 py-6",
  paginationClassName = "flex justify-center mt-4 pb-4",
  linkPrefix = "/logistics/bulletin-board",
  latestJoIds = {},
  onClick,
  searchTerm,
  setSearchTerm,
  loading,
  bookings,
  products,
  currentPage,
  itemsPerPage,
  totalPages,
  handleNextPage,
  handlePreviousPage,
  reports,
  reportsLoading,
  serviceAssignments,
  serviceAssignmentsLoading,
}: BulletinBoardContentProps) => {
  return (
    <div className={containerClassName}>
      {showTitle && <h1 className="text-lg font-bold text-gray-700 mb-4">{title}</h1>}

      {showSearch && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-700">Search:</span>
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[190px] h-6 px-3 py-1 border border-gray-400 rounded text-sm text-gray-500 bg-white"
            />
          </div>
          <div className="ml-auto flex gap-2 opacity-30 items-center">
            <img src="/icons/listview.png" alt="List view" style={{ width: '19.276px', height: '19.276px', flexShrink: 0, aspectRatio: '19.28/19.28' }} />
            <img src="/icons/cardview.png" alt="Card view" style={{ width: '26.505px', height: '26.505px', flexShrink: 0, aspectRatio: '26.50/26.50' }} />
          </div>
        </div>
      )}

      <div className="flex flex-col">
        <div className="flex-1">
          {loading ? (
            <div data-testid="loading-skeleton" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                  <div className="h-16 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded mb-1"></div>
                  <div className="h-6 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded mb-3"></div>
                  <div className="border-t pt-2">
                    <div className="h-3 bg-gray-300 rounded mb-1"></div>
                    <div className="h-3 bg-gray-300 rounded mb-1"></div>
                    <div className="h-3 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-lg">No Activities yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((booking) => {
                const product = products.find(p => p.id === booking.product_id);
                return (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    product={product}
                    reports={reports}
                    reportsLoading={reportsLoading}
                    serviceAssignments={serviceAssignments}
                    serviceAssignmentsLoading={serviceAssignmentsLoading}
                    linkPrefix={linkPrefix}
                    latestJoIds={latestJoIds}
                    onClick={onClick}
                  />
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className={paginationClassName}>
            <Pagination
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalItems={Math.min(itemsPerPage, bookings.length - (currentPage - 1) * itemsPerPage)}
              totalOverall={bookings.length}
              onNextPage={handleNextPage}
              onPreviousPage={handlePreviousPage}
              hasMore={currentPage < totalPages}
            />
          </div>
        )}
      </div>
    </div>
  );
};