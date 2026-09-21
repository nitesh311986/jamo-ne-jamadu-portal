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
}

export interface ReceiptInput {
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile: string;
  amount: string;
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
}
