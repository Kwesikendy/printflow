# PrintFlow — Complete Project Context & Architecture Reference

This document is the single source of truth for the **PrintFlow** codebase. Any developer or AI agent should read this file first to obtain total context of the system architecture, business logic, database migrations, routes, server actions, and hardware integrations without having to reverse-engineer the codebase.

---

## 1. Executive Summary & Domain Overview

**PrintFlow** is a multi-tenant SaaS application purpose-built for commercial digital graphic print shops in Ghana (operating under UTC+0 / `Africa/Accra` timezone with Ghanaian Cedi `GHS` as primary currency).

### Key Business Workflows
1. **Front Desk (Order Intake)**:
   - Walk-in or marketing customer requests a quote or places an order.
   - Products are chosen (e.g. *Flexi - Matte*, *SAV - Glossy*, *Banner*, *Flag*, *DTF*).
   - Dimensions are entered in `cm`, `m`, `ft`, or `in`. Area is computed dynamically (`width × height`).
   - Customer pricing is derived automatically based on client tier (`walk_in` vs `marketing`).
   - Optional extra services can be added (e.g. *Pockets - Flexi/Banner*, *Flag Finishing*).
   - Upfront or partial payment is recorded (via Mobile Money `momo`, `cash`, or `other`).
   - Jobs are forwarded to the print room.

2. **The 5:00 PM Shift / Workday Boundary**:
   - In Ghanaian print shops, the operational workday starts at **17:00 (5:00 PM)** and ends at **16:59:59** the next calendar day (`src/lib/workday.ts`).
   - Any financial reports, daily analytics, staff activity, and sequential shift numberings align to this 5:00 PM shift boundary.
   - Job numbers follow the date-prefixed format `PF-YYMMDD-XXX` (e.g. `PF-261015-001`).
   - Invoice numbers follow `INV-YYMMDD-XXX` (e.g. `INV-261015-001`).
   - This date prefix prevents collision across shifts.

3. **Print Room Production**:
   - Jobs released to production enter the **Print Queue** (`/dashboard/queue`).
   - Operators can be assigned to **Print Room 1** (`room_1`), **Print Room 2** (`room_2`), or handle unassigned jobs.
   - Operators print an **80mm thermal Job Card ticket** for the physical order.
   - **Critical Domain Rule — Substrates vs Extra Services**:
     - Non-print extra services like **Pockets** and **Finishing** are billable line items and appear on the customer's invoice.
     - However, they **must never appear on the production Job Card** handed to print machine operators, as they confuse printers who search for artwork to print for pockets.
     - When primary printable products are marked `in_production` or `completed`, companion pocket/finishing service jobs in the group automatically advance in sync (`src/app/actions/jobs.ts`).

4. **Pickup & Delivery**:
   - Once completed, jobs transition to the **Pickup Queue** (`/dashboard/pickup`) or **Delivery Board** (`/dashboard/delivery`).
   - Front desk logs recipient identity (`pickup_name`, `pickup_phone`).

5. **Finance & Accounting**:
   - Daily income vs expenditures (`/dashboard/finance/expenditures`).
   - Customer arrears tracking and monthly customer statement printing (`/print/customer-statement`).
   - Shift finance report printing (`/print/finance-report`).
   - Account clearance checks for releasing partial payment orders.

6. **HR & Payroll**:
   - Employee directory, roles, departments, salary configurations, and leave tracking (`/dashboard/admin/hr`).
   - Monthly payroll generation adhering strictly to **Ghana Revenue Authority (GRA) PAYE** progressive tax bands and **SSNIT** (5.5% employee, 13% employer) contributions (`/dashboard/admin/hr/payroll`).
   - Printable payslips (`/print/payslip/[runId]/[employeeId]`).

---

## 2. Technology Stack & Key Packages

