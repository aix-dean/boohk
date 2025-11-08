import { NextResponse } from "next/server"
import { getAllCostEstimates } from "@/lib/cost-estimate-service"

// Algolia client for indexing
let algoliasearch: any = null
let costEstimatesIndex: any = null

// Initialize Algolia client
function initializeAlgolia() {
  try {
    algoliasearch = require('algoliasearch')
    const client = algoliasearch(
      process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_APP_ID,
      process.env.ALGOLIA_COST_ESTIMATES_ADMIN_API_KEY
    )
    costEstimatesIndex = client.initIndex(process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_INDEX_NAME)
  } catch (error) {
    console.error('Failed to initialize Algolia client:', error)
    throw error
  }
}

// Index cost estimate in Algolia
async function indexCostEstimate(costEstimate: any) {
  if (!costEstimatesIndex) {
    initializeAlgolia()
  }

  const algoliaObject = {
    objectID: costEstimate.id,
    id: costEstimate.id,
    title: costEstimate.title,
    client_company: costEstimate.client?.company || '',
    client_contact: costEstimate.client?.name || '',
    status: costEstimate.status,
    totalAmount: costEstimate.totalAmount,
    createdAt: costEstimate.createdAt?.toISOString() || '',
    company_id: costEstimate.company_id,
    lineItems: costEstimate.lineItems || [],
    lineItemsCount: costEstimate.lineItems?.length || 0,
  }

  await costEstimatesIndex.saveObject(algoliaObject)
  console.log('Cost estimate indexed in Algolia:', costEstimate.id)
}

export async function POST(request: Request) {
  try {
    console.log("Starting bulk indexing of cost estimates...")

    // Initialize Algolia
    initializeAlgolia()

    // Get all cost estimates from Firestore
    const costEstimates = await getAllCostEstimates()
    console.log(`Found ${costEstimates.length} cost estimates to index`)

    // Index each cost estimate
    const indexingPromises = costEstimates.map(async (costEstimate) => {
      try {
        await indexCostEstimate(costEstimate)
        return { id: costEstimate.id, success: true }
      } catch (error) {
        console.error(`Failed to index cost estimate ${costEstimate.id}:`, error)
        return { id: costEstimate.id, success: false, error: error.message }
      }
    })

    const results = await Promise.all(indexingPromises)

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`Indexing complete. Successful: ${successful}, Failed: ${failed}`)

    return NextResponse.json({
      success: true,
      message: `Indexed ${successful} cost estimates, ${failed} failed`,
      results
    })

  } catch (error) {
    console.error("Error during bulk indexing:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to index cost estimates",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}