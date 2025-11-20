import { NextResponse } from "next/server"
import { getAllTransactions } from "@/lib/transaction-service"
import { algoliasearch } from 'algoliasearch'

let transactionsIndex: any = null

// Initialize Algolia client
function initializeAlgolia() {
  try {
    const client = algoliasearch(
      process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
      process.env.ALGOLIA_ADMIN_API_KEY!
    ) as any
    transactionsIndex = client.initIndex('transactions')
  } catch (error) {
    console.error('Failed to initialize Algolia client:', error)
    throw error
  }
}

// Index transaction in Algolia
async function indexTransaction(transaction: any) {
  if (!transactionsIndex) {
    initializeAlgolia()
  }

  const algoliaObject = {
    objectID: transaction.id,
    id: transaction.id,
    'client.name': transaction.client?.name || '',
    merchantName: transaction.merchantName,
    status: transaction.status,
    amount: transaction.amount,
    date: transaction.createdAt?.toISOString() || '',
    description: transaction.description,
    companyId: transaction.companyId,
    createdAt: transaction.createdAt?.toISOString() || '',
  }

  await transactionsIndex.saveObject(algoliaObject)
  console.log('Transaction indexed in Algolia:', transaction.id)
}

export async function POST(request: Request) {
  try {
    console.log("Starting bulk indexing of transactions...")

    // Initialize Algolia
    initializeAlgolia()

    // Get all transactions from Firestore
    const transactions = await getAllTransactions()
    console.log(`Found ${transactions.length} transactions to index`)

    // Index each transaction
    const indexingPromises = transactions.map(async (transaction) => {
      try {
        await indexTransaction(transaction)
        return { id: transaction.id, success: true }
      } catch (error) {
        console.error(`Failed to index transaction ${transaction.id}:`, error)
        return { id: transaction.id, success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    const results = await Promise.all(indexingPromises)

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`Indexing complete. Successful: ${successful}, Failed: ${failed}`)

    return NextResponse.json({
      success: true,
      message: `Indexed ${successful} transactions, ${failed} failed`,
      results
    })

  } catch (error) {
    console.error("Error during bulk indexing:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to index transactions",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}