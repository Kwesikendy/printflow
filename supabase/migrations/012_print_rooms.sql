-- ============================================================
-- PrintFlow -- 012_print_rooms.sql
-- Adds print_room column to jobs (room_1 | room_2 | null)
-- and updates create_job_group RPC to accept print_room
-- ============================================================

-- Add print_room column to jobs (nullable — old jobs won't have one)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS print_room text
  CHECK (print_room IS NULL OR print_room IN ('room_1', 'room_2'));

-- ============================================================
-- UPDATE create_job_group to accept print_room per item
-- Each item in p_items may now include "print_room": "room_1" | "room_2"
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
  v_print_room      text;
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

    -- Validate print_room value if provided
    v_print_room := v_item->>'print_room';
    IF v_print_room IS NOT NULL AND v_print_room NOT IN ('room_1', 'room_2') THEN
      RAISE EXCEPTION 'print_room must be room_1 or room_2';
    END IF;

    v_area       := (v_item->>'width')::numeric * (v_item->>'height')::numeric;
    v_line_total := ROUND(v_area * (v_item->>'unit_cost')::numeric * (v_item->>'quantity')::integer, 2);
    v_grand_total := v_grand_total + v_line_total;
    v_job_number := get_next_job_number(v_tenant_id);

    INSERT INTO jobs(
      tenant_id, group_id, job_number, source, customer_name, customer_phone,
      product_type_id, width, height, area, quantity,
      unit_cost_applied, line_total, notes, artwork_url,
      dimension_unit, print_room, status, created_by
    ) VALUES (
      v_tenant_id, v_group_id, v_job_number, p_source, p_customer_name, p_customer_phone,
      (v_item->>'product_type_id')::uuid,
      (v_item->>'width')::numeric, (v_item->>'height')::numeric,
      v_area, (v_item->>'quantity')::integer,
      (v_item->>'unit_cost')::numeric, v_line_total,
      v_item->>'notes', v_item->>'artwork_url',
      COALESCE(v_item->>'dimension_unit', 'cm'),
      v_print_room,
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

-- Index for analytics: filter jobs by print room
CREATE INDEX IF NOT EXISTS idx_jobs_print_room ON jobs(tenant_id, print_room);
