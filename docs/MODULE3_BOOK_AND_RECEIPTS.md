# Module 3 — Book & Receipt Management

This module implements the **Book Allocation** and **Receipt (Seva)** entry flow for the Jamo Ne Jamadu portal. It is based on the receipt book / pavti workflow where a sevak is assigned a unique book number, and each donation receipt is recorded under a sevak and a book.

## Backend

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/books/assign` | Assign a unique `bookNumber` to a `sevakId` |
| GET | `/api/v1/books/sevak/:sevakId` | List books assigned to a sevak |
| POST | `/api/v1/receipts` | Create one or many receipts for a sevak |
| GET | `/api/v1/receipts/search` | Search by `bookNumber`, `receiptNo`, `donorName`, `donorMobile`, and `sevakCode` |
| GET | `/api/v1/receipts/sevak/:sevakId` | List receipts for a sevak with book metadata |
| GET | `/api/v1/receipts/sevak/:sevakId/summary` | Real-time aggregation by amount |
| PUT | `/api/v1/receipts/:receiptId` | Update a single receipt |
| DELETE | `/api/v1/receipts/:receiptId` | Delete a single receipt and recalculate book status |
| POST | `/api/v1/receipts/bulk-sync` | Synchronize updates and additions for a sevak |
| GET | `/api/v1/receipts/export/excel` | Download all receipts + summary as `.xlsx` |

All endpoints require a valid JWT (`authenticateToken`).

### POST `/api/v1/books/assign`

**Required fields**
- `bookNumber` — the printed book number
- `sevakId` — UUID of the sevak

**Validation**
- The sevak must exist.
- `bookNumber` must be unique across all `BookAllocation` records.
- On conflict the API returns `409 Book number already assigned`.

### GET `/api/v1/books/sevak/:sevakId`

Returns the `BookAllocation` rows for a sevak, ordered by `assignedAt` descending. Each row contains:
- `id`
- `bookNumber`
- `sevakId`
- `status` (`ASSIGNED`, `SUBMITTED`, `PARTIALLY_SUBMITTED`)
- `assignedAt`

### POST `/api/v1/receipts`

Accepts a bulk payload:

```json
{
  "sevakId": "...",
  "receipts": [
    {
      "bookNumber": "123",
      "receiptNo": "1",
      "donorName": "પ.ભ.શ્રી John",
      "donorMobile": "9876543210",
      "amount": 500,
      "entryDate": "2026-09-21T00:00:00.000Z"
    }
  ]
}
```

**Validation**
- `sevakId` is required.
- Every receipt must have `bookNumber`, `receiptNo`, `donorName`, and a positive `amount`.
- `donorMobile` is normalized and optional; if provided it must contain at least 10 digits.
- Duplicate `bookNumber + receiptNo` pairs are rejected both within the request and against the database.
  - A duplicate pair inside the same request returns `400 Duplicate receipt number <receiptNo> detected within book <bookNumber>`.
  - A pair that already exists in the database returns `409 Receipt <receiptNo> already exists in Book <bookNumber>`.
- `entryDate` defaults to the current timestamp when omitted.

On success the API returns `{ count: <number> }`.

### GET `/api/v1/receipts/search`

Query parameters (all optional):
- `bookNumber`
- `receiptNo`
- `donorName` (partial, case-insensitive match)
- `donorMobile`
- `sevakCode` (partial, case-insensitive match)
- `page` (default `1`)
- `limit` (default `20`, max `100`)

Response is paginated and includes the related sevak stub (`sevakCode`, `fullName`, `mandal`).

### GET `/api/v1/receipts/sevak/:sevakId/summary`

Real-time aggregation for the selected sevak.

Response:

```json
{
  "sevak": { "sevakCode": "PJ1234", "fullName": "...", "mandal": "..." },
  "groups": [
    { "amount": 500, "count": 4, "subTotal": 2000 },
    { "amount": 1000, "count": 2, "subTotal": 2000 }
  ],
  "grandTotal": 4000,
  "totalCount": 6
}
```

The backend groups by distinct `amount` values, so any denomination — including the examples in the receipt image (₹50, ₹100, ₹250, ₹500, ₹1000, ₹1001, ₹1100, ₹1111, ₹2000, ₹2001, ₹2500, ₹5000, ₹5001, ₹11000, ₹25000, etc.) — is counted exactly as entered.

### GET `/api/v1/receipts/export/excel`

Streams a two-tab Excel file:
- **Receipts** — donor details, book / receipt numbers, amount, entry date, sevak code/name, mandal.
- **Summary** — denomination breakdown, count, sub-total, plus a grand total row.

## Frontend

### Pages

- `client/src/pages/ReceiptEntry.tsx` — Quick sevak search (by code, phone, or name), sevak summary banner, inline receipt entry grid with Enter-key navigation, and a live calculation card.
- `client/src/pages/ReceiptSearch.tsx` — Filtered search across `bookNumber`, `receiptNo`, `donorName`, `donorMobile`, and `sevakCode`, with a paginated table and Excel export.

### Receipt entry flow

1. The user types a sevak code, mobile, or name; the page queries `/api/v1/sevaks/search?limit=5`.
2. Selecting a sevak fetches assigned books and the receipt summary in parallel.
3. The banner displays `sevakCode`, `fullName`, `mandal`, `kshetra`, and assigned books.
4. The inline grid has columns: Book No, Receipt No, Donor Name, Donor Mobile, Amount.
5. Pressing **Enter** in any field advances to the next field; pressing **Enter** in the Amount column adds a new row and focuses the new row's Book No.
6. The live calculation card shows `₹amount × count = ₹subTotal` for every distinct amount and a bold grand total in Indian currency format.

### Indian currency formatting

The utility `client/src/utils/currency.ts` uses `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` for consistent `₹1,00,000` style display.

## Database

The module uses two existing Prisma models:

```prisma
model BookAllocation {
  id         String     @id @default(uuid())
  bookNumber String     @unique
  sevakId    String
  sevak      Sevak      @relation(fields: [sevakId], references: [id], onDelete: Cascade)
  status     BookStatus @default(ASSIGNED)
  assignedAt DateTime   @default(now())
}