| Category | Technology / Library | Version | Role / Usage |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router, Turbopack) | `16.3.4` | Server Actions, React Server Components, Route Handlers |
| **UI Library** | React | `19.2.8` | Core UI |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`) | `^4` | Utility-first CSS, CSS variables, `@theme` directives |
| **Animation** | Framer Motion | `^13.1.1` | Spring animations, queue item transitions, modal layout animations |
| **Icons** | Lucide React | `^0.511.0` | Modern SVG iconography |
| **Database & Auth**| Supabase (`@supabase/supabase-js`, `@supabase/ssr`)| `^2.49.4` | PostgreSQL, Row Level Security, Realtime subscriptions, Auth |
| **Forms & Validation**| React Hook Form, Zod, `@hookform/resolvers` | `^7.56`, `^3.25` | Schema-validated client & server forms |
| **Toasts** | Sonner | `^2.0.3` | Notification toasts |
| **Charts** | Recharts | `^2.15.3` | Finance & production analytics dashboards |
| **Hardware / Print**| `react-qr-code`, `react-barcode` | `^2.2.0`, `^1.6.1` | Receipt QR tracking, barcode labels |
| **Server Runner** | Node.js v24 + PM2 (`ecosystem.config.cjs`) | `v24+` | Production service process management with `server.js` |

### Scripts in `package.json`
- `npm run dev`: Runs Next.js with `--max-old-space-size=4096` to prevent Node 24 V8 nursery heap overflow.
- `npm run dev:webpack`: Fallback webpack development server.
- `npm run build`: Production build.
- `npm run start`: Starts production server.

---

## 3. Database Schema & All SQL Migrations (`supabase/migrations/`)

All migrations live under `supabase/migrations/` and should be executed in chronological order:

| File | Purpose & Contents |
| :--- | :--- |
| `001_schema.sql` | Base schema: `tenants`, `profiles`, `product_types`, `pricing_rules`, `standard_sizes`, `jobs`, `invoices`, `payments`, `job_status_events`, `job_sequences`. |
| `002_rls.sql` | Strict Row Level Security policies guaranteeing multi-tenant isolation via `tenant_id`. |
| `003_functions.sql` | Core PostgreSQL functions: `record_payment()`, `transition_job_status()`, `get_next_job_number()`, `get_next_invoice_number()`. |
| `004_seed.sql` | Demo tenant `GhanaPress Print Shop` (`00000000-0000-0000-0000-000000000001`), sample product catalog, standard A-sizes, pricing rules. |
| `005_artworks_and_admin.sql` | Storage bucket `artworks` configuration for uploaded artwork files and tenant configuration JSONs. |
| `006_job_groups.sql` | Introduces `job_groups` table to bundle multiple line-item jobs under a single customer order and single invoice. |
| `007_partial_payments.sql` | Partial payments engine: adds `subtotal`, `discount_type`, `discount_value`, `discount_amount` to `invoices`. |
| `008_fix_payments.sql` | Foreign key alignment between invoices and payment records. |
| `008_tenant_logo.sql` | Adds `logo_url` column to `tenants`. |
| `009_allow_manual_release.sql` | Allows front desk / admin to release `awaiting_payment` jobs directly to print queue (`paid_released`). |
| `010_add_pickup_details.sql` | Adds `pickup_name` and `pickup_phone` to `jobs`. |
| `011_create_customers_table.sql` | Dedicated `customers` directory for phone autocomplete, past debt, and customer profile management. |
| `012_print_rooms.sql` | Adds `print_room` column (`room_1`, `room_2`) to `jobs` and `profiles`. |
| `013_manual_reset_and_payments.sql` | Manual sequence reset controls and payment method expansions. |
| `013_profile_print_room.sql` | Profile-level print room default assignment. |
| `014_five_pm_workday_reset.sql` | 5:00 PM shift reset trigger and workday boundary timestamps on `job_sequences`. |
| `015_safe_unique_job_sequence.sql` | Safe sequential numbering generator resilient to high concurrency. |
| `016_delivery_tracking.sql` | Delivery support: adds `delivery_method`, `delivery_status`, `delivery_address`, `delivery_phone`, `dispatched_at`, `delivered_at`. |
| `017_accounting_controls.sql` | `expenditures` table (categories, amounts, notes, payment methods) and invoice dispute flagging (`is_flagged`, `flag_reason`). |
| `018_shift_date_job_numbers.sql` | Shift date-encoded identifiers (`PF-YYMMDD-XXX` / `INV-YYMMDD-XXX`). |
| `019_accountant_payment_clearance.sql` | Updates `transition_job_status` to allow `accountant` role to authorize releases. |
| `020_hr_management.sql` | Adds HR attributes to `profiles`: phone, department, job title, employment type, basic salary, allowances, deductions, SSNIT, Ghana card, bank details. |
| `021_backfill_hr_assignments.sql` | Migration script backfilling default HR departments for legacy staff. |
| `022_hr_leave_requests.sql` | `employee_leave_balances` and `leave_requests` tables for annual/sick/unpaid leave management. |
| `023_hr_payroll.sql` | `payroll_settings`, `payroll_runs`, and `payroll_items` tables with Ghana GRA PAYE tax calculation & SSNIT. |
| `024_fix_ssnit_employer_rate.sql` | Corrects SSNIT employer rate to legal statutory 13.0%. |
| `025_accountant_hr_access.sql` | Permits accountants to inspect HR payroll runs. |
| `026_expand_roles_cleaner_rider.sql` | Expands allowed profile roles to include `cleaner` and `rider`. |

---

## 4. Roles & Permissions (RBAC)

PrintFlow defines 6 system roles in `types/database.ts`:

1. **`admin`**: Unrestricted access across all operational, financial, HR, inventory, user administration, and system settings modules.
2. **`front_desk`**: Customer lookup, order creation (`/dashboard/jobs/new`), payment recording, job cancellation, order release, customer collection/pickup logging (`/dashboard/pickup`), customer statement generation.
3. **`printer`**: Production queue view (`/dashboard/queue`), printing 80mm thermal Job Cards, starting production (`in_production`), completing print jobs (`completed`). Filterable by assigned `print_room`.
4. **`accountant`**: Financial management (`/dashboard/finance`), recording invoice payments, expenditures (`/dashboard/finance/expenditures`), daily financial reports, customer debt settlement, payroll review.
5. **`rider`**: Delivery board (`/dashboard/delivery`), dispatching and marking orders as delivered.
6. **`cleaner`**: Operations staff with HR & payroll profile tracking.

---

## 5. Pricing Engine & Billable Add-ons vs Job Cards

### Pricing Formula
- **Area-based products**:
  $$\text{Line Total} = (\text{Width} \times \text{Height}) \times \text{Unit Cost} \times \text{Quantity}$$
- **Fixed-price products (`is_fixed_price = true`)**:
  $$\text{Line Total} = \text{Unit Cost} \times \text{Quantity}$$
  *(e.g., Pull-Up Banners, PVC stands, standard cards)*.

### Unit Rate Resolution (`src/lib/pricing.ts`)
- Pricing rates are stored per unit squared (`ft²`, `in²`, `cm²`, `m²`).
- Custom pricing schemes are saved in Supabase storage at:
  `artworks/{tenant_id}/settings/unit_pricing.json`
- Function [`resolveUnitRate()`](file:///d:/Printess/printflow/src/lib/pricing.ts#L69-L98) resolves rates by tenant config, customer tier (`walk_in` vs `marketing`), and selected dimension unit.

### Substrates vs Extra Services (Pockets & Finishing)
- Some jobs represent physical print substrates (*Flexi*, *SAV*, *Flag*, *Cloth*, *Vinyl*).
- Other line items represent billable post-press extra services:
  - *Pockets - Flexi/Banner*
  - *Pocketing*
  - *Finishing*
  - *Flag Finishing*
- **Identification Utility**: [`isPocketOrFinishingProduct(name)`](file:///d:/Printess/printflow/src/lib/utils.ts#L217-L225)
- **Job Card Behavior**:
  - Filtered out of [`GroupJobCardPrintPage`](file:///d:/Printess/printflow/src/app/print/job-card/group/%5Bid%5D/page.tsx) and [`JobCardPrintPage`](file:///d:/Printess/printflow/src/app/print/job-card/%5Bid%5D/page.tsx).
  - Print operators ONLY see the items that need to go through the printing machines.
- **Invoice Behavior**:
  - Unfiltered in [`InvoicePrintPage`](file:///d:/Printess/printflow/src/app/print/invoice/%5Bid%5D/page.tsx) and [`TrackInvoicePage`](file:///d:/Printess/printflow/src/app/track/invoice/%5Bid%5D/page.tsx).
  - Fully billed with price, quantity, and line total.
- **Queue Synchronization**:
  - In [`transitionJobStatusAction()`](file:///d:/Printess/printflow/src/app/actions/jobs.ts#L717-L800), when the primary printable jobs transition to `in_production`, `completed`, or `picked_up`, companion pocket/finishing jobs advance automatically in sync.

---

## 6. Directory Map of All Routes & Endpoints (`src/app/`)

### Authentication & Landing
- `src/app/page.tsx`: Redirects authenticated users to `/dashboard` or unauthenticated to `/login`.
- `src/app/(auth)/login/page.tsx`: Email & password login supporting demo quick-fill logins.

### Operations & Jobs
- `src/app/dashboard/page.tsx`: Core overview dashboard with quick metrics, quick actions, and recent jobs.
- `src/app/dashboard/jobs/page.tsx`: Paginated, filterable list of all orders and individual jobs.
- `src/app/dashboard/jobs/new/page.tsx`: Comprehensive multi-job order creation interface (customer autocomplete, size presets, live pricing calculator, artwork file upload/link, notes, and print room routing).
- `src/app/dashboard/jobs/[id]/page.tsx`: Single job detail view (artwork preview, dimension audit, payment status, status transitions).
- `src/app/dashboard/jobs/group/[id]/page.tsx`: Multi-job consolidated order view showing all line items, group payments, and group actions.
- `src/app/dashboard/queue/page.tsx`: Live real-time print room queue for production operators.
- `src/app/dashboard/pickup/page.tsx`: Front desk customer pickup and hand-over logging queue.
- `src/app/dashboard/delivery/page.tsx`: Delivery board for dispatched jobs and riders.
- `src/app/dashboard/staff-activity/page.tsx`: Shift performance analytics tracking jobs logged by Front Desk and jobs completed by Print Room workers.

### Finance & Administration
- `src/app/dashboard/finance/page.tsx`: Financial management hub, payments breakdown, outstanding balances, customer search, and revenue summaries.
- `src/app/dashboard/finance/expenditures/page.tsx`: Shop expenses manager (materials, utilities, petty cash, equipment maintenance).
- `src/app/dashboard/admin/page.tsx`: Administrator central panel.
- `src/app/dashboard/admin/users/page.tsx`: Staff account management, role assignment, and print room assignments.
- `src/app/dashboard/admin/products/page.tsx`: Product types catalog editor and pricing configuration.
- `src/app/dashboard/admin/inventory/page.tsx`: Large-format roll inventory tracking, stock levels, and deduction logs.
- `src/app/dashboard/admin/settings/page.tsx`: Tenant logo, name, currency, and operational settings.
- `src/app/dashboard/admin/hr/page.tsx`: Human Resources employee directory, compensation profiles, and leave request management.
- `src/app/dashboard/admin/hr/payroll/page.tsx`: Monthly payroll run generator, GRA PAYE tax calculation, and SSNIT deductions.

### Print Templates & Public Tracking
- `src/app/print/job-card/group/[id]/page.tsx`: 80mm thermal receipt ticket for consolidated orders (excludes pockets/finishing).
- `src/app/print/job-card/[id]/page.tsx`: 80mm thermal receipt ticket for standalone jobs (auto-redirects to group card if grouped).
- `src/app/print/invoice/[id]/page.tsx`: A4 branded customer invoice with QR tracking, bank details, breakdown, discounts, and payment terms.
- `src/app/print/finance-report/page.tsx`: Printable shift financial report (total revenue, cash, momo, unpaid balance, expenditures).
- `src/app/print/customer-statement/page.tsx`: Comprehensive customer account statement for client billing and debt recovery.
- `src/app/print/payroll/[runId]/page.tsx`: Printable monthly master payroll sheet.
- `src/app/print/payslip/[runId]/[employeeId]/page.tsx`: Individual employee payslip print template.
- `src/app/track/invoice/[id]/page.tsx`: Publicly accessible QR-code destination where customers can view live order status.

---

## 7. Server Actions Reference (`src/app/actions/`)

All server actions reside in `src/app/actions/` and use `'use server'`:

| Module | Core Exported Actions | Description |
| :--- | :--- | :--- |
| [`jobs.ts`](file:///d:/Printess/printflow/src/app/actions/jobs.ts) | `createJobGroupAction`, `transitionJobStatusAction`, `releaseJobGroupAction`, `cancelJobGroupAction`, `updateJobDetailsAction` | Multi-item order creation, date-prefixed numbering generation, state transitions, companion pocket/finishing sync, inventory auto-deduction. |
| [`finance.ts`](file:///d:/Printess/printflow/src/app/actions/finance.ts) | `recordInvoicePaymentAction`, `settleCustomerBalanceAction`, `getFinanceOverviewAction`, `toggleInvoiceFlagAction` | Atomic payment recording, multi-invoice bulk arrears settlement, revenue breakdown. |
| [`invoices.ts`](file:///d:/Printess/printflow/src/app/actions/invoices.ts) | `updateInvoiceAction`, `applyDiscountAction`, `deleteInvoiceAction` | Editing invoice terms, applying fixed or percentage discounts. |
| [`customers.ts`](file:///d:/Printess/printflow/src/app/actions/customers.ts) | `searchCustomers`, `createCustomerAction`, `updateCustomerAction`, `getCustomerStatementAction` | Realtime customer autocomplete, phone matching, ledger statement extraction. |
| [`delivery.ts`](file:///d:/Printess/printflow/src/app/actions/delivery.ts) | `dispatchOrderAction`, `markDeliveredAction`, `updateDeliveryDetailsAction` | Rider assignment, delivery status lifecycle. |
| [`expenditures.ts`](file:///d:/Printess/printflow/src/app/actions/expenditures.ts) | `createExpenditureAction`, `deleteExpenditureAction`, `getExpendituresAction` | Recording petty cash, utilities, and shop expenses against shift revenue. |
| [`inventory.ts`](file:///d:/Printess/printflow/src/app/actions/inventory.ts) | `createMaterialAction`, `updateMaterialAction`, `adjustStockAction` | Roll inventory management, low-stock alerts, manual stock adjustments. |
| [`hr.ts`](file:///d:/Printess/printflow/src/app/actions/hr.ts) | `updateEmployeeHRAction`, `submitLeaveRequestAction`, `reviewLeaveRequestAction` | Staff HR compensation profile setup, leave request approvals. |
| [`payroll.ts`](file:///d:/Printess/printflow/src/app/actions/payroll.ts) | `generatePayrollRunAction`, `approvePayrollRunAction`, `markPayrollPaidAction` | Ghana GRA PAYE tax calculation, SSNIT employer/employee deductions, payroll state changes. |
| [`staff-activity.ts`](file:///d:/Printess/printflow/src/app/actions/staff-activity.ts)| `getStaffActivityReportAction` | Aggregates daily production events by Front Desk staff vs Print Room workers. |
| [`storage.ts`](file:///d:/Printess/printflow/src/app/actions/storage.ts) | `getStorageUsageAction`, `cleanOrphanArtworksAction` | Audits Supabase storage consumption, cleans up obsolete artwork files. |
| [`users.ts`](file:///d:/Printess/printflow/src/app/actions/users.ts) | `inviteUserAction`, `updateUserRoleAction`, `updateUserPrintRoomAction` | Staff provisioning, role reassignment, print room assignment. |
| [`auth.ts`](file:///d:/Printess/printflow/src/app/actions/auth.ts) | `loginAction`, `logoutAction` | Supabase authentication session handling with cookie persistence. |
| [`admin.ts`](file:///d:/Printess/printflow/src/app/actions/admin.ts) | `updateTenantSettingsAction`, `resetJobSequenceAction` | Branding updates, emergency sequence resets. |
| [`track.ts`](file:///d:/Printess/printflow/src/app/actions/track.ts) | `markInvoiceJobsCompleted` | Public tracking portal completion trigger. |

---

## 8. Hardware & Printing Standards

### 1. Thermal Job Card (80mm Roll)
- **Target Hardware**: POS-80 / Epson TM-T88 / Xprinter 80mm thermal receipt printers.
- **CSS Setup**:
  ```css
  @page {
    margin: 0mm !important;
    size: 80mm auto !important;
  }
  ```
- **Design rules**: High-contrast pure black text (`text-black font-extrabold`), large order number badge, customer phone, QR code for order receipt tracking, compact items table without borders that bleed.
- **Non-print services**: Pockets and finishing are excluded to avoid printing confusion.

### 2. A4 Branded Invoice
- **CSS Setup**:
  ```css
  @page {
    margin: 0 !important;
    size: A4 portrait;
  }
  ```
- **Design rules**: Official shop letterhead, beneficiary payment details (Fidelity Bank account, Mobile Money number), discount deductions, VAT breakdown, and QR code tracking.

---

## 9. Production Runbook & Common VPS Gotchas

1. **Node 24 Memory Allocation**:
   Always run with `--max-old-space-size=4096`. Under default memory limits, Turbopack allocation triggers `FATAL ERROR: MarkCompactCollector: young object promotion failed`.

2. **Windows PM2 Configuration**:
   Never use `pm2 start "npm start"`. On Windows, PM2 wraps `npm` in `cmd.exe` which cannot properly forward signals.
   Always launch via `ecosystem.config.cjs`:
   ```powershell
   pm2 delete all
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

3. **InterServer / Caddy Reverse Proxy Body Limit**:
   The VPS runs behind an InterServer network edge proxy. The default body size limit will reject files over 20MB. `next.config.ts` allows 400MB, but the edge proxy must be configured to allow 400MB payloads.

4. **Corrupted `.next` Cache**:
   If builds are interrupted and throw 404s on CSS/JS chunks:
   ```powershell
   pm2 delete all
   taskkill /F /IM node.exe /T
   Remove-Item .next -Recurse -Force
   npm run build
   pm2 start ecosystem.config.cjs
   ```
