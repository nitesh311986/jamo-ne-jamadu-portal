# Module 4 — Prasad Vitran (Distribution) Counter

This document describes the live book-level prasad eligibility and distribution module for the BAPS Anand Jamo Ne Jamadu Seva Portal.

## 1. Volunteer Counter SOP

### Step 1 — Find the Book
1. Open **Prasad Counter / પ્રસાદ વિતરણ કાઉન્ટર** from the left navigation menu.
2. Use the live search to match sevak code, name, mobile, sah-sevak name/mobile, or book number. Optionally filter by **Mandal**.
3. Use the quick tabs to show **All**, **Pending (બાકી)**, or **Completed (પૂર્ણ)** books.

### Step 2 — Review Desk Totals
Four summary cards at the top show desk-wide totals for each item:
- **Small Box**, **Big Box**, **Biscuit Box**, **Chocolate Box**
- Each card shows Eligible / Given / Remaining across all filtered rows.

### Step 3 — Review the Book Row
Every allocated book is one row showing:
- Sevak code badge, full name, mobile, mandal/kshetra.
- Book number badge, receipt count, and Sah-Sevak name/mobile (or "None").
- One badge per item: `Eligible: X | Given: Y | Rem: Z`.
- **Collected By** — the representative who last picked up prasad for that book.
- Status badge: emerald **Completed** (all remaining = 0) or amber **Pending**.

### Step 4 — Distribute
Tap **Distribute / આપો** on a pending row. In the modal:
- Fill **Collected By Name** — quick-fill with [Use Sevak Name] or [Use Sah-Sevak Name], or type a custom representative name.
- Fill **Collected By Mobile** (10 digits).
- Use the per-item steppers (capped at remaining), or **Fill All Remaining / બધું બાકી આપો**.
- Optionally add notes, then **Confirm & Save**.

The grid refreshes immediately and the row flips to Completed when nothing remains.

## 2. Slab Eligibility Rules (Mandir Rules)

Eligibility is computed **per receipt**, then summed per book.

| Slab | Receipt Amount | Prasad Items |
|------|----------------|--------------|
| 1 | ₹1 – ₹499 | 1 Small Box |
| 2 | ₹500 – ₹1,000 | 1 Big Box |
| 3 | ₹1,001 – ₹4,999 | 1 Big Box + 1 Biscuit Box |
| 4 | ₹5,000+ | 1 Big Box + 1 Chocolate Box + 1 Biscuit Box |

### Formulas
- `eligible[item]` per book = sum of item counts across that book's receipts.
- `remaining[item]` = `max(0, eligible - distributed)`.
- Row status = `COMPLETED` when all four remaining counts are 0, else `PENDING`.

## 3. API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/prasad/summary` | Paginated book-level rows + aggregate item totals + mandal list. Filters: `search`, `sevakCode`, `sevakName`, `mobile`, `sahSevakName`, `sahSevakMobile`, `mandal`, `status`, `page`, `limit`. |
| POST | `/api/v1/prasad/distribute` | Increment distributed item counts for `(sevakId, bookNumber)` and record the collector. |
| GET | `/api/v1/prasad/export` | Excel workbook `Prasad_Vitran_Records_2026.xlsx` of the filtered rows. |

### Distribute request body
```json
{
  "sevakId": "uuid",
  "bookNumber": "12",
  "distributedSmall": 0,
  "distributedBig": 1,
  "distributedBiscuit": 1,
  "distributedChocolate": 0,
  "collectedByName": "Representative Name",
  "collectedByMobile": "9876543210",
  "notes": "optional"
}
```

Response: `{ "success": true, "message": "Prasad distributed successfully", "data": <PrasadDistribution> }`

## 4. Validation and Over-allocation Protection

- Quantities are **increments** — each call adds to the stored `distributed*` counts.
- The API rejects any item whose requested count exceeds `eligible - distributed` for that book with HTTP 400.
- All validation and the upsert run inside a single Prisma `$transaction`.
- `distributedAt` is set to the current time and `distributedBy` to the authenticated volunteer (`fullName`/`email`).
- An `AuditLog` entry (`PRASAD_DISTRIBUTE`) is written after each successful handover.
- `collectedByMobile` must contain at least 10 digits when provided.

## 5. Excel Export

`GET /api/v1/prasad/export` streams a single-sheet workbook with 16 columns:
Sevak Code, Sevak Name, Sevak Mobile, Mandal, Book Number, Sah-Sevak Name, Sah-Sevak Mobile, Small Box (E/G/R), Big Box (E/G/R), Biscuit Box (E/G/R), Chocolate Box (E/G/R), Picked Up By (Name), Picked Up By (Mobile), Status, Dispensed By, Dispensed At.

It accepts the same query filters as `/prasad/summary`.

## 6. File Reference

| File | Responsibility |
|------|---------------|
| `server/src/services/prasad.service.ts` | Slab rules (`computePrasadItems`), book-row builder, filter/pagination data. |
| `server/src/controllers/prasad.controller.ts` | HTTP handlers for summary, distribution, and Excel export. |
| `server/src/routes/prasad.routes.ts` | `/api/v1/prasad` routes. |
| `client/src/pages/PrasadCounter.tsx` | Counter UI: summary cards, filter bar, book grid, distribution modal. |
| `docs/openapi.yaml` | OpenAPI specifications for the endpoints. |
