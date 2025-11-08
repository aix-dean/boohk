"use client"

import { useState, useEffect } from "react"
import { addDays, format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { WeatherForecast } from "@/lib/weather-service"
import { getLatestVideoByCategory, getNewsItemsByCategory, type ContentMedia } from "@/lib/firebase-service"
import { ChevronDown, ChevronRight } from "lucide-react"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { ComingSoonModal } from "@/components/coming-soon-dialog"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function LogisticsWeatherPage() {
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [videoError, setVideoError] = useState<string | null>(null)

  const [newsItems, setNewsItems] = useState<ContentMedia[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    return {
      from: today,
      to: addDays(today, 4)
    }
  })

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showComingSoonModal, setShowComingSoonModal] = useState(false)

  const router = useRouter()

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        console.log('Weather page: Starting weather data fetch from /api/weather/accuweather')
        setLoading(true)
        setError(null)

        // Build query parameters
        const params = new URLSearchParams()
        params.append('locationKey', '264885')

        if (dateRange?.from) {
          params.append('startDate', dateRange.from.toISOString().split('T')[0])
        }
        if (dateRange?.to) {
          params.append('endDate', dateRange.to.toISOString().split('T')[0])
        }

        const response = await fetch(`/api/weather/accuweather?${params.toString()}`)
        console.log('Weather page: Fetch response status:', response.status)
        if (!response.ok) {
          throw new Error('Failed to fetch weather data')
        }
        const data = await response.json()
        console.log('Weather page: Fetch successful, data received')
        setWeatherData(data)
      } catch (err) {
        console.error('Weather page: Fetch error:', err)
        setError(err instanceof Error ? err.message : "Failed to fetch weather data")
      } finally {
        console.log('Weather page: Fetch completed')
        setLoading(false)
      }
    }

    fetchWeatherData()
  }, [dateRange])

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        console.log('Weather page: Starting video fetch from content_media')
        setVideoLoading(true)
        setVideoError(null)
        const url = await getLatestVideoByCategory("0YxkR7oed1qzzaqPqUKh")
        console.log('Weather page: Video fetch successful, URL:', url)
        console.log('Weather page: Setting videoUrl state to:', url)
        setVideoUrl(url)
        console.log('Weather page: videoUrl state set')

        // Verify URL accessibility
        try {
          if (url) {
            const response = await fetch(url, { method: 'HEAD' })
            console.log('Weather page: Video URL accessibility check:', response.ok ? 'Accessible' : `Not accessible, status ${response.status}`)
          }
        } catch (verifyErr) {
          console.log('Weather page: Error checking video URL accessibility:', verifyErr)
        }
      } catch (err) {
        console.error('Weather page: Video fetch error:', err)
        setVideoError(err instanceof Error ? err.message : "Failed to fetch video")
      } finally {
        console.log('Weather page: Video fetch completed')
        setVideoLoading(false)
      }
    }

    fetchVideo()
  }, [])

  useEffect(() => {
    if (videoUrl) {
      console.log('Weather page: Video element about to render with URL:', videoUrl)
    }
  }, [videoUrl])

  useEffect(() => {
    const fetchNewsItems = async () => {
      try {
        console.log('Weather page: Starting news items fetch from content_media')
        setNewsLoading(true)
        setNewsError(null)
        const items = await getNewsItemsByCategory("0YxkR7oed1qzzaqPqUKh", 5)
        console.log('Weather page: News items fetch successful, items:', items)
        setNewsItems(items)
      } catch (err) {
        console.error('Weather page: News items fetch error:', err)
        setNewsError(err instanceof Error ? err.message : "Failed to fetch news items")
      } finally {
        console.log('Weather page: News items fetch completed')
        setNewsLoading(false)
      }
    }

    fetchNewsItems()
  }, [])

  // Helper function to map icon strings to SVG paths
  const getWeatherIcon = (icon: string) => {
    const iconMap: { [key: string]: string } = {
      sun: "/weather-icons/clear-day.svg",
      "cloud-sun": "/weather-icons/cloudy.svg",
      cloud: "/weather-icons/cloudy.svg",
      "cloud-fog": "/weather-icons/haze.svg",
      "cloud-rain": "/weather-icons/rain.svg",
      "cloud-lightning": "/weather-icons/thunderstorms-rain.svg",
      "cloud-snow": "/weather-icons/snowflake.svg",
      wind: "/weather-icons/wind.svg",
      moon: "/weather-icons/clear-day.svg",
    }
    return iconMap[icon] || "/weather-icons/cloudy.svg"
  }

  // Handler for news item clicks
  const handleNewsItemClick = (item: ContentMedia) => {
    console.log('News item click handler called for item:', item.title || 'Untitled')

    // Construct the URL using the content id
    const url = `https://oohshop.online/content/${item.id}`
    console.log('News item URL:', url)

    if (url) {
      console.log('Opening URL in new window:', url)
      const newWindow = window.open(url, '_blank')

      if (newWindow) {
        console.log('window.open succeeded - new window opened')
      } else {
        console.log('window.open failed - popup blocked or other error')
      }
    } else {
      console.log('No URL found for news item')
    }
  }

  return (
    <main className="flex-1 flex flex-col p-4 2xl:h-[80vh]">
      <div className="flex justify-between items-center mb-6">
        <h1 style={{
          color: 'var(--LIGHTER-BLACK, #333)',
          fontFamily: 'Inter',
          fontSize: '16px',
          fontStyle: 'normal',
          fontWeight: 700,
          lineHeight: '100%'
        }}>News and Weather</h1>
      </div>


      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4 items-stretch min-h-screen">
        {/* Do I need to roll down today? */}
        <div className="bg-white rounded-2xl shadow-lg p-6 lg:col-span-1 flex flex-col xl:h-[80vh] min-h-[657px]">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{
              color: 'var(--LIGHTER-BLACK, #333)',
              fontFamily: 'Inter',
              fontSize: '15.006px',
              fontStyle: 'normal',
              fontWeight: 600,
              lineHeight: '100%'
            }}>Do I need to roll down today?</h2>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="9" stroke="var(--LIGHTER-BLACK, #333)" stroke-width="1.501"/>
              <text x="10" y="10" text-anchor="middle" dominant-baseline="middle" fill="var(--LIGHTER-BLACK, #333)" font-family="Inter" font-size="15.006" font-weight="400">?</text>
            </svg>
          </div>
          {/* <div className="flex items-center mb-4">
            <img src="/login-image-5.png" alt="Oscar" className="w-9 h-9 mr-3" />
            <span className="text-lg text-gray-600">Oscar</span>
          </div> */}
          {/* <div className="text-6xl font-bold text-green-500 text-center mb-6">No</div> */}
          <div className="flex justify-center mt-10 mb-6 flex-1 items-center">
            <div className="flex flex-col gap-4 items-center py-5">
              {/* Illustration */}
              <div className="flex-shrink-0">
                <img
                  src="/coming-soon-oscar.png"
                  alt="Coming soon illustration"
                  className="h-32 w-32 sm:h-40 sm:w-40 lg:h-56 lg:w-56 object-contain"
                />
              </div>

              {/* Text content */}
              <div className="flex flex-col justify-center text-center mb-10">
                <h2 className="mb-2 text-[#333] font-inter text-[28px] font-bold leading-none">Coming soon!</h2>
                <p className="text-[#333] font-inter text-[18px] font-light leading-none">
                  We are working hard to make this feature available to you as soon as possible!
                </p>
              </div>
            </div>
          </div>
          {/* <h3 className="text-xl font-semibold text-gray-800 mb-4">Rolldown Parameters</h3> */}
          {/* <div className="space-y-4">
            {[
              { title: 'Typhoon Strength', desc: 'Stronger than 65 kph' },
              { title: 'City Ordinance', desc: 'On cities that covers my sites' },
              { title: 'Typhoon Location', desc: "Typhoon's trajectory will hit my sites" },
              { title: 'Angle of Direction', desc: 'On cities that covers my sites' },
              { title: 'Typhoon Speed', desc: 'Slower than 20kph' },
            ].map((param, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">{param.title}</h4>
                <p className="text-sm text-gray-600">{param.desc}</p>
              </div>
            ))}
          </div> */}
          <div className="mt-auto">
            <button className="w-full text-white px-8 py-2 font-semibold text-sm hover:opacity-90 transition-colors" style={{borderRadius: '10px', background: '#1D0BEB'}} onClick={() => router.push('/logistics/assignments/create')}>
              Create Service Assignment
            </button>
          </div>
        </div>

        {/* Second Column Container */}
        <div className="space-y-6 lg:col-span-2 flex flex-col flex-1 min-h-0 xl:h-[80vh]">
          <div className="bg-white rounded-2xl p-6 border-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[15.006px] font-semibold text-[#333] leading-none font-['Inter'] text-center">Weekly Weather Forecast</h2>
              <div className="relative">
                <div
                  className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer"
                  onClick={() => setShowComingSoonModal(true)}
                >
                  <span className="text-sm text-gray-600">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
                      : 'Select dates'
                    }
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                {showDatePicker && (
                  <div className="absolute top-full mt-2 right-0 z-10">
                    <DateRangePicker
                      value={dateRange}
                      onChange={(range) => {
                        setDateRange(range)
                        setShowDatePicker(false)
                      }}
                      placeholder="Select date range"
                      className="w-64"
                      maxDays={7}
                    />
                  </div>
                )}
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-600">
                  Loading weather data...
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-red-600 text-center">
                  <div className="font-semibold mb-2">Failed to load weather data</div>
                  <div className="text-sm">{error}</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-around items-center gap-0">
                {weatherData?.forecast
                  .filter((item, index, arr) => arr.findIndex(i => i.date === item.date) === index)
                  .slice(0, 5)
                  .flatMap((item, index) => [
                    <div key={`day-${index}`} className="flex flex-col items-center">
                      <div className="text-center min-w-[60px] sm:min-w-[80px] flex-shrink-0">
                        <div className="text-sm font-medium text-gray-600 mb-2">{format(new Date(item.date), 'MMM d')} - {format(new Date(item.date), 'EEE')}</div>
                        <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                          <img
                            src={getWeatherIcon(item.icon)}
                            alt={`${item.icon} weather icon`}
                            className="w-[51px] h-[51px] flex-shrink-0 aspect-square"
                          />
                        </div>
                        <div className="text-[15.006px] font-semibold text-[#333] text-center leading-none font-['Inter']">{item.temperature.max}°</div>
                      </div>
                    </div>,
                    index < 4 ? <div key={`divider-${index}`} className="flex-shrink-0 self-center hidden sm:block" style={{background: 'rgba(0, 0, 0, 0.25)', width: '1.501px', height: '125.802px'}}></div> : null
                  ]).filter(Boolean)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-[1.3fr_1.2fr] gap-6 flex-1 min-h-0">
          {/* Publikong Impormasyon */}
          <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col flex-1 min-h-0 min-h-[415px]">
          <h3 className="mb-2 flex items-center justify-between" style={{
            color: 'var(--LIGHTER-BLACK, #333)',
            fontFamily: 'Inter',
            fontSize: '15.006px',
            fontStyle: 'normal',
            fontWeight: 600,
            lineHeight: '100%'
          }}>
            Publikong Impormasyon
            <ChevronRight className="w-5 h-5" />
          </h3>
          <div className="relative flex items-center justify-center flex-1">
            {videoLoading ? (
              <div className="w-full aspect-square bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-gray-600">Loading video...</div>
              </div>
            ) : videoError ? (
              <div className="w-full aspect-square bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-red-600 text-center">
                  <div className="font-semibold mb-2">Failed to load video</div>
                  <div className="text-sm">{videoError}</div>
                </div>
              </div>
            ) : videoUrl ? (
              <video
                className="w-[90%] aspect-square bg-gray-200 rounded-lg object-cover"
                controls
                autoPlay
                muted
                loop
                src={videoUrl}
                poster=""
                data-testid="video-element"
                onLoadStart={() => console.log('Weather page: Video load started')}
                onCanPlay={() => console.log('Weather page: Video can play')}
                onPlay={() => console.log('Weather page: Video started playing (autoplay working)')}
                onError={(e) => console.log('Weather page: Video error:', e)}
                onPause={() => console.log('Weather page: Video paused')}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="w-full aspect-square bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-gray-600">No video available</div>
              </div>
            )}
          </div>
          </div>

          {/* OOH News for you */}
           <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col overflow-y-auto min-h-[415px]">
             <div className="flex flex-col min-h-0">
               <h3 className="mb-4" style={{
                 color: 'var(--LIGHTER-BLACK, #333)',
                 fontFamily: 'Inter',
                 fontSize: '15.006px',
                 fontStyle: 'normal',
                 fontWeight: 600,
                 lineHeight: '100%'
               }}>OOH News for you</h3>
               {newsLoading ? (
                 <div className="flex items-center justify-center py-8">
                   <div className="text-gray-600">Loading news items...</div>
                 </div>
               ) : newsError ? (
                 <div className="flex items-center justify-center py-8">
                   <div className="text-red-600 text-center">
                     <div className="font-semibold mb-2">Failed to load news items</div>
                     <div className="text-sm">{newsError}</div>
                   </div>
                 </div>
               ) : (
                 <div className="flex flex-col gap-4 overflow-y-auto max-h-full">
                   {newsItems.map((item, index) => (
                     <div
                       key={item.id || index}
                       className="p-4 flex items-center space-x-4 cursor-pointer hover:bg-gray-50 transition-colors"
                       style={{
                         borderRadius: '11.255px',
                         border: '2.251px solid rgba(196, 196, 196, 0.50)',
                         background: '#FFF'
                       }}
                       onClick={() => handleNewsItemClick(item)}
                     >
                       <div className="w-16 h-16 bg-gray-300 rounded-lg flex-shrink-0 overflow-hidden">
                         {item.thumbnail ? (
                           <img
                             src={item.thumbnail}
                             alt={item.title || "News thumbnail"}
                             className="w-full h-full object-cover"
                           />
                         ) : (
                           <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                             <span className="text-xs text-gray-500">No image</span>
                           </div>
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <h4 className="font-semibold text-gray-800 truncate">{item.title || "Untitled News"}</h4>
                         <p className="text-sm text-gray-600">
                           {item.created ? new Date(item.created.toDate ? item.created.toDate() : item.created).toLocaleDateString() : "No date"}
                         </p>
                       </div>
                     </div>
                   ))}
                   {newsItems.length === 0 && (
                     <div className="col-span-full text-center py-8 text-gray-500">
                       No news items available
                     </div>
                   )}
                 </div>
               )}
             </div>
           </div>
          </div>
        </div>
      </div>

      {showComingSoonModal && (
        <ComingSoonModal
          onClose={() => setShowComingSoonModal(false)}
          onNotify={() => {
            // Handle notify logic here if needed
            setShowComingSoonModal(false)
          }}
        />
      )}


    </main>
  )
}
