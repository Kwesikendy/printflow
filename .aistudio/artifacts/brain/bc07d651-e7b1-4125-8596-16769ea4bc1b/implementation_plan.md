## 1. Executive Summary & Architectural Vision
PrintFlow will connect the Print Room workflow directly to the Raw Materials Inventory so that whenever a printer marks a job (or multi-job group) as **Completed**, the exact square meterage ($m^2$) used is automatically deducted from the right warehouse roll and recorded in the Inventory Audit Log with a full date and timestamp.

Based on your actual warehouse inventory (`FLEXI-MATTE 4FT- 1.3M`, `FLEXI-MATTE 5FT 1.85M`, `FLEXI-MATTE 10FT- 3.2M`, `SAV-GLOSSY 3FT -50M`, `SAV-GLOSSY 4FT- 50M`, `SAV-GLOSSY 5FT- 50M`, `SAV-MATTE 4FT- 50M`), the system solves four real-world challenges:
1. **Smart Substrate Family & Alias Matching**: Connects product catalog names (`Flexi`, `Flexy`, `Pullup Flexy`, `Banner`, `SAV`, `Sticker`, `Vinyl`, `One Way Vision`, `PVC`, etc.) to your warehouse `FLEXI-MATTE`, `SAV-GLOSSY`, and `SAV-MATTE` rolls even when spelled differently.
2. **Smallest-Fit Roll Width Selection (Including Widths in Roll Names)**: Parses roll widths from both the `roll_width` field and the material name (`3FT` = `0.91m`, `4FT` = `1.22m–1.3m`, `5FT` = `1.52m–1.85m`, `10FT` = `3.2m`) so even SAV rolls whose width was entered as `50m × 50m` are accurately recognized as `3FT`, `4FT`, or `5FT` rolls and deducted accurately.
3. **Duplicate Card & Stock-Aware Priority**: When two cards exist for the same roll size (e.g., `FLEXI-MATTE 10FT- 3.2M` and `FLEXI-MATTE 10FT-3.2M`), the engine prioritizes the roll with available stock and displays remaining rolls clearly.
4. **One-Click Printer Roll Confirmation & Learning**: Shows a fast confirmation modal when the printer clicks **Complete** or **Complete All**, pre-selecting the smallest fitting roll while allowing a 1-click switch between `3FT`, `4FT`, `5FT`, `10FT`, any other warehouse roll, or *"No Material Deduction"* (for non-roll items), and optionally saving the link for future jobs.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        PRINT ROOM COMPLETION WORKFLOW                        │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
         Printer clicks "Complete" (Single Job) or "Complete All" (Group)
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 1. SMART ROLL MATCHER & WIDTH-FIT ENGINE                     │
│  • Converts job width × height (ft/in/cm/mm) ──► meters & total area (m²)    │
│  • Matches family (Flexi/Flexy/Banner ──► FLEXI, SAV/Sticker/Vinyl ──► SAV)  │
│  • Parses true width (3FT=0.91m, 4FT=1.3m, 5FT=1.85m, 10FT=3.2m)             │
│  • Auto-picks smallest in-stock roll where roll_width >= min(width_m, h_m)   │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 2. PRINTER ROLL CONFIRMATION DIALOG (UI)                     │
│  • Shows Job Title, Dimensions (ft & m), and Calculated Area to Deduct (m²)  │
│  • Pre-selects recommended roll (e.g., "FLEXI-MATTE 4FT- 1.3M • 1.00 roll")  │
│  • Quick chips for sibling widths (4FT, 5FT, 10FT) + full dropdown override  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                         Printer clicks "Confirm & Complete"
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 3. PRIVILEGED SERVER DEDUCTION & AUDIT LOG                   │
│  • Marks job status = 'completed'                                            │
│  • Deducts m² & recalculates remaining rolls via Admin Service Client        │
│    (bypasses printer RLS restrictions safely on the server)                  │
│  • Inserts timestamped 'job_deduction' record into inventory_logs            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Aesthetic Direction & Domain Exemplars
- **Primary Category**: `data_analytics_apps` -> `bi_analytics_dashboard` (Enterprise Print Shop Production & Inventory SaaS)
- **Design Paradigm**: **P4 Atmospheric Minimalism & High-Craft UI** blended with **P2 Kinetic Typography & Neo-Brutalist Swiss Grids** (`1px solid` structural borders, high-contrast status badges, and zero-jitter tabular numerals).
- **Domain Exemplars**: **Linear** and **Vercel Dashboard** — fast operational modals, crisp `tabular-nums` metric readouts for roll widths (`3FT`, `4FT`, `5FT`, `10FT` / `1.3m`, `1.85m`, `3.2m`) and square meterage, and clear semantic status indicators.
- **Color & Atmospheric Polarity**:
  - **Surface Hierarchy**: Clean light mode workspace (`#F8FAFC` background canvas, `#FFFFFF` elevated modal and table surfaces, `#E2E8F0` `1px` structural borders).
  - **Semantic Status Accents**:
    - **Brand Indigo (`#4F46E5`)**: Primary confirmation actions, smart-matched roll badges, and active selection states.
    - **Emerald (`#10B981`)**: In-stock roll availability and completed job verification.
    - **Amber (`#F59E0B`)**: Low-stock warning or fallback roll width notice when a roll has misconfigured `50m × 50m` dimensions that can be normalized in one click.

