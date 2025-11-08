import { NextRequest, NextResponse } from "next/server"
import { CompanyService } from "@/lib/company-service"
import type { CompanyUpdateRequest } from "@/lib/types/company"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")

    if (!companyId || !userId) {
      return NextResponse.json({ error: "Company ID and User ID are required" }, { status: 400 })
    }

    const companyData = await CompanyService.getCompanyData(companyId)

    if (!companyData) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, company: companyData })
  } catch (error) {
    console.error("Error fetching company data:", error)
    return NextResponse.json(
      { error: "Failed to fetch company data" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")

    if (!companyId || !userId) {
      return NextResponse.json({ error: "Company ID and User ID are required" }, { status: 400 })
    }

    const body: CompanyUpdateRequest = await request.json()

    await CompanyService.updateCompanyData(companyId, userId, body)

    return NextResponse.json({ success: true, message: "Company updated successfully" })
  } catch (error) {
    console.error("Error updating company data:", error)
    return NextResponse.json(
      { error: "Failed to update company data" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, userId, ...companyData } = body

    if (!companyId || !userId) {
      return NextResponse.json({ error: "Company ID and User ID are required" }, { status: 400 })
    }

    await CompanyService.createCompanyData(companyId, userId, companyData)

    return NextResponse.json({ success: true, message: "Company created successfully" })
  } catch (error) {
    console.error("Error creating company data:", error)
    return NextResponse.json(
      { error: "Failed to create company data" },
      { status: 500 }
    )
  }
}
