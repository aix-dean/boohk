"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Loader2,
  Download,
  ImageIcon,
} from "lucide-react"
import { getProposalById, downloadProposalPDF } from "@/lib/proposal-service"
import type { Proposal } from "@/lib/types/proposal"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

const GoogleMap: React.FC<{ location: string; className?: string }> = ({ location, className }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    const initializeMaps = async () => {
      try {
        await loadGoogleMaps()
        await initializeMap()
      } catch (error) {
        console.error("Error loading Google Maps:", error)
        setMapError(true)
      }
    }

    const initializeMap = async () => {
      if (!mapRef.current || !window.google) return

      try {
        const geocoder = new window.google.maps.Geocoder()

        // Geocode the location
        geocoder.geocode({ address: location }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
          if (status === "OK" && results && results[0]) {
            const map = new window.google.maps.Map(mapRef.current!, {
              center: results[0].geometry.location,
              zoom: 15,
              disableDefaultUI: true,
              gestureHandling: "none",
              zoomControl: false,
              mapTypeControl: false,
              scaleControl: false,
              streetViewControl: false,
              rotateControl: false,
              fullscreenControl: false,
              styles: [
                {
                  featureType: "poi",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }],
                },
              ],
            })

            // Add marker
            new window.google.maps.Marker({
              position: results[0].geometry.location,
              map: map,
              title: location,
              icon: {
                url:
                  "data:image/svg+xml;charset=UTF-8," +
                  encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 32),
              },
            })

            setMapLoaded(true)
          } else {
            console.error("Geocoding failed:", status)
            setMapError(true)
          }
        })
      } catch (error) {
        console.error("Error initializing map:", error)
        setMapError(true)
      }
    }

    initializeMaps()
  }, [location])

  if (mapError) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Map unavailable</p>
          <p className="text-xs mt-1">{location}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}

const CompanyLogo: React.FC<{ className?: string }> = ({ className }) => {
  const { userData } = useAuth()
  const [companyLogo, setCompanyLogo] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCompanyLogo = async () => {
      if (!userData?.company_id) {
        setLoading(false)
        return
      }

      try {
        const companyDocRef = doc(db, "companies", userData.company_id)
        const companyDocSnap = await getDoc(companyDocRef)

        if (companyDocSnap.exists()) {
          const companyData = companyDocSnap.data()
          if (companyData.photo_url && companyData.photo_url.trim() !== "") {
            setCompanyLogo(companyData.photo_url)
          }
        }
      } catch (error) {
        console.error("Error fetching company logo:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanyLogo()
  }, [userData?.company_id])

  if (loading) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    )
  }

  if (companyLogo) {
    return (
      <img
        src={companyLogo || "/placeholder.svg"}
        alt="Company logo"
        className={`object-cover rounded-lg border border-gray-200 shadow-sm bg-white ${className}`}
        onError={(e) => {
          setCompanyLogo("")
        }}
      />
    )
  }

  return (
    <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
      <span className="text-gray-500 text-sm">No logo</span>
    </div>
  )
}

