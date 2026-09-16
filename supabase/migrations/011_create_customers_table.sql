-- Migration to add a dedicated customers table

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

-- Optional: Upsert existing customers from jobs into the new table
-- (We'll do this to backfill the database)
INSERT INTO customers (tenant_id, name, phone)
SELECT DISTINCT ON (tenant_id, customer_name) 
  tenant_id, 
  customer_name as name, 
  customer_phone as phone
FROM jobs
WHERE customer_name IS NOT NULL
ORDER BY tenant_id, customer_name, created_at DESC
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) FOR CUSTOMERS
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read customers in their own tenant
CREATE POLICY "customers: read own tenant"
  ON customers FOR SELECT
  USING (tenant_id = auth_tenant_id());

-- Front desk and Admin can insert customers for their own tenant
CREATE POLICY "customers: front_desk/admin insert"
  ON customers FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk', 'admin')
  );

-- Front desk and Admin can update customers for their own tenant
CREATE POLICY "customers: front_desk/admin update"
  ON customers FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk', 'admin')
  );
