-- Migration 027: Expenditure Deletion Requests (Accountant requests -> Admin approves)
ALTER TABLE expenditures
  ADD COLUMN IF NOT EXISTS deletion_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reviewed_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_expenditures_deletion_status
  ON expenditures(tenant_id, deletion_status)
  WHERE deletion_status IS NOT NULL;
