CREATE TABLE IF NOT EXISTS invoice_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  old_total DECIMAL(12,2) NOT NULL,
  new_total DECIMAL(12,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoice_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for invoice_edits" ON invoice_edits 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
