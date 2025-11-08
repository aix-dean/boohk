import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { CompanyData } from '@/lib/types/company'
import { Proposal } from '@/lib/types/proposal'
import { CostEstimate } from '@/lib/types/cost-estimate'
import { Quotation } from '@/lib/types/quotation'
import { JobOrder } from '@/lib/types/job-order'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type) {
      return NextResponse.json({ error: 'Type parameter is required' }, { status: 400 })
    }

    let data: any[] = []
    let filename = ''

    switch (type) {
      case 'company-data':
        data = [createCompanyDataTemplate()]
        filename = 'company-data-template.xlsx'
        break

      case 'proposals':
        data = [createProposalTemplate()]
        filename = 'proposals-template.xlsx'
        break

      case 'cost-estimates':
        data = [createCostEstimateTemplate()]
        filename = 'cost-estimates-template.xlsx'
        break

      case 'quotations':
        data = [createQuotationTemplate()]
        filename = 'quotations-template.xlsx'
        break

      case 'job-orders':
        data = [createJobOrderTemplate()]
        filename = 'job-orders-template.xlsx'
        break

      case 'inventory':
        data = [createInventoryTemplate()]
        filename = 'inventory-template.xlsx'
        break

      case 'users':
        data = [createUsersTemplate()]
        filename = 'users-template.xlsx'
        break

      case 'service-assignments':
        data = [createServiceAssignmentTemplate()]
        filename = 'service-assignments-template.xlsx'
        break

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Template')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file as response
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Error generating template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}

function createCompanyDataTemplate(): any {
  return {
    companyId: 'COMPANY_ID',
    name: 'Company Name',
    // Flattened address fields for Excel
    address_city: 'City',
    address_province: 'Province',
    address_street: 'Street Address',
    tin: 'TIN_NUMBER',
    email: 'company@email.com',
    phone: 'Phone Number',
    website: 'https://company.com',
    company_profile: 'Company profile description',
    logo: 'Logo URL',
    business_type: 'Business Type',
    position: 'Contact Position',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'USER_ID',
    updatedBy: 'USER_ID'
  }
}

function createProposalTemplate(): any {
  return {
    // Basic proposal fields
    title: 'Proposal Title',
    description: 'Proposal description',
    proposalNumber: 'PROP001',

    // Client fields (flattened for Excel)
    client_id: 'CLIENT_ID',
    client_company: 'Client Company',
    client_contact_person: 'Contact Person',
    client_email: 'client@email.com',
    client_phone: 'Phone Number',
    client_address: 'Client Address',
    client_industry: 'Industry',
    client_target_audience: 'Target Audience',
    client_campaign_objective: 'Campaign Objective',
    client_designation: 'Designation',
    client_company_logo_url: 'Logo URL',
    client_company_id: 'COMPANY_ID',

    // Product fields (flattened for Excel)
    product_id: 'PRODUCT_ID',
    product_name: 'Product Name',
    product_type: 'Product Type',
    product_price: 1000,
    product_location: 'Location',
    product_site_code: 'SITE_CODE',
    product_description: 'Product description',
    product_health_percentage: 100,
    product_active: true,
    product_deleted: false,
    product_seller_id: 'SELLER_ID',
    product_seller_name: 'Seller Name',
    product_company_id: 'COMPANY_ID',
    product_position: 1,
    product_categories: 'Category1,Category2',
    product_category_names: 'Category Name1,Category Name2',
    product_content_type: 'Content Type',
    // Flattened specs_rental
    product_specs_rental_location: 'Location',
    product_specs_rental_traffic_count: 1000,
    product_specs_rental_elevation: 10,
    product_specs_rental_height: 5,
    product_specs_rental_width: 10,
    product_specs_rental_audience_type: 'General Public',
    product_specs_rental_audience_types: 'General Public,Business',
    // Flattened light
    product_light_location: 'Location',
    product_light_name: 'Light Name',
    product_light_operator: 'Operator',
    // Flattened media (showing one example)
    product_media_url: 'Media URL',
    product_media_distance: '100m',
    product_media_type: 'Image',
    product_media_is_video: false,
    // Flattened cms
    product_cms_start_time: '09:00',
    product_cms_end_time: '18:00',
    product_cms_spot_duration: 30,
    product_cms_loops_per_day: 10,
    product_cms_spots_per_loop: 5,
    product_status: 'active',
    product_address: 'Product Address',

    // Financial fields
    total_amount: 1000,
    valid_until: '2024-12-31', // Date as string for Excel

    // Additional fields
    notes: 'Notes',
    custom_message: 'Custom message',
    campaign_id: 'CAMPAIGN_ID'
  }
}

