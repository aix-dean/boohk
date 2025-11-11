import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Gmail compatibility utilities
interface EmailDomainInfo {
  domain: string
  isGmail: boolean
  isCorporate: boolean
  requiresFallback: boolean
}

function analyzeEmailDomain(email: string): EmailDomainInfo {
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

function separateGmailRecipients(recipients: string[]): { gmail: string[], other: string[] } {
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

function checkGmailRateLimit(senderEmail: string): boolean {
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
interface EmailComplianceInfo {
  domain: string
  spfValid: boolean
  dkimValid: boolean
  dmarcValid: boolean
  complianceScore: number
  recommendations: string[]
}

async function checkEmailCompliance(domain: string): Promise<EmailComplianceInfo> {
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

function validateFromAddress(from: string): { isValid: boolean, domain: string, recommendations: string[] } {
  const recommendations: string[] = []

  // Extract domain from email address (handle both "user@domain.com" and "Name <user@domain.com>" formats)
  const domainMatch = from.match(/@([^>\s]+)(?:\s*>)?$/)
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

// Function to convert image URL to base64 data URI
async function imageUrlToDataUri(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status, response.statusText)
      return null
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.startsWith('image/')) {
      console.error('Invalid content type for image:', contentType)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.error('Error converting image to data URI:', error)
    return null
  }
}

// Function to extract dominant color from base64 image data
async function extractDominantColor(base64DataUri: string): Promise<string | null> {
  try {
    // Extract base64 data from data URI
    const base64Data = base64DataUri.split(',')[1]
    if (!base64Data) {
      console.error('Invalid base64 data URI format')
      return null
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Dynamically import node-vibrant to avoid ES module issues
    let Vibrant: any
    try {
      console.log('Attempting to import node-vibrant...')
      // Use named import for node-vibrant v4+
      const vibrantModule = await import('node-vibrant/node')
      Vibrant = vibrantModule.Vibrant
      console.log('node-vibrant imported successfully')
    } catch (error) {
      console.error('Failed to import node-vibrant:', error)
      return null // Return null if node-vibrant is not available
    }

    // Get color palette from the image buffer using node-vibrant
    const palette = await Vibrant.from(imageBuffer).getPalette()

    if (!palette) {
      console.error('Failed to extract color palette from image')
      return null
    }

    // Log all available palette swatches for debugging
    console.log('Available palette swatches:', Object.keys(palette))

    // Get the dominant color (Vibrant swatch)
    const dominantColor = palette.Vibrant

    if (!dominantColor) {
      console.error('No dominant color found in palette')
      // Try alternative swatches if Vibrant is not available
      const alternativeSwatches = ['Muted', 'DarkVibrant', 'DarkMuted', 'LightVibrant', 'LightMuted']
      for (const swatchName of alternativeSwatches) {
        if (palette[swatchName]) {
          console.log(`Using alternative swatch: ${swatchName}`)
          const altDominantColor = palette[swatchName]
          const hexColor = rgbToHex(
            Math.round(altDominantColor.rgb[0]),
            Math.round(altDominantColor.rgb[1]),
            Math.round(altDominantColor.rgb[2])
          )
          console.log('Alternative dominant color extracted:', hexColor)
          return hexColor
        }
      }
      console.error('No suitable color swatch found in the palette')
      return null
    }

    // Convert RGB values to hex format
    const hexColor = rgbToHex(
      Math.round(dominantColor.rgb[0]),
      Math.round(dominantColor.rgb[1]),
      Math.round(dominantColor.rgb[2])
    )

    console.log('Dominant color extracted:', hexColor)
    return hexColor

  } catch (error) {
    console.error('Error extracting dominant color:', error)
    return null
  }
}

// Helper function to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
}

// Helper function to shade a color by a percentage
function shadeColor(color: string, percent: number): string {
  // Remove # if present
  color = color.replace('#', '')

  // Parse r, g, b values
  const num = parseInt(color, 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt

  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1).toUpperCase()
}

function createUltraSimpleGmailTemplate(
  body: string,
  companyName?: string,
  userDisplayName?: string,
  userPosition?: string,
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
${userPosition ? `${userPosition}` : ''}
${replyTo ? `Email: ${replyTo}` : ''}

Note: If you're having trouble viewing this email, please add our email address to your contacts or safe senders list.
  `
}

function createGmailCompatibleTemplate(
  body: string,
  userPhoneNumber?: string,
  companyName?: string,
  companyWebsite?: string,
  companyAddress?: string,
  userDisplayName?: string,
  userPosition?: string,
  replyTo?: string,
  companyLogo?: string,
  proposalId?: string,
  dominantColor?: string,
  proposalPassword?: string
): string {
  const phoneNumber = userPhoneNumber || "+639XXXXXXXXX"
  const primaryColor = dominantColor || '#667eea'
  const secondaryColor = dominantColor ? shadeColor(dominantColor, 40) : '#5a6fd8'

  const processedBody = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #333333;">${line}</p>`)
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
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333333; background-color: #f5f5f5; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.header {
    background: #ffffff;
    padding: 0 0 0 20px; /* top right bottom left */
    text-align: center;
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 130px;
}
        .header-circles { position: absolute; top: 0; right: 0; width: 100%; height: 130px; pointer-events: none; display: flex; justify-content: flex-end; align-items: center; gap: 20px; }
        .header-div { height: 130px; background: ${dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : ''}; opacity: 0.8; z-index: 1; display: flex; justify-content: flex-end; align-items: center;  }
        .header-square-1 { width: 80px; height: 130px; background: ${primaryColor}; opacity: 1.0; z-index: 2; }
        .header-square-2 { width: 60px; height: 130px; background: transparent; opacity: 0.8; z-index: 1;  }
        .header-content { width: 85%; height: 100px; display: flex; align-items: center; gap: 20px; position: relative; z-index: 3; padding-top: 10px }
        .header-logo { height: 80px; width: auto; max-width: 150px; flex-shrink: 0; }
        .company-info {  flex: 1; padding-left: 15px; }
.company-name {
  color: #000000;
  font-size: 24px;
  font-weight: bold;
  letter-spacing: 1px;
  text-align: start;
  margin: 0px;
}
        .company-address { color: #000000; font-size: 14px; margin: 0; }
        .content { padding: 40px 30px; background-color: #f9f9f9; }
        .content p { margin: 0 0 16px 0; }
        .highlight-box { background-color: #f8f9ff; border-left: 4px solid ${primaryColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
        .cta-section { text-align: center; margin: 30px 0; }
        .cta-button { display: inline-block; background: ${primaryColor}; color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 25px; font-weight: 600; font-size: 16px; transition: transform 0.2s ease; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4); }
        .footer { background: #ffffff; padding: 0 0 0 20px; color: #000000; position: relative; overflow: hidden; width: 100%; }
        .footer-circles { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; display: flex; justify-content: flex-end; align-items: center; gap: 20px; }
        .footer-div { background: ${dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : ''}; opacity: 0.8; z-index: 1; display: flex; justify-content: flex-end; align-items: center;  }
        .footer-square-1 { width: 80px; height: 160px; background: ${primaryColor}; opacity: 1.0; z-index: 2; }
        .footer-square-2 { width: 60px; height: 160px; background: transparent; opacity: 0.8; z-index: 1;  }
        .footer-content { width: 75%; position: relative; z-index: 3; }
        .footer-header { position: absolute; display: flex; justify-content: flex-start;align-items: center; gap: 20px; padding-top:20px; }
        .footer-logo { height: 40px; width: auto; max-width: 120px;  }
        .footer-company-name { font-size: 18px; font-weight: 600; margin: 0px 15px; color: #000000; }
        .footer-website { color: #000000; font-size: 14px; margin: 0; }
        .signature { margin-top: 5px; }
        .signature-name { font-weight: 600; color: #000000; font-size: 16px; margin: 0; }
        .signature-title { color: #000000; font-size: 14px; margin: 0; }
        .contact-info { font-size: 14px; color: #000000; }
        .contact-info strong { color: #000000; }
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; box-shadow: none; }
            .header, .content, .footer { padding: 20px !important; }
            .header-circles, .footer-circles { display: none !important; }
            .header-content { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
            .company-name { font-size: 20px !important; }
            .cta-button { padding: 12px 24px !important; font-size: 14px !important; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
                <div class="header-circles">
                    <div class="header-content">
                        ${companyLogo ? `<img src="${companyLogo}" alt="${companyName || 'Company'} Logo" class="header-logo">` : ''}
                        <div class="company-info">
                            <h1 class="company-name">${companyName || "Company"}</h1>
                            ${companyAddress ? `<p class="company-address">${companyAddress}</p>` : ''}
                        </div>
                    </div>
                    <div class="header-div">
                        <div class="header-square-2"></div>
                        <div class="header-square-1"></div>
                    </div>
                </div>
        </div>

        <div class="content">
            ${processedBody}

            <div class="cta-section">
                <a href="https://mrk.ohplus.ph/pr/${proposalId || ''}" class="cta-button">View Proposal</a>
            </div>

        </div>

        <div class="footer">

                <div class="footer-circles">
                                <div class="footer-content">
                    <div class="footer-header">
                        ${companyLogo ? `<img src="${companyLogo}" alt="${companyName || 'Company'} Logo" class="footer-logo">` : ''}
                        <h3 class="footer-company-name">${companyName || "Company"}</h3>
                        ${companyWebsite ? `<p class="footer-website">${companyWebsite}</p>` : ''}
                    </div>

                    <div class="signature">
                        <h4 class="signature-name">${userDisplayName || "Sales Executive"}</h4>
                        <p class="signature-title">${userPosition || "Sales Executive"}</p>
                        <div class="contact-info">
                            ${replyTo ? `<p style="margin: 0;">${replyTo}</p>` : ''}
                            ${userPhoneNumber ? `<p style="margin: 0;"> ${userPhoneNumber}</p>` : ''}
                        </div>
                    </div>
                </div>
                    <div class="footer-div">
                        <div class="footer-square-2"></div>
                        <div class="footer-square-1"></div>
                    </div>
                </div>
            </div>
    </div>
</body>
</html>
  `
}

function createEmailTemplate(
  body: string,
  userPhoneNumber?: string,
  companyName?: string,
  companyWebsite?: string,
  companyAddress?: string,
  userDisplayName?: string,
  userPosition?: string,
  replyTo?: string,
  companyLogo?: string,
  proposalId?: string,
  dominantColor?: string,
  proposalPassword?: string
): string {
  const phoneNumber = userPhoneNumber || "+639XXXXXXXXX"
  const primaryColor = dominantColor || '#667eea'

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
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333333; background-color: #f5f5f5; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.header {
    background: #ffffff;
    padding: 30px 0 30px 20px; /* top right bottom left */
    text-align: center;
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 130px;
}
        .header-circles { position: absolute; top: 0; right: 0; width: 100%; height: 130px; pointer-events: none; display: flex; justify-content: flex-end; align-items: center; gap: 20px; }
        .header-div { height: 130px; background: ${dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : ''}; opacity: 0.8; z-index: 1; display: flex; justify-content: flex-end; align-items: center;  }
        .header-square-1 { width: 80px; height: 130px; background: ${primaryColor}; opacity: 1.0; z-index: 2; }
        .header-square-2 { width: 60px; height: 130px; background: transparent; opacity: 0.8; z-index: 1;  }
        .header-content { width: 85%; height: 100px; display: flex; align-items: center; gap: 20px; position: relative; z-index: 3; padding-top: 10px; padding-left: 20px }
        .header-logo { height: 80px; width: auto; max-width: 150px; flex-shrink: 0; }
        .company-info {  flex: 1; padding-left: 15px; }
.company-name {
  color: #000000;
  font-size: 24px;
  font-weight: bold;
  letter-spacing: 1px;
  text-align: start;
  margin: 0px;
}
        .company-address { color: #000000; font-size: 14px; margin: 0;   text-align: start; }
        .content { padding: 40px 30px; background-color: #f9f9f9; }
        .content p { margin: 0 0 16px 0; }
        .highlight-box { background-color: #f8f9ff; border-left: 4px solid ${primaryColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
        .cta-section { text-align: center; margin: 30px 0; }
        .cta-button { display: inline-block; background: ${primaryColor}; color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 25px; font-weight: 600; font-size: 16px; transition: transform 0.2s ease; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4); }
        .footer { background: #ffffff;  color: #000000; position: relative; overflow: hidden; width: 100%; height: 160px}
        .footer-circles { position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; display: flex; justify-content: flex-end; align-items: center; gap: 20px; }
        .footer-div { background: ${dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : ''}; opacity: 0.8; z-index: 1; display: flex; justify-content: flex-end; align-items: center;  }
        .footer-square-1 { width: 80px; height: 210px; background: ${primaryColor}; opacity: 1.0; z-index: 2; }
        .footer-square-2 { width: 60px; height: 210px; background: transparent; opacity: 0.8; z-index: 1;  }
        .footer-content { width: 75%; position: relative; z-index: 3; padding-left:20px; }
        .footer-header {  display: flex; justify-content: flex-start;align-items: center; gap: 20px; padding-top:0px; }
        .footer-logo { height: 40px; width: auto; max-width: 120px;  }
        .footer-company-name { font-size: 18px; font-weight: 600; margin: 0px 15px; color: #000000; }
        .footer-website { color: #000000; font-size: 14px; margin: 0; }
        .signature { margin-top: 5px; }
        .signature-name { font-weight: 600; color: #000000; font-size: 16px; margin: 0; }
        .signature-title { color: #000000; font-size: 14px; margin: 0; }
        .contact-info { font-size: 14px; color: #000000; }
        .contact-info strong { color: #000000; }
        @media only screen and (max-width: 600px) {
            .email-container { width: 100% !important; box-shadow: none; }
            .header, .content, .footer { padding: 20px !important; }
            .header-circles, .footer-circles { display: none !important; }
            .header-content { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
            .company-name { font-size: 20px !important; }
            .cta-button { padding: 12px 24px !important; font-size: 14px !important; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
                <div class="header-circles">
                    <div class="header-content">
                        ${companyLogo ? `<img src="${companyLogo}" alt="${companyName || 'Company'} Logo" class="header-logo">` : ''}
                        <div class="company-info">
                            <h1 class="company-name">${companyName || "Company"}</h1>
                            ${companyAddress ? `<p class="company-address">${companyAddress}</p>` : ''}
                        </div>
                    </div>
                    <div class="header-div">
                        <div class="header-square-2"></div>
                        <div class="header-square-1"></div>
                    </div>
                </div>
        </div>

        <div class="content">
            ${processedBody}

            <div class="cta-section">
                <a href="https://mrk.ohplus.ph/pr/${proposalId || ''}" class="cta-button">View Proposal</a>
            </div>
<!--
            ${proposalPassword ? `
            <div class="highlight-box">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px; font-weight: 600;">🔐 Access Code</h4>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: ${primaryColor}; background: #f8f9fa; padding: 12px; border-radius: 6px; text-align: center; border: 2px dashed rgba(102, 126, 234, 0.3);">${proposalPassword}</p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #6c757d;">Please use this code to access the proposal online.</p>
            </div>
            ` : ''}
            -->
        </div>

        <div class="footer">

                <div class="footer-circles">
                                <div class="footer-content">
                    <div class="footer-header">
                        ${companyLogo ? `<img src="${companyLogo}" alt="${companyName || 'Company'} Logo" class="footer-logo">` : ''}
                        <h3 class="footer-company-name">${companyName || "Company"}</h3>
                        ${companyWebsite ? `<p class="footer-website">${companyWebsite}</p>` : ''}
                    </div>

                    <div class="signature">
                        <h4 class="signature-name">${userDisplayName || "Sales Executive"}</h4>
                        <p class="signature-title">${userPosition || "Sales Executive"}</p>
                        <div class="contact-info">
                            ${replyTo ? `<p style="margin: 0;">${replyTo}</p>` : ''}
                            ${userPhoneNumber ? `<p style="margin: 0;"> ${userPhoneNumber}</p>` : ''}
                        </div>
                    </div>
                </div>
                    <div class="footer-div">
                        <div class="footer-square-2"></div>
                        <div class="footer-square-1"></div>
                    </div>
                </div>
            </div>
    </div>
</body>
</html>
  `
}

async function fetchUserData(userEmail: string) {
  try {
    if (!userEmail) {
      console.log("No user email provided for user data fetch")
      return null
    }

    // Query iboard_users collection for user data
    const usersRef = collection(db, "iboard_users")
    const q = query(usersRef, where("email", "==", userEmail))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0]
      const userData = userDoc.data()

      console.log("User data fetched from iboard_users:", {
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        position: userData.position,
        phone_number: userData.phone_number
      })

      return {
        first_name: userData.first_name || "",
        last_name: userData.last_name || "",
        position: userData.position || "Sales Executive",
        phone_number: userData.phone_number || "",
        displayName: userData.first_name && userData.last_name
          ? `${userData.first_name} ${userData.last_name}`.trim()
          : userData.first_name || userData.last_name || "Sales Executive"
      }
    } else {
      console.log("No user found in iboard_users with email:", userEmail)
      return null
    }
  } catch (error) {
    console.error("Error fetching user data:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set")
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Parse FormData
    const formData = await request.formData()

    // Extract email data
    const toJson = formData.get("to") as string
    const ccJson = formData.get("cc") as string
    const replyTo = formData.get("replyTo") as string
    const subject = formData.get("subject") as string
    const body = formData.get("body") as string
    const currentUserPhoneNumber = formData.get("currentUserPhoneNumber") as string
    const companyId = formData.get("companyId") as string
    const companyName = formData.get("companyName") as string
    const companyWebsite = formData.get("companyWebsite") as string
    const userDisplayName = formData.get("userDisplayName") as string
    const companyLogo = formData.get("companyLogo") as string
    const proposalId = formData.get("proposalId") as string
    const proposalPassword = formData.get("proposalPassword") as string

    // Validate and sanitize userDisplayName for security and data integrity
    let validatedUserDisplayName = userDisplayName
    if (!validatedUserDisplayName || typeof validatedUserDisplayName !== 'string' || validatedUserDisplayName.trim().length === 0) {
      console.error("[v0] User display name validation failed - missing or empty")
      return NextResponse.json({
        error: "User display name is required and cannot be empty"
      }, { status: 400 })
    }

    // Sanitize userDisplayName to prevent XSS attacks
    validatedUserDisplayName = validatedUserDisplayName.trim()
    // HTML escape the userDisplayName for safe template insertion
    validatedUserDisplayName = validatedUserDisplayName
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')

    console.log("[v0] User display name validated and sanitized:", validatedUserDisplayName)

    // Validate and sanitize currentUserPhoneNumber for security
    let validatedPhoneNumber = currentUserPhoneNumber
    if (validatedPhoneNumber && typeof validatedPhoneNumber === 'string') {
      validatedPhoneNumber = validatedPhoneNumber.trim()
      // Basic phone number sanitization - remove potentially dangerous characters
      validatedPhoneNumber = validatedPhoneNumber.replace(/[<>\"']/g, '')
      console.log("[v0] Phone number sanitized:", validatedPhoneNumber)
    }

    // Validate and sanitize replyTo email for security
    let validatedReplyTo = replyTo
    if (validatedReplyTo && typeof validatedReplyTo === 'string') {
      validatedReplyTo = validatedReplyTo.trim()
      // Basic email sanitization - remove potentially dangerous characters
      validatedReplyTo = validatedReplyTo.replace(/[<>\"']/g, '')
      console.log("[v0] Reply-to email sanitized:", validatedReplyTo)
    }

    // Get actual company name from database if companyId is provided
    let actualCompanyName = companyName || "Company"
    let actualCompanyWebsite = companyWebsite
    let actualCompanyAddress = ""
    let actualCompanyLogo = companyLogo || ""

    if (companyId) {
      try {
        const companyDocRef = doc(db, "companies", companyId)
        const companyDocSnap = await getDoc(companyDocRef)

        if (companyDocSnap.exists()) {
          const companyData = companyDocSnap.data()
          console.log("[v0] Company data retrieved from database:", companyData)

          // Safely extract company data with validation
          if (companyData?.name && typeof companyData.name === 'string') {
            actualCompanyName = companyData.name
            console.log("[v0] Company name set to:", actualCompanyName)
          }
          if (companyData?.website && typeof companyData.website === 'string') {
            actualCompanyWebsite = companyData.website
          }
          if (companyData?.address) {
            if (typeof companyData.address === 'object' && companyData.address !== null) {
              // Format address object to string
              const addr = companyData.address
              const addressParts = []
              if (addr.street && typeof addr.street === 'string') addressParts.push(addr.street)
              if (addr.city && typeof addr.city === 'string') addressParts.push(addr.city)
              if (addr.state && typeof addr.state === 'string') addressParts.push(addr.state)
              if (addr.zip && typeof addr.zip === 'string') addressParts.push(addr.zip)
              if (addr.country && typeof addr.country === 'string') addressParts.push(addr.country)
              actualCompanyAddress = addressParts.join(', ')
              console.log("[v0] Company address object:", companyData.address)
              console.log("[v0] Company address formatted to:", actualCompanyAddress)
            } else if (typeof companyData.address === 'string') {
              actualCompanyAddress = companyData.address
              console.log("[v0] Company address string set to:", actualCompanyAddress)
            }
          }
          if (companyData?.photo_url && typeof companyData.photo_url === 'string') {
            // Use Firebase photo_url as fallback only if no FormData logo provided
            if (!actualCompanyLogo) {
              actualCompanyLogo = companyData.photo_url
              console.log("[v0] Using Firebase photo_url as company logo:", actualCompanyLogo)
            }
          }
        } else {
          console.log("[v0] Company document not found for ID:", companyId)
        }
      } catch (error) {
        console.error("[v0] Error fetching company data:", error)
        // Continue with fallback values - not a critical failure
      }
    }

    // Fetch user data from iboard_users table
    let userData = null
    if (validatedReplyTo) {
      try {
        userData = await fetchUserData(validatedReplyTo)
        if (userData) {
          console.log("[v0] User data fetched successfully:", userData.displayName, userData.position)
        } else {
          console.log("[v0] No user data found, using fallback values")
        }
      } catch (error) {
        console.error("[v0] Error fetching user data:", error)
        // Continue with fallback values - not a critical failure
      }
    }

    // Keep logo as URL format for better Gmail compatibility
    let dominantColor = null
    if (actualCompanyLogo) {
      try {
        console.log("[v0] Using logo URL format for Gmail compatibility:", actualCompanyLogo)

        // Extract dominant color from the logo URL
        const logoDataUri = await imageUrlToDataUri(actualCompanyLogo)
        if (logoDataUri) {
          dominantColor = await extractDominantColor(logoDataUri)
          if (dominantColor) {
            console.log("[v0] Successfully extracted dominant color:", dominantColor)
          } else {
            console.log("[v0] Failed to extract dominant color, using fallback color #667eea")
            dominantColor = undefined // Explicitly set to undefined for fallback
          }
        } else {
          console.log("[v0] Failed to process logo for color extraction, using fallback color")
          dominantColor = undefined
        }
      } catch (error) {
        console.error("[v0] Error processing company logo for color extraction:", error)
        // Continue without dominant color - not a critical failure
        dominantColor = null
      }
    }

    // Create from address using company information
    // Check for verified domain in environment variables first
    const verifiedDomain = process.env.RESEND_VERIFIED_DOMAIN
    let from: string

    if (verifiedDomain) {
      // Use verified domain if available
      // Sanitize company name to remove special characters that break email format
      const sanitizedCompanyName = actualCompanyName.replace(/[<>\[\]{}|\\^`]/g, '').trim()
      from = `${sanitizedCompanyName} <noreply@${verifiedDomain}>`

      // Validate the from address for compliance
      const fromValidation = validateFromAddress(from)
      if (!fromValidation.isValid) {
        console.warn("[v0] Invalid from address format:", fromValidation.recommendations)
      }

      // Check email compliance for the domain
      const complianceInfo = await checkEmailCompliance(verifiedDomain)
      console.log("[v0] Email compliance check for", verifiedDomain, ":", {
        score: complianceInfo.complianceScore,
        spf: complianceInfo.spfValid,
        dkim: complianceInfo.dkimValid,
        dmarc: complianceInfo.dmarcValid,
        recommendations: complianceInfo.recommendations
      })

      // Warn if compliance score is low
      if (complianceInfo.complianceScore < 66) {
        console.warn("[v0] Low email compliance score for", verifiedDomain, "- may affect deliverability")
      }

    } else {
      // Fallback to default - this may not work if no domains are verified
      from = `noreply@resend.dev`
      console.warn("[v0] No verified domain configured - using fallback. This may impact deliverability.")
    }

    console.log("[v0] Email sending - Subject:", subject)
    console.log("[v0] Email sending - Body length:", body?.length)
    console.log("[v0] Email sending - Body preview:", body?.substring(0, 100))
    console.log("[v0] Email sending - Company Logo URL:", actualCompanyLogo)
    console.log("[v0] Email sending - Company Logo URL available:", !!actualCompanyLogo)

    // Validate required fields with enhanced user data validation
    if (!toJson) {
      console.error("[v0] Email sending failed - Missing recipients")
      return NextResponse.json({ error: "Email recipients are required" }, { status: 400 })
    }

    if (!subject || subject.trim().length === 0) {
      console.error("[v0] Email sending failed - Empty subject")
      return NextResponse.json({ error: "Email subject cannot be empty" }, { status: 400 })
    }

    if (!body || body.trim().length === 0) {
      console.error("[v0] Email sending failed - Empty body")
      return NextResponse.json({ error: "Email body cannot be empty" }, { status: 400 })
    }

    // Enhanced user data validation
    if (!currentUserPhoneNumber || currentUserPhoneNumber.trim().length === 0) {
      console.warn("[v0] User phone number missing - using fallback")
      // This is not critical, but log it for monitoring
    }

    if (!replyTo || replyTo.trim().length === 0) {
      console.warn("[v0] Reply-to email missing - using fallback")
      // This is not critical, but log it for monitoring
    }

    // Validate company information for better error reporting
    if (!companyId) {
      console.warn("[v0] Company ID missing - using fallback company information")
    }

    if (!actualCompanyName || actualCompanyName === "Company") {
      console.warn("[v0] Company name not properly resolved - using fallback")
    }

    // Parse JSON strings with error handling
    let to: string[]
    let cc: string[] | undefined

    try {
      to = JSON.parse(toJson)
      if (!Array.isArray(to) || to.length === 0) {
        console.error("[v0] Invalid 'to' field: must be a non-empty array")
        return NextResponse.json({ error: "Email recipients (to) must be a non-empty array" }, { status: 400 })
      }
    } catch (error) {
      console.error("[v0] Failed to parse 'to' JSON:", error)
      return NextResponse.json({ error: "Invalid email recipients format" }, { status: 400 })
    }

    try {
      cc = ccJson ? JSON.parse(ccJson) : undefined
      if (cc && (!Array.isArray(cc) || cc.length === 0)) {
        console.error("[v0] Invalid 'cc' field: must be a non-empty array if provided")
        return NextResponse.json({ error: "Email CC recipients must be a non-empty array if provided" }, { status: 400 })
      }
    } catch (error) {
      console.error("[v0] Failed to parse 'cc' JSON:", error)
      return NextResponse.json({ error: "Invalid email CC recipients format" }, { status: 400 })
    }

    // Process file attachments
    const attachments = []
    let attachmentIndex = 0
    let totalAttachmentSize = 0

    while (true) {
      const file = formData.get(`attachment_${attachmentIndex}`) as File
      if (!file) break

      // Validate file
      if (file.size === 0) {
        console.error(`[v0] Empty attachment file: ${file.name}`)
        return NextResponse.json({
          error: `Attachment "${file.name}" appears to be empty. Please try regenerating the PDF.`
        }, { status: 400 })
      }

      // Convert file to buffer
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Additional validation
      if (buffer.length === 0) {
        console.error(`[v0] Failed to read attachment file: ${file.name}`)
        return NextResponse.json({
          error: `Failed to process attachment "${file.name}". Please try again.`
        }, { status: 400 })
      }

      attachments.push({
        filename: file.name,
        content: buffer,
      })

      totalAttachmentSize += buffer.length
      attachmentIndex++
    }

    // Check total attachment size
    // Note: Resend has a 40MB limit, but allowing higher limit for flexibility with other email services
    const maxSize = 500 * 1024 * 1024 // 500MB limit (configurable)
    if (totalAttachmentSize > maxSize) {
      console.error(`[v0] Total attachment size exceeds limit: ${(totalAttachmentSize / (1024 * 1024)).toFixed(2)}MB`)
      return NextResponse.json({
        error: `Total attachment size (${(totalAttachmentSize / (1024 * 1024)).toFixed(2)}MB) exceeds the ${maxSize / (1024 * 1024)}MB limit. Please reduce file sizes or remove attachments.`
      }, { status: 400 })
    }

    console.log("[v0] Email sending - Attachments count:", attachments.length)

    // Separate Gmail and non-Gmail recipients for different handling
    const { gmail: gmailRecipients, other: otherRecipients } = separateGmailRecipients(to)
    const allCc = cc || []
    const { gmail: gmailCc, other: otherCc } = separateGmailRecipients(allCc)

    console.log("[v0] Email domain analysis:", {
      totalRecipients: to.length,
      gmailRecipients: gmailRecipients.length,
      otherRecipients: otherRecipients.length,
      gmailCc: gmailCc.length,
      otherCc: otherCc.length
    })

    // Check rate limiting for Gmail recipients
    if (gmailRecipients.length > 0) {
      const rateLimitPassed = checkGmailRateLimit(validatedReplyTo || from)
      if (!rateLimitPassed) {
        console.warn("[v0] Gmail rate limit exceeded for sender:", validatedReplyTo || from)
        return NextResponse.json({
          error: "Rate limit exceeded for Gmail recipients. Please wait before sending more emails to Gmail addresses.",
          code: "RATE_LIMIT_EXCEEDED"
        }, { status: 429 })
      }
    }

    // Send emails separately for Gmail and non-Gmail recipients
    const results = []

    // Send to non-Gmail recipients with regular template
    if (otherRecipients.length > 0) {
      try {
        const regularEmailData: any = {
          from,
          to: otherRecipients,
          subject: subject.trim(),
          html: createEmailTemplate(body.trim(), validatedPhoneNumber, actualCompanyName, actualCompanyWebsite, actualCompanyAddress, userData?.displayName || validatedUserDisplayName, userData?.position || "Sales Executive", validatedReplyTo, actualCompanyLogo, proposalId, dominantColor || undefined, proposalPassword),
        }

        if (otherCc.length > 0) {
          regularEmailData.cc = otherCc
        }

        if (replyTo && replyTo.trim()) {
          regularEmailData.reply_to = replyTo.trim()
        }

        if (attachments.length > 0) {
          regularEmailData.attachments = attachments
        }

        console.log("[v0] Sending regular email to non-Gmail recipients:", otherRecipients.length)
        const sendResult = await resend.emails.send(regularEmailData)

        if (sendResult && sendResult.error) {
          console.error("[v0] Error sending regular email:", sendResult.error)
          results.push({ type: 'regular', success: false, error: sendResult.error.message, recipients: otherRecipients.length })
        } else if (sendResult && sendResult.data) {
          console.log("[v0] Regular email sent successfully:", sendResult.data?.id)
          results.push({ type: 'regular', success: true, data: sendResult.data, recipients: otherRecipients.length })
        } else {
          console.error("[v0] Unexpected response from Resend API:", sendResult)
          results.push({ type: 'regular', success: false, error: 'Unexpected API response', recipients: otherRecipients.length })
        }
      } catch (error) {
        console.error("[v0] Exception sending regular email:", error)
        results.push({ type: 'regular', success: false, error: error instanceof Error ? error.message : 'Unknown error', recipients: otherRecipients.length })
      }
    }

    // Send to Gmail recipients with Gmail-optimized template
    if (gmailRecipients.length > 0) {
      try {
        const gmailEmailData: any = {
          from,
          to: gmailRecipients,
          subject: subject.trim(),
          html: createGmailCompatibleTemplate(body.trim(), validatedPhoneNumber, actualCompanyName, actualCompanyWebsite, actualCompanyAddress, userData?.displayName || validatedUserDisplayName, userData?.position || "Sales Executive", validatedReplyTo, actualCompanyLogo, proposalId, dominantColor || undefined, proposalPassword),
        }

        if (gmailCc.length > 0) {
          gmailEmailData.cc = gmailCc
        }

        if (replyTo && replyTo.trim()) {
          gmailEmailData.reply_to = replyTo.trim()
        }

        if (attachments.length > 0) {
          gmailEmailData.attachments = attachments
        }

        console.log("[v0] Sending Gmail-optimized email to recipients:", gmailRecipients.length)
        const gmailSendResult = await resend.emails.send(gmailEmailData)

        if (gmailSendResult && gmailSendResult.error) {
          console.error("[v0] Error sending Gmail-optimized email:", gmailSendResult.error)
          results.push({ type: 'gmail', success: false, error: gmailSendResult.error.message, recipients: gmailRecipients.length })

          // If Gmail fails, try alternative approach with simplified template
          if (gmailSendResult.error.message.includes("domain") || gmailSendResult.error.message.includes("spam") || gmailSendResult.error.message.includes("blocked")) {
            console.log("[v0] Attempting fallback for Gmail recipients with ultra-simple template")

            const fallbackEmailData: any = {
              from,
              to: gmailRecipients,
              subject: `[IMPORTANT] ${subject.trim()}`,
              html: createUltraSimpleGmailTemplate(body.trim(), actualCompanyName, userData?.displayName || validatedUserDisplayName, userData?.position || "Sales Executive", validatedReplyTo, proposalId),
            }

            if (replyTo && replyTo.trim()) {
              fallbackEmailData.reply_to = replyTo.trim()
            }

            const fallbackSendResult = await resend.emails.send(fallbackEmailData)

            if (fallbackSendResult && fallbackSendResult.error) {
              console.error("[v0] Fallback also failed for Gmail:", fallbackSendResult.error)
              results.push({ type: 'gmail-fallback', success: false, error: fallbackSendResult.error.message, recipients: gmailRecipients.length })
            } else if (fallbackSendResult && fallbackSendResult.data) {
              console.log("[v0] Gmail fallback email sent successfully:", fallbackSendResult.data?.id)
              results.push({ type: 'gmail-fallback', success: true, data: fallbackSendResult.data, recipients: gmailRecipients.length })
            } else {
              console.error("[v0] Unexpected fallback response from Resend API:", fallbackSendResult)
              results.push({ type: 'gmail-fallback', success: false, error: 'Unexpected fallback API response', recipients: gmailRecipients.length })
            }
          }
        } else if (gmailSendResult && gmailSendResult.data) {
          console.log("[v0] Gmail-optimized email sent successfully:", gmailSendResult.data?.id)
          results.push({ type: 'gmail', success: true, data: gmailSendResult.data, recipients: gmailRecipients.length })
        } else {
          console.error("[v0] Unexpected Gmail response from Resend API:", gmailSendResult)
          results.push({ type: 'gmail', success: false, error: 'Unexpected Gmail API response', recipients: gmailRecipients.length })
        }
      } catch (error) {
        console.error("[v0] Exception sending Gmail email:", error)
        results.push({ type: 'gmail', success: false, error: error instanceof Error ? error.message : 'Unknown error', recipients: gmailRecipients.length })
      }
    }

    // Analyze results and return appropriate response
    const successfulSends = results.filter(r => r.success)
    const failedSends = results.filter(r => !r.success)

    if (successfulSends.length === 0) {
      // All sends failed
      const primaryError = failedSends[0]?.error || "Failed to send email"
      return NextResponse.json({
        error: primaryError,
        details: "All email sends failed",
        results: results.map(r => ({ type: r.type, success: r.success, error: r.error }))
      }, { status: 400 })
    }

    if (failedSends.length > 0) {
      // Partial success
      console.warn("[v0] Partial email send success:", {
        successful: successfulSends.length,
        failed: failedSends.length
      })
    }

    console.log("[v0] Email send completed with results:", {
      totalAttempts: results.length,
      successful: successfulSends.length,
      failed: failedSends.length,
      totalRecipients: to.length + (cc?.length || 0)
    })

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${successfulSends.reduce((sum, r) => sum + r.recipients, 0)} recipients. ${failedSends.length > 0 ? `${failedSends.reduce((sum, r) => sum + r.recipients, 0)} recipients failed.` : ''}`,
      results: results.map(r => ({
        type: r.type,
        success: r.success,
        recipients: r.recipients,
        error: r.error
      })),
      deliveryNote: "Gmail recipients may experience delays due to strict filtering. Please ask recipients to check spam/promotions folders."
    })
  } catch (error) {
    console.error("[v0] Send email error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 },
    )
  }
}

