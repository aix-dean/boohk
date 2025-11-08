import { NextRequest, NextResponse } from "next/server"
import { collection, query, where, orderBy, limit, startAfter, getDocs, DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { JobOrder } from "@/lib/types/job-order"

const ITEMS_PER_PAGE = 10

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("productId")
    const companyId = searchParams.get("companyId")
    const page = parseInt(searchParams.get("page") || "1")
    const lastDocParam = searchParams.get("lastDocId")

    if (!productId) {
      return NextResponse.json(
        { error: "Missing required parameter: productId" },
        { status: 400 }
      )
    }

    // Build the base query - only filter by product_id since company_id might not be set on all job orders
    let q = query(
      collection(db, "job_orders"),
      where("product_id", "==", productId),
      orderBy("createdAt", "desc")
    )

    // Add pagination if not first page
    if (page > 1 && lastDocParam) {
      // For pagination, we need to get the last document from the previous page
      // This is a simplified approach - in production you'd want to store pagination cursors
      const lastDocRef = await getDocs(query(collection(db, "job_orders"), where("__name__", "==", lastDocParam)))
      if (!lastDocRef.empty) {
        q = query(q, startAfter(lastDocRef.docs[0]))
      }
    }

    // Add limit - get one extra to check if there's a next page
    q = query(q, limit(ITEMS_PER_PAGE + 1))

    const querySnapshot = await getDocs(q)

    const jobOrders: JobOrder[] = []
    let lastDocId: string | null = null
    let index = 0

    querySnapshot.forEach((doc) => {
      if (index < ITEMS_PER_PAGE) { // Only include up to ITEMS_PER_PAGE for display
        const data = doc.data()
        jobOrders.push({
          id: doc.id,
          joNumber: data.joNumber || "N/A",
          joType: data.joType || "N/A",
          status: data.status || "unknown",
          siteName: data.siteName || "N/A",
          clientName: data.clientName || "N/A",
          clientCompany: data.clientCompany || "N/A",
          dateRequested: data.dateRequested || "",
          deadline: data.deadline || "",
          remarks: data.remarks || "",
          assignTo: data.assignTo || "",
          requestedBy: data.requestedBy || "",
          attachments: data.attachments || [],
          created: data.createdAt,
          updated: data.updated,
          created_by: data.created_by || "",
          company_id: data.company_id || "",
          quotation_id: data.quotation_id,
          contractDuration: data.contractDuration,
          contractPeriodEnd: data.contractPeriodEnd,
          contractPeriodStart: data.contractPeriodStart,
          leaseRatePerMonth: data.leaseRatePerMonth,
          missingCompliance: data.missingCompliance,
          quotationNumber: data.quotationNumber,
          product_id: data.product_id,
          projectCompliance: data.projectCompliance,
          dtiBirUrl: data.dtiBirUrl,
          gisUrl: data.gisUrl,
          idSignatureUrl: data.idSignatureUrl,
          siteImageUrl: data.siteImageUrl,
          materialSpec: data.materialSpec || "",
          illumination: data.illumination || "",
        })
        lastDocId = doc.id
      }
      index++
    })

    // Check if there's a next page by seeing if we got more than ITEMS_PER_PAGE
    const hasNextPage = querySnapshot.size > ITEMS_PER_PAGE

    return NextResponse.json({
      jobOrders,
      pagination: {
        currentPage: page,
        hasNextPage,
        hasPrevPage: page > 1,
        lastDocId,
      },
      debug: {
        totalFetched: querySnapshot.size,
        itemsShown: jobOrders.length,
        hasNextPage
      }
    })

  } catch (error) {
    console.error("Error fetching job orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch job orders" },
      { status: 500 }
    )
  }
}
