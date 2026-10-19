-- PrintFlow — 023_hr_payroll.sql
-- Employee compensation records, configurable Ghana payroll settings,
-- monthly payroll runs, and itemised payroll entries.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS monthly_basic_salary numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_basic_salary >= 0),
  ADD COLUMN IF NOT EXISTS monthly_allowances numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_allowances >= 0),
  ADD COLUMN IF NOT EXISTS monthly_other_deductions numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_other_deductions >= 0),
  ADD COLUMN IF NOT EXISTS payroll_deduction_notes text,
  ADD COLUMN IF NOT EXISTS ssnit_number text,
  ADD COLUMN IF NOT EXISTS ghana_card_number text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS salary_payment_method text NOT NULL DEFAULT 'bank'
    CHECK (salary_payment_method IN ('bank', 'mobile_money', 'cash'));

CREATE TABLE IF NOT EXISTS payroll_settings (
  tenant_id            uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  tax_year             integer NOT NULL DEFAULT 2026,
  ssnit_employee_rate  numeric(5,2) NOT NULL DEFAULT 5.5 CHECK (ssnit_employee_rate >= 0 AND ssnit_employee_rate <= 100),
  ssnit_employer_rate  numeric(5,2) NOT NULL DEFAULT 13 CHECK (ssnit_employer_rate >= 0 AND ssnit_employer_rate <= 100),
  ssnit_ceiling        numeric(12,2) NOT NULL DEFAULT 25000 CHECK (ssnit_ceiling > 0),
  paye_bands           jsonb NOT NULL DEFAULT '[{"limit":588,"rate":0},{"limit":80,"rate":5},{"limit":100,"rate":10},{"limit":2900,"rate":17.5},{"limit":16000,"rate":25},{"limit":30332,"rate":30},{"limit":null,"rate":35}]'::jsonb,
  updated_by           uuid REFERENCES profiles(id),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO payroll_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS payroll_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_month          date NOT NULL,
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  total_basic_salary    numeric(14,2) NOT NULL DEFAULT 0,
  total_allowances      numeric(14,2) NOT NULL DEFAULT 0,
  total_gross_salary    numeric(14,2) NOT NULL DEFAULT 0,
  total_employee_ssnit  numeric(14,2) NOT NULL DEFAULT 0,
  total_paye            numeric(14,2) NOT NULL DEFAULT 0,
  total_other_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net_salary      numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_ssnit  numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_cost   numeric(14,2) NOT NULL DEFAULT 0,
  created_by            uuid NOT NULL REFERENCES profiles(id),
  approved_by           uuid REFERENCES profiles(id),
  approved_at           timestamptz,
  paid_by               uuid REFERENCES profiles(id),
  paid_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_month),
  CHECK (EXTRACT(DAY FROM period_month) = 1)
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id           uuid NOT NULL REFERENCES profiles(id),
  basic_salary          numeric(12,2) NOT NULL DEFAULT 0,
  allowances           numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary          numeric(12,2) NOT NULL DEFAULT 0,
  employee_ssnit        numeric(12,2) NOT NULL DEFAULT 0,
  paye                  numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions      numeric(12,2) NOT NULL DEFAULT 0,
  net_salary            numeric(12,2) NOT NULL DEFAULT 0,
  employer_ssnit        numeric(12,2) NOT NULL DEFAULT 0,
  employer_cost         numeric(12,2) NOT NULL DEFAULT 0,
  deduction_notes       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant_period
  ON payroll_runs(tenant_id, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_run
  ON payroll_entries(run_id);

ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll settings: admin manage" ON payroll_settings;
CREATE POLICY "payroll settings: admin manage"
  ON payroll_settings FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "payroll runs: admin manage" ON payroll_runs;
CREATE POLICY "payroll runs: admin manage"
  ON payroll_runs FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "payroll entries: admin manage" ON payroll_entries;
CREATE POLICY "payroll entries: admin manage"
  ON payroll_entries FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin')
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
