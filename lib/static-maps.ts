/**
 * Generates a Google Static Map URL for the given location
 * @param location - The location string (address, coordinates, etc.)
 * @param width - Width of the map image in pixels (default: 324)
 * @param height - Height of the map image in pixels (default: 226)
 * @returns The static map URL or null if location is not provided
 */
export function generateStaticMapUrl(
  location: string | null | undefined,
  width: number = 324,
  height: number = 226
): string | null {
  if (!location || location.trim() === '') {
    return null
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyDeLrUgnPTRk36Gwq9V2RlDJEyhUO5fwO8"

  // URL encode the location
  const encodedLocation = encodeURIComponent(location.trim())

  // Generate the static map URL
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedLocation}&zoom=15&size=${width}x${height}&markers=color:red%7C${encodedLocation}&key=${apiKey}`

  return url
}