-- ============================================================
-- PrintFlow — 005_artworks_and_admin.sql
-- Add artworks storage bucket and update jobs table
-- ============================================================

-- 1. Create the artworks storage bucket (public for MVP)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('artworks', 'artworks', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Add RLS policies for the artworks bucket
-- Allow anyone to read
CREATE POLICY "Public Artwork Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'artworks' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'artworks' AND auth.role() = 'authenticated' );

-- 3. Add artwork_url to jobs table
ALTER TABLE jobs ADD COLUMN artwork_url text;

-- 4. Update create_job function signature and logic to accept p_artwork_url
CREATE OR REPLACE FUNCTION create_job(
  p_customer_name     text,
  p_customer_phone    text,
  p_product_type_id   uuid,
  p_source            text,
  p_width             numeric,
  p_height            numeric,
  p_quantity          integer,
  p_unit_cost         numeric,
  p_notes             text DEFAULT NULL,
  p_artwork_url       text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_tenant_id       uuid;
  v_caller_role     text;
  v_area            numeric;
  v_line_total      numeric(12,2);
  v_job_number      text;
  v_invoice_number  text;
  v_job_id          uuid;
  v_invoice_id      uuid;
  v_area_unit       text;
BEGIN
  SELECT p.tenant_id, p.role, t.area_unit
    INTO v_tenant_id, v_caller_role, v_area_unit
    FROM profiles p JOIN tenants t ON t.id = p.tenant_id
    WHERE p.id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk','admin') THEN
    RAISE EXCEPTION 'Only front_desk or admin can create jobs';
  END IF;

  IF p_unit_cost <= 0 THEN
    RAISE EXCEPTION 'Unit cost must be greater than 0';
  END IF;

  -- Calculate area and total
  v_area := p_width * p_height;
  v_line_total := ROUND(v_area * p_unit_cost * p_quantity, 2);

  -- Generate sequential numbers
  v_job_number     := get_next_job_number(v_tenant_id);
  v_invoice_number := get_next_invoice_number(v_tenant_id);

  -- Insert job
  INSERT INTO jobs(
    tenant_id, job_number, source, customer_name, customer_phone,
    product_type_id, width, height, area, quantity,
    unit_cost_applied, line_total, notes, artwork_url, status, created_by
  ) VALUES (
    v_tenant_id, v_job_number, p_source, p_customer_name, p_customer_phone,
    p_product_type_id, p_width, p_height, v_area, p_quantity,
    p_unit_cost, v_line_total, p_notes, p_artwork_url, 'awaiting_payment', v_caller_id
  ) RETURNING id INTO v_job_id;

  -- Insert initial status event
  INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id)
    VALUES (v_tenant_id, v_job_id, NULL, 'awaiting_payment', v_caller_id);

  -- Insert invoice
  INSERT INTO invoices(tenant_id, job_id, invoice_number, total, status)
    VALUES (v_tenant_id, v_job_id, v_invoice_number, v_line_total, 'unpaid')
  RETURNING id INTO v_invoice_id;

  RETURN json_build_object(
    'job_id', v_job_id,
    'job_number', v_job_number,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'area', v_area,
    'unit_cost_applied', p_unit_cost,
    'line_total', v_line_total
  );
END;
$$;

-- Note: We do NOT need to drop the old signature if we rely on overloading, but to be clean:
-- DROP FUNCTION IF EXISTS create_job(text, text, uuid, text, numeric, numeric, integer, numeric, text);
-- However dropping it might break existing grants if not careful. Overloading is safer for now.
