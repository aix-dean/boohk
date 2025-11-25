let isLoading = false
let isLoaded = false
let loadPromise: Promise<{ apiKey: string; mapId?: string }> | null = null
let config: { apiKey: string; mapId?: string } | null = null

declare global {
  interface Window {
    google: any
    initGoogleMapsGlobal?: () => void
  }
}

export function loadGoogleMaps(): Promise<{ apiKey: string; mapId?: string }> {
  // Return existing promise if already loading
  if (loadPromise) {
    return loadPromise
  }

  // Return resolved promise if already loaded
  if (isLoaded || (window.google && window.google.maps)) {
    isLoaded = true
    return Promise.resolve(config!)
  }

  // Check if script already exists
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
  if (existingScript && !isLoading) {
    // Script exists but not loaded yet, wait for it
    loadPromise = new Promise((resolve, reject) => {
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          isLoaded = true
          resolve(config!)
        } else {
          setTimeout(checkLoaded, 100)
        }
      }
      checkLoaded()

      // Timeout after 10 seconds
      setTimeout(() => reject(new Error("Google Maps loading timeout")), 10000)
    })
    return loadPromise
  }

  // Create new loading promise
  loadPromise = new Promise(async (resolve, reject) => {
    try {
      const response = await fetch("/api/maps-config")

      if (!response.ok) {
        reject(new Error("Google Maps API key not configured"))
        return
      }

      config = await response.json()

      if (!config || !config.apiKey) {
        reject(new Error("Google Maps API key not configured"))
        return
      }

      isLoading = true

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${config.apiKey}&libraries=places,marker&callback=initGoogleMapsGlobal`
      script.async = true
      script.defer = true

      window.initGoogleMapsGlobal = () => {
        isLoaded = true
        isLoading = false
        resolve(config!)
        delete window.initGoogleMapsGlobal
      }

      script.onerror = () => {
        isLoading = false
        loadPromise = null
        reject(new Error("Failed to load Google Maps script"))
      }

      document.head.appendChild(script)
    } catch (error) {
      isLoading = false
      loadPromise = null
      reject(new Error("Failed to fetch Google Maps configuration"))
    }
  })

  return loadPromise
}

export function isGoogleMapsLoaded(): boolean {
  return isLoaded || (window.google && window.google.maps)
}
