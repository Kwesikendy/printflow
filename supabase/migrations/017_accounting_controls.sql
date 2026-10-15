-- PrintFlow -- 017_accounting_controls.sql
-- Discounts, invoice review flags, explicit roll dimensions, and expenditures.

-- ============================================================
-- INVOICE PRICING + REVIEW STATE
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flagged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.invoices
SET subtotal = total
WHERE subtotal IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN subtotal SET DEFAULT 0;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_discount_type_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_discount_type_check
  CHECK (discount_type IN ('none', 'percentage', 'fixed'));

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_flagged
  ON public.invoices(tenant_id, is_flagged, issued_at DESC);

-- ============================================================
-- EXPLICIT ROLL HEIGHT
-- roll_length remains for backward compatibility with existing stock
-- calculations and is kept in sync with roll_height by the app.
-- ============================================================
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS roll_height numeric;

UPDATE public.materials
SET roll_height = roll_length
WHERE roll_height IS NULL;

ALTER TABLE public.materials
  ALTER COLUMN roll_height SET DEFAULT 0;

-- ============================================================
-- EXPENDITURES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenditures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  vendor text,
  reference text,
  notes text,
  spent_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenditures: tenant read" ON public.expenditures;
CREATE POLICY "expenditures: tenant read"
  ON public.expenditures FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "expenditures: accountant manage" ON public.expenditures;
CREATE POLICY "expenditures: accountant manage"
  ON public.expenditures FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'accountant')
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'accountant')
  );

CREATE INDEX IF NOT EXISTS idx_expenditures_tenant_spent_at
  ON public.expenditures(tenant_id, spent_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenditures_tenant_category
  ON public.expenditures(tenant_id, category);
