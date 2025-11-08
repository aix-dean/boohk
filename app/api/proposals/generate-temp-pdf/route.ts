import { type NextRequest, NextResponse } from "next/server"
import { generateProposalPDF } from "@/lib/pdf-service"
import type { Proposal } from "@/lib/types/proposal"

// In-memory storage for temp PDFs (in production, use Redis or similar)
const tempPDFs = new Map<string, { pdfBuffer: Buffer; timestamp: number; filename: string }>()

// Clean up old PDFs every 5 minutes
setInterval(() => {
  const now = Date.now()
  const expiryTime = 30 * 60 * 1000 // 30 minutes

  for (const [id, data] of tempPDFs.entries()) {
    if (now - data.timestamp > expiryTime) {
      tempPDFs.delete(id)
    }
  }
}, 5 * 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    const {
      proposal,
      templateSize,
      templateOrientation,
      templateLayout,
      templateBackground
    }: {
      proposal: Proposal
      templateSize?: string
      templateOrientation?: string
      templateLayout?: string
      templateBackground?: string
    } = await request.json()

    if (!proposal) {
      return NextResponse.json({ error: "Proposal data is required" }, { status: 400 })
    }

    console.log("[v0] Temp PDF Generation - Proposal ID:", proposal.id)

    // Use provided template settings or proposal defaults or fallbacks
    const selectedSize = templateSize || proposal.templateSize || "A4"
    const selectedOrientation = templateOrientation || proposal.templateOrientation || "Portrait"
    const selectedLayout = templateLayout || proposal.templateLayout || "1"
    const selectedTemplateBackground = templateBackground || proposal.templateBackground || ""

    // Generate PDF using the updated function with compression settings
    const pdfBase64 = await generateProposalPDF(proposal, true, selectedSize, selectedOrientation, selectedLayout, selectedTemplateBackground)

    if (!pdfBase64) {
      throw new Error("Failed to generate PDF")
    }

    // Convert base64 to buffer
    let pdfBuffer = Buffer.from(pdfBase64, 'base64')

    // Log original size
    const originalSize = pdfBuffer.length
    console.log(`[v0] Original PDF size: ${(originalSize / (1024 * 1024)).toFixed(2)}MB`)

    // If PDF is larger than 10MB, try to regenerate with more aggressive compression
    if (originalSize > 10 * 1024 * 1024) {
      console.log("[v0] PDF size exceeds 10MB, regenerating with optimized settings")

      // Try regenerating with smaller size if it's A4
      const compressedSize = selectedSize === "A4" ? "A5" : selectedSize
      const compressedPdfBase64 = await generateProposalPDF(proposal, true, compressedSize, selectedOrientation, selectedLayout, selectedTemplateBackground)

      if (compressedPdfBase64) {
        const compressedBuffer = Buffer.from(compressedPdfBase64, 'base64')
        const compressedSizeBytes = compressedBuffer.length

        console.log(`[v0] Compressed PDF size: ${(compressedSizeBytes / (1024 * 1024)).toFixed(2)}MB`)

        // Use compressed version if it's significantly smaller
        if (compressedSizeBytes < originalSize * 0.8) { // 20% smaller
          pdfBuffer = compressedBuffer
          console.log("[v0] Using compressed PDF version")
        }
      }
    }

    // Generate unique ID for temp storage
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const filename = `OH_PROP_${proposal.id}_${proposal.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`

    // Store temporarily
    tempPDFs.set(tempId, {
      pdfBuffer,
      timestamp: Date.now(),
      filename
    })

    console.log("[v0] Temp PDF stored with ID:", tempId)
    console.log(`[v0] Final PDF size: ${(pdfBuffer.length / (1024 * 1024)).toFixed(2)}MB`)

    return NextResponse.json({
      success: true,
      tempId,
      filename,
      size: pdfBuffer.length,
      sizeMB: (pdfBuffer.length / (1024 * 1024)).toFixed(2),
      compressed: pdfBuffer.length !== originalSize
    })

  } catch (error) {
    console.error("Error generating temp PDF:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}

// Endpoint to retrieve temp PDF
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tempId = searchParams.get('id')

    if (!tempId) {
      return NextResponse.json({ error: "Temp ID is required" }, { status: 400 })
    }

    const tempData = tempPDFs.get(tempId)

    if (!tempData) {
      return NextResponse.json({ error: "Temp PDF not found or expired" }, { status: 404 })
    }

    // Clean up the temp PDF after retrieval
    tempPDFs.delete(tempId)

    return new NextResponse(new Uint8Array(tempData.pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${tempData.filename}"`,
      },
    })

  } catch (error) {
    console.error("Error retrieving temp PDF:", error)
    return NextResponse.json({ error: "Failed to retrieve PDF" }, { status: 500 })
  }
}