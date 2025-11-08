import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { generateProposalPDF } from "@/lib/pdf-service"

const resend = new Resend(process.env.RESEND_API_KEY)

// Function to convert image URL to base64 data URI
async function imageUrlToDataUri(imageUrl: string): Promise<string | null> {
  try {
    console.log('Fetching image from URL:', imageUrl)
    const response = await fetch(imageUrl)
    console.log('Response status:', response.status, response.statusText)

    if (!response.ok) {
      console.error('Failed to fetch image:', response.status, response.statusText)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    console.log('Content type:', contentType)
    if (!contentType || !contentType.startsWith('image/')) {
      console.error('Invalid content type for image:', contentType)
      throw new Error(`Invalid content type: ${contentType}. Expected image/*`)
    }

    const contentLength = response.headers.get('content-length')
    console.log('Content length:', contentLength)

    const arrayBuffer = await response.arrayBuffer()
    console.log('Array buffer size:', arrayBuffer.byteLength)

    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUri = `data:${contentType};base64,${base64}`
    console.log('Data URI created successfully, length:', dataUri.length)

    return dataUri
  } catch (error) {
    console.error('Error converting image to data URI:', error)
    throw new Error(`Image conversion failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Function to extract dominant color from base64 image data
async function extractDominantColor(base64DataUri: string): Promise<string | null> {
  try {
    console.log('Starting color extraction process...')

    // Extract base64 data from data URI
    const base64Data = base64DataUri.split(',')[1]
    if (!base64Data) {
      console.error('Invalid base64 data URI format')
      return null
    }
    console.log('Base64 data extracted successfully')

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64')
    console.log('Image buffer created, size:', imageBuffer.length, 'bytes')

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
      throw new Error(`node-vibrant import failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Get color palette from the image buffer using node-vibrant
    console.log('Extracting color palette from image buffer...')
    const palette = await Vibrant.from(imageBuffer).getPalette()
    console.log('Palette extracted:', palette ? 'Success' : 'Failed')

    if (!palette) {
      console.error('Failed to extract color palette from image')
      throw new Error('No color palette could be extracted from the image')
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
      throw new Error('No suitable color swatch found in the palette')
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
    throw new Error(`Color extraction failed: ${error instanceof Error ? error.message : String(error)}`)
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

export async function POST(request: NextRequest) {
  try {
    console.log("Proposal email API route called")

    // Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not found in environment variables")
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }

    let formData
    try {
      formData = await request.formData()
    } catch (parseError) {
      console.error("Failed to parse form data:", parseError)
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
    }

    const proposalData = formData.get("proposal") as string
    const proposal = proposalData ? JSON.parse(proposalData) : null

    console.log("Request form data received:", {
      hasProposal: !!proposal,
      hasClientEmail: !!formData.get("clientEmail"),
      proposalId: proposal?.id,
      customSubject: formData.get("subject"),
      customBody: formData.get("body"),
      currentUserEmail: formData.get("currentUserEmail"),
      currentUserPhoneNumber: formData.get("currentUserPhoneNumber"),
      ccEmail: formData.get("ccEmail"), // Now a string that might contain multiple emails
      replyToEmail: formData.get("replyToEmail"),
      hasUserData: !!formData.get("userData"),
    })

    console.log("Proposal company logo:", proposal?.companyLogo)
    console.log("Proposal company name:", proposal?.companyName)

    // Extract dominant color from company logo if available
    let dominantColor: string = '#667eea' // Default fallback color
    let logoDataUri: string | null = null

    // Use the correct logo URL consistently
    const companyLogoUrl = proposal?.companyLogo

    if (companyLogoUrl) {
      try {
        console.log("Converting logo URL to data URI:", companyLogoUrl)
        logoDataUri = await imageUrlToDataUri(companyLogoUrl)

        if (logoDataUri) {
          console.log("Successfully converted logo to data URI")

          // Extract dominant color from the logo
          const extractedColor = await extractDominantColor(logoDataUri)
          if (extractedColor) {
            dominantColor = extractedColor
            console.log("Successfully extracted dominant color:", dominantColor)
          } else {
            console.error("Failed to extract dominant color from logo, using fallback color")
            dominantColor = '#667eea' // Use fallback color instead of throwing error
          }
        } else {
          console.error("Failed to convert logo to data URI, using original URL")
          logoDataUri = companyLogoUrl // Use original URL as fallback
        }
      } catch (error) {
        console.error("Error processing company logo:", error)
        // Continue without logo - not a critical failure
        logoDataUri = null
        dominantColor = '#667eea' // Use default color
      }
    } else {
      console.log("No company logo provided, using default styling")
      logoDataUri = null
      dominantColor = '#667eea' // Use default color
    }

    const clientEmail = formData.get("clientEmail") as string
    const subject = formData.get("subject") as string
    const customBody = formData.get("body") as string
    const currentUserEmail = formData.get("currentUserEmail") as string
    const currentUserPhoneNumber = formData.get("currentUserPhoneNumber") as string
    const ccEmail = formData.get("ccEmail") as string
    const replyToEmail = formData.get("replyToEmail") as string
    const userData = formData.get("userData") ? JSON.parse(formData.get("userData") as string) : null

    if (!proposal || !clientEmail) {
      console.error("Missing required fields:", { proposal: !!proposal, clientEmail: !!clientEmail })
      return NextResponse.json({ error: "Missing proposal or client email address" }, { status: 400 })
    }

    // Validate email format for 'To'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(clientEmail)) {
      console.error("Invalid 'To' email format:", clientEmail)
      return NextResponse.json({ error: "Invalid 'To' email address format" }, { status: 400 })
    }

    // Process and validate multiple CC emails
    const ccEmailsArray = ccEmail
      ? ccEmail
          .split(",")
          .map((email: string) => email.trim())
          .filter(Boolean)
      : []

    for (const email of ccEmailsArray) {
      if (!emailRegex.test(email)) {
        console.error("Invalid 'CC' email format:", email)
        return NextResponse.json({ error: `Invalid 'CC' email address format: ${email}` }, { status: 400 })
      }
    }

    const proposalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposals/view/${proposal.id}`

    // Generate PDF as base64 for attachment with optimized compression for email
    let pdfBase64 = null
    try {
      console.log("Generating PDF for email attachment...")
      // Use proposal template settings or defaults
      const selectedSize = proposal.templateSize || "A4"
      const selectedOrientation = proposal.templateOrientation || "Portrait"
      const selectedLayout = proposal.templateLayout || "1"
      const selectedTemplateBackground = proposal.templateBackground || ""

      // Generate PDF with email-optimized compression
      pdfBase64 = await generateProposalPDF(proposal, true, selectedSize, selectedOrientation, selectedLayout, selectedTemplateBackground) // true for base64 return
      console.log("PDF generated successfully for email attachment")
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError)
      // Continue without PDF attachment if generation fails
    }

    console.log("Generated proposal URL:", proposalUrl)

    // Use custom subject and body if provided, otherwise fall back to default
    const finalSubject = subject || `Proposal: ${proposal.title || "Custom Advertising Solution"} - ${proposal.companyName || "OH Plus"}`

    // Create email template function that uses the extracted dominant color and user data
    const createProposalEmailTemplate = (dominantColor: string, userName?: string, userPosition?: string, replyToEmail?: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Proposal from ${proposal.companyName || "OH Plus"}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, ${dominantColor}, ${shadeColor(dominantColor, -20)});
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .logo {
            max-height: 60px;
            margin-bottom: 10px;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #1f2937;
          }
          .proposal-summary {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid ${dominantColor};
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
          }
          .summary-label {
            font-weight: 600;
            color: #6b7280;
          }
          .summary-value {
            color: #1f2937;
            font-weight: 500;
          }
          .total-amount {
            background: linear-gradient(135deg, ${dominantColor}, ${shadeColor(dominantColor, -20)});
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            font-size: 20px;
            font-weight: 700;
            margin: 25px 0;
          }
          .action-button {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, ${dominantColor}, ${shadeColor(dominantColor, -20)});
            color: white !important;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
          }
          .btn:hover {
            transform: translateY(-1px);
          }
          .message {
            background: #eff6ff;
            border: 1px solid #dbeafe;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            color: #1e40af;
          }
          .footer {
            background: linear-gradient(135deg, ${dominantColor}, ${shadeColor(dominantColor, -20)});
            color: white;
            padding: 50px 30px 30px 30px;
            position: relative;
            overflow: hidden;
            min-height: 200px;
            margin-top: 30px;
          }
          .footer-circles {
            position: absolute;
            top: 0;
            right: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
          }
          .footer-circle-1 {
            position: absolute;
            top: -40px;
            right: -60px;
            width: 150px;
            height: 150px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            z-index: 2;
          }
          .footer-circle-2 {
            position: absolute;
            top: -20px;
            right: 20px;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.05);
            z-index: 1;
          }
          .footer-content {
            position: relative;
            z-index: 3;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            max-width: 400px;
          }
          .footer-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
          }
          .footer-logo {
            width: 40px;
            height: 40px;
            margin-right: 12px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            color: white;
          }
          .footer-company-name {
            font-size: 20px;
            font-weight: 600;
            margin: 0;
            color: white;
          }
          .footer-name {
            font-size: 18px;
            font-weight: 600;
            margin: 5px 0;
            color: white;
          }
          .footer-position {
            font-size: 14px;
            opacity: 0.9;
            margin: 2px 0 15px 0;
            color: white;
          }
          .footer-contact {
            font-size: 13px;
            margin: 3px 0;
            color: rgba(255, 255, 255, 0.9);
          }
          .footer-legal {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            font-size: 12px;
            opacity: 0.8;
            text-align: center;
            color: white;
          }
          .contact-info {
            background: #f9fafb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
          }
          .attachment-note {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            color: #92400e;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${proposal.companyLogo ? `<img src="${logoDataUri || proposal.companyLogo}" alt="${proposal.companyName || 'Company Logo'}" style="max-height: 60px; margin-bottom: 10px;" />` : `<h1>${proposal.companyName || 'OH Plus'}</h1>`}
            <p>Professional Outdoor Advertising Solutions</p>
          </div>

          <div class="content">
            <div class="greeting">
              Dear ${proposal.client?.contactPerson || proposal.client?.company || "Valued Client"},
            </div>

            <p>We are excited to present you with a customized advertising proposal tailored to your specific needs. Our team has carefully crafted this proposal to help you achieve your marketing objectives.</p>

            <div class="proposal-summary">
              <h3 style="margin-top: 0; color: #1f2937;">Proposal Summary</h3>
              <div class="summary-item">
                <span class="summary-label">Proposal Title:</span>
                <span class="summary-value">${proposal.title || "Custom Advertising Proposal"}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Number of Products:</span>
                <span class="summary-value">${proposal.products?.length || 0} advertising solutions</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Valid Until:</span>
                <span class="summary-value">${proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
              </div>
            </div>

            <div class="total-amount">
              Total Investment: ₱${(proposal.totalAmount || 0).toLocaleString()}
            </div>

            ${
              proposal.customMessage
                ? `
            <div class="message">
              <strong>Personal Message:</strong><br>
              ${proposal.customMessage}
            </div>
            `
                : ""
            }

            ${
              pdfBase64
                ? `
            <div class="attachment-note">
              📎 <strong>PDF Attached:</strong> You'll find the complete proposal document attached to this email for your convenience.
            </div>
            `
                : ""
            }

            <div class="action-button">
              <a href="https://mrk.ohplus.ph/pr/${proposal.id}" class="btn">View Full Proposal Online</a>
            </div>

            ${
              proposal.password
                ? `
            <div class="attachment-note">
              🔐 <strong>Access Code:</strong> ${proposal.password}<br>
              <small style="color: #6b7280;">Please use this code to access the proposal online.</small>
            </div>
            `
                : ""
            }

            <p>We believe this proposal offers excellent value and aligns perfectly with your advertising goals. Our team is ready to discuss any questions you may have and work with you to bring this campaign to life.</p>

            <div class="contact-info">
               <strong>Ready to get started?</strong><br>
               📧 Email: ${replyToEmail || currentUserEmail || "noreply@ohplus.ph"}<br>
               📞 Phone: ${currentUserPhoneNumber || "+639XXXXXXXXX"}
             </div>

            <p>Thank you for considering OH Plus as your advertising partner. We look forward to creating something amazing together!</p>

            <p style="margin-bottom: 0;">
              Best regards,<br>
              <strong>The OH Plus Team</strong>
            </p>
          </div>

          <div class="footer">
            <div class="footer-circles">
              <div class="footer-circle-1"></div>
              <div class="footer-circle-2"></div>
            </div>
            <div class="footer-content">
              <!-- Header elements copied to footer -->
              <div class="footer-header-section" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <div class="footer-left-content" style="display: flex; align-items: center; gap: 15px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    ${proposal.companyLogo ? `<img src="${logoDataUri || proposal.companyLogo}" alt="${proposal.companyName || 'Company Logo'}" class="footer-logo" style="max-height: 60px;" />` : `<div style="width: 60px; height: 60px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: white;">${(proposal.companyName || 'OH Plus').charAt(0)}</div>`}
                    <span style="color: white; font-size: 18px; font-weight: 600;">${proposal.companyName || 'OH Plus'}</span>
                  </div>
                  <div class="sales-info">
                    <h4 class="sales-name" style="color: ${dominantColor}; margin: 0 0 2px 0; font-size: 16px; font-weight: 600;">${userName || 'Sales Executive'}</h4>
                    <p class="sales-position" style="margin: 0 0 3px 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">${userPosition || 'Sales Executive'}</p>
                    <p class="sales-contact" style="margin: 0 0 2px 0; color: rgba(255, 255, 255, 0.9); font-size: 13px;">📞 ${currentUserPhoneNumber || "+639XXXXXXXXX"}</p>
                    <p class="sales-contact" style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 13px;">📧 ${replyToEmail || currentUserEmail || "noreply@ohplus.ph"}</p>
                  </div>
                </div>
                <div class="footer-company-section" style="text-align: right;">
                  <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">${proposal.companyName || 'OH Plus'}</h2>
                  <p style="color: rgba(255, 255, 255, 0.9); margin: 5px 0 0 0; font-size: 16px;">Professional Outdoor Advertising Solutions</p>
                </div>
              </div>

              <!-- Updated contact information with header-like styling -->
              <div class="footer-contact-section">
                <div class="footer-name" style="font-size: 18px; font-weight: 600; margin: 0 0 5px 0; color: white; letter-spacing: 0.5px;">${userName || 'Sales Executive'}</div>
                <div class="footer-company" style="font-size: 16px; font-weight: 500; margin: 0 0 2px 0; color: rgba(255, 255, 255, 0.95);">${userPosition || 'Sales Executive'}</div>
                <div class="footer-position" style="font-size: 16px; font-weight: 600; margin: 0 0 15px 0; color: white; letter-spacing: 0.5px;">${userName || 'Sales Executive'}</div>

                <div class="footer-contact" style="font-size: 14px; margin: 5px 0; color: rgba(255, 255, 255, 0.95); display: flex; align-items: center; justify-content: flex-start;">
                  <span style="margin-right: 8px;">📞</span>
                  <span>${currentUserPhoneNumber || "+639XXXXXXXXX"}</span>
                </div>
                <div class="footer-contact" style="font-size: 14px; margin: 5px 0; color: rgba(255, 255, 255, 0.95); display: flex; align-items: center; justify-content: flex-start;">
                  <span style="margin-right: 8px;">📧</span>
                  <span>${replyToEmail || currentUserEmail || "noreply@ohplus.ph"}</span>
                </div>

                <div class="footer-legal-text" style="font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.85); line-height: 1.4;">
                  This email contains confidential information intended only for the recipient. If you have received this email in error, please notify the sender and delete this message.
                </div>
              </div>
            </div>

          </div>
        </div>
      </body>
      </html>
    `

    // Create user name and position from userData like in quotations template
    const userName = userData?.first_name && userData?.last_name
      ? `${userData.first_name} ${userData.last_name}`.trim()
      : userData?.displayName || userData?.name || "Sales Executive"

    const userPosition = userData?.position || "Sales Executive"

    const finalBody =
       customBody ||
       createProposalEmailTemplate(dominantColor, userName, userPosition, replyToEmail)

    console.log("Attempting to send email to:", clientEmail)

    // Prepare email data with optional PDF attachment
    const emailData: any = {
       from: "OH Plus <noreply@ohplus.ph>",
       to: [clientEmail],
       subject: finalSubject, // Use the final subject
       html: finalBody, // Use the final body
       cc: ccEmailsArray.length > 0 ? ccEmailsArray : undefined, // Add CC if provided
     }

     // Add reply-to if replyToEmail is provided, otherwise use current user email
     if (replyToEmail && replyToEmail.trim().length > 0) {
       emailData.reply_to = replyToEmail.trim()
     } else if (currentUserEmail && currentUserEmail.trim().length > 0) {
       emailData.reply_to = currentUserEmail.trim()
     }

    // Add PDF attachment if generated successfully
    if (pdfBase64) {
      emailData.attachments = [
        {
          filename: `${(proposal.title || "Proposal").replace(/[^a-z0-9]/gi, "_")}_${proposal.id}.pdf`,
          content: pdfBase64,
          type: "application/pdf",
        },
      ]
      console.log("PDF attachment added to email")
    }

    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error("Resend API error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send email",
          details: error.message || "Unknown error from email service",
        },
        { status: 500 },
      )
    }

    console.log("Email sent successfully:", data)
    return NextResponse.json({
      success: true,
      data,
      message: pdfBase64
        ? "Email sent successfully with PDF attachment and access code"
        : "Email sent successfully with access code",
    })
  } catch (error) {
    console.error("Email sending error:", error)

    // Handle color extraction errors specifically (now non-critical)
    if (error instanceof Error && error.message.includes('Color extraction failed')) {
      console.warn("Color extraction failed, but continuing with default color:", error.message)
    }

    if (error instanceof Error && error.message.includes('Logo processing failed')) {
      console.warn("Logo processing failed, but continuing without logo:", error.message)
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
