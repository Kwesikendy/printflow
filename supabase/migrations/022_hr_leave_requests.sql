-- PrintFlow — 022_hr_leave_requests.sql
-- Leave request register and HR approval workflow.

CREATE TABLE IF NOT EXISTS leave_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_by  uuid NOT NULL REFERENCES profiles(id),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  days          integer NOT NULL CHECK (days > 0),
  leave_type    text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'unpaid', 'other')),
  reason        text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   uuid REFERENCES profiles(id),
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant_created
  ON leave_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status
  ON leave_requests(employee_id, status);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave requests: read own tenant" ON leave_requests;
CREATE POLICY "leave requests: read own tenant"
  ON leave_requests FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_is_active()
    AND (auth_role() = 'admin' OR employee_id = auth.uid())
  );

DROP POLICY IF EXISTS "leave requests: employee insert" ON leave_requests;
CREATE POLICY "leave requests: employee insert"
  ON leave_requests FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_is_active()
    AND (employee_id = auth.uid() OR auth_role() = 'admin')
  );

DROP POLICY IF EXISTS "leave requests: admin update" ON leave_requests;
CREATE POLICY "leave requests: admin update"
  ON leave_requests FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');
