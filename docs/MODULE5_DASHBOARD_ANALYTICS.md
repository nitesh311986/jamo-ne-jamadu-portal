# Module 5 — Executive Analytics Dashboard

## Overview

The Executive Analytics Dashboard provides a real-time, at-a-glance view of the Jamo Ne Jamadu Seva Portal. It consolidates key operational metrics from the `Sevak`, `BookAllocation`, `SevaReceipt`, and `PrasadDistribution` models and exposes them via `GET /api/v1/dashboard/stats`.

## Endpoint

- **Route:** `GET /api/v1/dashboard/stats`
- **Middleware:** `authenticateToken`
- **Response Shape:**

```json
{
  "success": true,
  "data": {
    "overview": { ... },
    "prasadSummary": { ... },
    "recentActivity": [ ... ],
    "charts": { ... }
  }
}
```

## Data Aggregation Formulas

### Overview Metrics

| Metric | Source / Formula |
|--------|------------------|
| `totalSevaks` | `prisma.sevak.count()` |
| `totalAllocatedBooks` | `prisma.bookAllocation.count()` |
| `totalSubmittedBooks` | `prisma.bookAllocation.count({ where: { status: 'SUBMITTED' } })` |
| `totalPartiallySubmittedBooks` | `prisma.bookAllocation.count({ where: { status: 'PARTIALLY_SUBMITTED' } })` |
| `pendingBooks` | `totalAllocatedBooks - (totalSubmittedBooks + totalPartiallySubmittedBooks)` |
| `totalSubmittedAmount` | `prisma.sevaReceipt.aggregate({ _sum: { amount: true } })` converted to number; `0` when `null` |
| `totalReceiptsCount` | `prisma.sevaReceipt.count()` |

### Prasad Summary

| Metric | Source / Formula |
|--------|------------------|
| `totalEligibleBoxes` | `prisma.prasadDistribution.aggregate({ _sum: { eligibleBoxes: true } })` |
| `totalDistributedBoxes` | `prisma.prasadDistribution.aggregate({ _sum: { distributedBoxes: true } })` |
| `balanceBoxes` | `totalEligibleBoxes - totalDistributedBoxes` (clamped to `0`) |

### Progress Rates (Frontend)

- **Book Collection Rate** = `((totalSubmittedBooks + totalPartiallySubmittedBooks) / totalAllocatedBooks) * 100`
- **Prasad Distribution Rate** = `(totalDistributedBoxes / totalEligibleBoxes) * 100`

### Chart Breakdowns

- **Monthly Trend:** Receipts grouped by `YYYY-MM` derived from `entryDate` (fallback `createdAt`) and aggregated by count and total `amount`.
- **Denomination Breakdown:** Each receipt is classified into the existing slab tiers defined in `prasad.service.ts` and aggregated by count and total `amount`.

## Backend Implementation Notes

- All count and aggregate queries run in parallel via `Promise.all` for high performance.
- `toNumber()` normalizes Prisma `Decimal` values returned from the `amount` aggregation.
- Recent activity is derived from the most recent `SevaReceipt` records joined to the `Sevak` record.
- Winston logs every successful stats fetch at `info` level and errors at `error` level.

## Cache Recommendations

### Short-Term In-Memory Cache

Because dashboard data can be expensive to compute and changes relatively infrequently during steady operations, a short-lived in-memory cache is recommended:

| Setting | Suggestion | Rationale |
|---------|------------|-----------|
| TTL | 30–60 seconds | Keeps metrics fresh while reducing repeated aggregate load during rapid refreshes. |
| Key | `dashboard:stats` or `dashboard:stats:{role}` | Single key is sufficient unless role-specific filtering is added later. |
| Invalidation | Time-based (TTL) + manual refresh endpoint | Simple and avoids stale data without adding event complexity. |

### Future Enhancements

1. **Redis / External Cache:** For multi-instance deployments, move the cache to Redis with the same TTL.
2. **Cache Warming:** Pre-compute stats every minute via a background job so the endpoint rarely blocks on heavy aggregates.
3. **Model Event Hooks:** Use Prisma middleware or database triggers to invalidate the cache when `sevaReceipt`, `bookAllocation`, or `prasadDistribution` rows change.
4. **Materialized Views (PostgreSQL):** For very large data sets, create materialized views for the most common aggregates and refresh them on an interval.

## Frontend Behavior

- The dashboard fetches stats on component mount.
- Auto-refresh is set to every 30 seconds.
- A manual **Refresh Stats** button is available and displays the last-updated timestamp.
- All metric cards, progress rings, and the monthly trend bar chart are populated from the live endpoint.
