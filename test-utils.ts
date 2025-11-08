/**
 * Test Utilities for Gmail Compatibility Testing
 *
 * This file contains utility functions extracted from the send-email route
 * for testing purposes.
 */

// Gmail compatibility utilities (extracted from route.tsx)
export interface EmailDomainInfo {
  domain: string
  isGmail: boolean
  isCorporate: boolean
  requiresFallback: boolean
}

export function analyzeEmailDomain(email: string): EmailDomainInfo {
  const domain = email.toLowerCase().split('@')[1]
  if (!domain) {
    return { domain: '', isGmail: false, isCorporate: false, requiresFallback: false }
  }

  const isGmail = domain === 'gmail.com'
  const corporateDomains = ['ohplus.ph', 'aix.ph', 'gmail.com']
  const isCorporate = corporateDomains.includes(domain)

  // Gmail recipients need fallback handling due to strict filtering
  const requiresFallback = isGmail

  return { domain, isGmail, isCorporate, requiresFallback }
}

export function separateGmailRecipients(recipients: string[]): { gmail: string[], other: string[] } {
  const gmail: string[] = []
  const other: string[] = []

  recipients.forEach(email => {
    const domainInfo = analyzeEmailDomain(email)
    if (domainInfo.isGmail) {
      gmail.push(email)
    } else {
      other.push(email)
    }
  })

  return { gmail, other }
}

