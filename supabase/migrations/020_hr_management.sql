-- PrintFlow — 020_hr_management.sql
-- HR profile fields and annual leave balances.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  ADD COLUMN IF NOT EXISTS employment_start_date date;

CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_year   integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  entitlement  integer NOT NULL DEFAULT 20 CHECK (entitlement >= 0),
  used_days    integer NOT NULL DEFAULT 0 CHECK (used_days >= 0 AND used_days <= entitlement),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_tenant_year
  ON employee_leave_balances(tenant_id, leave_year);

INSERT INTO employee_leave_balances (tenant_id, employee_id, leave_year, entitlement, used_days)
SELECT tenant_id, id, EXTRACT(YEAR FROM now())::integer, 20, 0
FROM profiles
ON CONFLICT (employee_id, leave_year) DO NOTHING;

ALTER TABLE employee_leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave balances: read own tenant" ON employee_leave_balances;
CREATE POLICY "leave balances: read own tenant"
  ON employee_leave_balances FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_is_active());

DROP POLICY IF EXISTS "leave balances: admin insert" ON employee_leave_balances;
CREATE POLICY "leave balances: admin insert"
  ON employee_leave_balances FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "leave balances: admin update" ON employee_leave_balances;
CREATE POLICY "leave balances: admin update"
  ON employee_leave_balances FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "leave balances: admin delete" ON employee_leave_balances;
CREATE POLICY "leave balances: admin delete"
  ON employee_leave_balances FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
