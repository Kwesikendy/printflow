-- ============================================================
-- PrintFlow -- 006_job_groups.sql
-- Adds job_groups (multi-line-item orders), dimension_unit,
-- and the create_job_group RPC
-- ============================================================

-- Add dimension_unit to jobs (stores the unit the front desk used)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dimension_unit text NOT NULL DEFAULT 'cm';

-- Job groups table -- one "customer visit" can have multiple jobs
CREATE TABLE IF NOT EXISTS job_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  source        text NOT NULL DEFAULT 'walk_in',
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES job_groups(id) ON DELETE SET NULL;

-- Add group_id to invoices so a group invoice can cover multiple jobs
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES job_groups(id) ON DELETE SET NULL;
-- job_id on invoices becomes nullable (group invoices have no single job_id)
ALTER TABLE invoices ALTER COLUMN job_id DROP NOT NULL;

-- RLS for job_groups
ALTER TABLE job_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON job_groups
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- CREATE JOB GROUP RPC
-- Accepts a JSONB array of job items, creates group + all
-- jobs + one combined invoice atomically
-- ============================================================
CREATE OR REPLACE FUNCTION create_job_group(
  p_customer_name  text,
  p_customer_phone text,
  p_source         text,
  p_items          jsonb
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_tenant_id       uuid;
  v_caller_role     text;
  v_group_id        uuid;
  v_invoice_number  text;
  v_invoice_id      uuid;
  v_grand_total     numeric(12,2) := 0;
  v_item            jsonb;
  v_job_id          uuid;
  v_job_number      text;
  v_area            numeric;
  v_line_total      numeric(12,2);
  v_result_jobs     jsonb := '[]'::jsonb;
BEGIN
  SELECT p.tenant_id, p.role
    INTO v_tenant_id, v_caller_role
    FROM profiles p WHERE p.id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk', 'admin') THEN
    RAISE EXCEPTION 'Only front_desk or admin can create jobs';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one job item is required';
  END IF;

  INSERT INTO job_groups(tenant_id, customer_name, customer_phone, source, created_by)
    VALUES (v_tenant_id, p_customer_name, p_customer_phone, p_source, v_caller_id)
  RETURNING id INTO v_group_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'unit_cost')::numeric <= 0 THEN
      RAISE EXCEPTION 'Unit cost must be greater than 0';
    END IF;

    v_area       := (v_item->>'width')::numeric * (v_item->>'height')::numeric;
    v_line_total := ROUND(v_area * (v_item->>'unit_cost')::numeric * (v_item->>'quantity')::integer, 2);
    v_grand_total := v_grand_total + v_line_total;
    v_job_number := get_next_job_number(v_tenant_id);

    INSERT INTO jobs(
      tenant_id, group_id, job_number, source, customer_name, customer_phone,
      product_type_id, width, height, area, quantity,
      unit_cost_applied, line_total, notes, artwork_url,
      dimension_unit, status, created_by
    ) VALUES (
      v_tenant_id, v_group_id, v_job_number, p_source, p_customer_name, p_customer_phone,
      (v_item->>'product_type_id')::uuid,
      (v_item->>'width')::numeric, (v_item->>'height')::numeric,
      v_area, (v_item->>'quantity')::integer,
      (v_item->>'unit_cost')::numeric, v_line_total,
      v_item->>'notes', v_item->>'artwork_url',
      COALESCE(v_item->>'dimension_unit', 'cm'),
      'awaiting_payment', v_caller_id
    ) RETURNING id INTO v_job_id;

    INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id)
      VALUES (v_tenant_id, v_job_id, NULL, 'awaiting_payment', v_caller_id);

    v_result_jobs := v_result_jobs || jsonb_build_object(
      'job_id', v_job_id, 'job_number', v_job_number, 'line_total', v_line_total
    );
  END LOOP;

  v_invoice_number := get_next_invoice_number(v_tenant_id);
  INSERT INTO invoices(tenant_id, job_id, invoice_number, total, status, group_id)
    VALUES (v_tenant_id, NULL, v_invoice_number, v_grand_total, 'unpaid', v_group_id)
  RETURNING id INTO v_invoice_id;

  RETURN json_build_object(
    'group_id', v_group_id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'grand_total', v_grand_total,
    'jobs', v_result_jobs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_job_group(text, text, text, jsonb) TO authenticated;
