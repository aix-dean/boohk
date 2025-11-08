import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { generateCostEstimatePDF } from "@/lib/cost-estimate-pdf-service"
import { emailService, type EmailAttachment } from "@/lib/email-service"
import { Timestamp, doc, getDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage, db } from "@/lib/firebase"

// Helper function to convert image URL to base64 data URI
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

// Helper function to extract dominant color from base64 image data
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

async function uploadFileToStorage(fileBuffer: Buffer, fileName: string, fileType: string, companyId: string): Promise<string> {
  try {
    const timestamp = Date.now()
    const fileExtension = fileName.split('.').pop() || 'file'
    const storageFileName = `emails/${companyId}/${timestamp}_${fileName}`

    const storageRef = ref(storage, storageFileName)

    // Upload the file
    await uploadBytes(storageRef, fileBuffer, {
      contentType: fileType,
    })

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef)

    return downloadURL
  } catch (error) {
    console.error("Error uploading file to storage:", error)
    throw new Error(`Failed to upload file: ${fileName}`)
  }
}

async function fetchCompanyData(companyId: string) {
  try {
    const companyDoc = await getDoc(doc(db, "companies", companyId))

    if (companyDoc.exists()) {
      const data = companyDoc.data()

      // Always use ohplus.ph domain for sending emails (verified domain)
      const verifiedEmail = "noreply@ohplus.ph"

      // Log if company has a different email domain
      if (data.email) {
        const companyEmailDomain = data.email.split('@')[1]
        if (companyEmailDomain !== 'ohplus.ph') {
          console.log(`Using ohplus.ph domain for sending. Company email: ${data.email}`)
        }
      }

      return {
        company_name: data.company_name || data.name || "Boohk",
        company_location: data.company_location || data.address || "No. 727 General Solano St., San Miguel, Manila 1005",
        phone: data.phone || data.telephone || data.contact_number || "+639XXXXXXXXX",
        email: verifiedEmail,
        website: data.website || "www.ohplus.ph",
      }
    }

    return {
      company_name: "Boohk",
      company_location: "No. 727 General Solano St., San Miguel, Manila 1005",
      phone: "+639XXXXXXXXX",
      email: "noreply@ohplus.ph",
      website: "www.ohplus.ph",
    }
  } catch (error) {
    console.error("Error fetching company data:", error)
    return {
      company_name: "Boohk",
      company_location: "No. 727 General Solano St., San Miguel, Manila 1005",
      phone: "+639XXXXXXXXX",
      email: "noreply@ohplus.ph",
      website: "www.ohplus.ph",
    }
  }
}

function createEmailTemplate(
    body: string,
    userPhoneNumber?: string,
    companyData?: {
      company_name?: string
      company_location?: string
      phone?: string
      email?: string
      website?: string
    },
    companyLogo?: string,
    dominantColor?: string,
    replyToEmail?: string,
    userName?: string,
    userPosition?: string,
    costEstimateId?: string
  ): string {
    const phoneNumber = userPhoneNumber || companyData?.phone || "+639XXXXXXXXX"
    const companyName = companyData?.company_name || ""
    const companyLocation = companyData?.company_location || ""
    const companyEmail = replyToEmail || companyData?.email || "noreply@ohplus.ph"
    const companyWebsite = companyData?.website || "www.ohplus.ph"

    // Use primary color for branding (dynamic based on logo or fallback)
    const primaryColor = dominantColor || '#667eea'

    const processedBody = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #333333;">${line}</p>`)
      .join("")

    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${companyName} - Cost Estimate</title>
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
     padding: 0 0 0 20px;
     color: #000000;
     position: relative;
     overflow: hidden;
     width: 100%;
     display: flex;
     justify-content: flex-end;  /* align footer-content to the right */
     align-items: center;
 }
         .header-circles { position: absolute; top: 0; right: 0; width: 140px; height: 100%; pointer-events: none; display: flex; justify-content: flex-end; align-items: center; gap: 20px; }
         .header-div { background: ${dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : ''}; opacity: 0.8; z-index: 1; display: flex; justify-content: flex-end; align-items: center;  }
         .header-square-1 { width: 80px; height: 130px; background: ${primaryColor}; opacity: 1.0; z-index: 2; }
         .header-square-2 { width: 60px; height: 130px; background: transparent; opacity: 0.8; z-index: 1;  }
         .header-content { width: 100%; height: 100px; display: flex; align-items: center; gap: 20px; position: relative; z-index: 3; padding-top: 10px }
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
.footer {
     background: #ffffff;
     padding: 0 0 0 20px;
     color: #000000;
     position: relative;
     overflow: hidden;
     width: 100%;
     display: flex;
     justify-content: flex-end;  /* align footer-content to the right */
     align-items: center;
 }