---

## 3. Functional Architecture & Core Capabilities

### A. Smart Material Family Matcher & Roll-Name Dimension Parser
- **Substrate & Finish Recognition**:
  - Maps catalog product keywords (`flexi`, `flexy`, `banner`, `pullup`, `billboard` -> `FLEXI`; `sav`, `sticker`, `vinyl`, `branding`, `decal` -> `SAV`; plus `one way`, `reflective`, `pvc`, `canvas`, `backlit`, `mesh`, `board`) and finish tokens (`matte`, `glossy`/`gloss`).
- **True Roll Width Extraction (`3FT`, `4FT`, `5FT`, `10FT`, `1.3M`, `1.85M`, `3.2M`)**:
  - Inspects both `roll_width` and the material name. When a roll like `SAV-GLOSSY 3FT -50M` has `roll_width = 50` (mistakenly entered as length), it extracts `3FT` (`0.914m`), `4FT` (`1.22m`), `5FT` (`1.52m`), or explicit meter widths (`1.3M`, `1.85M`, `3.2M`) from the name so both width-fitting and per-roll area (`m²/roll`) calculations are accurate.
  - Also adds a 1-click **"Fix Roll Dimensions from Names"** button in Admin Inventory so you can permanently fix all `50m × 50m` SAV roll widths in the database at once.

### B. Printer Roll Confirmation Modal on Job Completion
- **Triggered on "Complete" & "Complete All"**:
  - In both the **Print Room Queue** and the **Job Detail Page**, clicking **Complete** (or **Complete All** for a multi-job order) opens the **Confirm Material Usage & Complete** modal.
- **Fast Operator Controls**:
  - Shows each job's dimensions in both feet and meters, quantity, and exact `m²` to deduct.
  - Pre-selects the smallest fitting roll in stock and provides 1-click width chips (e.g., switch between `4FT 1.3M`, `5FT 1.85M`, `10FT 3.2M`, or between duplicate stock batches) plus a *"No raw material deduction"* option.
  - Includes an option to save the selected material as the default link for that product type if not yet linked.

### C. Reliable Server-Side Deduction & Admin Auto-Match Upgrade
- **Privileged Deduction via Service Client**:
  - Updates `transitionJobStatusAction` to accept `materialIdOverride` (and `saveAsDefaultLink`), executing all `materials` updates and `inventory_logs` insertions via `createServiceClient()` so printer accounts are never blocked by RLS.
- **Upgraded Admin "Auto-Match by Name"**:
  - Upgrades the **Product Deductions** tab in Admin Inventory to use the smart family matcher and display a badge indicating when multiple roll widths (`3FT` / `4FT` / `5FT` / `10FT`) in that family will be dynamically auto-selected based on each job's dimensions.

---

## 4. Verification & Acceptance Criteria
- **Exact Match with Warehouse Inventory**: `Flexi` / `Pullup Flexy` jobs auto-select between `FLEXI-MATTE 4FT- 1.3M`, `5FT 1.85M`, and `10FT- 3.2M` based on job size; `SAV` / `Sticker` jobs auto-select between `SAV-GLOSSY 3FT`, `4FT`, `5FT`, and `SAV-MATTE 4FT`.
- **Correct Area & Roll Deduction for SAV Rolls**: Normalizing or deducting from `SAV-GLOSSY 3FT -50M` uses the true `3FT × 50M` (`45.7 m²` / `50 m²`) roll area instead of the erroneous `50m × 50m` (`2500 m²`).
- **Build & Type Safety**: Full Next.js production build (`compile_applet`) passes with zero TypeScript or lint errors.