// Rate limiting for Gmail to avoid spam filters
const gmailRateLimit = new Map<string, { count: number, resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 5 // Max 5 emails per minute per sender

export function checkGmailRateLimit(senderEmail: string): boolean {
  const now = Date.now()
  const senderLimit = gmailRateLimit.get(senderEmail)

  if (!senderLimit || now > senderLimit.resetTime) {
    gmailRateLimit.set(senderEmail, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (senderLimit.count >= RATE_LIMIT_MAX) {
    return false
  }

  senderLimit.count++
  return true
}

// SPF/DKIM/DMARC compliance utilities
export interface EmailComplianceInfo {
  domain: string
  spfValid: boolean
  dkimValid: boolean
  dmarcValid: boolean
  complianceScore: number
  recommendations: string[]
}

export async function checkEmailCompliance(domain: string): Promise<EmailComplianceInfo> {
  const recommendations: string[] = []
  let spfValid = false
  let dkimValid = false
  let dmarcValid = false

  try {
    // Check SPF record
    try {
      const spfResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`)
      const spfData = await spfResponse.json()

      if (spfData.Answer) {
        spfValid = spfData.Answer.some((record: any) =>
          record.data.includes('v=spf1') || record.data.includes('spf2.0')
        )
      }

      if (!spfValid) {
        recommendations.push(`Add SPF record for ${domain} to improve deliverability`)
      }
    } catch (error) {
      console.warn(`[v0] Could not check SPF for ${domain}:`, error)
      recommendations.push(`Verify SPF record exists for ${domain}`)
    }

    // Check DMARC record
    try {
      const dmarcResponse = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`)
      const dmarcData = await dmarcResponse.json()

      if (dmarcData.Answer) {
        dmarcValid = dmarcData.Answer.some((record: any) =>
          record.data.includes('v=DMARC1')
        )
      }

      if (!dmarcValid) {
        recommendations.push(`Add DMARC policy for ${domain} (start with p=none for monitoring)`)
      }
    } catch (error) {
      console.warn(`[v0] Could not check DMARC for ${domain}:`, error)
      recommendations.push(`Consider adding DMARC policy for ${domain}`)
    }

    // DKIM is harder to check programmatically, so we'll assume it's configured
    // if SPF and DMARC are present, or provide general recommendation
    if (spfValid && dmarcValid) {
      dkimValid = true // Assume DKIM is configured with proper SPF/DMARC
    } else {
      recommendations.push(`Configure DKIM for ${domain} to maximize deliverability`)
    }

  } catch (error) {
    console.error(`[v0] Error checking email compliance for ${domain}:`, error)
    recommendations.push(`Verify DNS records (SPF, DKIM, DMARC) for ${domain}`)
  }

  const complianceScore = (spfValid ? 33 : 0) + (dkimValid ? 33 : 0) + (dmarcValid ? 34 : 0)

  return {
    domain,
    spfValid,
    dkimValid,
    dmarcValid,
    complianceScore,
    recommendations
  }
}

export function validateFromAddress(from: string): { isValid: boolean, domain: string, recommendations: string[] } {
  const recommendations: string[] = []

  // Extract domain from email address
  const domainMatch = from.match(/@([^>]+)$/)
  if (!domainMatch) {
    return { isValid: false, domain: '', recommendations: ['Invalid email format in from address'] }
  }

  const domain = domainMatch[1]

  // Check for suspicious patterns
  if (domain.includes('resend.dev') || domain.includes('gmail.com')) {
    recommendations.push('Consider using a verified custom domain for better deliverability')
  }

  if (domain.length > 60) {
    recommendations.push('Domain name is unusually long, may trigger spam filters')
  }

  return { isValid: true, domain, recommendations }
}

// Email template functions (simplified versions for testing)
export function createUltraSimpleGmailTemplate(
  body: string,
  companyName?: string,
  userDisplayName?: string,
  replyTo?: string,
  proposalId?: string
): string {
  const processedBody = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n\n")

  return `Subject: ${companyName || "Company"} - Important Proposal

Dear Valued Customer,

${processedBody}

To view the complete proposal, please visit:
https://mrk.ohplus.ph/pr/${proposalId || ''}

---
This email was sent from ${companyName || "Company"}
Contact: ${userDisplayName || "Sales Executive"}
${replyTo ? `Email: ${replyTo}` : ''}

Note: If you're having trouble viewing this email, please add our email address to your contacts or safe senders list.
  `
}

export function createGmailCompatibleTemplate(
  body: string,
  userPhoneNumber?: string,
  companyName?: string,
  companyWebsite?: string,
  companyAddress?: string,
  userDisplayName?: string,
  replyTo?: string,
  companyLogo?: string,
  proposalId?: string,
  dominantColor?: string,
  proposalPassword?: string
): string {
  const phoneNumber = userPhoneNumber || "+639XXXXXXXXX"

  const processedBody = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; color: #333333;">${line}</p>`)
    .join("")

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName || "Company"} - Proposal</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e9ecef; }
        .content { padding: 20px; }
        .content p { margin: 0 0 12px 0; }
        .cta-button { display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: 500; margin: 15px 0; }
        .cta-button:hover { background-color: #0056b3; }
        .footer { background-color: #f8f9fa; padding: 20px; border-top: 1px solid #e9ecef; font-size: 12px; color: #6c757d; }
        .company-info { margin-bottom: 10px; }
        .signature { margin-top: 20px; border-top: 1px solid #e9ecef; padding-top: 15px; }
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .header, .content, .footer { padding: 15px !important; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; color: #333333; font-size: 18px; font-weight: 600;">${companyName || "Company"}</h1>
            ${companyAddress ? `<p style="margin: 5px 0 0 0; color: #6c757d; font-size: 12px;">${companyAddress}</p>` : ''}
        </div>

        <div class="content">
            ${processedBody}

            <div style="text-align: center; margin: 20px 0;">
                <a href="https://mrk.ohplus.ph/pr/${proposalId || ''}" class="cta-button">View Proposal</a>
            </div>
        </div>

        <div class="footer">
            <div class="company-info">
                <strong>${companyName || "Company"}</strong>
                ${companyWebsite ? `<br>Website: ${companyWebsite}` : ''}
            </div>

            <div class="signature">
                <strong>${userDisplayName || "Sales Executive"}</strong><br>
                Sales Executive<br>
                ${replyTo ? `Email: ${replyTo}<br>` : ''}
                ${userPhoneNumber ? `Phone: ${userPhoneNumber}` : ''}
            </div>
        </div>
    </div>
</body>
</html>
  `
}

export function createEmailTemplate(
  body: string,
  userPhoneNumber?: string,
  companyName?: string,
  companyWebsite?: string,
  companyAddress?: string,
  userDisplayName?: string,
  replyTo?: string,
  companyLogo?: string,
  proposalId?: string,
  dominantColor?: string,
  proposalPassword?: string
): string {
  const phoneNumber = userPhoneNumber || "+639XXXXXXXXX"

  const processedBody = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${line}</p>`)
    .join("")

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName || "Company"} - Proposal</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #d9dfe6ff;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: #ffffff;
            padding: 20px 40px;
        }
        .content {
            padding: 40px;
            background-color: #eaeaea;
        }
        .content p {
            margin: 0 0 16px 0;
            font-size: 16px;
            line-height: 1.6;
        }
        .cta-section {
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            background: ${dominantColor || '#667eea'};
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 30px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 16px;
        }
        .footer {
            background-color: #ffffff;
            padding: 20px 40px;
        }
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }
            .header, .content, .footer {
                padding: 20px !important;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 style="color: #2c3e50; font-size: 20px; font-weight: bold; margin: 0;">${companyName || "Company"}</h1>
            ${companyAddress ? `<p style="margin: 5px 0 0 0; color: #34495e; font-size: 12px;">${companyAddress}</p>` : ''}
        </div>

        <div class="content">
            ${processedBody}

            <div class="cta-section">
                <a href="https://mrk.ohplus.ph/pr/${proposalId || ''}" class="cta-button">View</a>
            </div>
        </div>

        <div class="footer">
            <p><strong>${companyName || "Company"}</strong></p>
            <p><strong>${userDisplayName || "Sales Executive"}</strong><br>
            Sales Executive<br>
            ${replyTo ? `Email: ${replyTo}<br>` : ''}
            ${userPhoneNumber ? `Phone: ${userPhoneNumber}` : ''}</p>
        </div>
    </div>
</body>
</html>
  `
}