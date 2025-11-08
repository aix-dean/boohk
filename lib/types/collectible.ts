export interface Collectible {
  id?: string
  booking_id: string
  company_id: string
  product: {
    id: string
    name?: string
    owner: string
  }
  client: {
    id: string
    name: string
    company_name: string
    company_id: string
  }
  booking: {
    id: string
    project_name?: string
    reservation_id: string
    start_date: any // Firestore timestamp
    end_date: any // Firestore timestamp
  }
  billing_type: string
  rate: number
  total_months: number
  deposit_required: string
  deposit_terms: string
  deposit_amount: number
  advance_required: string
  advance_terms: string
  amount: number
  vat_amount: number
  with_holding_tax: number
  due_date?: any // Firestore timestamp, optional for one-time
  period?: string // e.g., "January 2024", optional for one-time
  status: string
  invoice_number?: string
  invoice_id?: string
  contract_pdf_url?: string
  created: any // Firestore timestamp
  updated: any // Firestore timestamp
}