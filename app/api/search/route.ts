import { NextResponse } from "next/server"

export async function POST(request: Request) {
  console.log("Search API route called")

  // Default values for pagination
  let page = 0
  let hitsPerPage = 10

  try {
    // Parse the request body
    let query = ""
    let filters = undefined
    let indexName = undefined
    try {
      const body = await request.json()
      query = body.query || ""
      filters = body.filters
      indexName = body.indexName
      page = body.page || 0
      hitsPerPage = body.hitsPerPage || 10
    } catch (error) {
      console.error("Error parsing request body:", error)
      return NextResponse.json(
        {
          error: "Invalid request body",
          hits: [],
          nbHits: 0,
          page: page,
          nbPages: 0,
          hitsPerPage: hitsPerPage,
          processingTimeMS: 0,
          query: "",
        },
        { status: 400 },
      )
    }

    console.log(`Received search query: "${query}"${filters ? ` with filters: ${filters}` : ""}`)

    if (typeof query !== "string") {
      console.error("Invalid query parameter:", query)
      return NextResponse.json(
        {
          error: "Query parameter must be a string",
          hits: [],
          nbHits: 0,
          page: page,
          nbPages: 0,
          hitsPerPage: hitsPerPage,
          processingTimeMS: 0,
          query: "",
        },
        { status: 400 },
      )
    }

    // Check if environment variables are available
    let appId: string | undefined
    let apiKey: string | undefined
    let finalIndexName: string | undefined

    if (indexName === 'products') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
      apiKey = process.env.ALGOLIA_ADMIN_API_KEY
      finalIndexName = 'products'
    } else if (indexName === 'service_assignments') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_ASSIGNMENTS_APP_ID
      apiKey = process.env.ALGOLIA_ASSIGNMENTS_ADMIN_API_KEY
      finalIndexName = process.env.NEXT_PUBLIC_ALGOLIA_ASSIGNMENTS_INDEX_NAME
    } else if (indexName === 'cost_estimates') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_APP_ID
      apiKey = process.env.ALGOLIA_COST_ESTIMATES_ADMIN_API_KEY
      finalIndexName = process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_INDEX_NAME
    } else if (indexName === 'collectibles') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_APP_ID
      apiKey = process.env.ALGOLIA_COST_ESTIMATES_ADMIN_API_KEY
      finalIndexName = 'collectibles'
    } else if (indexName === 'quotations') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_COST_ESTIMATES_APP_ID
      apiKey = process.env.ALGOLIA_COST_ESTIMATES_ADMIN_API_KEY
      finalIndexName = process.env.NEXT_PUBLIC_ALGOLIA_QUOTATIONS_INDEX_NAME
    } else if (indexName === 'booking') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
      apiKey = process.env.ALGOLIA_ADMIN_API_KEY
      finalIndexName = 'booking'
    } else if (indexName === 'reports') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
      apiKey = process.env.ALGOLIA_ADMIN_API_KEY
      finalIndexName = 'reports'
    } else if (indexName === 'proposals') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
      apiKey = process.env.ALGOLIA_ADMIN_API_KEY
      finalIndexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME
    } else if (indexName === 'emails') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
      apiKey = process.env.ALGOLIA_ADMIN_API_KEY
      finalIndexName = 'emails'
    } else if (indexName === 'transactions') {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
      apiKey = process.env.ALGOLIA_ADMIN_API_KEY
      finalIndexName = 'transactions'
    } else {
      appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
      apiKey = process.env.ALGOLIA_ADMIN_API_KEY
      finalIndexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME
    }

    if (!appId || !apiKey || !finalIndexName) {
      console.error("Missing Algolia environment variables")
      return NextResponse.json(
        {
          error: "Algolia configuration is incomplete. Please check your environment variables.",
          hits: [],
          nbHits: 0,
          page: page,
          nbPages: 0,
          hitsPerPage: hitsPerPage,
          processingTimeMS: 0,
          query,
        },
        { status: 500 },
      )
    }

    // Use the Algolia REST API directly instead of the JS client
    // This avoids issues with importing the client in Next.js server components
    const url = `https://${appId}-dsn.algolia.net/1/indexes/${finalIndexName}/query`
    const headers = {
      "X-Algolia-API-Key": apiKey,
      "X-Algolia-Application-Id": appId,
      "Content-Type": "application/json",
    }

    // Prepare search parameters
    let attributesToRetrieve = "name,type,location,price,site_code,image_url,category,seller_id"
    let attributesToHighlight = "name,location"

    if (indexName === 'products') {
      attributesToRetrieve = "name,type,location,price,site_code,category,seller_id,media,specs_rental,description"
      attributesToHighlight = "name,location,description"
    } else if (indexName === 'service_assignments') {
      attributesToRetrieve = "saNumber,projectSiteId,projectSiteName,projectSiteLocation,serviceType,assignedTo,jobDescription,message,joNumber,requestedBy,status,coveredDateStart,coveredDateEnd,created,updated,company_id"
      attributesToHighlight = "saNumber,projectSiteName,serviceType"
    } else if (indexName === 'cost_estimates') {
      attributesToRetrieve = "id,costEstimateNumber,title,client,client_company,client_contact,client_email,client_phone,status,totalAmount,createdAt,company_id,lineItems,lineItemsCount"
      attributesToHighlight = "costEstimateNumber,title,client_company,client_contact"
    } else if (indexName === 'collectibles') {
      attributesToRetrieve = "id,invoice_number,invoice_id,contract_pdf_url,client,period,amount,due_date,booking,status,created,company_id"
      attributesToHighlight = "invoice_number,client.name,booking.reservation_id,booking.project_name"
    } else if (indexName === 'quotaions') {
      attributesToRetrieve = "quotation_number,client_name,items,seller_id,status,created,client_company_name,client_email,client_phone,client_address,client_designation,total_amount,company_id,projectCompliance,projectName"
      attributesToHighlight = "quotation_number,client_name,created"
    } else if (indexName === 'booking') {
      attributesToRetrieve = "id,cancel_reason,category_id,client,company_id,contract,cost,costDetails,tax,discount,created,end_date,media_order,payment_method,product_id,product_name,product_owner,project_name,promos,projectCompliance,requirements,reservation_id,seller_id,spot_numbers,start_date,status,total_cost,type,updated,user_id,quotation_id,quotation_number,isCollectibles,items,url,for_screening,airing_code"
      attributesToHighlight = "reservation_id,product_name,client.name,client.company_name"
    } else if (indexName === 'reports') {
      attributesToRetrieve = "siteName,date,reportType,createdByName,category,company_id,status,created,report_id,product,logistics_report"
      attributesToHighlight = "siteName,reportType,createdByName"
    } else if (indexName === 'proposals') {
      attributesToRetrieve = "id,proposalNumber,title,client_company,client_contactPerson,client_name,client_email,status,createdAt,company_id,totalAmount,products"
      attributesToHighlight = "proposalNumber,title,client_company,client_contactPerson"
    } else if (indexName === 'emails') {
       attributesToRetrieve = "id,sentAt,subject,to,cc,body,attachments"
       attributesToHighlight = "subject,to,body"
    } else if (indexName === 'transactions') {
      attributesToRetrieve = "id,client.name,merchantName,status,amount,date,description,companyId,createdAt"
      attributesToHighlight = "id,client.name,merchantName,status,description"
    }

    const searchParams: any = {
      query,
      hitsPerPage: hitsPerPage.toString(),
      page: page.toString(),
      attributesToRetrieve,
      attributesToHighlight,
    }

    // Add filters if provided
    if (filters) {
      searchParams["filters"] = filters
    }

    const body = JSON.stringify({
      params: new URLSearchParams(searchParams).toString(),
    })

    console.log(`Calling Algolia REST API: ${url}`)
    console.log(`Search parameters: ${JSON.stringify(searchParams)}`)
    console.log(`Request body: ${body}`)

    const algoliaResponse = await fetch(url, {
      method: "POST",
      headers,
      body,
    })

    if (!algoliaResponse.ok) {
      const errorText = await algoliaResponse.text()
      console.error(`Algolia API error (${algoliaResponse.status}):`, errorText)
      return NextResponse.json(
        {
          error: `Algolia API returned status ${algoliaResponse.status}`,
          details: errorText,
          hits: [],
          nbHits: 0,
          page: page,
          nbPages: 0,
          hitsPerPage: hitsPerPage,
          processingTimeMS: 0,
          query,
        },
        { status: algoliaResponse.status },
      )
    }

    const searchResults = await algoliaResponse.json()
    console.log(`Search completed with ${searchResults.nbHits} results`)
    console.log(`Search results:`, JSON.stringify(searchResults, null, 2))

    return NextResponse.json(searchResults)
  } catch (error) {
    console.error("Search API error:", error)

    // Always return a valid JSON response
    return NextResponse.json(
      {
        error: "An error occurred while searching. Please try again later.",
        details: error instanceof Error ? error.message : "Unknown error",
        hits: [],
        nbHits: 0,
        page: page,
        nbPages: 0,
        hitsPerPage: hitsPerPage,
        processingTimeMS: 0,
        query: "",
      },
      { status: 500 },
    )
  }
}
