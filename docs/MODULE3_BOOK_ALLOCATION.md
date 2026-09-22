# Module 3 — Book Allocation & Management

This module provides the full Book Allocation workflow for the Jamo Ne Jamadu portal. Operators can search for a sevak, review currently assigned books, edit or delete existing allocations, and add multiple new book numbers in a single batch.

## User Flow

```
Operator -> SevakSearchSelect -> /api/v1/sevaks/search
                                       |
                                       v
                              Select Sevak (onSelect)
                                       |
                                       v
            GET /api/v1/books/sevak/{sevakId}
                                       |
                                       v
                    Section A: Existing Assigned Books
                    - Edit book number
                    - Delete book (safeguard against receipts)
                                       |
                                       v
                    Section B: New Book Allocation
                    - Dynamic rows (Add/Remove)
                    - Client-side duplicate check
                    - Save All -> POST /api/v1/books/batch-assign
                                       |
                                       v
                              Refresh list + Toast
```

## Backend

### Endpoints

All endpoints require a valid JWT (`authenticateToken`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/books/sevak/{sevakId}` | List books assigned to a sevak |
| POST | `/api/v1/books/batch-assign` | Assign multiple unique book numbers to a sevak |
| PUT | `/api/v1/books/{bookId}` | Update an existing book number |
| DELETE | `/api/v1/books/{bookId}` | Delete a book allocation if no receipts are linked |

### `GET /api/v1/books/sevak/{sevakId}`

Returns `BookAllocation` rows for the sevak ordered by `assignedAt` descending. Each row contains:

- `id`
- `bookNumber`
- `sevakId`
- `status` (`ASSIGNED`, `SUBMITTED`, `PARTIALLY_SUBMITTED`)
- `assignedAt`

### `POST /api/v1/books/batch-assign`

**Request body**

```json
{
  "sevakId": "...",
  "bookNumbers": ["1001", "1002", "1003"]
}
```

**Validation**

1. `sevakId` must exist.
2. Each `bookNumber` is trimmed and uppercased.
3. Empty entries are stripped.
4. Duplicate values within the submitted array return `400` with the duplicated numbers.
5. Any `bookNumber` already present in `BookAllocation` returns `409` with the conflicting list.
6. All inserts run inside a Prisma `$transaction` with `status: ASSIGNED`.

**Audit**

`logAuditEvent(actorId, 'BOOK_BATCH_ASSIGN', { sevakId, bookNumbers, count })` is triggered on success.

### `PUT /api/v1/books/{bookId}`

**Request body**

```json
{
  "bookNumber": "1004"
}
```

**Validation**

- `bookNumber` is required, trimmed and uppercased.
- If the new number is already assigned to a different book allocation, return `409`.
- On success, the allocation is updated and both Winston and `BOOK_UPDATED` audit logs are written.

### `DELETE /api/v1/books/{bookId}`

**Validation**

- Returns `404` if the allocation does not exist.
- Prevents deletion if any `SevaReceipt` references the `bookNumber`, returning `400` with `Cannot delete book with existing logged receipts`.
- On success, the allocation is deleted and both Winston and `BOOK_DELETED` audit logs are written.

## Business Rules & Constraints

1. **Global Uniqueness**: `BookAllocation.bookNumber` is marked `@unique` in the Prisma schema. A book number can only be assigned to one sevak at a time.
2. **Batch Uniqueness**: The request itself cannot contain the same book number twice.
3. **Immutability by Receipts**: A book allocation cannot be deleted if any `SevaReceipt` has logged a receipt against that `bookNumber`.
4. **Audit Trail**: Every create, update, and delete is persisted in `AuditLog` with the actor, action, and details.
5. **Winston Logging**: All service-level events (success and failure) are sent to the Winston logger with the actor, sevak, and book number context.
6. **Normalization**: Book numbers are trimmed and uppercased on both client and server to keep comparison consistent.

## Database

```prisma
model BookAllocation {
  id         String     @id @default(uuid())
  bookNumber String     @unique
  sevakId    String
  sevak      Sevak      @relation(fields: [sevakId], references: [id], onDelete: Cascade)
  status     BookStatus @default(ASSIGNED)
  assignedAt DateTime   @default(now())

  @@index([bookNumber])
  @@index([sevakId])
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
  @@index([bookNumber])
}
```

## Frontend

### Components & Pages

- `client/src/components/SevakSearchSelect.tsx` — Debounced sevak lookup (code, mobile, full name) with an accessible dropdown and verified sevak badge.
- `client/src/pages/BookAllocation.tsx` — Full mobile-first page:
  - SevakSearchSelect at the top
  - Existing assigned books with responsive cards (mobile) / table (desktop)
  - Inline edit and delete actions
  - Dynamic new-book input rows with duplicate highlighting
  - "Save All Books" batch submission
  - Summary card and toast-style success/error banners

### Data Flow

1. Operator types in `SevakSearchSelect`.
2. After 300ms the component calls `/api/v1/sevaks/search`.
3. Selecting a sevak triggers `onSelect` in `BookAllocation`.
4. `BookAllocation` fetches assigned books via `GET /api/v1/books/sevak/{sevakId}`.
5. Existing books render with status badges and edit/delete controls.
6. Operator adds new rows, removes them, and hits **Save All Books**.
7. The page calls `POST /api/v1/books/batch-assign` and refreshes the list on success.

## Test Matrix

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Search sevak by code, mobile, or full name | Matching sevaks appear in the dropdown |
| 2 | Select a sevak | Existing assigned books load and display; summary updates |
| 3 | Add multiple valid, unique books and save | `201` response; books created; list refreshes; audit logged |
| 4 | Submit a duplicate within the new rows | Client highlights duplicates; request is not sent |
| 5 | Submit a book number that already exists in the system | Server returns `409` with the conflicting number(s) |
| 6 | Edit an existing book to a number used by another allocation | Server returns `409`; no update |
| 7 | Delete a book with no linked receipts | Book is removed; `BOOK_DELETED` audit logged |
| 8 | Delete a book with linked SevaReceipt rows | Server returns `400` with safeguard message |
| 9 | Concurrent batch assignments with overlapping book numbers | First transaction wins; second receives `409` conflict |
| 10 | Server error (e.g., database unavailable) | Winston logs the error; client shows generic 500 message |

## Files Added / Modified

- `server/src/controllers/book.controller.ts`
- `server/src/routes/book.routes.ts`
- `client/src/components/SevakSearchSelect.tsx`
- `client/src/pages/BookAllocation.tsx`
- `client/src/App.tsx`
- `client/src/components/DashboardLayout.tsx`
- `docs/openapi.yaml`
- `docs/MODULE3_BOOK_ALLOCATION.md`
