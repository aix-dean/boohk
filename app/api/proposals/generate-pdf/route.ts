import { type NextRequest, NextResponse } from "next/server"
import { generateProposalPDF } from "@/lib/pdf-service"
import type { Proposal } from "@/lib/types/proposal"

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

    console.log("[v0] PDF Generation - Proposal ID:", proposal.id)
    console.log("[v0] PDF Generation - Proposal Title:", proposal.title)
    console.log("[v0] PDF Generation - Products Count:", proposal.products?.length || 0)

    // Use provided template settings or proposal defaults or fallbacks
    const selectedSize = templateSize || proposal.templateSize || "A4"
    const selectedOrientation = templateOrientation || proposal.templateOrientation || "Portrait"
    const selectedLayout = templateLayout || proposal.templateLayout || "1"
    const selectedTemplateBackground = templateBackground || proposal.templateBackground || ""

    // Generate PDF using the updated function
    const pdfBase64 = await generateProposalPDF(proposal, true, selectedSize, selectedOrientation, selectedLayout, selectedTemplateBackground)

    if (!pdfBase64) {
      throw new Error("Failed to generate PDF")
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposal-${(proposal.title || "proposal").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
