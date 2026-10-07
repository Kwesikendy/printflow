-- ============================================================
-- PrintFlow — 013_manual_reset_and_payments.sql
-- 1. Adds manual start_new_day function
-- 2. Modifies record_payment to allow payments for forwarded jobs
-- ============================================================

ALTER TABLE job_sequences ADD COLUMN IF NOT EXISTS last_reset_time timestamptz NOT NULL DEFAULT (current_date::timestamptz);
ALTER TABLE job_sequences DROP COLUMN IF EXISTS last_reset_date;

-- Ensure that if it was accidentally set to now(), we roll it back to the start of today
-- so that jobs created earlier today aren't hidden from the UI.
UPDATE job_sequences SET last_reset_time = current_date::timestamptz;

CREATE OR REPLACE FUNCTION start_new_day()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_tenant_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk','admin') THEN
    RAISE EXCEPTION 'Only front_desk or admin can start a new day';
  END IF;

  INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
    VALUES (v_tenant_id, 0, 0, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_job = 0, last_inv = 0, last_reset_time = now();
END;
$$;
GRANT EXECUTE ON FUNCTION start_new_day() TO authenticated;


CREATE OR REPLACE FUNCTION get_next_job_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
    VALUES (p_tenant_id, 1, 0, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_job = job_sequences.last_job + 1
  RETURNING last_job INTO v_next;

  RETURN 'PF-' || lpad(v_next::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
    VALUES (p_tenant_id, 0, 1, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_inv = job_sequences.last_inv + 1
  RETURNING last_inv INTO v_next;

  RETURN 'INV-' || lpad(v_next::text, 5, '0');
END;
$$;


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
  SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk','admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to record payment';
  END IF;

  SELECT i.job_id INTO v_job_id
    FROM invoices i
    WHERE i.id = p_invoice_id
      AND i.tenant_id = v_tenant_id
      AND i.status = 'unpaid'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found, already paid, or access denied';
  END IF;

  SELECT status INTO v_job_status FROM jobs
    WHERE id = v_job_id AND tenant_id = v_tenant_id
    FOR UPDATE;

  -- Allow payment anytime invoice is unpaid! No strict job_status block anymore.

  INSERT INTO payments(tenant_id, invoice_id, job_id, amount, method, reference, notes, recorded_by)
    VALUES (v_tenant_id, p_invoice_id, v_job_id, p_amount, p_method, p_reference, p_notes, v_caller_id)
  RETURNING id INTO v_payment_id;

  UPDATE invoices SET status = 'paid' WHERE id = p_invoice_id;

  -- Only transition job to paid_released if it was still awaiting_payment
  IF v_job_status = 'awaiting_payment' THEN
    UPDATE jobs
      SET status = 'paid_released', updated_at = now()
      WHERE id = v_job_id;

    INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
      VALUES (v_tenant_id, v_job_id, 'awaiting_payment', 'paid_released', v_caller_id,
              'Payment recorded: ' || p_method || COALESCE(' ref: ' || p_reference, ''));
  END IF;

  RETURN v_payment_id;
END;
$$;
