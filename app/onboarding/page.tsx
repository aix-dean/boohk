"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, Upload, LayoutGrid } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useEffect } from "react"
import Image from "next/image"

// Onboarding Header Component
function OnboardingHeader() {
  const router = useRouter()
  return (
    <header className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center">
        <Image src="public/boohk-logo.svg" alt="OHPlus Logo" width={100} height={30} />
      </div>
      <Button variant="outline" onClick={() => router.push("/login")}>
        Exit
      </Button>
    </header>
  )
}

// Onboarding Footer Component
function OnboardingFooter({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onFinish,
  isLastStep,
}: {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  onFinish: () => void
  isLastStep: boolean
}) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between">
      <Button variant="ghost" onClick={onBack} disabled={currentStep === 1}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      {isLastStep ? (
        <Button onClick={onFinish}>
          Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={onNext}>
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </footer>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userData, loading, updateUserData } = useAuth()

  const totalContentSteps = 3
  const currentStep = Number.parseInt(searchParams.get("step") || "1")

  useEffect(() => {
    if (!loading && !userData) {
      router.push("/login")
    }
  }, [userData, loading, router])

  useEffect(() => {
    if (currentStep < 1 || currentStep > totalContentSteps) {
      router.replace(`/onboarding?step=1`)
    }
  }, [currentStep, totalContentSteps, router])

  const handleNext = () => {
    if (currentStep < totalContentSteps) {
      router.push(`/onboarding?step=${currentStep + 1}`)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      router.push(`/onboarding?step=${currentStep - 1}`)
    } else {
      router.push("/login") // Go to login if on the first step and pressing back
    }
  }

  const handleFinishOnboarding = async (redirectPath: string) => {
    if (userData) {
      await updateUserData({ onboarding: false })
    }
    router.push(redirectPath)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 dark:bg-gray-950">
        <p>Loading...</p>
      </div>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="flex flex-col md:flex-row items-center justify-center min-h-[calc(100vh-160px)] p-8">
            <div className="md:w-1/2 text-center md:text-left space-y-6">
              <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">Step 1</p>
              <h1 className="text-5xl font-bold">Welcome, {userData?.first_name || "New User"}!</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Thank you for registering with us. We're excited to have you on board and help you streamline your
                business operations.
              </p>
            </div>
            <div className="md:w-1/2 flex justify-center md:justify-end mt-8 md:mt-0">
              <Image src="/placeholder.svg?height=300&width=400" alt="Welcome" width={400} height={300} />
            </div>
          </div>
        )
      case 2:
        return (
          <div className="flex flex-col md:flex-row items-center justify-center min-h-[calc(100vh-160px)] p-8">
            <div className="md:w-1/2 text-center md:text-left space-y-6">
              <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">Step 2</p>
              <h1 className="text-5xl font-bold">Upload Your First Product</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Let's get you started by adding your first product or service. This will be the foundation for your
                proposals and cost estimates.
              </p>
              <Button onClick={() => handleFinishOnboarding("/admin/inventory")} className="w-full md:w-auto">
                <Upload className="mr-2 h-5 w-5" />
                Upload Product Now
              </Button>
            </div>
            <div className="md:w-1/2 flex justify-center md:justify-end mt-8 md:mt-0">
              <Image src="/placeholder.svg?height=300&width=400" alt="Upload Product" width={400} height={300} />
            </div>
          </div>
        )
      case 3:
        return (
          <div className="flex flex-col md:flex-row items-center justify-center min-h-[calc(100vh-160px)] p-8">
            <div className="md:w-1/2 text-center md:text-left space-y-6">
              <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">Step 3</p>
              <h1 className="text-5xl font-bold">You're All Set!</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Congratulations! You've completed the initial setup. You're now ready to explore your dashboard and
                start managing your business efficiently.
              </p>
              <Button onClick={() => handleFinishOnboarding("/sales/dashboard")} className="w-full md:w-auto">
                <LayoutGrid className="mr-2 h-5 w-5" />
                Go to Dashboard
              </Button>
            </div>
            <div className="md:w-1/2 flex justify-center md:justify-end mt-8 md:mt-0">
              <Image src="/placeholder.svg?height=300&width=400" alt="All Set" width={400} height={300} />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      <OnboardingHeader />
      <main className="flex-grow">{renderStepContent()}</main>
      <OnboardingFooter
        currentStep={currentStep}
        totalSteps={totalContentSteps}
        onBack={handleBack}
        onNext={handleNext}
        onFinish={() => handleFinishOnboarding("/sales/dashboard")}
        isLastStep={currentStep === totalContentSteps}
      />
    </div>
  )
}
