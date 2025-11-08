interface LocationData {
  country?: string
  region?: string
  city?: string
  timezone?: string
  isp?: string
}

interface IPLocationResponse {
  country?: string
  regionName?: string
  city?: string
  timezone?: string
  isp?: string
  status?: string
}

// Get client IP address from request headers
export function getClientIP(request: Request): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  const cfConnectingIP = request.headers.get("cf-connecting-ip")

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, get the first one
    return forwarded.split(",")[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback - this might be a proxy IP
  return "unknown"
}

// Get location data from IP address using ip-api.com (free service)
export async function getLocationFromIP(ipAddress: string): Promise<LocationData> {
  try {
    // Skip location lookup for local/private IPs
    if (
      ipAddress === "unknown" ||
      ipAddress.startsWith("127.") ||
      ipAddress.startsWith("192.168.") ||
      ipAddress.startsWith("10.") ||
      ipAddress.includes("::1")
    ) {
      return {
        country: "Local",
        region: "Local",
        city: "Local",
        timezone: "Local",
        isp: "Local Network",
      }
    }

    const response = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,country,regionName,city,timezone,isp`,
      {
        headers: {
          "User-Agent": "OHPlus-ERP/1.0",
        },
      },
    )

    if (!response.ok) {
      throw new Error("Failed to fetch location data")
    }

    const data: IPLocationResponse = await response.json()

    if (data.status === "fail") {
      throw new Error("Invalid IP address or location service error")
    }

    return {
      country: data.country,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
      isp: data.isp,
    }
  } catch (error) {
    console.error("Error fetching location data:", error)
    return {
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      timezone: "Unknown",
      isp: "Unknown",
    }
  }
}

// Get location data from browser (client-side)
export async function getClientLocation(): Promise<LocationData> {
  try {
    // Try to get location from browser's geolocation API
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              // Use reverse geocoding to get location details
              const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`,
              )
              const data = await response.json()

              resolve({
                country: data.countryName,
                region: data.principalSubdivision,
                city: data.city,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                isp: "Browser Location",
              })
            } catch (error) {
              console.error("Error with reverse geocoding:", error)
              resolve({
                country: "Browser",
                region: "Browser",
                city: "Browser",
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                isp: "Browser Location",
              })
            }
          },
          () => {
            // Fallback if geolocation is denied
            resolve({
              country: "Unknown",
              region: "Unknown",
              city: "Unknown",
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              isp: "Browser (Location Denied)",
            })
          },
          { timeout: 10000 },
        )
      })
    }

    // Fallback for non-browser environments
    return {
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      timezone: "Unknown",
      isp: "Unknown",
    }
  } catch (error) {
    console.error("Error getting client location:", error)
    return {
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      timezone: "Unknown",
      isp: "Unknown",
    }
  }
}
