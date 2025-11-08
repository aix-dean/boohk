export interface CompanyFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  path: string
  uploadedBy: string
  uploadedAt: Date
  companyId: string
  userId: string
  folder?: string
  deleted?: boolean
}

export interface CompanyFolder {
  id: string
  name: string
  path: string
  parentId?: string | null
  createdBy: string
  createdAt: Date
  companyId: string
  userId: string
  deleted?: boolean
}

export interface CompanyData {
  companyId: string
  name: string
  address?: {
    city?: string
    province?: string
    street?: string
  }
  tin?: string
  email?: string
  phone?: string
  website?: string
  company_profile?: string
  logo?: string
  business_type?: string
  position?: string
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}

export interface FileUploadResponse {
  success: boolean
  file?: CompanyFile
  error?: string
}

export interface FileListResponse {
  success: boolean
  files: CompanyFile[]
  folders: CompanyFolder[]
  error?: string
}

export interface CompanyUpdateRequest {
  name?: string
  address?: {
    city?: string
    province?: string
    street?: string
  }
  tin?: string
  email?: string
  phone?: string
  website?: string
  company_profile?: string
  logo?: string
  business_type?: string
  position?: string
}