function createCostEstimateTemplate(): any {
  return {
    proposalId: 'PROPOSAL_ID',
    costEstimateNumber: 'CE001',
    title: 'Cost Estimate Title',
    // Flattened client fields for Excel
    client_id: 'CLIENT_ID',
    client_company: 'Client Company',
    client_contact_person: 'Contact Person',
    client_email: 'client@email.com',
    client_phone: 'Phone Number',
    client_address: 'Client Address',
    client_industry: 'Industry',
    client_target_audience: 'Target Audience',
    client_campaign_objective: 'Campaign Objective',
    client_designation: 'Designation',
    client_company_logo_url: 'Logo URL',
    client_company_id: 'COMPANY_ID',
    // Flattened line item fields (showing one example)
    line_item_id: 'LINE_ITEM_ID',
    line_item_description: 'Line item description',
    line_item_quantity: 1,
    line_item_unit_price: 1000,
    line_item_total: 1000,
    line_item_category: 'Billboard Rental',
    line_item_notes: 'Notes',
    line_item_image: 'Image URL',
    // Flattened specs for the line item
    line_item_specs_audience_types: 'General Public',
    line_item_specs_elevation: 10,
    line_item_specs_location: 'Location',
    line_item_specs_traffic_count: 1000,
    line_item_specs_type: 'RENTAL',
    line_item_specs_height: 5,
    line_item_specs_width: 10,
    line_item_specs_content_type: 'Digital',
    line_item_content_type: 'Digital',
    totalAmount: 1000,
    status: 'draft',
    notes: 'Notes',
    customMessage: 'Custom message',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'USER_ID',
    company_id: 'COMPANY_ID',
    page_id: 'PAGE_ID',
    page_number: 1,
    startDate: new Date(),
    endDate: new Date(),
    durationDays: 30,
    validUntil: new Date()
  }
}