export default function ProposalDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { userData } = useAuth()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSize, setSelectedSize] = useState<string>("A4")
  const [selectedOrientation, setSelectedOrientation] = useState<string>("Portrait")
  const [selectedLayout, setSelectedLayout] = useState<string>("1")
  const [selectedTemplateBackground, setSelectedTemplateBackground] = useState<string>("")

  useEffect(() => {
    async function fetchProposal() {
      if (!params.id) return

      setLoading(true)
      try {
        const proposalData = await getProposalById(params.id as string)
        if (proposalData) {
          setProposal(proposalData)

          if (proposalData.templateSize) {
            setSelectedSize(proposalData.templateSize)
          }
          if (proposalData.templateOrientation) {
            setSelectedOrientation(proposalData.templateOrientation)
          }
          if (proposalData.templateLayout) {
            setSelectedLayout(proposalData.templateLayout)
          }
          if (proposalData.templateBackground) {
            setSelectedTemplateBackground(proposalData.templateBackground)
          }
        }
      } catch (error) {
        console.error("Error fetching proposal:", error)
        toast({
          title: "Error",
          description: "Failed to load proposal",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProposal()
  }, [params.id])

  // Handle automatic download when page loads with action=download
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const action = searchParams.get("action")

    if (action === "download" && proposal && !loading) {
      // Small delay to ensure the proposal is fully rendered
      setTimeout(() => {
        handleDownload()
        // Clean up the URL parameter
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        window.history.replaceState({}, "", url.toString())
      }, 1000)
    }
  }, [proposal, loading])



  const handleDownload = async () => {
    if (!proposal) {
      toast({
        title: "Error",
        description: "No proposal data available",
        variant: "destructive",
      })
      return
    }

    await downloadProposalPDF(proposal, selectedSize, selectedOrientation, toast)
  }

  const getPagePrice = (pageContent: any[]) => {
    return pageContent.reduce((total, product) => {
      return total + (product.price || 0)
    }, 0)
  }

  const getSitesPerPage = (layout: string) => Number.parseInt(layout)

  const getTotalPages = (layout: string) => {
    const numberOfSites = proposal?.products?.length || 1
    const sitesPerPage = getSitesPerPage(layout)
    return Math.ceil(numberOfSites / sitesPerPage)
  }

  const getPageContent = (pageNumber: number, layout: string) => {
    if (!proposal?.products) return []

    const sitesPerPage = getSitesPerPage(layout)
    const startIndex = (pageNumber - 1) * sitesPerPage
    const endIndex = startIndex + sitesPerPage

    return proposal.products.slice(startIndex, endIndex)
  }

  const getLayoutGridClass = (layout: string) => {
    const sitesPerPage = getSitesPerPage(layout)
    switch (sitesPerPage) {
      case 1:
        return "grid-cols-1"
      case 2:
        return "grid-cols-1 lg:grid-cols-2"
      case 4:
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
      default:
        return "grid-cols-1"
    }
  }

  const getPageTitle = (pageContent: any[]): string => {
    if (!pageContent || pageContent.length === 0) {
      return "N/A"
    }

    const siteCodes = pageContent.map((product) => product.site_code).filter(Boolean)

    if (siteCodes.length === 0) {
      return "N/A"
    }

    if (siteCodes.length === 1) {
      return siteCodes[0]
    }

    if (siteCodes.length === 2) {
      return `${siteCodes[0]} & ${siteCodes[1]}`
    }

    return `${siteCodes[0]} & ${siteCodes.length - 1} more sites`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading proposal...</p>
        </div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-gray-400 text-2xl">📄</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Proposal Not Found</h1>
          <p className="text-gray-600 mb-6">The proposal you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => router.push("/sales/proposals")} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Proposals
          </Button>
        </div>
      </div>
    )
  }

  const getPageContainerClass = (size: string, orientation: string) => {
    const baseStyles = "mx-auto bg-white shadow-lg print:shadow-none print:mx-0 print:my-0 relative overflow-hidden"

    // Size-based dimensions with orientation support
    let sizeStyles = ""
    switch (size) {
      case "A4":
        if (orientation === "Landscape") {
          sizeStyles = "w-[297mm] min-h-[210mm]" // A4 Landscape
        } else {
          sizeStyles = "w-[210mm] min-h-[297mm]" // A4 Portrait
        }
        break
      case "Letter size":
        if (orientation === "Landscape") {
          sizeStyles = "w-[11in] min-h-[8.5in]" // Letter Landscape
        } else {
          sizeStyles = "w-[8.5in] min-h-[11in]" // Letter Portrait
        }
        break
      case "Legal size":
        if (orientation === "Landscape") {
          sizeStyles = "w-[14in] min-h-[8.5in]" // Legal Landscape
        } else {
          sizeStyles = "w-[8.5in] min-h-[14in]" // Legal Portrait
        }
        break
      default:
        sizeStyles = "w-full max-w-4xl min-h-[600px]"
    }


    return `${baseStyles} ${sizeStyles}`
  }

  return (
    <div>
      <div className="bg-white px-4 py-3 flex items-center gap-3 fixed top-0 left-0 right-0 z-50 border-b border-gray-200 shadow-sm">
        <span className="text-black font-medium">Proposal</span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={handleDownload}
            variant="ghost"
            size="sm"
            className="h-8 w-15 gap-2 px-2 hover:bg-gray-200"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </Button>
        </div>
      </div>
      <div className="min-h-screen bg-gray-50/50 flex flex-col pt-16">
        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <div className="flex flex-col gap-8">
            {Array.from({ length: getTotalPages(selectedLayout) }, (_, index) => {
              const pageNumber = index + 1
              const pageContent = getPageContent(pageNumber, selectedLayout)

              return (
                <div key={pageNumber} className={getPageContainerClass(selectedSize, selectedOrientation)}>
                  {selectedTemplateBackground && (
                    <div
                      className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-90 z-0"
                      style={{ backgroundImage: `url(${selectedTemplateBackground})` }}
                    />
                  )}

                  {/* Content */}
                  <div className="relative z-10 p-4 md:p-6 bg-transparent">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                      <CompanyLogo className="w-16 h-16 md:w-20 md:h-20" />
                      <div className="text-right">
                        <h1 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
                          {getPageTitle(pageContent)}
                        </h1>

                        {getSitesPerPage(selectedLayout) === 1 ? (
                          <div className="inline-block bg-green-500 text-white px-3 py-1 md:px-4 md:py-1 rounded-md font-semibold text-sm md:text-base">
                            ₱{getPagePrice(pageContent).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Product content grid */}
                    <div className={`grid gap-4 transition-all duration-300 ${getLayoutGridClass(selectedLayout)}`}>
                      {pageContent.map((product, productIndex) => (
                        <div key={product.id} className="space-y-4 transition-all duration-300">
                          {/* Rest of product content */}
                          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                            <div className="flex-shrink-0">
                              <div
                                className={`border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100 transition-all duration-300 ${getSitesPerPage(selectedLayout) === 1
                                  ? "w-48 h-60 md:w-64 md:h-80"
                                  : getSitesPerPage(selectedLayout) === 2
                                    ? "w-40 h-48 md:w-48 md:h-60"
                                    : "w-32 h-40 md:w-36 md:h-44"
                                  }`}
                              >
                                {product.media && product.media.length > 0 ? (
                                  <img
                                    src={product.media[0].url || "/placeholder.svg"}
                                    alt={product.name || "Product image"}
                                    className="w-full h-full"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon
                                      className={`text-gray-400 ${getSitesPerPage(selectedLayout) === 1 ? "h-12 w-12" : "h-8 w-8"}`}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3
                                className={`font-semibold text-gray-900 mb-3 ${getSitesPerPage(selectedLayout) === 1 ? "text-lg" : "text-sm md:text-base"}`}
                              >
                                Location Map:
                              </h3>

                              {product.specs_rental?.location ? (
                                <GoogleMap
                                  location={product.specs_rental.location}
                                  className={`w-full rounded-lg mb-4 ${getSitesPerPage(selectedLayout) === 1 ? "h-24 md:h-32" : "h-16 md:h-20"}`}
                                />
                              ) : (
                                <div
                                  className={`w-full bg-gray-100 rounded-lg mb-4 flex items-center justify-center ${getSitesPerPage(selectedLayout) === 1 ? "h-24 md:h-32" : "h-16 md:h-20"}`}
                                >
                                  <p className="text-gray-500 text-xs">Location not specified</p>
                                </div>
                              )}

                              <div
                                className={`space-y-1 text-gray-800 ${getSitesPerPage(selectedLayout) === 1 ? "text-sm" : "text-xs"}`}
                              >
                                {product.specs_rental?.location && (
                                  <p>
                                    <span className="font-semibold">Location:</span> {product.specs_rental.location}
                                  </p>
                                )}
                                {product.specs_rental?.traffic_count && (
                                  <p>
                                    <span className="font-semibold">Traffic Count:</span>{" "}
                                    {product.specs_rental.traffic_count.toLocaleString()} vehicles
                                  </p>
                                )}
                                {product.specs_rental?.elevation !== undefined && (
                                  <p>
                                    <span className="font-semibold">Visibility:</span> {product.specs_rental.elevation}{" "}
                                    meters
                                  </p>
                                )}
                                {product.specs_rental?.height && product.specs_rental?.width && (
                                  <p>
                                    <span className="font-semibold">Dimension:</span> {product.specs_rental.height}ft x{" "}
                                    {product.specs_rental.width}ft
                                  </p>
                                )}
                                <p>
                                  <span className="font-semibold">Type:</span> {product.type || "Advertising Space"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {getSitesPerPage(selectedLayout) > 1 && (
                            <div className="mt-3 flex justify-center">
                              <div className="bg-green-500 text-white h-8 px-2 pb-2.5 rounded-md font-semibold text-xs flex items-center justify-center">
                                ₱{product.price?.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || "0.00"}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
