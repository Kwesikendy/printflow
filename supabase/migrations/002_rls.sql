-- ============================================================
-- PrintFlow — 002_rls.sql
-- Row Level Security: complete tenant isolation + role access
-- ============================================================

-- Enable RLS on all business tables
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_sizes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sequences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get current user's tenant_id (cached from profiles)
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION auth_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Check if current user is active
CREATE OR REPLACE FUNCTION auth_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(is_active, false) FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- TENANTS POLICIES
-- ============================================================

-- Users can read their own tenant
CREATE POLICY "tenant: read own"
  ON tenants FOR SELECT
  USING (id = auth_tenant_id());

-- Only admin can update tenant settings
CREATE POLICY "tenant: admin update"
  ON tenants FOR UPDATE
  USING (id = auth_tenant_id() AND auth_role() = 'admin');

-- No inserts via RLS (tenants created via service role / admin API)
-- No deletes via RLS

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Any authenticated user can read profiles in their tenant
CREATE POLICY "profiles: read own tenant"
  ON profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_is_active());

-- Admin can insert new profiles in their tenant
CREATE POLICY "profiles: admin insert"
  ON profiles FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Admin can update profiles in their tenant
CREATE POLICY "profiles: admin update"
  ON profiles FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Users can update their own profile (limited fields handled in app layer)
CREATE POLICY "profiles: self update"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================================
-- PRODUCT TYPES POLICIES
-- ============================================================

-- Anyone in tenant can read active product types
CREATE POLICY "product_types: read own tenant"
  ON product_types FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- Admin can insert
CREATE POLICY "product_types: admin insert"
  ON product_types FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Admin can update
CREATE POLICY "product_types: admin update"
  ON product_types FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- ============================================================
-- PRICING RULES POLICIES
-- ============================================================

-- Anyone in tenant can read (needed for price calculation)
CREATE POLICY "pricing_rules: read own tenant"
  ON pricing_rules FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- Admin can insert
CREATE POLICY "pricing_rules: admin insert"
  ON pricing_rules FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Admin can update
CREATE POLICY "pricing_rules: admin update"
  ON pricing_rules FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- Admin can delete
CREATE POLICY "pricing_rules: admin delete"
  ON pricing_rules FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- ============================================================
-- STANDARD SIZES POLICIES
-- ============================================================

CREATE POLICY "standard_sizes: read own tenant"
  ON standard_sizes FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "standard_sizes: admin manage"
  ON standard_sizes FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_role() = 'admin');

-- ============================================================
-- JOB SEQUENCES POLICIES
-- ============================================================

-- Only accessible via security definer functions
CREATE POLICY "job_sequences: deny direct"
  ON job_sequences FOR ALL
  USING (false);

-- ============================================================
-- JOBS POLICIES
-- ============================================================

-- Front desk & admin: see all jobs in their tenant
CREATE POLICY "jobs: front_desk/admin/accountant read"
  ON jobs FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin','accountant')
  );

-- Printer: only see paid_released and in_production
CREATE POLICY "jobs: printer read queue"
  ON jobs FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'printer'
    AND status IN ('paid_released','in_production','completed')
  );

-- Front desk & admin can insert new jobs
CREATE POLICY "jobs: front_desk/admin insert"
  ON jobs FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin')
  );

-- Front desk & admin can update most fields
CREATE POLICY "jobs: front_desk/admin update"
  ON jobs FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin')
  );

-- Printer can update status only (enforced at app layer for specific transitions)
CREATE POLICY "jobs: printer update status"
  ON jobs FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'printer'
    AND status IN ('paid_released','in_production')
  );

-- No hard deletes on jobs
-- (cancellation is a status change, handled by front_desk/admin update policy)

-- ============================================================
-- INVOICES POLICIES
-- ============================================================

-- Read: all roles except printer
CREATE POLICY "invoices: read own tenant"
  ON invoices FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin','accountant')
  );

-- Insert: front_desk and admin (via server action)
CREATE POLICY "invoices: front_desk/admin insert"
  ON invoices FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin')
  );

-- Update: front_desk and admin (for marking paid via record_payment function)
CREATE POLICY "invoices: front_desk/admin update"
  ON invoices FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin')
  );

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================

-- Read: front_desk, admin, accountant
CREATE POLICY "payments: read own tenant"
  ON payments FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin','accountant')
  );

-- Insert: front_desk and admin only
CREATE POLICY "payments: front_desk/admin insert"
  ON payments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin')
  );

-- No updates or deletes on payments (immutable)

-- ============================================================
-- JOB STATUS EVENTS POLICIES
-- ============================================================

-- All roles can read status history for their tenant's jobs
CREATE POLICY "job_status_events: read own tenant"
  ON job_status_events FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- Insert: all active roles (via server actions only)
CREATE POLICY "job_status_events: all roles insert"
  ON job_status_events FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin','printer','accountant')
  );

-- No updates or deletes (immutable audit log)
