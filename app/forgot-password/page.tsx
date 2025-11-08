"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Mail, CheckCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!email.trim()) {
      setError("Please enter your email address.")
      setIsLoading(false)
      return
    }

    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address.")
      setIsLoading(false)
      return
    }

    try {
      // TODO: Implement actual forgot password API call
      console.log("Sending password reset email to:", email)

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      setIsSuccess(true)
      toast({
        title: "Password Reset Sent",
        description: "If an account with this email exists, you'll receive a password reset link shortly.",
      })
    } catch (error: any) {
      console.error("Forgot password error:", error)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToLogin = () => {
    router.push('/login')
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Left side - Success Content */}
        <div className="flex-1 flex flex-col justify-center bg-white p-8 order-1 md:order-1">
          <div className="w-full max-w-md mx-auto space-y-6">
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h1 className="text-3xl font-bold text-gray-900">Check Your Email</h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                We've sent a password reset link to <span className="font-semibold text-gray-900">{email}</span>
              </p>
              <p className="text-gray-500 text-sm">
                If you don't see the email in your inbox, please check your spam folder.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                onClick={handleBackToLogin}
              >
                Back to Login
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                  onClick={() => setIsSuccess(false)}
                >
                  Didn't receive the email? Try again
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Illustration */}
        <div className="hidden md:flex flex-1 relative order-2 md:order-2">
          <div className="w-full h-full rounded-[50px] p-4">
            <Image
              src="/login-image-1.png"
              alt="Forgot password illustration"
              fill
              className="rounded-[46px] p-8"
              priority
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side - Forgot Password Form */}
      <div className="flex-1 flex flex-col justify-center bg-white p-8 order-1 md:order-1">
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </button>
            <h1 className="text-4xl font-bold text-gray-900">Forgot Password?</h1>
            <p className="text-gray-600 text-lg leading-relaxed">
              No worries! Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-gray-600">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  className="h-12 border-gray-200 rounded-lg pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Reset Link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Remember your password?{" "}
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 underline font-medium"
                onClick={handleBackToLogin}
              >
                Back to Login
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden md:flex flex-1 relative order-2 md:order-2">
        <div className="w-full h-full rounded-[50px] p-4">
          <Image
            src="/login-image-1.png"
            alt="Forgot password illustration"
            fill
            className="rounded-[46px] p-8"
            priority
          />
        </div>
      </div>
    </div>
  )
}
