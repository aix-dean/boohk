"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default function RulesPage() {
  const [hasReadRules, setHasReadRules] = useState(false)
  const [scrollAreaRef, setScrollAreaRef] = useState<HTMLDivElement | null>(null)
  const router = useRouter()

  // Scroll detection for rules agreement
  useEffect(() => {
    const handleScroll = () => {
      if (scrollAreaRef) {
        const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px tolerance
        if (isAtBottom && !hasReadRules) {
          setHasReadRules(true)
        }
      }
    }

    if (scrollAreaRef) {
      scrollAreaRef.addEventListener('scroll', handleScroll)
      return () => scrollAreaRef.removeEventListener('scroll', handleScroll)
    }
  }, [scrollAreaRef, hasReadRules])

  const handleAgree = () => {
    // Store agreement in localStorage or sessionStorage
    sessionStorage.setItem('rulesAgreed', 'true')
    router.push('/register')
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Panel - Image */}
      <div className="relative hidden w-full items-center justify-center bg-gray-900 sm:flex lg:w-[40%]">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-700 opacity-90"></div>
        <div className="relative z-10 text-center text-white p-8">
          <h1 className="text-4xl font-bold mb-4">Rules & Regulations</h1>
          <p className="text-lg">Platform guidelines and standards</p>
        </div>
      </div>

      {/* Right Panel - Rules Content */}
      <div className="flex w-full items-center justify-center bg-white p-4 dark:bg-gray-950 sm:p-6 lg:w-[60%] lg:p-8">
        <Card className="w-full max-w-4xl border-none shadow-none">
          <CardHeader className="space-y-1">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/register')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Registration</span>
              </Button>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Rules and Regulations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Rules Content */}
              <div className="border rounded-md p-6 max-h-96 overflow-hidden">
                <ScrollArea
                  className="h-80 w-full"
                  ref={(el) => {
                    if (el && !scrollAreaRef) {
                      setScrollAreaRef(el.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement)
                    }
                  }}
                >
                  <div className="pr-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {`# Rules and Regulations

Last updated: May 24, 2021

These Rules and Regulations ("Rules") govern your use of the OH!Plus platform. By accessing or using our Service, you agree to comply with these Rules.

## General Conduct

### Acceptable Use
You agree to use the OH!Plus platform only for lawful purposes and in accordance with these Rules. You are prohibited from using the platform:

- In any way that violates any applicable federal, state, local, or international law or regulation
- To transmit, or procure the sending of, any advertising or promotional material, including any "junk mail," "chain letter," "spam," or any other similar solicitation
- To impersonate or attempt to impersonate the Company, a Company employee, another user, or any other person or entity
- To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the Service, or which, as determined by us, may harm the Company or users of the Service or expose them to liability

### User Responsibilities
As a user of OH!Plus, you are responsible for:

- Maintaining the confidentiality of your account and password
- All activities that occur under your account
- Ensuring that all information you provide is accurate and up-to-date
- Complying with all applicable laws and regulations
- Respecting the rights of other users and third parties

## Content Guidelines

### Prohibited Content
You may not post, upload, or share content that:

- Is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or invasive of another's privacy
- Contains software viruses or any other computer code, files, or programs designed to interrupt, destroy, or limit the functionality of any computer software or hardware
- Constitutes unauthorized or unsolicited advertising
- Contains false or misleading information

### Content Ownership
You retain ownership of content you submit to OH!Plus, but you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, translate, distribute, and display such content in connection with the Service.

## Business Operations

### Service Availability
While we strive to provide continuous service, OH!Plus may be temporarily unavailable due to maintenance, updates, or other reasons. We are not liable for any damages resulting from service interruptions.

### Data Security
We implement reasonable security measures to protect your data, but we cannot guarantee absolute security. You are responsible for maintaining the security of your account credentials.

### Billing and Payments
If you use paid features:

- All fees are non-refundable unless otherwise specified
- You agree to pay all charges associated with your account
- We may change pricing with 30 days' notice
- Failed payments may result in service suspension

## User Interactions

### Communication Standards
When communicating with other users or our team:

- Be respectful and professional
- Do not share personal information without consent
- Report any suspicious or inappropriate behavior
- Use appropriate language and tone

### Dispute Resolution
In case of disputes with other users:

- Attempt to resolve issues directly first
- Contact our support team if direct resolution fails
- We may mediate disputes at our discretion
- We reserve the right to suspend accounts involved in disputes

## Platform Integrity

### System Integrity
You agree not to:

- Attempt to gain unauthorized access to our systems
- Interfere with or disrupt the Service
- Use automated tools to access the Service without permission
- Circumvent any security measures

### Reporting Violations
If you encounter violations of these Rules:

- Report the issue to our support team immediately
- Provide as much detail as possible
- Cooperate with any investigations
- Do not take matters into your own hands

## Account Management

### Account Creation
To create an account:

- You must be at least 18 years old
- Provide accurate and complete information
- Choose a strong, unique password
- Verify your email address

### Account Termination
We may terminate or suspend your account if you:

- Violate these Rules
- Provide false information
- Engage in fraudulent activity
- Fail to pay for services
- Remain inactive for an extended period

## Intellectual Property

### OH!Plus IP
All OH!Plus trademarks, service marks, logos, and content are owned by us and may not be used without permission.

### User-Generated Content
By posting content on OH!Plus:

- You confirm you have the right to share it
- You grant us license to use it as described above
- You agree not to post copyrighted material without permission
- You are responsible for any IP infringement claims

## Legal Compliance

### Applicable Laws
Your use of OH!Plus must comply with:

- All applicable local, state, and federal laws
- International laws if accessing from outside the Philippines
- Industry-specific regulations relevant to your business

### Export Controls
You agree not to use OH!Plus in violation of export control laws or regulations.

## Amendments

We reserve the right to modify these Rules at any time. Changes will be effective immediately upon posting. Your continued use of the Service constitutes acceptance of the modified Rules.

## Contact Information

For questions about these Rules and Regulations, contact us at:
- Email: support@ohplus.com
- Phone: +63 (2) 123-4567`}
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Agreement Section */}
              <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                <Checkbox
                  id="rules-agreement"
                  checked={hasReadRules}
                  onCheckedChange={() => {}} // Read-only, auto-checked by scroll
                  disabled={!hasReadRules}
                />
                <label htmlFor="rules-agreement" className="text-sm font-medium">
                  I have read and agree to the Rules and Regulations
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={() => router.push('/register')}
                >
                  Cancel
                </Button>
                <Button
                  className={`${
                    hasReadRules
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-gray-400 cursor-not-allowed"
                  } text-white`}
                  onClick={handleAgree}
                  disabled={!hasReadRules}
                >
                  I Agree
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}