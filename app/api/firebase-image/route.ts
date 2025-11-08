import { type NextRequest, NextResponse } from "next/server"

// Alternative approach using direct Firebase Storage access
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get("url")

    if (!imageUrl) {
      return new NextResponse("Missing image URL", { status: 400 })
    }

    console.log("Firebase image proxy request for:", imageUrl)

    // For Firebase Storage URLs, we can try to access them directly
    // Firebase Storage URLs with tokens should be publicly accessible
    const response = await fetch(imageUrl, {
      method: "GET",
      headers: {
        Accept: "*/*",
        "User-Agent": "NextJS-Image-Proxy/1.0",
      },
    })

    if (!response.ok) {
      console.error("Firebase Storage fetch failed:", response.status, response.statusText)

      // If direct access fails, try to construct a public URL
      if (imageUrl.includes("firebasestorage.googleapis.com")) {
        try {
          const url = new URL(imageUrl)
          const pathParts = url.pathname.split("/")
          const bucket = pathParts[3] // bucket name
          const filePath = decodeURIComponent(pathParts[5]) // file path after /o/

          // Try public access URL format
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`
          console.log("Trying public URL:", publicUrl)

          const publicResponse = await fetch(publicUrl)
          if (publicResponse.ok) {
            const buffer = await publicResponse.arrayBuffer()
            const contentType = publicResponse.headers.get("content-type") || "image/jpeg"

            return new NextResponse(buffer, {
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
              },
            })
          }
        } catch (urlError) {
          console.error("Error parsing Firebase URL:", urlError)
        }
      }

      return new NextResponse("Failed to fetch image", { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/jpeg"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Firebase image proxy error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
