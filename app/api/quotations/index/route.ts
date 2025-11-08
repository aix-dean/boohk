import { NextResponse } from "next/server"
import { getAllQuotations } from "@/lib/quotation-service"

// Algolia client for indexing
let algoliasearch: any = null
let quotationsIndex: any = null

// Initialize Algolia client
function initializeAlgolia() {
    try {
        algoliasearch = require('algoliasearch')
        const client = algoliasearch(
            process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_APP_ID,
            process.env.ALGOLIA_COST_ESTIMATES_ADMIN_API_KEY
        )
        quotationsIndex = client.initIndex(process.env.NEXT_PUBLIC_ALGOLIA_QUOTATIONS_INDEX_NAME)
    } catch (error) {
        console.error('Failed to initialize Algolia client:', error)
        throw error
    }
}

// Index quotation in Algolia
async function indexQuotation(quotation: any) {
    if (!quotationsIndex) {
        initializeAlgolia()
    }

    const algoliaObject = {
        objectID: quotation.id,
        quotation_number: quotation.quotation_number,
        client_name: quotation.client_name,
        client_email: quotation.client_email,
        client_company_name: quotation.client_company_name,
        client_phone: quotation.client_phone,
        client_address: quotation.client_address,
        client_designation: quotation.client_designation,
        items: quotation.items,
        seller_id: quotation.seller_id,
        status: quotation.status,
        created: quotation.created?.toISOString() || '',
        total_amount: quotation.total_amount,
        company_id: quotation.company_id,
        start_date: quotation.start_date,
        end_date: quotation.end_date,
        duration_days: quotation.duration_days,
        valid_until: quotation.valid_until?.toISOString() || '',
    }

    await quotationsIndex.saveObject(algoliaObject)
    console.log('Quotation indexed in Algolia:', quotation.id)
}

export async function POST(request: Request) {
    try {
        // Parse the request body to determine if it's bulk or single indexing

        // Initialize Algolia
        initializeAlgolia()

        const quotations = await getAllQuotations()
        console.log(`Found ${quotations.length} quotations to index`)

        const indexingPromises = quotations.map(async (quotation) => {
            try {
                await indexQuotation(quotation)
                return { id: quotation.id, success: true }
            } catch (error) {
                console.error(`Failed to index quotation ${quotation.id}:`, error)
                return { id: quotation.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
            }
        })

        const results = await Promise.all(indexingPromises)

        const successful = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length
        console.log(`Indexing complete. Successful: ${successful}, Failed: ${failed}`)

        return NextResponse.json({
            success: true,
            message: `Indexed ${successful} quotations, ${failed} failed`,
            results
        })
    } catch (error) {
        console.error("Error during bulk indexing:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Failed to index quotations",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        )
    }
}