function createQuotationTemplate(): any {
  return {
    quotation_number: 'Q001',
    quotation_request_id: 'REQUEST_ID',
    start_date: new Date(),
    end_date: new Date(),
    total_amount: 1000,
    duration_days: 30,
    notes: 'Notes',
    status: 'draft',
    created: new Date(),
    updated: new Date(),
    created_by: 'USER_ID',
    created_by_first_name: 'First Name',
    created_by_last_name: 'Last Name',
    client_name: 'Client Name',
    client_email: 'client@email.com',
    client_id: 'CLIENT_ID',
    client_company_id: 'COMPANY_ID',
    client_company_name: 'Client Company',
    client_designation: 'Designation',
    client_address: 'Client Address',
    client_phone: 'Phone Number',
    campaignId: 'CAMPAIGN_ID',
    proposalId: 'PROPOSAL_ID',
    company_id: 'COMPANY_ID',
    page_id: 'PAGE_ID',
    page_number: 1,
    valid_until: new Date(),
    seller_id: 'SELLER_ID',
    product_id: 'PRODUCT_ID',
    // Flattened items fields
    items_id: 'PRODUCT_ID',
    items_product_id: 'PRODUCT_ID',
    items_name: 'Product Name',
    items_location: 'Location',
    items_price: 1000,
    items_site_code: 'SITE_CODE',
    items_type: 'LED Billboard',
    items_description: 'Product description',
    items_health_percentage: 100,
    items_light: false,
    // Flattened media (showing one example)
    items_media_distance: '100m',
    items_media_is_video: false,
    items_media_type: 'Image',
    items_media_url: 'Media URL',
    items_media_name: 'Media Name',
    items_media_price: 0,
    // Flattened specs
    items_specs_audience_types: 'General Public',
    items_specs_elevation: 10,
    items_specs_location: 'Location',
    items_specs_traffic_count: 1000,
    items_specs_type: 'RENTAL',
    items_specs_height: 5,
    items_specs_width: 10,
    items_specs_content_type: 'Digital',
    items_duration_days: 30,
    items_item_total_amount: 1000,
    items_height: 5,
    items_width: 10,
    items_content_type: 'Digital',
    items_site_type: 'Billboard',
    // Flattened project compliance
    project_compliance_final_artwork_completed: false,
    project_compliance_final_artwork_file_name: null,
    project_compliance_final_artwork_file_url: null,
    project_compliance_final_artwork_notes: null,
    project_compliance_final_artwork_uploaded_at: null,
    project_compliance_final_artwork_uploaded_by: null,
    project_compliance_final_artwork_status: 'pending',
    project_compliance_payment_as_deposit_completed: false,
    project_compliance_payment_as_deposit_file_name: null,
    project_compliance_payment_as_deposit_file_url: null,
    project_compliance_payment_as_deposit_notes: null,
    project_compliance_payment_as_deposit_uploaded_at: null,
    project_compliance_payment_as_deposit_uploaded_by: null,
    project_compliance_payment_as_deposit_status: 'pending',
    project_compliance_irrevocable_po_completed: false,
    project_compliance_irrevocable_po_file_name: null,
    project_compliance_irrevocable_po_file_url: null,
    project_compliance_irrevocable_po_notes: null,
    project_compliance_irrevocable_po_uploaded_at: null,
    project_compliance_irrevocable_po_uploaded_by: null,
    project_compliance_irrevocable_po_status: 'pending',
    project_compliance_signed_contract_completed: false,
    project_compliance_signed_contract_file_name: null,
    project_compliance_signed_contract_file_url: null,
    project_compliance_signed_contract_notes: null,
    project_compliance_signed_contract_uploaded_at: null,
    project_compliance_signed_contract_uploaded_by: null,
    project_compliance_signed_contract_status: 'pending',
    project_compliance_signed_quotation_completed: false,
    project_compliance_signed_quotation_file_name: null,
    project_compliance_signed_quotation_file_url: null,
    project_compliance_signed_quotation_notes: null,
    project_compliance_signed_quotation_uploaded_at: null,
    project_compliance_signed_quotation_uploaded_by: null,
    project_compliance_signed_quotation_status: 'pending',
    // Flattened client compliance
    client_compliance_dti_bir_2303_status: 'pending',
    client_compliance_dti_bir_2303_pdf_url: null,
    client_compliance_dti_bir_2303_uploaded_date: null,
    client_compliance_dti_bir_2303_uploaded_by: null,
    client_compliance_dti_bir_2303_file_name: null,
    client_compliance_dti_bir_2303_notes: null,
    client_compliance_gis_status: 'pending',
    client_compliance_gis_pdf_url: null,
    client_compliance_gis_uploaded_date: null,
    client_compliance_gis_uploaded_by: null,
    client_compliance_gis_file_name: null,
    client_compliance_gis_notes: null,
    client_compliance_id_signature_status: 'pending',
    client_compliance_id_signature_pdf_url: null,
    client_compliance_id_signature_uploaded_date: null,
    client_compliance_id_signature_uploaded_by: null,
    client_compliance_id_signature_file_name: null,
    client_compliance_id_signature_notes: null,
    signature_position: 'Position',
    signature_name: 'Signature Name',
    size: 'Size'
  }
}

