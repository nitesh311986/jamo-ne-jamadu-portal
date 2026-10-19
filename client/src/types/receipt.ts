export interface BookMeta {
  status: 'ASSIGNED' | 'SUBMITTED' | 'PARTIALLY_SUBMITTED';
  assignedAt: string;
}

export interface Receipt {
  id: string;
  sevakId: string;
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile: string | null;
  amount: number;
  entryDate: string;
  createdAt: string;
  sevak?: { sevakCode: string; fullName: string; mandal: string };
  book?: BookMeta | null;
  sahSevakName?: string | null;
  sahSevakMobile?: string | null;
}

export interface ReceiptInput {
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile: string;
  amount: string;
}

export interface ReceiptDraftRow {
  tempId: string;
  id?: string;
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile: string;
  amount: string | number;
  isSaved?: boolean;
}

export interface CreateReceiptsRequest {
  sevakId: string;
  receipts: ReceiptInput[];
}

export interface ReceiptSearchResponse {
  receipts: Receipt[];
  total: number;
  page: number;
  limit: number;
}

export interface ReceiptSummaryGroup {
  amount: number;
  count: number;
  subTotal: number;
}

export interface ReceiptSummaryResponse {
  sevak: { id: string; sevakCode: string; fullName: string; mandal: string };
  groups: ReceiptSummaryGroup[];
  grandTotal: number;
  totalCount: number;
  uniqueBooks?: number;
}

export interface ReceiptUpdateItem {
  receiptId: string;
  receiptNo?: string;
  donorName?: string;
  donorMobile?: string | null;
  amount?: number;
}

export interface NewReceiptItem {
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile?: string | null;
  amount: number;
  entryDate?: string | null;
}

export interface BulkSyncBookItem {
  id?: string;
  receiptNo: string;
  donorName?: string;
  donorMobile?: string | null;
  amount: number;
}

export interface BulkSyncRequest {
  sevakId: string;
  bookNumber: string;
  receipts: BulkSyncBookItem[];
  sahSevakName?: string;
  sahSevakMobile?: string;
}

export interface BulkSyncResponse {
  success: boolean;
  count: number;
}
