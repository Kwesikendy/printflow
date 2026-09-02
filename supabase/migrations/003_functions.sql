-- ============================================================
-- PrintFlow — 003_functions.sql
-- Database functions: sequential numbers, record_payment transaction
-- ============================================================

-- ============================================================
-- SEQUENTIAL JOB NUMBER GENERATOR
-- Atomic: no gaps, no duplicates, per-tenant
-- Returns e.g. "PF-00041"
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_job_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
BEGIN
  -- Upsert sequence row and atomically increment
  INSERT INTO job_sequences(tenant_id, last_job, last_inv)
    VALUES (p_tenant_id, 1, 0)
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_job = job_sequences.last_job + 1
  RETURNING last_job INTO v_next;

  RETURN 'PF-' || lpad(v_next::text, 5, '0');
END;
$$;

-- ============================================================
-- SEQUENTIAL INVOICE NUMBER GENERATOR
-- Returns e.g. "INV-00041"
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO job_sequences(tenant_id, last_job, last_inv)
    VALUES (p_tenant_id, 0, 1)
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_inv = job_sequences.last_inv + 1
  RETURNING last_inv INTO v_next;

  RETURN 'INV-' || lpad(v_next::text, 5, '0');
END;
$$;

-- ============================================================
-- RECORD PAYMENT (atomic transaction)
-- 1. Verify invoice is unpaid and belongs to caller's tenant
-- 2. Insert payment record
-- 3. Mark invoice as paid
-- 4. Update job status: awaiting_payment → paid_released
-- 5. Insert job_status_event
-- Returns the created payment id
-- ============================================================
CREATE OR REPLACE FUNCTION record_payment(
  p_invoice_id  uuid,
  p_amount      numeric,
  p_method      text,
  p_reference   text DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_tenant_id   uuid;
  v_caller_role text;
  v_job_id      uuid;
  v_job_status  text;
  v_payment_id  uuid;
BEGIN
  -- Get caller tenant and role
  SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  -- Only front_desk and admin can record payments
  IF v_caller_role NOT IN ('front_desk','admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to record payment';
  END IF;

  -- Fetch invoice + job (with lock)
  SELECT i.job_id INTO v_job_id
    FROM invoices i
    WHERE i.id = p_invoice_id
      AND i.tenant_id = v_tenant_id
      AND i.status = 'unpaid'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found, already paid, or access denied';
  END IF;

  -- Verify job is in awaiting_payment state
  SELECT status INTO v_job_status FROM jobs
    WHERE id = v_job_id AND tenant_id = v_tenant_id
    FOR UPDATE;

  IF v_job_status != 'awaiting_payment' THEN
    RAISE EXCEPTION 'Job must be in awaiting_payment status to record payment, current status: %', v_job_status;
  END IF;

  -- Insert payment
  INSERT INTO payments(tenant_id, invoice_id, job_id, amount, method, reference, notes, recorded_by)
    VALUES (v_tenant_id, p_invoice_id, v_job_id, p_amount, p_method, p_reference, p_notes, v_caller_id)
  RETURNING id INTO v_payment_id;

  -- Mark invoice paid
  UPDATE invoices SET status = 'paid' WHERE id = p_invoice_id;

  -- Transition job: awaiting_payment → paid_released
  UPDATE jobs
    SET status = 'paid_released', updated_at = now()
    WHERE id = v_job_id;

  -- Insert status event (immutable audit)
  INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
    VALUES (v_tenant_id, v_job_id, 'awaiting_payment', 'paid_released', v_caller_id,
            'Payment recorded: ' || p_method || COALESCE(' ref: ' || p_reference, ''));

  RETURN v_payment_id;
END;
$$;

-- ============================================================
-- TRANSITION JOB STATUS (generic, role-validated)
-- Enforces the state machine and role restrictions
-- ============================================================
CREATE OR REPLACE FUNCTION transition_job_status(
  p_job_id    uuid,
  p_to_status text,
  p_notes     text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_tenant_id   uuid;
  v_caller_role text;
  v_job_status  text;
  v_allowed     boolean := false;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  -- Lock and fetch current job status
  SELECT status INTO v_job_status
    FROM jobs
    WHERE id = p_job_id AND tenant_id = v_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or access denied';
  END IF;

  -- Validate transition based on state machine + roles
  CASE
    -- draft → quoted (front_desk, admin)
    WHEN v_job_status = 'draft' AND p_to_status = 'quoted'
      AND v_caller_role IN ('front_desk','admin') THEN v_allowed := true;

    -- quoted → awaiting_payment (front_desk, admin)
    WHEN v_job_status = 'quoted' AND p_to_status = 'awaiting_payment'
      AND v_caller_role IN ('front_desk','admin') THEN v_allowed := true;

    -- paid_released → in_production (printer, admin)
    WHEN v_job_status = 'paid_released' AND p_to_status = 'in_production'
      AND v_caller_role IN ('printer','admin') THEN v_allowed := true;

    -- in_production → completed (printer, admin)
    WHEN v_job_status = 'in_production' AND p_to_status = 'completed'
      AND v_caller_role IN ('printer','admin') THEN v_allowed := true;

    -- completed → picked_up (front_desk, admin)
    WHEN v_job_status = 'completed' AND p_to_status = 'picked_up'
      AND v_caller_role IN ('front_desk','admin') THEN v_allowed := true;

    -- Any pre-paid status → cancelled (front_desk, admin)
    WHEN p_to_status = 'cancelled'
      AND v_job_status IN ('draft','quoted','awaiting_payment')
      AND v_caller_role IN ('front_desk','admin') THEN v_allowed := true;

    ELSE v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition: % → % for role %',
      v_job_status, p_to_status, v_caller_role;
  END IF;

  -- Apply transition
  UPDATE jobs SET status = p_to_status, updated_at = now()
    WHERE id = p_job_id;

  -- Record event
  INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
    VALUES (v_tenant_id, p_job_id, v_job_status, p_to_status, v_caller_id, p_notes);
END;
$$;

-- ============================================================
-- CREATE JOB (atomic: job + invoice in one transaction)
-- Validates pricing, calculates totals, generates numbers
-- ============================================================
CREATE OR REPLACE FUNCTION create_job(
  p_customer_name     text,
  p_customer_phone    text,
  p_product_type_id   uuid,
  p_source            text,
  p_width             numeric,
  p_height            numeric,
  p_quantity          integer,
  p_unit_cost         numeric,
  p_notes             text DEFAULT NULL
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
    unit_cost_applied, line_total, notes, status, created_by
  ) VALUES (
    v_tenant_id, v_job_number, p_source, p_customer_name, p_customer_phone,
    p_product_type_id, p_width, p_height, v_area, p_quantity,
    p_unit_cost, v_line_total, p_notes, 'awaiting_payment', v_caller_id
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

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_next_job_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment(uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION transition_job_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_job(text, text, uuid, text, numeric, numeric, integer, text) TO authenticated;
