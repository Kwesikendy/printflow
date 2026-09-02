-- ============================================================
-- PrintFlow — 001_schema.sql
-- Core schema: all tables, indexes, constraints
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  area_unit  text NOT NULL DEFAULT 'cm2' CHECK (area_unit IN ('cm2','m2','in2')),
  currency   text NOT NULL DEFAULT 'GHS',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PROFILES (one per auth.users row)
-- ============================================================
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  role       text NOT NULL CHECK (role IN ('front_desk','printer','accountant','admin')),
  full_name  text NOT NULL,
  email      text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PRODUCT TYPES
-- ============================================================
CREATE TABLE product_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PRICING RULES
-- ============================================================
CREATE TABLE pricing_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  product_type_id uuid NOT NULL REFERENCES product_types(id),
  source          text NOT NULL CHECK (source IN ('walk_in','marketing')),
  unit_cost       numeric(12,4) NOT NULL CHECK (unit_cost >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_type_id, source)
);

-- ============================================================
-- STANDARD SIZES
-- ============================================================
CREATE TABLE standard_sizes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name      text NOT NULL,   -- e.g. A4, A3, A2
  width     numeric NOT NULL CHECK (width > 0),
  height    numeric NOT NULL CHECK (height > 0)
);

-- ============================================================
-- JOB NUMBER SEQUENCES (one counter per tenant)
-- ============================================================
CREATE TABLE job_sequences (
  tenant_id  uuid PRIMARY KEY REFERENCES tenants(id),
  last_job   integer NOT NULL DEFAULT 0,
  last_inv   integer NOT NULL DEFAULT 0
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  job_number        text NOT NULL,
  source            text NOT NULL CHECK (source IN ('walk_in','marketing')),
  customer_name     text NOT NULL,
  customer_phone    text,
  product_type_id   uuid NOT NULL REFERENCES product_types(id),
  width             numeric NOT NULL CHECK (width > 0),
  height            numeric NOT NULL CHECK (height > 0),
  area              numeric NOT NULL CHECK (area > 0),
  quantity          integer NOT NULL CHECK (quantity > 0),
  unit_cost_applied numeric(12,4) NOT NULL,
  line_total        numeric(12,2) NOT NULL,
  notes             text,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN (
                      'draft','quoted','awaiting_payment','paid_released',
                      'in_production','completed','picked_up','cancelled'
                    )),
  created_by        uuid NOT NULL REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, job_number)
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  job_id         uuid NOT NULL UNIQUE REFERENCES jobs(id),
  invoice_number text NOT NULL,
  total          numeric(12,2) NOT NULL,
  status         text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  issued_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  invoice_id  uuid NOT NULL REFERENCES invoices(id),
  job_id      uuid NOT NULL REFERENCES jobs(id),
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  method      text NOT NULL CHECK (method IN ('momo','cash','other')),
  reference   text,
  notes       text,
  recorded_by uuid NOT NULL REFERENCES profiles(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- JOB STATUS EVENTS (immutable audit log)
-- ============================================================
CREATE TABLE job_status_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  job_id      uuid NOT NULL REFERENCES jobs(id),
  from_status text,
  to_status   text NOT NULL,
  actor_id    uuid NOT NULL REFERENCES profiles(id),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);

-- product_types
CREATE INDEX idx_product_types_tenant ON product_types(tenant_id);

-- pricing_rules
CREATE INDEX idx_pricing_rules_tenant ON pricing_rules(tenant_id);
CREATE INDEX idx_pricing_rules_lookup ON pricing_rules(tenant_id, product_type_id, source);

-- jobs
CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_tenant_created ON jobs(tenant_id, created_at DESC);
CREATE INDEX idx_jobs_tenant_number ON jobs(tenant_id, job_number);
CREATE INDEX idx_jobs_tenant_customer ON jobs(tenant_id, customer_name);
CREATE INDEX idx_jobs_created_by ON jobs(created_by);

-- invoices
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_job ON invoices(job_id);
CREATE INDEX idx_invoices_tenant_status ON invoices(tenant_id, status);

-- payments
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_tenant_date ON payments(tenant_id, recorded_at DESC);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

-- job_status_events
CREATE INDEX idx_job_events_tenant ON job_status_events(tenant_id);
CREATE INDEX idx_job_events_job ON job_status_events(job_id);

-- ============================================================
-- UPDATED_AT TRIGGER for jobs
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
