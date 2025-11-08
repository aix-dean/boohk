import { NextRequest, NextResponse } from "next/server"
import { CompanyService } from "@/lib/company-service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")
    const folder = searchParams.get("folder") || ""

    if (!companyId || !userId) {
      return NextResponse.json({ error: "Company ID and User ID are required" }, { status: 400 })
    }

    const result = await CompanyService.getCompanyFiles(companyId, folder)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      files: result.files,
      folders: result.folders
    })
  } catch (error) {
    console.error("Error fetching company files:", error)
    return NextResponse.json(
      { error: "Failed to fetch company files" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const companyId = formData.get("companyId") as string
    const userId = formData.get("userId") as string
    const folder = formData.get("folder") as string || ""
    const file = formData.get("file") as File

    if (!companyId || !userId || !file) {
      return NextResponse.json({
        error: "Company ID, User ID, and file are required"
      }, { status: 400 })
    }

    const result = await CompanyService.uploadFile(file, companyId, userId, folder)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      file: result.file
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get("fileId")
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")

    if (!fileId || !companyId || !userId) {
      return NextResponse.json({
        error: "File ID, Company ID, and User ID are required"
      }, { status: 400 })
    }

    const success = await CompanyService.deleteFile(fileId, companyId, userId)

    if (!success) {
      return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "File deleted successfully" })
  } catch (error) {
    console.error("Error deleting file:", error)
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    )
  }
}
