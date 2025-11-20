import { Button } from "@/components/ui/button"
import { Loader2, ArrowRight } from "lucide-react"

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
                      <img
              src="/owen-face.png"
              alt="User icon"
              style={{  height: '51px', }}
            />
            <p style={{ marginTop: 0 }}>
            <span style={{ color: '#333', fontFamily: 'Inter', fontSize: '30px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%' }}>Great! <br /></span> <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%' }}>We are so thrilled to have you here! Take a look around, settle in, and let’s enjoy the wonderful world of OOH together!</span>
            </p>
          </div>

          {/* Start Tour button */}
          <div className="pt-6 flex justify-end">
            <Button
              style={{ width: '114.963px', height: '23.493px', flexShrink: 0, borderRadius: '6.024px', background: '#1D0BEB', color: '#FFF', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%' }}
              onClick={onStartTour}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Lets go</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  <span>Lets go</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}