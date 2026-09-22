# Module 4 — Prasad Distribution Counter

This document describes the live real-time inventory, eligibility, and master reporting module for the BAPS Anand Jamo Ne Jamadu Seva Portal.

## 1. Volunteer Counter SOP

### Step 1 — Identify the Sevak
1. Open **Prasad Counter** from the left navigation menu.
2. Search by **Sevak Code**, **Mobile**, or **Full Name**.
3. Select the sevak. The header card and live statistics banner appear.

### Step 2 — Verify Live Metrics
The banner shows four key metrics updated in real time:
- **Total Seva** collected by the sevak.
- **Receipts** — served / total, with the count of unserved receipts.
- **Books** — completed / total, with pending books.
- **Boxes** — already distributed / eligible, with boxes pending to issue.

### Step 3 — Review Slab-wise Eligibility
Scroll through the slab cards. Each card displays:
- Tier label (e.g., ₹500 - ₹999)
- Total and unserved receipt counts
- Eligible, already given, and remaining box counts

If any boxes remain for a tier, enter the number to hand over in the **Issue Now** field. The input is validated immediately: a red border appears if you enter more than the remaining boxes.

### Step 4 — Select Receipts to Serve
Expand a book under **Receipts & Books to Hand Over**.
- Already-served receipts show a green **Served** badge and cannot be re-selected.
- Use the checkbox next to an unserved receipt to mark it.
- Use **Select All Unserved** to select every unserved receipt in that book.

### Step 5 — Confirm and Hand Over
Tap **Confirm & Hand Over Prasad**. The confirmation modal shows:
- Sevak name and code
- Total boxes being handed over in this batch
- Number of receipts to mark as served
- Remaining boxes left for next pickup

After confirmation, the system records the distribution atomically and refreshes the live metrics instantly.

## 2. Tier Eligibility Algorithm

| Tier | Slab | Allocation Rule |
|------|------|-----------------|
| LT_500 | < ₹500 | 1 box per unique qualifying amount group. Multiple receipts of the same amount share one box. |
| GTE_500_LT_1000 | ₹500 - ₹999 | 1 box per receipt. |
| GTE_1000_LT_2000 | ₹1,000 - ₹1,999 | 1 box per receipt (standard configuration). |
| GTE_2000_LT_5000 | ₹2,000 - ₹4,999 | 1 box per receipt. |
| GTE_5000_LT_10000 | ₹5,000 - ₹9,999 | 1 box per receipt. |
| GTE_10000_LT_25000 | ₹10,000 - ₹24,999 | 1 box per receipt. |
| GTE_25000_LT_50000 | ₹25,000 - ₹49,999 | 1 box per receipt. |
| GTE_50000 | ≥ ₹50,000 | 1 box per receipt (default VIP allocation). |

### Formulas
- **Total Eligible Boxes** per tier:
  - Tier 1: `COUNT(DISTINCT amount)` within the slab.
  - Other tiers: `COUNT(receipts)` within the slab.
- **Remaining Boxes** per tier: `eligibleBoxes - distributedBoxes`.
- **Grand Total Eligible**: `SUM(eligibleBoxes across all tiers)`.
- **Grand Total Pending**: `eligibleBoxes - distributedBoxes` across all tiers.

## 3. API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/prasad/sevak/{sevakId}` | Full distribution overview and receipt checklist. |
| POST | `/api/v1/prasad/distribute` | Record tier box distribution and mark receipts served. |
| GET | `/api/v1/reports/master-summary/excel` | Multi-tab master summary Excel export. |

## 4. Idempotency and Over-allocation Protection

### Over-allocation Prevention
- The service calculates `remainingBoxes` for every tier.
- The API rejects any `distributeCount` that exceeds the remaining boxes with HTTP 400.
- The client adds an instant red border when an input exceeds the remaining value and disables the submit button.

### Single-serve Protection
- `prasadDistributed` is a boolean flag on `SevaReceipt`.
- The API checks every `receiptId` in the request before the transaction.
- If any requested receipt is already served, the entire request is rejected with HTTP 409 and the conflicting receipt numbers are returned.
- The transaction only marks receipts that are currently unserved, and it sets `distributedAt` and `distributedBy` for audit.

### Atomicity
- All writes run inside a single Prisma `$transaction`:
  1. Increment `distributedBoxes` in `PrasadDistribution` for each tier (upserting the row if it does not exist).
  2. Update the marked `SevaReceipt` rows to `prasadDistributed: true`.
  3. Re-evaluate affected `BookAllocation` records, updating them to `SUBMITTED` (all receipts served) or `PARTIALLY_SUBMITTED` (some served).
  4. Create an `AuditLog` entry.

## 5. Master Summary Excel Export

The `/api/v1/reports/master-summary/excel` endpoint streams a three-tab workbook:

1. **Master Sevak Summary** — one row per sevak with code, name, phone, mandal, kshetra, total seva, books, receipts, boxes eligible, given, and pending.
2. **Tier-wise Box Allocation** — per sevak, per slab tier breakdown of receipt counts and box counts.
3. **Receipt Audit Trail** — every receipt with book number, receipt number, donor, amount, distribution status, and timestamp.

## 6. File Reference

| File | Responsibility |
|------|---------------|
| `server/src/services/prasad.service.ts` | Tier logic, overview aggregation, master export data. |
| `server/src/controllers/prasad.controller.ts` | HTTP handlers for overview, distribution, and Excel export. |
| `server/src/routes/prasad.routes.ts` | `/api/v1/prasad` routes. |
| `server/src/routes/reports.routes.ts` | `/api/v1/reports` route for master summary Excel. |
| `client/src/pages/PrasadDistribution.tsx` | Mobile-first counter UI. |
| `docs/openapi.yaml` | OpenAPI specifications for the new endpoints. |
