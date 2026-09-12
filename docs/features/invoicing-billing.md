# Invoicing & Billable Time (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

Turn tracked time into money: mark time entries as billable, and generate a
client-ready invoice (PDF) from a project's tracked time over a date range,
using an hourly rate. This is the single highest-value feature for the
freelance/independent-contractor segment of this app's users — it's the
natural next step after "I tracked my hours" is "now I need to bill for
them," and today that step requires exporting data and building the invoice
by hand in another tool.

## 2. Current state in the codebase

More groundwork exists than it looks like at first glance:

- `Project.hourlyRate` and `Project.currency` already exist in the schema
  (`src/main/db/schema.ts`), the domain type (`src/shared/types/domain.ts`),
  and the create/edit form (`ProjectFormModal.vue` — "Hourly rate
  (optional)" field).
- **Neither field is read anywhere else in the codebase.** No revenue
  calculation, no formatting with `currency`, no invoice of any kind. They
  are captured and stored, full stop.
- There is no billable/non-billable distinction on `TimeEntry` — every
  tracked second is implicitly billable today.
- There is no client concept distinct from `Project` — no name, address, or
  contact info to put on an invoice.
- PDF generation has no precedent in the codebase (no `electron.printToPDF`
  usage, no PDF library dependency).

## 3. Proposed scope for v1

**In scope:**
- A `TimeEntry.isBillable` flag (default `true`), settable in
  `ManualEntryModal` and toggleable in bulk from the Timeline/Timesheet
  (mirrors how `source` is already a first-class, filterable field).
- Simple client fields **on `Project`** rather than a new entity —
  `clientName`, `clientEmail`, `clientAddress` (all nullable). One project =
  one client is the common freelance case; a separate `clients` table that
  multiple projects reference is a natural v2 if someone actually needs it
  (see open questions).
- An "Invoice" flow, scoped to one project + one date range:
  1. Renderer picks project + range (reuses the date pickers already built
     for `ReportsPage`/`TimesheetPage`).
  2. Main process pulls billable time entries in range (`TimeEntryRepository.listInRange`
     already supports `projectIds` + is indexed on `started_at`), groups
     them by task/description into line items, multiplies hours × `hourlyRate`.
  3. Renders an HTML invoice template (project/client info, line items,
     subtotal, total, currency-formatted via `Intl.NumberFormat`) and prints
     it to PDF via the main process `BrowserWindow.webContents.printToPDF()`
     API (already available in Electron, zero new dependencies) into a
     hidden offscreen window — same pattern the app could reuse for any
     future PDF report.
- Persist generated invoices (`invoices` table) so the user has a record:
  invoice number, project, date range, total, currency, status
  (`draft`/`sent`/`paid`), generated file path, created date. Without this,
  "did I already bill this week?" has no answer next time the app opens.
- A simple "Invoices" list (new page or a tab under the project detail page)
  showing past invoices with status, and a manual "Mark as paid" action.

**Out of scope for v1:**
- Recurring/scheduled invoices.
- Multi-currency conversion (store whatever currency the project uses,
  don't convert anything).
- Payment collection/integration (Stripe, PayPal links, etc.) — this stays
  a local, offline app; an invoice is a document, not a payment flow.
- Tax handling (VAT/sales tax line items) beyond a single optional flat
  "tax rate %" field the user can add on top of the subtotal — full tax
  compliance is out of scope.
- A separate `clients` entity — start with fields on `Project` (see above).

## 4. Architecture fit

### Schema (new migration `0002_billing.sql`)

```sql
ALTER TABLE time_entries ADD COLUMN is_billable INTEGER NOT NULL DEFAULT 1;

ALTER TABLE projects ADD COLUMN client_name TEXT;
ALTER TABLE projects ADD COLUMN client_email TEXT;
ALTER TABLE projects ADD COLUMN client_address TEXT;

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax_rate_percent REAL,
  total REAL NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid
  file_path TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX idx_invoices_project_id ON invoices(project_id);
```

### Domain types (`src/shared/types/domain.ts`)

```ts
export interface Invoice {
  id: string
  projectId: string
  invoiceNumber: string
  rangeStart: string
  rangeEnd: string
  subtotal: number
  taxRatePercent: number | null
  total: number
  currency: string
  status: 'draft' | 'sent' | 'paid'
  filePath: string | null
  createdAt: string
  paidAt: string | null
}
export type InvoiceInput = Pick<Invoice, 'projectId' | 'rangeStart' | 'rangeEnd'> &
  Partial<Pick<Invoice, 'taxRatePercent'>>
```

`TimeEntry.isBillable: boolean` and `Project.clientName/clientEmail/clientAddress: string | null`
added alongside the existing fields.

### New service: `InvoiceService` (`src/main/services/invoice.service.ts`)

- `generate(input: InvoiceInput): Invoice` — pulls billable entries via
  `TimeEntryRepository.listInRange({ projectIds: [projectId], startDate,
  endDate })`, groups and totals them, renders the HTML template, calls
  `printToPDF`, writes the file under a new `getInvoicesDir()` (same
  pattern as `getExportsDir()`/`getBackupsDir()` in `backup.service.ts`),
  and persists the `invoices` row via a new `InvoiceRepository`.
- `markPaid(id: string): Invoice`, `list(projectId?: string): Invoice[]`,
  `delete(id: string): void`.

### Repository: `InvoiceRepository`

Standard CRUD mirroring `ProjectRepository`'s shape.

### IPC surface

New `invoices` namespace on `DesktopApi`:
```ts
invoices: {
  generate(input: InvoiceInput): Promise<Invoice>
  list(projectId?: string): Promise<Invoice[]>
  markPaid(id: string): Promise<Invoice>
  delete(id: string): Promise<void>
  openFile(id: string): Promise<void> // shell.openPath, like openBackupFolder
}
```
Plus a zod schema in `src/shared/validation/schemas.ts` for `InvoiceInput`.

### Renderer

- `ProjectFormModal.vue` gains the three client fields (grouped under a
  "Billing" section next to the existing rate/budget fields).
- `ManualEntryModal.vue` and the Timeline row actions gain an `isBillable`
  toggle.
- A new `features/invoices/InvoicesPage.vue` (or a tab on
  `ProjectDetailPage.vue`) lists invoices and has a "Generate invoice"
  action opening a small modal (project pre-filled, date range picker,
  optional tax rate).

## 5. Open questions

1. Invoice numbering: per-project sequential (`INV-{project}-0001`) or
   global sequential? Freelancers with accounting obligations often need
   gapless sequential numbers — worth asking before building.
2. Should a `clients` entity be built now instead of embedding fields on
   `Project`, if the target user commonly bills multiple projects under one
   client? Embedding is simpler and matches "one project ≈ one client
   engagement," but doesn't dedupe client info across projects.
3. Invoice template customization (logo, notes, payment terms text) — v1
   fixed template, or a free-text "notes" field per invoice at minimum?
4. Should marking an invoice "sent" or "paid" have any effect on the
   underlying time entries (e.g., lock them from further editing so a paid
   invoice's numbers can't silently drift)? Worth deciding before entries
   attached to a paid invoice can be freely edited/deleted.
