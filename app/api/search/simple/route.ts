import { NextResponse } from "next/server"

// Simple in-memory database for search
const items = [
  { objectID: "1", name: "Billboard A1", type: "product", location: "Main Street", price: 1200, category: "Billboard" },
  {
    objectID: "2",
    name: "LED Display B2",
    type: "product",
    location: "Downtown",
    price: 3500,
    category: "LED Display",
  },
  {
    objectID: "3",
    name: "Static Billboard C3",
    type: "product",
    location: "Highway Junction",
    price: 800,
    category: "Billboard",
  },
  {
    objectID: "4",
    name: "Digital Panel D4",
    type: "product",
    location: "Shopping Mall",
    price: 1500,
    category: "Digital Panel",
  },
  { objectID: "5", name: "Acme Corporation", type: "client", location: "123 Business Ave" },
  { objectID: "6", name: "Metro Marketing", type: "client", location: "456 Commerce St" },
  { objectID: "7", name: "City Advertisers", type: "client", location: "789 Urban Blvd" },
  { objectID: "8", name: "Regional Promotions", type: "client", location: "321 District Rd" },
]

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    const query = body.query || ""

    console.log(`Simple search for: "${query}"`)

    // Filter items based on the query
    const filteredItems = items.filter(
      (item) =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.location.toLowerCase().includes(query.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(query.toLowerCase())),
    )

    // Return search results in Algolia-like format
    return NextResponse.json({
      hits: filteredItems,
      nbHits: filteredItems.length,
      page: 0,
      nbPages: 1,
      hitsPerPage: 10,
      processingTimeMS: 1,
      query,
    })
  } catch (error) {
    console.error("Simple search error:", error)
    return NextResponse.json(
      {
        error: "An error occurred while searching",
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 0,
        processingTimeMS: 0,
        query: "",
      },
      { status: 500 },
    )
  }
}
