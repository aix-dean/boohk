"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ExternalLink, CheckCircle, AlertCircle, Copy } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

export function DomainSetupGuide() {
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null)
  const { toast } = useToast()

  const copyToClipboard = (text: string, recordType: string) => {
    navigator.clipboard.writeText(text)
    setCopiedRecord(recordType)
    toast({
      title: "Copied!",
      description: `${recordType} record copied to clipboard`,
    })
    setTimeout(() => setCopiedRecord(null), 2000)
  }

  const dnsRecords = [
    {
      type: "TXT",
      name: "quotations.ohplus.ph",
      value: "resend-domain-verification=your-verification-code-here",
      purpose: "Domain verification",
    },
    {
      type: "MX",
      name: "quotations.ohplus.ph",
      value: "feedback-smtp.us-east-1.amazonses.com",
      priority: "10",
      purpose: "Mail routing",
    },
    {
      type: "TXT",
      name: "quotations.ohplus.ph",
      value: "v=spf1 include:amazonses.com ~all",
      purpose: "SPF record",
    },
    {
      type: "CNAME",
      name: "_domainkey.quotations.ohplus.ph",
      value: "your-dkim-value.dkim.amazonses.com",
      purpose: "DKIM signing",
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Domain Setup Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your domain <strong>quotations.ohplus.ph</strong> needs to be verified before you can send emails. Follow
              these steps to complete the setup.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Step 1: Access Resend Dashboard</h4>
              <Button variant="outline" className="flex items-center gap-2 bg-transparent" asChild>
                <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open Resend Domains
                </a>
              </Button>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Step 2: Click on quotations.ohplus.ph</h4>
              <p className="text-sm text-gray-600">
                Find your domain in the list and click on it to see the DNS records you need to add.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Step 3: Add DNS Records</h4>
              <p className="text-sm text-gray-600 mb-3">
                Add these DNS records to your domain provider (the exact values will be shown in your Resend dashboard):
              </p>

              <div className="space-y-3">
                {dnsRecords.map((record, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {record.type}
                        </span>
                        <span className="text-sm text-gray-600">{record.purpose}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(record.value, record.type)}
                        className="h-6 w-6 p-0"
                      >
                        {copiedRecord === record.type ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs space-y-1">
                      <div>
                        <strong>Name:</strong> {record.name}
                      </div>
                      <div>
                        <strong>Value:</strong> <code className="bg-white px-1 rounded">{record.value}</code>
                      </div>
                      {record.priority && (
                        <div>
                          <strong>Priority:</strong> {record.priority}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Step 4: Wait for Verification</h4>
              <p className="text-sm text-gray-600">
                After adding the DNS records, it may take up to 24 hours for the changes to propagate. Resend will
                automatically verify your domain once the records are detected.
              </p>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Quick Setup:</strong> If you're using Cloudflare, Namecheap, or GoDaddy, the DNS changes usually
                take effect within 5-15 minutes.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alternative: Use Resend's Default Domain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">
            For testing purposes, you can temporarily use Resend's default sending domain, but emails may be marked as
            spam and you'll have limited sending capabilities.
          </p>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Not Recommended for Production:</strong> Always use your own verified domain for better
              deliverability and professional appearance.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
