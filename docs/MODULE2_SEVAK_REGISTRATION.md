# Module 2 — Sevak Registration & Search

This module implements the **Aksharmrut Sevak - Jamo Ne Jamadu Re** (Form 01) flow: registering volunteers, generating a unique 6-character sevak code, searching the directory, and exporting records to Excel.

## Backend

### `generateSevakCode(firstName, lastName)`

**Algorithm**
1. Take the first letter of `firstName` and `lastName` and convert them to lower-case.
2. If either name is empty, use `x` as the missing initial.
3. Use the year `2026` as the numeric anchor.
4. Base prefix = `${firstInitial}${lastInitial}2026` (e.g. `nb2026`).
5. Query existing Sevaks whose `sevakCode` starts with this prefix (`prisma.sevak.findMany`).
6. Extract the numeric suffix from each matching code, determine the maximum, and increment by 1.
7. Suffix is zero-padded to a minimum of 2 digits (`01`, `02`, `10`, `100`, ...).
8. Final code = `${basePrefix}${suffix}` (e.g. `nb202601`).

**Format examples**
- `Nisarg Bhatt` → `nb202601` (first=`n`, last=`b`)
- `Mina Patel` → `mp202601` (first=`m`, last=`p`)
- `A B` → `ab202601` (first=`a`, last=`b`)
- `A` → `aa202601` (one-word name: first and last initial from the same word)

**Collision handling**
The year-and-sequence format guarantees a unique next suffix for every matching prefix. No random retries are required.

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
- `mobile` is strictly unique. If it already belongs to another sevak, the API returns `409 Conflict: "Mobile number [mobile] is already registered with another Sevak"`.
- `whatsapp`, when provided, is strictly unique. If it already belongs to another sevak, the API returns `409 Conflict: "WhatsApp number [whatsapp] is already registered with another Sevak"`.
- `altMobile` may duplicate existing values; it is not uniqueness-checked.
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
| `firstName="Nisarg"`, `lastName="Bhatt"` | `nb202601` (or the next available 2+ digit sequence) |
| Existing `nb202601` in DB | Next `nb202602` |
| `firstName="A"`, `lastName="B"` | `ab202601` |
| Lowercase input | Lower-case initials in code |
| One-word name | First and last initial from the same word |

### POST `/api/v1/sevaks`

| Scenario | Expected |
|----------|----------|
| All required fields valid | `201` with sevak object and unique `sevakCode` |
| Missing `fullName` | `400 Required fields are missing` |
| `expectedContacts = -1` | `400 expectedContacts must be a non-negative integer` |
| `mobile = "123"` | `400 Mobile number must contain at least 10 digits` |
| `mobile` already registered | `409 Mobile number [mobile] is already registered with another Sevak` |
| `whatsapp` already registered | `409 WhatsApp number [whatsapp] is already registered with another Sevak` |

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
