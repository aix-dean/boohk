// Define the search result interface
export interface SearchResult {
  objectID: string
  name: string
  type: string
  location?: string
  price?: number
  site_code?: string
  image_url?: string
  category?: string
  seller_id?: string
  media?: Array<{
    url: string
    distance: string
    type: string
    isVideo: boolean
  }>
  specs_rental?: any
  description?: string
  _highlightResult?: any

}

// Define the search response interface
export interface SearchResponse {
  hits: SearchResult[]
  nbHits: number
  page: number 
  nbPages: number
  hitsPerPage: number
  processingTimeMS: number
  query: string
  error?: string
  details?: string
}

// Function to search products
export async function searchProducts(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching products for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'products', page, hitsPerPage }

    // Only add filters if companyId is provided
    if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching products:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search service assignments
export async function searchServiceAssignments(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching service assignments for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'service_assignments', page, hitsPerPage }

    // Add filters if companyId is provided
    if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching service assignments:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search bookings
export async function searchBookings(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching bookings for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'booking', page, hitsPerPage }

    // Add filters if companyId is provided
    if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching bookings:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search cost estimates
export async function searchCostEstimates(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching cost estimates for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'cost_estimates', page, hitsPerPage }

    // Add filters if companyId is provided
    if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching cost estimates:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search proposals
export async function searchProposals(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching proposals for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'proposals', page, hitsPerPage }

    // Add filters if companyId is provided and not empty
    if (companyId && companyId.trim() !== '') {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching proposals:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}
// Function to search quotations
export async function searchQuotations(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching quotations for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'quotations', page, hitsPerPage }

    // Add filters if companyId is provided
    if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching quotations:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search price listing products
export async function searchPriceListingProducts(query: string, userId?: string): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching price listing products for: "${query}"${userId ? ` with user filter: ${userId}` : ""}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'price_listing' }

    // Only add filters if userId is provided
    if (userId) {
      requestBody.filters = `company_id:${userId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching price listing products:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search collectibles
export async function searchCollectibles(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching collectibles for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'collectibles', page, hitsPerPage }

    // Add filters if companyId is provided
    if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching collectibles:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search reports
export async function searchReports(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10, filters?: string): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching reports for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'reports', page, hitsPerPage }

    // Add filters if provided
    if (filters) {
      requestBody.filters = filters
    } else if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching reports:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search transactions
export async function searchTransactions(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10, filters?: string): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching transactions for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'transactions', page, hitsPerPage }

    // Add filters
    let filterString = ''
    if (companyId) {
      filterString += `companyId:${companyId}`
    }
    if (filters) {
      if (filterString) filterString += ' AND '
      filterString += filters
    }
    if (filterString) {
      requestBody.filters = filterString
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching transactions:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}

// Function to search emails
export async function searchEmails(query: string, companyId?: string, page: number = 0, hitsPerPage: number = 10, filters?: string): Promise<SearchResponse> {
  try {
    // Log the search attempt
    console.log(`Searching emails for: "${query}"${companyId ? ` with company filter: ${companyId}` : ""} page: ${page}, hitsPerPage: ${hitsPerPage}`)

    // Create the request body
    const requestBody: any = { query, indexName: 'emails', page, hitsPerPage }

    // Add filters if provided
    if (filters) {
      requestBody.filters = filters
    } else if (companyId) {
      requestBody.filters = `company_id:${companyId}`
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store", // Disable caching for search requests
    })

    // Log the response status
    console.log(`Search response status: ${response.status}`)

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Search API error (${response.status}): ${errorText}`)
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 200), // Limit the error text length
      }
    }

    // Try to parse the response as JSON
    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError)
      const text = await response.text()
      console.error("Raw response:", text.substring(0, 200))
      return {
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query,
        error: "Invalid JSON response from search API",
        details: text.substring(0, 200), // Limit the error text length
      }
    }

    return data
  } catch (error) {
    console.error("Error searching emails:", error)
    // Return empty results instead of throwing
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 0,
      processingTimeMS: 0,
      query,
      error: error instanceof Error ? error.message : "Unknown search error",
    }
  }
}