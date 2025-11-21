import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/firebase'
import { writeBatch, collection, doc, addDoc, serverTimestamp } from 'firebase/firestore'
import { CompanyData } from '@/lib/types/company'
import { Proposal } from '@/lib/types/proposal'
import { CostEstimate } from '@/lib/types/cost-estimate'
import { Quotation } from '@/lib/types/quotation'
import { JobOrder } from '@/lib/types/job-order'

// Helper function to clean data for Firestore (remove undefined values)
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(cleanForFirestore)

  const cleaned: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value)
    }
  }
  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const userId = formData.get('userId') as string
    const companyId = formData.get('companyId') as string

    if (!file || !type || !userId || !companyId) {
      return NextResponse.json({
        error: 'Missing required fields: file, type, userId, companyId'
      }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({
        error: 'Invalid file type. Only .xlsx and .xls files are allowed.'
      }, { status: 400 })
    }

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    if (jsonData.length === 0) {
      return NextResponse.json({
        error: 'The uploaded file is empty or contains no valid data.'
      }, { status: 400 })
    }

    let processedCount = 0
    let errors: string[] = []

    // Process data based on type
    switch (type) {
      case 'company-data':
        const result = await processCompanyData(jsonData, userId, companyId)
        processedCount = result.processedCount
        errors = result.errors
        break

      case 'proposals':
        const proposalResult = await processProposals(jsonData, userId, companyId)
        processedCount = proposalResult.processedCount
        errors = proposalResult.errors
        break

      case 'cost-estimates':
        const costEstimateResult = await processCostEstimates(jsonData, userId, companyId)
        processedCount = costEstimateResult.processedCount
        errors = costEstimateResult.errors
        break

      case 'quotations':
        const quotationResult = await processQuotations(jsonData, userId, companyId)
        processedCount = quotationResult.processedCount
        errors = quotationResult.errors
        break

      case 'job-orders':
        const jobOrderResult = await processJobOrders(jsonData, userId, companyId)
        processedCount = jobOrderResult.processedCount
        errors = jobOrderResult.errors
        break

      case 'inventory':
        const inventoryResult = await processInventory(jsonData, userId, companyId)
        processedCount = inventoryResult.processedCount
        errors = inventoryResult.errors
        break

      case 'users':
        const usersResult = await processUsers(jsonData, userId, companyId)
        processedCount = usersResult.processedCount
        errors = usersResult.errors
        break

      case 'service-assignments':
        const serviceResult = await processServiceAssignments(jsonData, userId, companyId)
        processedCount = serviceResult.processedCount
        errors = serviceResult.errors
        break

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCount} records`,
      processedCount,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error processing upload:', error)
    return NextResponse.json({
      error: 'Failed to process the uploaded file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function processCompanyData(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate fields when present
      const validationErrors = validateCompanyData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const companyData: CompanyData = {
        companyId: row.companyId || companyId,
        name: row.name,
        address: {
          city: row.address_city,
          province: row.address_province,
          street: row.address_street
        },
        tin: row.tin,
        email: row.email,
        phone: row.phone,
        website: row.website,
        company_profile: row.company_profile,
        logo: row.logo,
        business_type: row.business_type,
        position: row.position,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId
      }

      await addDoc(collection(db, 'companies'), cleanForFirestore(companyData))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save company data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateCompanyData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  // Helper function to check if value is valid text
  const isValidText = (value: any) => {
    if (value === undefined || value === null) return true // Optional field
    const strValue = String(value).trim()
    return strValue !== '' && strValue !== 'undefined' && strValue !== 'null'
  }

  // Helper function to get string value
  const getStringValue = (value: any) => {
    if (value === undefined || value === null) return ''
    return String(value).trim()
  }

  if (row.name !== undefined && !isValidText(row.name)) {
    errors.push(`Row ${rowNumber}: Company name must be text`)
  }

  if (row.email !== undefined) {
    const emailStr = getStringValue(row.email)
    if (emailStr === '' || !emailStr.includes('@') || !emailStr.includes('.')) {
      errors.push(`Row ${rowNumber}: Email address must be a valid email`)
    }
  }

  if (row.phone !== undefined && !isValidText(row.phone)) {
    errors.push(`Row ${rowNumber}: Phone number must be text`)
  }

  if (row.tin !== undefined && !isValidText(row.tin)) {
    errors.push(`Row ${rowNumber}: TIN (Tax Identification Number) must be text`)
  }

  if (row.address_city !== undefined && !isValidText(row.address_city)) {
    errors.push(`Row ${rowNumber}: City must be text`)
  }

  if (row.address_province !== undefined && !isValidText(row.address_province)) {
    errors.push(`Row ${rowNumber}: Province must be text`)
  }

  if (row.address_street !== undefined && !isValidText(row.address_street)) {
    errors.push(`Row ${rowNumber}: Street address must be text`)
  }

  return errors
}

async function processProposals(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate required fields
      const validationErrors = validateProposalData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const proposal: Proposal = {
        id: `prop_${Date.now()}_${i}`,
        title: row.title || `Proposal ${i + 1}`, // Provide default if missing
        description: row.description,
        proposalNumber: row.proposalNumber,
        client: {
          id: row.client_id || `client_${Date.now()}_${i}`, // Generate ID if missing
          company: row.client_company,
          contactPerson: row.client_contact_person || '',
          email: row.client_email || '',
          phone: row.client_phone || '',
          address: row.client_address,
          industry: row.client_industry,
          targetAudience: row.client_target_audience,
          campaignObjective: row.client_campaign_objective,
          designation: row.client_designation,
          companyLogoUrl: row.client_company_logo_url,
          company_id: row.client_company_id
        },
        products: [{
          id: row.product_id || `prod_${Date.now()}_${i}`,
          name: row.product_name,
          type: row.product_type,
          price: parseFloat(row.product_price) || 0,
          location: row.product_location,
          site_code: row.product_site_code,
          media: row.product_media_url ? [{
            url: row.product_media_url,
            distance: row.product_media_distance,
            type: row.product_media_type,
            isVideo: row.product_media_is_video === 'true'
          }] : [],
          specs_rental: row.product_specs_rental_location ? {
            location: row.product_specs_rental_location,
            traffic_count: parseInt(row.product_specs_rental_traffic_count) || 0,
            elevation: parseInt(row.product_specs_rental_elevation) || 0,
            height: parseInt(row.product_specs_rental_height) || 0,
            width: parseInt(row.product_specs_rental_width) || 0,
            audience_type: row.product_specs_rental_audience_type,
            audience_types: row.product_specs_rental_audience_types ? row.product_specs_rental_audience_types.split(',') : []
          } : null,
          light: row.product_light_location ? {
            location: row.product_light_location,
            name: row.product_light_name,
            operator: row.product_light_operator
          } : null,
          description: row.product_description,
          health_percentage: parseInt(row.product_health_percentage) || 100,
          active: row.product_active !== 'false',
          deleted: row.product_deleted === 'true',
          created: new Date(),
          updated: new Date(),
          seller_id: row.product_seller_id,
          seller_name: row.product_seller_name,
          company_id: row.product_company_id || companyId,
          position: parseInt(row.product_position) || 1,
          categories: row.product_categories ? row.product_categories.split(',') : [],
          category_names: row.product_category_names ? row.product_category_names.split(',') : [],
          content_type: row.product_content_type,
          cms: row.product_cms_start_time ? {
            start_time: row.product_cms_start_time,
            end_time: row.product_cms_end_time,
            spot_duration: parseInt(row.product_cms_spot_duration) || 0,
            loops_per_day: parseInt(row.product_cms_loops_per_day) || 0,
            spots_per_loop: parseInt(row.product_cms_spots_per_loop) || 0
          } : null,
          status: row.product_status,
          address: row.product_address
        }],
        totalAmount: parseFloat(row.total_amount) || 0,
        validUntil: row.valid_until ? new Date(row.valid_until) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
        notes: row.notes,
        customMessage: row.custom_message,
        createdBy: userId,
        companyId: companyId,
        campaignId: row.campaign_id,
        templateSize: row.template_size,
        templateOrientation: row.template_orientation,
        templateLayout: row.template_layout,
        templateBackground: row.template_background,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await addDoc(collection(db, 'proposals'), cleanForFirestore(proposal))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save proposal data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateProposalData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  // Check if row has any data at all
  const hasData = Object.values(row).some(value =>
    value !== undefined && value !== null && String(value).trim() !== ''
  )

  if (!hasData) {
    errors.push(`Row ${rowNumber}: Row appears to be empty - no data found`)
    return errors
  }

  // Required fields for proposals
  if (!row.title || typeof row.title !== 'string' || row.title.trim() === '') {
    errors.push(`Row ${rowNumber}: Proposal title is required`)
  }

  if (!row.client_company || typeof row.client_company !== 'string' || row.client_company.trim() === '') {
    errors.push(`Row ${rowNumber}: Client company name is required`)
  }

  if (!row.valid_until) {
    errors.push(`Row ${rowNumber}: Valid until date is required`)
  } else {
    const date = new Date(row.valid_until)
    if (isNaN(date.getTime())) {
      errors.push(`Row ${rowNumber}: Valid until date must be a valid date`)
    }
  }

  // Optional fields validation
  if (row.client_email !== undefined && (typeof row.client_email !== 'string' || !row.client_email.includes('@'))) {
    errors.push(`Row ${rowNumber}: Client email address must be a valid email`)
  }

  if (row.total_amount !== undefined && row.total_amount !== '' && isNaN(parseFloat(row.total_amount))) {
    errors.push(`Row ${rowNumber}: Total amount must be number`)
  }

  if (row.description !== undefined && (typeof row.description !== 'string' || row.description.trim() === '')) {
    errors.push(`Row ${rowNumber}: Description must be text`)
  }

  return errors
}

async function processCostEstimates(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate required fields
      const validationErrors = validateCostEstimateData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const costEstimate: CostEstimate = {
        id: `ce_${Date.now()}_${i}`,
        proposalId: row.proposal_id,
        costEstimateNumber: row.cost_estimate_number,
        title: row.title,
        client: {
          id: row.client_id,
          company: row.client_company,
          contactPerson: row.client_contact_person,
          email: row.client_email,
          phone: row.client_phone,
          address: row.client_address,
          industry: row.client_industry,
          targetAudience: row.client_target_audience,
          campaignObjective: row.client_campaign_objective,
          designation: row.client_designation,
          companyLogoUrl: row.client_company_logo_url,
          company_id: row.client_company_id
        },
        lineItems: [], // Would need more complex parsing for line items array
        totalAmount: parseFloat(row.total_amount) || 0,
        status: 'draft',
        notes: row.notes,
        customMessage: row.custom_message,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        company_id: companyId,
        page_id: row.page_id,
        page_number: parseInt(row.page_number) || 1,
        startDate: row.start_date ? new Date(row.start_date) : undefined,
        endDate: row.end_date ? new Date(row.end_date) : undefined,
        durationDays: parseInt(row.duration_days) || undefined,
        validUntil: row.valid_until ? new Date(row.valid_until) : undefined
      }

      await addDoc(collection(db, 'cost_estimates'), cleanForFirestore(costEstimate))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save cost estimate data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateCostEstimateData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  if (row.title !== undefined && (typeof row.title !== 'string' || row.title.trim() === '')) {
    errors.push(`Row ${rowNumber}: Cost estimate title must be text`)
  }

  if (row.client_company !== undefined && (typeof row.client_company !== 'string' || row.client_company.trim() === '')) {
    errors.push(`Row ${rowNumber}: Client company name must be text`)
  }

  if (row.client_email !== undefined && (typeof row.client_email !== 'string' || !row.client_email.includes('@'))) {
    errors.push(`Row ${rowNumber}: Client email address must be a valid email`)
  }

  if (row.total_amount !== undefined && row.total_amount !== '' && isNaN(parseFloat(row.total_amount))) {
    errors.push(`Row ${rowNumber}: Total amount must be number`)
  }

  return errors
}

async function processQuotations(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate required fields
      const validationErrors = validateQuotationData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const quotation: Quotation = {
        id: `quot_${Date.now()}_${i}`,
        quotation_number: row.quotation_number,
        quotation_request_id: row.quotation_request_id,
        start_date: row.start_date ? new Date(row.start_date) : new Date(),
        end_date: row.end_date ? new Date(row.end_date) : new Date(),
        total_amount: parseFloat(row.total_amount) || 0,
        duration_days: parseInt(row.duration_days) || 30,
        notes: row.notes,
        status: 'draft',
        created: new Date(),
        updated: new Date(),
        created_by: userId,
        created_by_first_name: row.created_by_first_name,
        created_by_last_name: row.created_by_last_name,
        client_name: row.client_name,
        client_email: row.client_email,
        client_id: row.client_id,
        client_company_id: row.client_company_id,
        client_company_name: row.client_company_name,
        client_designation: row.client_designation,
        client_address: row.client_address,
        client_phone: row.client_phone,
        campaignId: row.campaign_id,
        proposalId: row.proposal_id,
        company_id: companyId,
        page_id: row.page_id,
        page_number: parseInt(row.page_number) || 1,
        valid_until: row.valid_until ? new Date(row.valid_until) : new Date(),
        seller_id: row.seller_id,
        product_id: row.product_id,
        items: {
          id: row.items_id,
          product_id: row.items_product_id,
          name: row.items_name,
          location: row.items_location,
          price: parseFloat(row.items_price) || 0,
          site_code: row.items_site_code,
          type: row.items_type,
          description: row.items_description,
          health_percentage: parseInt(row.items_health_percentage) || 100,
          light: row.items_light === 'true',
          media: [{
            distance: row.items_media_distance,
            isVideo: row.items_media_is_video === 'true',
            type: row.items_media_type,
            url: row.items_media_url,
            name: row.items_media_name,
            price: parseFloat(row.items_media_price) || 0
          }],
          specs: {
            audience_types: row.items_specs_audience_types ? row.items_specs_audience_types.split(',') : [],
            elevation: parseInt(row.items_specs_elevation) || 0,
            location: row.items_specs_location,
            traffic_count: parseInt(row.items_specs_traffic_count) || 0,
            type: row.items_specs_type,
            height: parseInt(row.items_specs_height) || 0,
            width: parseInt(row.items_specs_width) || 0,
            content_type: row.items_specs_content_type
          },
          duration_days: parseInt(row.items_duration_days) || 30,
          item_total_amount: parseFloat(row.items_item_total_amount) || 0,
          height: parseInt(row.items_height) || 0,
          width: parseInt(row.items_width) || 0,
          content_type: row.items_content_type,
          site_type: row.items_site_type
        },
        signature_position: row.signature_position,
        signature_name: row.signature_name,
        size: row.size
      }

      await addDoc(collection(db, 'quotations'), cleanForFirestore(quotation))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save quotation data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateQuotationData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  if (row.client_name !== undefined && (typeof row.client_name !== 'string' || row.client_name.trim() === '')) {
    errors.push(`Row ${rowNumber}: Client name must be text`)
  }

  if (row.client_email !== undefined && (typeof row.client_email !== 'string' || !row.client_email.includes('@'))) {
    errors.push(`Row ${rowNumber}: Client email address must be a valid email`)
  }

  if (row.items_name !== undefined && (typeof row.items_name !== 'string' || row.items_name.trim() === '')) {
    errors.push(`Row ${rowNumber}: Product name must be text`)
  }

  if (row.items_location !== undefined && (typeof row.items_location !== 'string' || row.items_location.trim() === '')) {
    errors.push(`Row ${rowNumber}: Product location must be text`)
  }

  if (row.total_amount !== undefined && row.total_amount !== '' && isNaN(parseFloat(row.total_amount))) {
    errors.push(`Row ${rowNumber}: Total amount must be number`)
  }

  if (row.duration_days !== undefined && row.duration_days !== '' && isNaN(parseInt(row.duration_days))) {
    errors.push(`Row ${rowNumber}: Duration days must be number`)
  }

  return errors
}

async function processJobOrders(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate required fields
      const validationErrors = validateJobOrderData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const jobOrder: JobOrder = {
        id: `jo_${Date.now()}_${i}`,
        joNumber: row.jo_number,
        siteName: row.site_name,
        siteLocation: row.site_location,
        joType: row.jo_type,
        requestedBy: row.requested_by,
        assignTo: row.assign_to,
        dateRequested: new Date(row.date_requested),
        deadline: new Date(row.deadline),
        jobDescription: row.job_description,
        message: row.message,
        attachments: [], // Would need parsing for attachments array
        status: 'draft',
        created: new Date(),
        updated: new Date(),
        created_by: userId,
        company_id: companyId,
        quotation_id: row.quotation_id,
        clientCompany: row.client_company,
        clientName: row.client_name,
        contractDuration: row.contract_duration,
        contractPeriodEnd: row.contract_period_end ? new Date(row.contract_period_end) : undefined,
        contractPeriodStart: row.contract_period_start ? new Date(row.contract_period_start) : undefined,
        leaseRatePerMonth: parseFloat(row.lease_rate_per_month) || 0,
        missingCompliance: {},
        quotationNumber: row.quotation_number,
        remarks: row.remarks,
        product_id: row.product_id,
        dtiBirUrl: row.dti_bir_url,
        gisUrl: row.gis_url,
        idSignatureUrl: row.id_signature_url,
        siteImageUrl: row.site_image_url,
        materialSpec: row.material_spec,
        illumination: row.illumination
      }

      await addDoc(collection(db, 'job_orders'), cleanForFirestore(jobOrder))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save job order data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateJobOrderData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  if (row.site_name !== undefined && (typeof row.site_name !== 'string' || row.site_name.trim() === '')) {
    errors.push(`Row ${rowNumber}: Site name must be text`)
  }

  if (row.site_location !== undefined && (typeof row.site_location !== 'string' || row.site_location.trim() === '')) {
    errors.push(`Row ${rowNumber}: Site location must be text`)
  }

  if (row.requested_by !== undefined && (typeof row.requested_by !== 'string' || row.requested_by.trim() === '')) {
    errors.push(`Row ${rowNumber}: Requested by must be text`)
  }

  if (row.assign_to !== undefined && (typeof row.assign_to !== 'string' || row.assign_to.trim() === '')) {
    errors.push(`Row ${rowNumber}: Assign to must be text`)
  }

  if (row.job_description !== undefined && (typeof row.job_description !== 'string' || row.job_description.trim() === '')) {
    errors.push(`Row ${rowNumber}: Job description must be text`)
  }

  return errors
}

async function processInventory(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate required fields
      const validationErrors = validateInventoryData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const product = {
        id: row.id,
        name: row.name,
        location: row.location,
        price: parseFloat(row.price) || 0,
        site_code: row.site_code,
        type: row.type,
        description: row.description,
        health_percentage: parseInt(row.health_percentage) || 100,
        light: row.light === 'true',
        active: row.active !== 'false',
        deleted: row.deleted === 'true',
        created: row.created ? new Date(row.created) : new Date(),
        updated: row.updated ? new Date(row.updated) : new Date(),
        seller_id: row.seller_id,
        seller_name: row.seller_name,
        company_id: row.company_id || companyId,
        position: parseInt(row.position) || 1,
        categories: row.categories ? row.categories.split(',') : [],
        category_names: row.category_names ? row.category_names.split(',') : [],
        content_type: row.content_type,
        specs: row.specs_audience_types ? {
          audience_types: row.specs_audience_types ? row.specs_audience_types.split(',') : [],
          elevation: parseInt(row.specs_elevation) || 0,
          location: row.specs_location,
          traffic_count: parseInt(row.specs_traffic_count) || 0,
          type: row.specs_type,
          height: parseInt(row.specs_height) || 0,
          width: parseInt(row.specs_width) || 0,
          content_type: row.specs_content_type
        } : undefined
      }

      await addDoc(collection(db, 'products'), cleanForFirestore(product))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save inventory data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateInventoryData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  if (row.name !== undefined && (typeof row.name !== 'string' || row.name.trim() === '')) {
    errors.push(`Row ${rowNumber}: Product name must be text`)
  }

  if (row.location !== undefined && (typeof row.location !== 'string' || row.location.trim() === '')) {
    errors.push(`Row ${rowNumber}: Product location must be text`)
  }

  if (row.site_code !== undefined && (typeof row.site_code !== 'string' || row.site_code.trim() === '')) {
    errors.push(`Row ${rowNumber}: Site code must be text`)
  }

  if (row.type !== undefined && (typeof row.type !== 'string' || row.type.trim() === '')) {
    errors.push(`Row ${rowNumber}: Product type must be text`)
  }

  if (row.price !== undefined && row.price !== '' && isNaN(parseFloat(row.price))) {
    errors.push(`Row ${rowNumber}: Price must be number`)
  }

  if (row.health_percentage !== undefined && row.health_percentage !== '' && isNaN(parseInt(row.health_percentage))) {
    errors.push(`Row ${rowNumber}: Health percentage must be number between 0-100`)
  }

  if (row.position !== undefined && row.position !== '' && isNaN(parseInt(row.position))) {
    errors.push(`Row ${rowNumber}: Position must be number`)
  }

  if (row.categories !== undefined && typeof row.categories !== 'string') {
    errors.push(`Row ${rowNumber}: Categories must be comma-separated text`)
  }

  return errors
}

async function processUsers(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate required fields
      const validationErrors = validateUserData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const userData = {
        uid: row.uid,
        email: row.email,
        displayName: row.displayName,
        license_key: row.license_key,
        company_id: row.company_id || companyId,
        role: row.role,
        permissions: row.permissions ? JSON.parse(row.permissions) : [],
        project_id: row.project_id,
        first_name: row.first_name,
        last_name: row.last_name,
        middle_name: row.middle_name,
        phone_number: row.phone_number,
        gender: row.gender,
        type: row.type,
        created: row.created ? new Date(row.created) : new Date(),
        updated: row.updated ? new Date(row.updated) : new Date(),
        onboarding: row.onboarding === 'true'
      }

      await addDoc(collection(db, 'boohk_users'), cleanForFirestore(userData))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save user data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateUserData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  if (row.email !== undefined && (typeof row.email !== 'string' || !row.email.includes('@'))) {
    errors.push(`Row ${rowNumber}: Email address must be a valid email`)
  }

  if (row.first_name !== undefined && (typeof row.first_name !== 'string' || row.first_name.trim() === '')) {
    errors.push(`Row ${rowNumber}: First name must be text`)
  }

  if (row.last_name !== undefined && (typeof row.last_name !== 'string' || row.last_name.trim() === '')) {
    errors.push(`Row ${rowNumber}: Last name must be text`)
  }

  if (row.role !== undefined && (typeof row.role !== 'string' || row.role.trim() === '')) {
    errors.push(`Row ${rowNumber}: User role must be text (e.g., admin, user, manager)`)
  }

  if (row.phone_number !== undefined && (typeof row.phone_number !== 'string' || row.phone_number.trim() === '')) {
    errors.push(`Row ${rowNumber}: Phone number must be text`)
  }

  if (row.gender !== undefined && !['male', 'female', 'other'].includes(row.gender.toLowerCase())) {
    errors.push(`Row ${rowNumber}: Gender must be 'male', 'female', or 'other'`)
  }

  if (row.permissions !== undefined && typeof row.permissions !== 'string') {
    errors.push(`Row ${rowNumber}: Permissions must be JSON`)
  } else if (row.permissions) {
    try {
      JSON.parse(row.permissions)
    } catch {
      errors.push(`Row ${rowNumber}: Permissions must be valid JSON`)
    }
  }

  return errors
}

async function processServiceAssignments(data: any[], userId: string, companyId: string) {
  let processedCount = 0
  const errors: string[] = []

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i]

      // Validate required fields
      const validationErrors = validateServiceAssignmentData(row, i + 1)
      if (validationErrors.length > 0) {
        errors.push(...validationErrors)
        continue
      }

      const serviceAssignment = {
        id: `sa_${Date.now()}_${i}`,
        assignmentNumber: row.assignment_number,
        siteName: row.site_name,
        siteLocation: row.site_location,
        serviceType: row.service_type,
        requestedBy: row.requested_by,
        assignTo: row.assign_to,
        dateRequested: new Date(row.date_requested),
        deadline: new Date(row.deadline),
        serviceDescription: row.service_description,
        message: row.message,
        attachments: [], // Would need parsing for attachments array
        status: 'draft',
        created: new Date(),
        updated: new Date(),
        created_by: userId,
        company_id: companyId,
        quotation_id: row.quotation_id,
        clientCompany: row.client_company,
        clientName: row.client_name,
        contractDuration: row.contract_duration,
        contractPeriodEnd: row.contract_period_end ? new Date(row.contract_period_end) : undefined,
        contractPeriodStart: row.contract_period_start ? new Date(row.contract_period_start) : undefined,
        serviceRatePerMonth: parseFloat(row.service_rate_per_month) || 0,
        remarks: row.remarks,
        product_id: row.product_id,
        siteImageUrl: row.site_image_url,
        materialSpec: row.material_spec,
        illumination: row.illumination
      }

      await addDoc(collection(db, 'service_assignments'), cleanForFirestore(serviceAssignment))
      processedCount++
    } catch (error) {
      errors.push(`Row ${i + 1}: Failed to save service assignment data - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { processedCount, errors }
}

function validateServiceAssignmentData(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  if (row.site_name !== undefined && (typeof row.site_name !== 'string' || row.site_name.trim() === '')) {
    errors.push(`Row ${rowNumber}: Site name must be text`)
  }

  if (row.site_location !== undefined && (typeof row.site_location !== 'string' || row.site_location.trim() === '')) {
    errors.push(`Row ${rowNumber}: Site location must be text`)
  }

  if (row.service_type !== undefined && (typeof row.service_type !== 'string' || row.service_type.trim() === '')) {
    errors.push(`Row ${rowNumber}: Service type must be text`)
  }

  if (row.requested_by !== undefined && (typeof row.requested_by !== 'string' || row.requested_by.trim() === '')) {
    errors.push(`Row ${rowNumber}: Requested by must be text`)
  }

  if (row.assign_to !== undefined && (typeof row.assign_to !== 'string' || row.assign_to.trim() === '')) {
    errors.push(`Row ${rowNumber}: Assign to must be text`)
  }

  if (row.service_description !== undefined && (typeof row.service_description !== 'string' || row.service_description.trim() === '')) {
    errors.push(`Row ${rowNumber}: Service description must be text`)
  }

  return errors
}