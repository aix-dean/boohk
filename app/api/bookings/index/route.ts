import { NextResponse } from "next/server"
import { getAllBookings } from "@/lib/booking-service"
import { algoliasearch } from 'algoliasearch'

let bookingsIndex: any = null

// Initialize Algolia client
function initializeAlgolia() {
  try {
    const client = algoliasearch(
      process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_APP_ID!,
      process.env.ALGOLIA_COST_ESTIMATES_ADMIN_API_KEY!
    ) as any
    bookingsIndex = client.initIndex('booking')
  } catch (error) {
    console.error('Failed to initialize Algolia client:', error)
    throw error
  }
}


// Index booking in Algolia using REST API
async function indexBooking(booking: any) {

  if (!bookingsIndex) {
    initializeAlgolia()
  }

  const algoliaObject = {
    objectID: booking.id,
    reservation_id: booking.reservation_id || '',
    product_name: booking.product_name || '',
    client_name: booking.client?.name || '',
    client_company_name: booking.client?.company_name || '',
    start_date: booking.start_date?.toDate ? booking.start_date.toDate().toISOString() : '',
    end_date: booking.end_date?.toDate ? booking.end_date.toDate().toISOString() : '',
    status: booking.status,
    created: booking.created?.toDate ? booking.created.toDate().toISOString() : '',
    quotation_id: booking.quotation_id || '',
    product_id: booking.product_id || '',
    company_id: booking.company_id,
  }
  await bookingsIndex.saveObject(algoliaObject)
  console.log('Booking indexed in Algolia via client:', booking.id)

}


export async function POST(request: Request) {
  try {
    console.log("Starting bulk indexing of bookings...")

    initializeAlgolia()

    // Get all bookings from Firestore
    const bookings = await getAllBookings()
    console.log(`Found ${bookings.length} bookings to index`)

    // Index each booking
    const indexingPromises = bookings.map(async (booking) => {
      try {
        await indexBooking(booking)
        return { id: booking.id, success: true }
      } catch (error) {
        console.error(`Failed to index booking ${booking.id}:`, error)
        return { id: booking.id, success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    const results = await Promise.all(indexingPromises)

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`Indexing complete. Successful: ${successful}, Failed: ${failed}`)

    return NextResponse.json({
      success: true,
      message: `Indexed ${successful} bookings, ${failed} failed`,
      results
    })

  } catch (error) {
    console.error("Error during bulk indexing:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to index bookings",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}