"use server"

export async function getGoogleMapsScriptUrl() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error("Google Maps API key not configured")
  }

  return `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`
}
