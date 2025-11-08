import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get("url")

    if (!imageUrl) {
      console.error("Missing image URL parameter")
      return new NextResponse("Missing image URL", { status: 400 })
    }

    // Decode the URL if it's encoded
    const decodedUrl = decodeURIComponent(imageUrl)
    console.log("Attempting to proxy image:", decodedUrl)

    // Add headers that might help with Firebase Storage
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
    }

    console.log("Fetching with headers:", headers)

    // Fetch the image from Firebase Storage
    const response = await fetch(decodedUrl, {
      headers,
      method: "GET",
    })

    console.log("Firebase Storage response status:", response.status)
    console.log("Firebase Storage response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      console.error("Failed to fetch image from Firebase Storage:", {
        status: response.status,
        statusText: response.statusText,
        url: decodedUrl,
      })

      // Try to get error details
      const errorText = await response.text().catch(() => "Unknown error")
      console.error("Error response body:", errorText)

      return new NextResponse(`Failed to fetch image: ${response.status} ${response.statusText}`, {
        status: response.status,
      })
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/jpeg"

    console.log("Successfully fetched image:", {
      size: imageBuffer.byteLength,
      contentType,
      url: decodedUrl,
    })

    // Return the image with proper CORS headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Length": imageBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("Error in proxy-image API route:", error)
    return new NextResponse(`Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`, {
      status: 500,
    })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
