import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface WelcomePageProps {
   onStartTour: () => void
   userName?: string
   isLoading?: boolean
}

export default function WelcomePage({ onStartTour, userName, isLoading = false }: WelcomePageProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-7xl w-full flex items-center gap-20">
        {/* Left side - Illustration */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-[500px] h-[500px] rounded-full overflow-hidden">
            <img
              src="/login-image-6.png"
              alt="Welcome illustration"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Right side - Content */}
        <div className="flex-1 max-w-lg space-y-8">




          {/* Description text */}
          {/* Increased text size from default to text-lg */}
          <div className="space-y-5 text-muted-foreground leading-relaxed text-lg">
            <p>
            <span className="font-semibold text-foreground">Great!</span> Now let me give you a quick little tour so you can get comfy. It’ll only take a minute!
            </p>
          </div>

          {/* Start Tour button */}
          <div className="pt-6 flex justify-end">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-medium text-lg flex items-center gap-3 transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              onClick={onStartTour}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Starting Tour...</span>
                </>
              ) : (
                <>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    Start Tour
                  </span>
                  <svg
                    className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}