.footer-circles {
     position: relative;
     top: 0;
     right: 0;
     bottom: 0;                  /* ensure full height coverage */
     height: 100%;
     width: 140px;
     pointer-events: none;
     display: flex;
     justify-content: flex-end;  /* align the squares to the right edge */
     align-items: center;
     gap: 0;                     /* remove gap so they stay flush right */
     z-index: 1;                 /* keep it behind the text content */
 }
.footer-div { background: ${dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : ''}; opacity: 0.8; z-index: 1; display: flex; justify-content: flex-end; align-items: center;  }
         .footer-square-1 { width: 80px; height: 160px; background: ${primaryColor}; opacity: 1.0; z-index: 2; }
         .footer-square-2 { width: 60px; height: 160px; background: transparent; opacity: 0.8; z-index: 1;  }
         .footer-content { height: 160px; width: 100%; position: relative; z-index: 3; }
         .footer-header {  display: flex; justify-content: flex-start;align-items: center; gap: 20px; padding-top:20px; }
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
              <div class="header-content">
                  ${companyLogo ? `<img src="${companyLogo}" alt="${companyName || 'Company'} Logo" class="header-logo">` : ''}
                  <div class="company-info">
                      <h1 class="company-name">${companyName}</h1>
                      ${companyLocation ? `<p class="company-address">${companyLocation}</p>` : ''}
                  </div>
              </div>
              <div class="header-circles">
                  <div class="header-div">
                      <div class="header-square-2"></div>
                      <div class="header-square-1"></div>
                  </div>
              </div>
          </div>

          <div class="content">
              ${processedBody}


              <div class="cta-section">
                  <a href="https://mrk.ohplus.ph/ce/${costEstimateId}" target="_blank" class="cta-button">View Cost Estimate</a>
              </div>
          </div>

          <div class="footer">
              <div class="footer-content">
                  <div class="footer-header">
                      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName || 'Company'} Logo" class="footer-logo">` : ''}
                      <h3 class="footer-company-name">${companyName}</h3>
                  </div>

                  <div class="signature">
                      <h4 class="signature-name">${userName || 'Sales Executive'}</h4>
                      <p class="signature-title">${userPosition ? `${userPosition}` : ``}</p>
                      <div class="contact-info">
                         ${companyEmail}<br>
                          ${phoneNumber ? `${phoneNumber}` : ''}
                      </div>
                  </div>
              </div>
              <div class="footer-circles">
                  <div class="footer-div">
                      <div class="footer-square-2"></div>
                      <div class="footer-square-1"></div>
                  </div>
              </div>
          </div>


          </div>
      </div>
  </body>
  </html>
    `
  }

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Resend API key not configured" }, { status: 500 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Parse JSON payload
    const {
      costEstimate,
      clientEmail,
      client,
      currentUserEmail,
      ccEmail,
      replyToEmail,
      subject,
      body,
      preGeneratedPDFs,
      uploadedFiles,
      userData
    } = await request.json()

    console.log("[v0] Cost estimate email sending - Subject:", subject)
    console.log("[v0] Cost estimate email sending - Client email:", clientEmail)
    console.log("[v0] Cost estimate email sending - Current user email (reply-to):", currentUserEmail)

    if (!body || body.trim().length === 0) {
      console.error("[v0] Email sending failed - Empty body")
      return NextResponse.json({ error: "Email body cannot be empty" }, { status: 400 })
    }

    if (!subject || subject.trim().length === 0) {
      console.error("[v0] Email sending failed - Empty subject")
      return NextResponse.json({ error: "Email subject cannot be empty" }, { status: 400 })
    }

    if (!clientEmail || clientEmail.trim().length === 0) {
      console.error("[v0] Email sending failed - Empty client email")
      return NextResponse.json({ error: "Client email cannot be empty" }, { status: 400 })
    }

    // Use pre-generated PDFs from frontend or generate fallback
    console.log("[v0] Using pre-generated PDFs from frontend...")
    let attachments: Array<{ filename: string; content: any }> = []
    let attachmentDetails: EmailAttachment[] = []

    const companyId = userData?.company_id || costEstimate.company_id || "unknown"

    if (preGeneratedPDFs && preGeneratedPDFs.length > 0) {
      // Use pre-generated PDFs from frontend
      console.log(`[v0] Using ${preGeneratedPDFs.length} pre-generated PDFs`)
      attachments = preGeneratedPDFs.map((pdf: any) => ({
        filename: pdf.filename,
        content: Buffer.from(pdf.content, 'base64'),
      }))

      // Upload pre-generated PDFs to storage and create attachment details
      for (const pdf of preGeneratedPDFs) {
        try {
          const fileUrl = await uploadFileToStorage(
            Buffer.from(pdf.content, 'base64'),
            pdf.filename,
            'application/pdf',
            companyId
          )
          attachmentDetails.push({
            fileName: pdf.filename,
            fileSize: Buffer.from(pdf.content, 'base64').length,
            fileType: 'application/pdf',
            fileUrl: fileUrl,
          })
        } catch (error) {
          console.error(`Failed to upload PDF ${pdf.filename}:`, error)
        }
      }
    } else {
      // Fallback: Generate PDF on server with userData
      console.log("[v0] No pre-generated PDFs, generating on server...")
      const pdfBuffer = await generateCostEstimatePDF(costEstimate, undefined, false, userData)
      if (!pdfBuffer) {
        console.error("[v0] Failed to generate PDF")
        return NextResponse.json({ error: "Failed to generate PDF attachment" }, { status: 500 })
      }
      const filename = `cost-estimate-${costEstimate.costEstimateNumber || costEstimate.id}.pdf`
      attachments = [{
        filename: filename,
        content: pdfBuffer,
      }]

      // Upload generated PDF to storage
      try {
        const pdfBufferData = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer.toString())
        const fileUrl = await uploadFileToStorage(pdfBufferData, filename, 'application/pdf', companyId)
        attachmentDetails.push({
          fileName: filename,
          fileSize: pdfBufferData.length,
          fileType: 'application/pdf',
          fileUrl: fileUrl,
        })
      } catch (error) {
        console.error(`Failed to upload generated PDF ${filename}:`, error)
      }
    }

    // Add uploaded files as attachments
    if (uploadedFiles && uploadedFiles.length > 0) {
      console.log(`[v0] Adding ${uploadedFiles.length} uploaded files`)
      const uploadedAttachments = uploadedFiles.map((file: any) => ({
        filename: file.filename,
        content: Buffer.from(file.content, 'base64'),
        type: file.type,
      }))
      attachments.push(...uploadedAttachments)

      // Upload uploaded files to storage and create attachment details
      for (const file of uploadedFiles) {
        try {
          const fileBuffer = Buffer.from(file.content, 'base64')
          const fileUrl = await uploadFileToStorage(
            fileBuffer,
            file.filename,
            file.type,
            companyId
          )
          attachmentDetails.push({
            fileName: file.filename,
            fileSize: fileBuffer.length,
            fileType: file.type,
            fileUrl: fileUrl,
          })
        } catch (error) {
          console.error(`Failed to upload file ${file.filename}:`, error)
        }
      }
    }

    // Fetch company data for email template
    const companyData = await fetchCompanyData(companyId)

    // Fetch company logo and extract dominant color
    let companyLogo = undefined
    let dominantColor = undefined

    if (companyId && companyId !== "unknown") {
      try {
        const companyDoc = await getDoc(doc(db, "companies", companyId))
        if (companyDoc.exists()) {
          const companyDocData = companyDoc.data()
          if (companyDocData?.logo || companyDocData?.photo_url) {
            companyLogo = companyDocData.logo || companyDocData.photo_url
            console.log("Company logo found:", companyLogo, {
              logo: !!companyDocData.logo,
              photo_url: !!companyDocData.photo_url,
              usingField: companyDocData.logo ? 'logo' : 'photo_url'
            })
          } else {
            console.log("No company logo found in document")
          }
        }
      } catch (error) {
        console.error("Error fetching company logo:", error)
      }
    }

    // Extract dominant color from logo if available
    if (companyLogo) {
      try {
        console.log("Extracting dominant color from logo...")
        const logoDataUri = await imageUrlToDataUri(companyLogo)
        if (logoDataUri) {
          dominantColor = await extractDominantColor(logoDataUri)
          if (dominantColor) {
            console.log("Successfully extracted dominant color:", dominantColor)
          } else {
            console.log("Failed to extract dominant color, using fallback")
            dominantColor = undefined
          }
        }
      } catch (error) {
        console.error("Error extracting dominant color:", error)
        dominantColor = undefined
      }
    }

    // Create email template - construct user name from available fields
    const userName = userData?.first_name && userData?.last_name
      ? `${userData.first_name} ${userData.last_name}`.trim()
      : userData?.displayName || userData?.displayName || "Sales Executive"

    const finalBody = createEmailTemplate(body.trim(), userData?.phone_number, companyData, companyLogo, dominantColor, replyToEmail, userName, userData?.position || "Sales Executive", costEstimate.id)

    // Prepare email data
    const from = `${companyData.company_name} <${companyData.email}>`
    const to = [clientEmail]
    const cc = ccEmail ? ccEmail.split(",").map((email: string) => email.trim()).filter(Boolean) : []

    // Send email using Resend
    const emailData: any = {
      from,
      to,
      subject: subject.trim(),
      html: finalBody,
      attachments,
    }

    // Add CC if provided
    if (cc.length > 0) {
      emailData.cc = cc
    }

    // Add reply-to if replyToEmail is provided, otherwise use current user email
    if (replyToEmail && replyToEmail.trim().length > 0) {
      emailData.reply_to = replyToEmail.trim()
    } else if (currentUserEmail && currentUserEmail.trim().length > 0) {
      emailData.reply_to = currentUserEmail.trim()
    }

    console.log("[v0] Email sending - Sending to Resend API with reply-to:", emailData.reply_to)
    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error("[v0] Resend error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log("[v0] Cost estimate email sent successfully:", data?.id)

    // Create email document in emails collection
    try {
      const emailDocument = {
        from: from,
        to: to,
        cc: cc.length > 0 ? cc : null,
        replyTo: emailData.reply_to,
        subject: subject.trim(),
        body: body.trim(),
        attachments: attachmentDetails.length > 0 ? attachmentDetails : undefined,
        email_type: "cost_estimate",
        costEstimateId: costEstimate.id,
        templateId: undefined, // No template used for cost estimates
        reportId: undefined,
        status: "sent" as const,
        userId: userData?.email || currentUserEmail || "unknown",
        company_id: userData?.company_id || costEstimate.company_id,
        created: Timestamp.fromDate(new Date()),
        sentAt: Timestamp.fromDate(new Date()),
        updated: Timestamp.fromDate(new Date()),
      }

      const emailId = await emailService.createEmail(emailDocument)
      console.log("[v0] Email document created successfully:", emailId)
    } catch (emailDocError) {
      console.error("[v0] Failed to create email document:", emailDocError)
      // Don't fail the entire request if email document creation fails
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Send cost estimate email error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 },
    )
  }
}
