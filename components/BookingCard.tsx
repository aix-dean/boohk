import Image from "next/image"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { formatDateShort } from "@/lib/utils"
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

interface BookingCardProps {
  booking: Booking
  product?: Product
  reports: { [bookingId: string]: ReportData[] }
  reportsLoading: boolean
  serviceAssignments: { [bookingId: string]: ServiceAssignment[] }
  serviceAssignmentsLoading: boolean
  linkPrefix?: string
  latestJoIds?: { [productId: string]: string }
  onClick?: (product: Product) => void
}

export const BookingCard = ({ booking, product, reports, reportsLoading, serviceAssignments, serviceAssignmentsLoading, linkPrefix = "/logistics/bulletin-board", latestJoIds = {}, onClick }: BookingCardProps) => {
  const reportList = reports[booking.id] || []

  return (
    <div
      className={`bg-white rounded-[10px] shadow-[-1px_2px_5px_-0.5px_rgba(0,0,0,0.25)] p-4 relative min-h-[195px] ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick ? () => onClick(product!) : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(product!)
        }
      } : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
    >
      <div className="absolute top-2 right-2 opacity-50">
        <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9.5" cy="9.5" r="1.5" fill="currentColor"/>
          <circle cx="9.5" cy="4.5" r="1.5" fill="currentColor"/>
          <circle cx="9.5" cy="14.5" r="1.5" fill="currentColor"/>
        </svg>
      </div>

      <div className="flex gap-3 mb-3">
        <div className="flex-shrink-0">
          <div className="w-[75px] h-[76px] bg-gray-400 rounded-[7px] overflow-hidden">
            {product?.media?.[0]?.url && product.media[0].url.trim() !== '' ? (
              product.media[0].isVideo ? (
                <video
                  src={product.media[0].url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
              ) : (
                <Image
                  src={product.media[0].url}
                  alt="Site Photo"
                  width={75}
                  height={76}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[11px] font-semibold text-center text-black">
                  No<br/>image
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-black mb-1">{booking.reservation_id || booking.id}</p>
          {onClick ? (
            <p className="text-[24px] font-semibold text-black mb-2 truncate cursor-pointer hover:text-blue-600 transition-colors">
              {booking.project_name}
            </p>
          ) : (
            <Link href={`${linkPrefix}/${latestJoIds[booking.id] || booking.id}`}>
              <p className="text-[24px] font-semibold text-black mb-2 truncate cursor-pointer hover:text-blue-600 transition-colors">
                {booking.project_name}
              </p>
            </Link>
          )}
          <p className="text-[14px] font-semibold text-black">
            Site: <span className="font-normal">{product?.name || "Unknown Location"}</span>
          </p>
        </div>
      </div>

      <div className="border-t border-gray-300 pt-3">
        <p className="text-[14px] font-semibold text-black mb-2">Latest Activities:</p>
        {reportsLoading ? (
          <div className="space-y-1 pl-4">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : reportList.length > 0 ? (
           <div className="space-y-1 pl-4">
             {reportList.slice(0, 3).map((report, index) => (
               <p key={index} className="text-[13px] text-black font-light">
                 {formatDateShort(report.created || report.updated || report.date)} - {report.descriptionOfWork || report.status}
               </p>
             ))}
           </div>
        ) : (
          <p className="text-[13px] text-gray-500 pl-4">No Activities yet</p>
        )}
      </div>
    </div>
  );
};