model SevaReceipt {
  id          String   @id @default(uuid())
  sevakId     String
  sevak       Sevak    @relation(fields: [sevakId], references: [id], onDelete: Cascade)
  bookNumber  String
  receiptNo   String
  donorName   String
  donorMobile String?
  amount      Decimal  @db.Decimal(12, 2)
  entryDate   DateTime @default(now())
  createdAt   DateTime @default(now())

  @@unique([bookNumber, receiptNo])
}
```

`@@unique([bookNumber, receiptNo])` guarantees receipt uniqueness at the database level, and `@unique` on `BookAllocation.bookNumber` guarantees a book is assigned to only one sevak.

## Receipt Synchronization

### Backend bulk-sync algorithm

`POST /api/v1/receipts/bulk-sync` runs inside a `prisma.$transaction`:

1. Verify that the `sevakId` exists and that all `updates` reference receipts owned by that sevak.
2. Normalize every `addition` and `update`. `receiptNo` and `bookNumber` are trimmed; `donorMobile` is stripped to digits; `amount` must be positive.
3. Build a unique key map of `bookNumber|receiptNo` across the request.
   - A collision within the payload returns `400 Duplicate receipt number <receiptNo> detected within book <bookNumber>`.
4. In the transaction:
   - Apply each update. If `receiptNo` changes, verify no other row under the same `bookNumber` already uses the new number.
   - Insert new receipts and validate against the database for the same `bookNumber + receiptNo` collision. On conflict, the transaction rolls back and returns `409 Receipt <receiptNo> already exists in Book <bookNumber>`.
   - For every affected `bookNumber`, recompute the `BookAllocation` status:
     - `ASSIGNED` when no receipts remain.
     - `SUBMITTED` when the numeric receipt numbers are a complete `1..N` sequence with no gaps.
     - `PARTIALLY_SUBMITTED` in all other cases (gaps, non-numeric, or out-of-sequence numbers).
5. Return the refreshed receipt list and an aggregate summary (denomination groups, grand total, total count, and unique book count).

### Frontend optimistic UI

`client/src/pages/ReceiptEntry.tsx` maintains three local states:

- `receipts` — committed rows loaded from the server.
- `edits` — pending changes to committed rows.
- `drafts` — new, unsaved rows.

As the volunteer types, the live-calculation card recalculates denomination counts, grand total, receipt count, and unique book count using the merged view of `receipts + edits + drafts`. Rows with unsaved modifications are highlighted with an orange border/background, and real-time duplicate detection flags any `bookNumber + receiptNo` that already exists in the saved table or other rows.

## Validation rules

- `bookNumber` and `receiptNo` are trimmed and non-empty.
- `bookNumber + receiptNo` must be unique per book.
- Duplicate `bookNumber + receiptNo` pairs inside the same request (across both updates and additions) are rejected.
- `donorMobile` is optional, but if supplied it must contain at least 10 digits after stripping non-numeric characters.
- `amount` must be a positive number.
- Books are marked `ASSIGNED`, `SUBMITTED`, or `PARTIALLY_SUBMITTED` based on the receipt numbers currently recorded under them.

## Files added / modified

- `server/src/controllers/book.controller.ts`
- `server/src/controllers/receipt.controller.ts`
- `server/src/routes/book.routes.ts`
- `server/src/routes/receipt.routes.ts`
- `server/src/app.ts`
- `client/src/pages/ReceiptEntry.tsx`
- `client/src/pages/ReceiptSearch.tsx`
- `client/src/types/receipt.ts`
- `client/src/types/book.ts`
- `client/src/utils/currency.ts`
- `client/src/App.tsx`
- `client/src/components/DashboardLayout.tsx`
- `client/src/pages/Dashboard.tsx`
- `docs/openapi.yaml`
- `docs/MODULE3_BOOK_AND_RECEIPTS.md`
