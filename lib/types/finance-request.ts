import { Timestamp } from 'firebase/firestore';

export interface BaseRequest {
  id: string;
  company_id: string;
  request_type: 'reimbursement' | 'requisition' | 'replenish';
  'Request No.': number;
  Requestor: string;
  // Keep Requested Item in base for backward compatibility; for replenish we mirror Particulars here.
  'Requested Item': string;
  Amount: number;
  Currency: string;
  'Approved By': string;
  // In existing data this is a single URL string; for replenish we keep optionality at data level.
  Attachments: string;
  Actions: string;
  created: Timestamp;
  deleted: boolean;
}

export interface ReimbursementRequest extends BaseRequest {
  request_type: 'reimbursement';
  'Date Released': Timestamp;
  // Attachments is mandatory in UI, persisted in BaseRequest.Attachments
}

export interface RequisitionRequest extends BaseRequest {
  request_type: 'requisition';
  Cashback: number;
  'O.R No.': string;
  'Invoice No.': string;
  Quotation: string; // optional in UI, persisted when present
  'Date Requested': Timestamp;
  // Attachments optional in UI, persisted in BaseRequest.Attachments when present
}

export interface ReplenishRequest extends BaseRequest {
  request_type: 'replenish';
  Particulars: string;
  'Total Amount': number;
  'Voucher No.': string;
  'Management Approval': 'Approved' | 'Pending';
  'Date Requested': Timestamp;
  // Uploads (PDF/DOC): Send Report mandatory; Print Report optional
  'Send Report'?: string;
  'Print Report'?: string;
  // For compatibility, BaseRequest.'Requested Item' should mirror Particulars
}

export type FinanceRequest = ReimbursementRequest | RequisitionRequest | ReplenishRequest;
