# Module 2 — Sevak Registration & Search

This module implements the **Aksharmrut Sevak - Jamo Ne Jamadu Re** (Form 01) flow: registering volunteers, generating a unique 6-character sevak code, searching the directory, and exporting records to Excel.

## Backend

### `generateSevakCode(firstName, lastName)`

**Algorithm**
1. Take the first character of `firstName` and `lastName`, upper-cased (`getInitials`).
2. Append a 4-digit, zero-padded random number (`0000`–`9999`).
3. Validate uniqueness against the `Sevak.sevakCode` column via `prisma.sevak.count`.
4. If the code exists, retry up to 20 times before throwing an error.

**Format examples**
- `Pankaj Joshi` → `PJ4892`
- `Mina Patel` → `MP0023`

**Collision handling**
The 4-digit random component yields 10,000 possibilities per initial pair. The retry loop makes collisions statistically negligible for expected data volumes. If all attempts collide, the API returns `500` with a logged error.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/sevaks` | Create a new sevak and return the generated code |
| GET | `/api/v1/sevaks/search?q=&page=&limit=` | Search/paginate sevaks |
| GET | `/api/v1/sevaks/export/excel` | Stream all records as `.xlsx` |

All endpoints require a valid JWT (`authenticateToken`).

### POST `/api/v1/sevaks`

**Required fields**
- `fullName`, `firstName`, `lastName`, `mobile`, `address`, `mandal`, `kshetra`, `expectedContacts`

**Validation**
- `expectedContacts` must be a non-negative integer.
- `mobile` must contain at least 10 digits; `altMobile` and `whatsapp` are validated the same way when provided.
- A unique `sevakCode` is generated server-side; clients must not supply it.

### GET `/api/v1/sevaks/search`

**Query parameters**
- `q` — search string
- `page` — default `1`
- `limit` — default `20`, capped at `100`

**Matching logic**
Prisma `OR` clause:
- `sevakCode` starts with `q` (case-insensitive)
- `mobile` starts with `q`
- `altMobile` starts with `q`
- `fullName` contains `q` (case-insensitive)

### GET `/api/v1/sevaks/export/excel`

**Implementation**
- Uses `exceljs` to build an `.xlsx` workbook.
- Headers are bilingual: Gujarati + English (e.g. `પૂરું નામ / Full Name`).
- Streaming response with `Content-Disposition: attachment; filename="sevaks.xlsx"`.

### Database indexing

The `Sevak` model already defines the following Prisma indexes:

```prisma
@@index([mobile])
@@index([fullName])
@@index([sevakCode])
```

These support the search/prefix queries above. `sevakCode` is also marked `@unique`.

## Frontend

### Pages

- `client/src/pages/SevakRegistration.tsx` — bilingual form that auto-derives first/last name from `fullName` and shows a success modal with the generated 6-character code.
- `client/src/pages/SevakList.tsx` — debounced search, paginated card view on mobile and table view on tablet/desktop, plus an Excel download button.

### Auto-derivation of first and last name

```ts
const parts = fullName.trim().split(/\s+/).filter(Boolean);
// 1 word  -> first = last = word
// 2+ words -> first = first word, last = last word
```

### Debounced search

The search input is debounced 300 ms before triggering the API call to avoid request spam.

### Excel download

The list view calls `GET /api/v1/sevaks/export/excel` with `responseType: 'blob'` and creates a client-side download link.

## Test matrices

### Code generation

| Scenario | Expected |
|----------|----------|
| `firstName="Pankaj"`, `lastName="Joshi"` | Code starts with `PJ` followed by 4 digits |
| Existing `PJ1234` in DB | New `P J...` sevak receives a different code (retry) |
| 20 consecutive collisions | `500 Internal server error` (extremely unlikely) |
| Lowercase input | Initials upper-cased in code |
| One-word name | First and last initial from the same word |

### POST `/api/v1/sevaks`

| Scenario | Expected |
|----------|----------|
| All required fields valid | `201` with sevak object and unique `sevakCode` |
| Missing `fullName` | `400 Required fields are missing` |
| `expectedContacts = -1` | `400 expectedContacts must be a non-negative integer` |
| `mobile = "123"` | `400 Mobile number must contain at least 10 digits` |

### Search

| Query `q` | Should match |
|-----------|--------------|
| `PJ` | `sevakCode` starting with `PJ` |
| `98765` | `mobile` or `altMobile` starting with `98765` |
| `pankaj` | `fullName` containing `pankaj` (case-insensitive) |
| `''` | Returns all results, paginated |

### Export

| Scenario | Expected |
|----------|----------|
| No sevaks | Empty workbook with headers |
| Many sevaks | All rows streamed; file downloads as `sevaks.xlsx` |

## Files added / modified

- `server/src/controllers/sevak.controller.ts`
- `server/src/routes/sevak.routes.ts`
- `server/src/app.ts`
- `server/package.json` (added `exceljs`)
- `client/src/pages/SevakRegistration.tsx`
- `client/src/pages/SevakList.tsx`
- `client/src/types/sevak.ts`
- `client/src/App.tsx`
- `docs/openapi.yaml`
- `docs/MODULE2_SEVAK_REGISTRATION.md`
