"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { X, ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface OnboardingTooltipProps {
  onClose: () => void
}

const tourSteps = [
  {
    title: "Control Bar",
    text: "Welcome to your Control Bar! This is your command deck where you'll find your department, notifications, messages, time, and profile all in one place.",
    arrowPosition: "top-8 left-1/2 transform -translate-x-1/2",
    image: "/onboarding-oscar.png"
  },
  {
    title: "Updates Center",
    text: "This is your Updates Center. This is where all the important updates come together. Whenever something needs your attention, you'll see it pop up here, so you're always in the loop",
    arrowPosition: "top-44 left-44",
    image: "/onboarding-oscar.png"
  },
  {
    title: "To Go Hub",
    text: "The To-Go Box is your go-to spot for keeping track of what's happening and what's ahead. It's where you'll always find the essentials to stay on top of things.",
    arrowPosition: "top-56 left-44",
    image: "/onboarding-oscar.png"
  },
  {
    title: "To Do Hub",
    text: "The To-Do Hub is your space for action. Here, you'll find the tasks you're working on, plus a history of what you've done. You can even jump right in and get things done from here",
    arrowPosition: "top-96 left-44",
    image: "/onboarding-oscar.png"
  },
  {
    title: "Oscar's Intelligence",
    text: "The Intelligence Board is where I place the important insights and numbers you might find useful. Think of it as your go-to spot for smart updates about how things are going.",
    arrowPosition: "bottom-0 left-8",
    image: "/onboarding-oscar.png"
  },
  {
    title: "Workzone",
    text: "The Workzone is your main space where all the action happens. It's where you roll up your sleeves and get things done.",
    arrowPosition: "top-24 left-1/2 transform -translate-x-1/2",
    image: "/onboarding-oscar.png"
  },
  {
    title: "You made it!",
    text: "If you ever want to see this tour again or check out more features, just go to Profile > Modules & Features and I'll be there to help.\n\nNow… let's bring your teammates on board!",
    arrowPosition: "",
    image: "/onboarding-oscar-done.png"
  }
]

export function OnboardingTooltip({ onClose }: OnboardingTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    // Delay to allow animation to complete
    setTimeout(onClose, 300)
  }

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const step = tourSteps[currentStep]

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      {/* Arrow positioned based on current step */}
      {step.arrowPosition && (
        <div
          className={`absolute ${step.arrowPosition} transition-all duration-300 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src="/onboarding-arrow.png"
            alt="Onboarding arrow"
            width={40}
            height={40}
            className="drop-shadow-lg"
          />
        </div>
      )}

      {/* Dashed border for Workzone step */}
      {currentStep === 5 && (
        <div
          className={`absolute top-20 left-72 right-6 bottom-6 border-8 border-dashed border-white rounded-2xl transition-all duration-300 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Tooltip Content positioned at bottom center */}
      <div
        className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-300 ${
          isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-transparent rounded-lg p-10 max-w-4xl mx-4 relative flex items-center gap-10">

          {/* Oscar Image */}
          <div className="flex-shrink-0">
            <Image
              src={step.image}
              alt="Oscar"
              width={200}
              height={200}
              className="rounded-lg"
            />
          </div>

          {/* Text Content */}
          <div className="flex-1 text-left">
            <h3 className="text-4xl font-semibold text-white mb-5">
              {step.title}
            </h3>
            <div className="text-xl text-gray-200 leading-relaxed mb-8">
              {step.text.split('\n\n').map((paragraph, index) => (
                <p key={index} className={index > 0 ? 'mt-5' : ''}>
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white text-lg font-medium">
                {Math.min(currentStep + 1, 6)}/6
              </span>
              <div className="flex items-center gap-2">
                {currentStep === 6 ? (
                  <Button onClick={handleClose} className="px-8 py-3 text-lg text-white hover:opacity-90" style={{ backgroundColor: '#1d0beb' }}>
                    Invite Teammates
                  </Button>
                ) : (
                  <>
                    {currentStep > 0 && (
                      <Button onClick={handleBack} className="w-16 h-16 bg-transparent border-4 border-white rounded-full hover:bg-white/10 flex items-center justify-center">
                        <ArrowLeft className="h-8 w-8 text-white" />
                      </Button>
                    )}
                    <Button onClick={handleNext} className="w-16 h-16 bg-transparent border-4 border-white rounded-full hover:bg-white/10 flex items-center justify-center">
                      <ArrowRight className="h-8 w-8 text-white" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}