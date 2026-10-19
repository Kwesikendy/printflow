-- Allow accountants to access the HR workspace and manage payroll.
-- Staff administration and leave approval remain admin-only.

DROP POLICY IF EXISTS "leave requests: read own tenant" ON leave_requests;
CREATE POLICY "leave requests: read own tenant"
  ON leave_requests FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_is_active()
    AND (auth_role() IN ('admin', 'accountant') OR employee_id = auth.uid())
  );

DROP POLICY IF EXISTS "payroll settings: admin manage" ON payroll_settings;
CREATE POLICY "payroll settings: admin manage"
  ON payroll_settings FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('admin', 'accountant'))
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "payroll runs: admin manage" ON payroll_runs;
CREATE POLICY "payroll runs: admin manage"
  ON payroll_runs FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('admin', 'accountant'))
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() IN ('admin', 'accountant'));

DROP POLICY IF EXISTS "payroll entries: admin manage" ON payroll_entries;
CREATE POLICY "payroll entries: admin manage"
  ON payroll_entries FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('admin', 'accountant'))
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() IN ('admin', 'accountant'));
