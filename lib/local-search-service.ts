// Sample data for search
const SAMPLE_DATA = [
  // Products
  {
    objectID: "prod1",
    name: "Billboard A123",
    type: "product",
    location: "Main Street & 5th Avenue",
    price: 1200,
    category: "Billboard",
    site_code: "BB-A123",
    image_url: "/roadside-billboard.png",
  },
  {
    objectID: "prod2",
    name: "LED Display XL5",
    type: "product",
    location: "Highway 101 Junction",
    price: 3500,
    category: "LED Display",
    site_code: "LED-XL5",
    image_url: "/led-billboard-1.png",
  },
  {
    objectID: "prod3",
    name: "Digital Panel S200",
    type: "product",
    location: "Downtown Shopping Center",
    price: 2200,
    category: "Digital Panel",
    site_code: "DP-S200",
    image_url: "/led-billboard-2.png",
  },
  {
    objectID: "prod4",
    name: "Transit Shelter Ad B45",
    type: "product",
    location: "Central Bus Terminal",
    price: 850,
    category: "Transit Ad",
    site_code: "TS-B45",
    image_url: "/led-billboard-3.png",
  },
  {
    objectID: "prod5",
    name: "Mall Kiosk K100",
    type: "product",
    location: "Westfield Shopping Mall",
    price: 1500,
    category: "Indoor Display",
    site_code: "MK-K100",
    image_url: "/led-billboard-4.png",
  },
  // Clients
  {
    objectID: "client1",
    name: "Acme Corporation",
    type: "client",
    location: "123 Business Ave, Suite 400",
  },
  {
    objectID: "client2",
    name: "Metro Marketing Agency",
    type: "client",
    location: "456 Commerce St, Floor 12",
  },
  {
    objectID: "client3",
    name: "Global Retail Brands",
    type: "client",
    location: "789 Market Blvd",
  },
  {
    objectID: "client4",
    name: "Tech Innovations Inc",
    type: "client",
    location: "101 Innovation Park",
  },
  {
    objectID: "client5",
    name: "Local Restaurant Chain",
    type: "client",
    location: "202 Food Court Lane",
  },
]

// Search result interface
export interface SearchResult {
  objectID: string
  name: string
  type: string
  location?: string
  price?: number
  site_code?: string
  image_url?: string
  category?: string
  _highlightResult?: any
}

// Search response interface
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

// Function to perform a local search
export function performLocalSearch(query: string): SearchResponse {
  console.log(`Performing local search for: "${query}"`)
  const startTime = performance.now()

  // If query is empty, return empty results
  if (!query.trim()) {
    return {
      hits: [],
      nbHits: 0,
      page: 0,
      nbPages: 0,
      hitsPerPage: 10,
      processingTimeMS: 0,
      query,
    }
  }

  // Convert query to lowercase for case-insensitive search
  const lowerQuery = query.toLowerCase()

  // Filter items that match the query in name, location, category, or site_code
  const filteredItems = SAMPLE_DATA.filter((item) => {
    return (
      item.name.toLowerCase().includes(lowerQuery) ||
      (item.location && item.location.toLowerCase().includes(lowerQuery)) ||
      (item.category && item.category.toLowerCase().includes(lowerQuery)) ||
      (item.site_code && item.site_code.toLowerCase().includes(lowerQuery))
    )
  })

  // Calculate processing time
  const processingTimeMS = Math.round(performance.now() - startTime)

  return {
    hits: filteredItems,
    nbHits: filteredItems.length,
    page: 0,
    nbPages: 1,
    hitsPerPage: 10,
    processingTimeMS,
    query,
  }
}