function createJobOrderTemplate(): Partial<JobOrder> {
  return {
    joNumber: 'JO001',
    siteName: 'Site Name',
    siteLocation: 'Site Location',
    joType: 'Installation',
    requestedBy: 'Requester Name',
    assignTo: 'Assignee Name',
    dateRequested: new Date(),
    deadline: new Date(),
    jobDescription: 'Job description',
    message: 'Message',
    attachments: [{
      url: 'Attachment URL',
      name: 'Attachment Name',
      type: 'Attachment Type'
    }],
    status: 'draft',
    created: new Date(),
    updated: new Date(),
    created_by: 'USER_ID',
    company_id: 'COMPANY_ID',
    quotation_id: 'QUOTATION_ID',
    clientCompany: 'Client Company',
    clientName: 'Client Name',
    contractDuration: '30 days',
    contractPeriodEnd: new Date(),
    contractPeriodStart: new Date(),
    leaseRatePerMonth: 1000,
    missingCompliance: {},
    quotationNumber: 'Q001',
    remarks: 'Remarks',
    product_id: 'PRODUCT_ID',
    dtiBirUrl: null,
    gisUrl: null,
    idSignatureUrl: null,
    siteImageUrl: null,
    materialSpec: 'Material specification',
    illumination: 'Illumination specification'
  }
}

function createInventoryTemplate(): any {
  return {
    id: 'PRODUCT_ID',
    name: 'Product Name',
    location: 'Location',
    price: 1000,
    site_code: 'SITE_CODE',
    type: 'LED Billboard',
    description: 'Product description',
    health_percentage: 100,
    light: false,
    active: true,
    deleted: false,
    created: new Date(),
    updated: new Date(),
    seller_id: 'SELLER_ID',
    seller_name: 'Seller Name',
    company_id: 'COMPANY_ID',
    position: 1,
    categories: ['Category'],
    category_names: ['Category Name'],
    content_type: 'Content Type',
    // Flattened specs fields
    specs_audience_types: 'General Public,Business',
    specs_elevation: 10,
    specs_location: 'Location',
    specs_traffic_count: 1000,
    specs_type: 'RENTAL',
    specs_height: 5,
    specs_width: 10,
    specs_content_type: 'Digital'
  }
}

function createUsersTemplate(): any {
  return {
    uid: 'USER_UID',
    email: 'user@email.com',
    displayName: 'User Name',
    license_key: 'LICENSE_KEY',
    company_id: 'COMPANY_ID',
    role: 'sales',
    permissions: '[]',
    project_id: 'PROJECT_ID',
    first_name: 'First Name',
    last_name: 'Last Name',
    middle_name: 'Middle Name',
    phone_number: 'Phone Number',
    gender: 'Male',
    type: 'OHPLUS',
    created: new Date(),
    updated: new Date(),
    onboarding: false
  }
}

function createServiceAssignmentTemplate(): any {
  return {
    assignmentNumber: 'SA001',
    siteName: 'Site Name',
    siteLocation: 'Site Location',
    serviceType: 'Maintenance',
    requestedBy: 'Requester Name',
    assignTo: 'Assignee Name',
    dateRequested: new Date(),
    deadline: new Date(),
    serviceDescription: 'Service description',
    message: 'Message',
    attachments: [{
      url: 'Attachment URL',
      name: 'Attachment Name',
      type: 'Attachment Type'
    }],
    status: 'draft',
    created: new Date(),
    updated: new Date(),
    created_by: 'USER_ID',
    company_id: 'COMPANY_ID',
    quotation_id: 'QUOTATION_ID',
    clientCompany: 'Client Company',
    clientName: 'Client Name',
    contractDuration: '30 days',
    contractPeriodEnd: new Date(),
    contractPeriodStart: new Date(),
    serviceRatePerMonth: 1000,
    remarks: 'Remarks',
    product_id: 'PRODUCT_ID',
    siteImageUrl: null,
    materialSpec: 'Material specification',
    illumination: 'Illumination specification'
  }
}