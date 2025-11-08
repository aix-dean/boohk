import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const input = searchParams.get("input")

  if (!input) {
    return NextResponse.json({ error: "Input parameter is required" }, { status: 400 })
  }

  try {
    // Only use the server-side environment variable
    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.error("Google Maps API key is not configured. Please check your environment variables.")

      // Return empty predictions instead of an error to prevent breaking the UI
      return NextResponse.json({
        predictions: [],
        status: "ZERO_RESULTS",
        error_message: "API key not configured",
      })
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching places:", error)

    // Return empty predictions instead of an error
    return NextResponse.json({
      predictions: [],
      status: "FAILED",
      error_message: "Failed to fetch places",
    })
  }
}
