"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PromoBannerProps {
  className?: string
  onClick?: () => void // Add onClick prop
  disabled?: boolean // Add disabled prop
}

export function PromoBanner({ className, onClick, disabled }: PromoBannerProps) {
  return (
    <Card className={cn("rounded-xl border-2 shadow-sm", className)}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-red-500 text-white text-center font-bold text-xs uppercase mr-4 flex-shrink-0">
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">GRAPHIC EXPO '25 PROMO</span>
        </div>
        <div className="flex-grow text-center">
          <h2 className="text-3xl font-extrabold">90 DAYS FREE TRIAL</h2>
          <p className="text-sm mt-1">Limited time offer for new sign-ups!</p>
        </div>
        <Button variant="secondary" className="ml-4 flex-shrink-0" onClick={onClick} disabled={disabled}>
          {" "}
          {/* Pass onClick and disabled to Button */}
          GET NOW <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
