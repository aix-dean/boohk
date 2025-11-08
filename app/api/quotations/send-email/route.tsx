import { type NextRequest, NextResponse } from "next/server"
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
        company_name: data.company_name || data.name || "OH Plus",
        company_location: data.company_location || data.address || "No. 727 General Solano St., San Miguel, Manila 1005",
        phone: data.phone || data.telephone || data.contact_number || "+639XXXXXXXXX",
        email: verifiedEmail,
        website: data.website || "www.ohplus.ph",
      }
    }

    return {
      company_name: "OH Plus",
      company_location: "No. 727 General Solano St., San Miguel, Manila 1005",
      phone: "+639XXXXXXXXX",
      email: "noreply@ohplus.ph",
      website: "www.ohplus.ph",
    }
  } catch (error) {
    console.error("Error fetching company data:", error)
    return {
      company_name: "OH Plus",
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
    quotationUrl?: string
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
     <title>${companyName} - Quotation</title>
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
                 <a href="${quotationUrl}" target="_blank" class="cta-button">View Quotation</a>
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
    console.log("Quotation email API route called")

    // Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not found in environment variables")
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }

    // Initialize Resend client inside the function to prevent module-level failures
    let resend: any
    try {
      const { Resend } = await import("resend")
      resend = new Resend(process.env.RESEND_API_KEY)
      console.log("Resend client initialized successfully")
    } catch (initError) {
      console.error("Failed to initialize Resend client:", initError)

      // Provide more specific error messages based on the type of error
      let errorMessage = "Email service initialization failed"
      let errorDetails = initError instanceof Error ? initError.message : "Unknown initialization error"

      if (initError instanceof Error) {
        if (initError.message.includes("API key")) {
          errorMessage = "Email service configuration error"
          errorDetails = "Invalid or missing Resend API key"
        } else if (initError.message.includes("network") || initError.message.includes("fetch")) {
          errorMessage = "Email service network error"
          errorDetails = "Unable to connect to email service. Please check your internet connection."
        } else if (initError.message.includes("module") || initError.message.includes("import")) {
          errorMessage = "Email service module error"
          errorDetails = "Email service module could not be loaded"
        }
      }

      return NextResponse.json({
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    console.log("Request body received:", {
      hasQuotation: !!body.quotation,
      hasClientEmail: !!body.clientEmail,
      quotationId: body.quotation?.id,
      customSubject: body.subject,
      customBody: body.body,
      currentUserEmail: body.currentUserEmail,
      ccEmail: body.ccEmail,
      preGeneratedPDFsCount: body.preGeneratedPDFs?.length || 0,
      hasUploadedFiles: !!body.uploadedFiles,
      uploadedFilesCount: body.uploadedFiles?.length || 0,
    })

    const {
      quotation,
      clientEmail,
      subject,
      body: customBody,
      currentUserEmail,
      ccEmail,
      replyToEmail,
      companyName,
      preGeneratedPDFs,
      uploadedFiles,
      userData,
    } = body

    if (!quotation || !clientEmail) {
      console.error("Missing required fields:", { quotation: !!quotation, clientEmail: !!clientEmail })
      return NextResponse.json({ error: "Missing quotation or client email address" }, { status: 400 })
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

    const quotationUrl = `https://mrk.ohplus.ph/q/${quotation.id}`

    console.log(`Using ${preGeneratedPDFs?.length || 0} pre-generated PDFs for email attachments`)
    console.log("Generated quotation URL:", quotationUrl)

    // Use custom subject and body if provided, otherwise fall back to default
    const finalSubject =
      subject || `Quotation: ${quotation.items?.[0]?.name || "Custom Advertising Solution"} - ${companyName || "Company"}`

    // Fetch company data for email template
    const companyId = userData?.company_id || quotation?.company_id || "unknown"
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

    const finalBody = createEmailTemplate(customBody || "We are excited to present you with a detailed quotation tailored to your specific advertising needs. Our team has carefully prepared this quotation to help you plan your marketing investment.", userData?.phone_number, companyData, companyLogo, dominantColor, replyToEmail, userName, userData?.position || "Sales Executive", quotationUrl)

    console.log("Attempting to send email to:", clientEmail)

    // Upload files to Firebase BEFORE sending email to ensure upload failures are fatal
    let attachmentDetails: EmailAttachment[] = []

    // Upload pre-generated PDFs to storage first
    if (preGeneratedPDFs && Array.isArray(preGeneratedPDFs) && preGeneratedPDFs.length > 0) {
      for (const pdf of preGeneratedPDFs) {
        if (pdf.filename && pdf.content) {
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
            console.log(`Pre-generated PDF uploaded successfully:`, pdf.filename)
          } catch (error) {
            console.error(`Failed to upload PDF ${pdf.filename}:`, error)
            throw error // Make upload failures fatal
          }
        }
      }
    }

    // Upload uploaded files to storage first
    if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        if (file.filename && file.content && file.type) {
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
            console.log(`Uploaded file uploaded successfully:`, file.filename)
          } catch (error) {
            console.error(`Failed to upload file ${file.filename}:`, error)
            throw error // Make upload failures fatal
          }
        }
      }
    }

    const attachments: Array<{ filename: string; content: Buffer; type?: string }> = []

    if (preGeneratedPDFs && Array.isArray(preGeneratedPDFs) && preGeneratedPDFs.length > 0) {
      preGeneratedPDFs.forEach((pdf, index) => {
        if (pdf.filename && pdf.content) {
          attachments.push({
            filename: pdf.filename,
            content: pdf.content,
            type: "application/pdf",
          })
          console.log(`Pre-generated PDF attachment ${index + 1} added:`, pdf.filename)
        }
      })
    }

    // Add uploaded file attachments if available
    if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
      uploadedFiles.forEach((file, index) => {
        if (file.filename && file.content && file.type) {
          attachments.push({
            filename: file.filename,
            content: file.content,
            type: file.type,
          })
          console.log(`Uploaded file attachment ${index + 1} added:`, file.filename)
        }
      })
    }

    console.log(`Total attachments prepared: ${attachments.length}`)

    // Prepare email data with all attachments
    const from = `${companyData.company_name} <${companyData.email}>`
    const to = [clientEmail]
    const cc = ccEmailsArray.length > 0 ? ccEmailsArray : []

    const emailData: any = {
      from,
      to,
      subject: finalSubject.trim(),
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

    if (attachments.length > 0) {
      emailData.attachments = attachments
      console.log(`${attachments.length} attachment(s) added to email`)
    }

    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error("Resend API error:", error)

      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to send email"
      let errorDetails = error.message || "Unknown error from email service"
      let statusCode = 500

      if (error.message) {
        if (error.message.includes("rate limit") || error.message.includes("429")) {
          errorMessage = "Email service rate limited"
          errorDetails = "Too many emails sent. Please try again later."
          statusCode = 429
        } else if (error.message.includes("authentication") || error.message.includes("unauthorized") || error.message.includes("403")) {
          errorMessage = "Email service authentication failed"
          errorDetails = "Email service credentials are invalid"
          statusCode = 401
        } else if (error.message.includes("validation") || error.message.includes("invalid") || error.message.includes("400")) {
          errorMessage = "Email validation error"
          errorDetails = "Email content or recipient address is invalid"
          statusCode = 400
        } else if (error.message.includes("network") || error.message.includes("timeout") || error.message.includes("ECONNRESET")) {
          errorMessage = "Email service network error"
          errorDetails = "Network error occurred while sending email"
          statusCode = 503
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: errorDetails,
          timestamp: new Date().toISOString(),
          requestId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        { status: statusCode },
      )
    }

    console.log("Email sent successfully:", data)

    // Create email document in emails collection
    try {
      const companyId = userData?.company_id || quotation?.company_id || "unknown"

      const emailDocument = {
        from: from,
        to: to,
        cc: cc.length > 0 ? cc : null,
        replyTo: emailData.reply_to,
        subject: finalSubject.trim(),
        body: customBody?.trim() || '',
        attachments: attachmentDetails.length > 0 ? attachmentDetails : undefined,
        email_type: "quotation",
        quotationId: quotation.id,
        templateId: undefined,
        reportId: undefined,
        status: "sent" as const,
        userId: userData?.email || currentUserEmail || "unknown",
        company_id: companyId,
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

    return NextResponse.json({
      success: true,
      data,
      message:
        attachments.length > 0
          ? `Email sent successfully with ${attachments.length} attachment(s)`
          : "Email sent successfully",
    })
  } catch (error) {
    console.error("Email sending error:", error)

    // Provide more specific error messages and better debugging info
    let errorMessage = "Internal server error"
    let errorDetails = error instanceof Error ? error.message : "Unknown error occurred"
    let statusCode = 500

    if (error instanceof Error) {
      // Handle Firebase storage upload errors specifically for tests
      if (error.message.includes("Failed to upload file")) {
        errorMessage = "Internal server error"
        errorDetails = error.message
        statusCode = 500
      } else if (error.message.includes("JSON") || error.message.includes("parse")) {
        errorMessage = "Request parsing error"
        errorDetails = "Invalid JSON in request body"
        statusCode = 400
      } else if (error.message.includes("network") || error.message.includes("fetch") || error.message.includes("ECONNRESET")) {
        errorMessage = "Network error"
        errorDetails = "Network error occurred while processing email"
        statusCode = 503
      } else if (error.message.includes("timeout")) {
        errorMessage = "Request timeout"
        errorDetails = "Email processing took too long"
        statusCode = 408
      } else if (error.message.includes("memory") || error.message.includes("heap")) {
        errorMessage = "Server resource error"
        errorDetails = "Server ran out of memory processing email"
        statusCode = 507
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
        requestId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      { status: statusCode },
    )
  }
}
