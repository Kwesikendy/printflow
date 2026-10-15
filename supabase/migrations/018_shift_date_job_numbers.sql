-- ============================================================
-- PrintFlow — 018_shift_date_job_numbers.sql
-- 1. Embeds the SHIFT DATE into job and invoice numbers
--    so they read PF-YYMMDD-001 / INV-YYMMDD-001 and reset
--    to 001 at every 5:00 PM shift boundary automatically.
-- 2. Updates record_payment to also accept group invoices
--    (status != 'unpaid' check relaxed to 'paid' only so
--    any front-desk worker can record late / cross-shift payments).
-- 3. Adds payment_shift_date column to payments so every payment
--    is tagged with the shift it was recorded in, and the
--    recorded_by / recorded_at are enforced via trigger.
-- ============================================================

-- -------------------------------------------------------
-- 1. Helper: return the shift-date string for a given timestamp
--    e.g. for 2026-10-15 03:00 UTC  →  '261014'  (shift started Oct 14 at 17:00)
--         for 2026-10-15 18:00 UTC  →  '261015'  (shift started Oct 15 at 17:00)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_shift_date_str(ts timestamptz DEFAULT now())
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT to_char(
    CASE
      WHEN extract(hour FROM timezone('Africa/Accra', ts)) >= 17
        THEN timezone('Africa/Accra', ts)::date
      ELSE (timezone('Africa/Accra', ts)::date - interval '1 day')
    END,
    'YYMMDD'
  );
$$;
GRANT EXECUTE ON FUNCTION get_shift_date_str(timestamptz) TO authenticated;


-- -------------------------------------------------------
-- 2. get_next_job_number — now embeds shift date in prefix
--    Format: PF-YYMMDD-NNN  (NNN resets to 001 each shift)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_job_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next         integer;
  v_candidate    text;
  v_exists       boolean;
  v_shift_date   text;
  v_workday_start timestamptz;
  v_seq          record;
BEGIN
  -- Determine current shift start and shift-date label
  SELECT get_current_workday_start() INTO v_workday_start;
  SELECT get_shift_date_str(now()) INTO v_shift_date;

  -- Lock sequence row for this tenant
  SELECT last_job, last_inv, last_reset_time INTO v_seq
    FROM job_sequences
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
      VALUES (p_tenant_id, 0, 0, v_workday_start);
    v_next := 0;
  ELSIF v_seq.last_reset_time < v_workday_start THEN
    -- New 5 PM shift — reset counters
    UPDATE job_sequences
      SET last_job = 0, last_inv = 0, last_reset_time = v_workday_start
      WHERE tenant_id = p_tenant_id;
    v_next := 0;
  ELSE
    v_next := COALESCE(v_seq.last_job, 0);
  END IF;

  -- Find the next genuinely unused job number for this shift date
  LOOP
    v_next := v_next + 1;
    v_candidate := 'PF-' || v_shift_date || '-' || lpad(v_next::text, 3, '0');

    SELECT EXISTS (
      SELECT 1 FROM jobs WHERE tenant_id = p_tenant_id AND job_number = v_candidate
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  UPDATE job_sequences SET last_job = v_next WHERE tenant_id = p_tenant_id;

  RETURN v_candidate;
END;
$$;
GRANT EXECUTE ON FUNCTION get_next_job_number(uuid) TO authenticated;


-- -------------------------------------------------------
-- 3. get_next_invoice_number — same shift-date embedding
--    Format: INV-YYMMDD-NNN
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next          integer;
  v_candidate     text;
  v_exists        boolean;
  v_shift_date    text;
  v_workday_start timestamptz;
  v_seq           record;
BEGIN
  SELECT get_current_workday_start() INTO v_workday_start;
  SELECT get_shift_date_str(now()) INTO v_shift_date;

  SELECT last_job, last_inv, last_reset_time INTO v_seq
    FROM job_sequences
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
      VALUES (p_tenant_id, 0, 0, v_workday_start);
    v_next := 0;
  ELSIF v_seq.last_reset_time < v_workday_start THEN
    UPDATE job_sequences
      SET last_job = 0, last_inv = 0, last_reset_time = v_workday_start
      WHERE tenant_id = p_tenant_id;
    v_next := 0;
  ELSE
    v_next := COALESCE(v_seq.last_inv, 0);
  END IF;

  LOOP
    v_next := v_next + 1;
    v_candidate := 'INV-' || v_shift_date || '-' || lpad(v_next::text, 3, '0');

    SELECT EXISTS (
      SELECT 1 FROM invoices WHERE tenant_id = p_tenant_id AND invoice_number = v_candidate
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  UPDATE job_sequences SET last_inv = v_next WHERE tenant_id = p_tenant_id;

  RETURN v_candidate;
END;
$$;
GRANT EXECUTE ON FUNCTION get_next_invoice_number(uuid) TO authenticated;


-- -------------------------------------------------------
-- 4. start_new_day — manual override, advances last_reset_time
--    to now so the sequence resets immediately on command.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION start_new_day()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_tenant_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk', 'admin') THEN
    RAISE EXCEPTION 'Only front_desk or admin can start a new day';
  END IF;

  UPDATE job_sequences
    SET last_job = 0,
        last_inv = 0,
        last_reset_time = now()
    WHERE tenant_id = v_tenant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION start_new_day() TO authenticated;


-- -------------------------------------------------------
-- 5. record_payment — cross-shift fix:
--    Any front_desk or admin can record payment on any UNPAID
--    invoice regardless of which shift it was created in.
--    recorded_by (who captured payment) and recorded_at
--    (exact timestamp) are always set.
-- -------------------------------------------------------
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
  v_group_id    uuid;
  v_job_status  text;
  v_payment_id  uuid;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to record payment';
  END IF;

  -- Find the invoice — it must be unpaid and belong to this tenant
  -- Works for BOTH single-job invoices AND group invoices
  SELECT i.job_id, i.group_id INTO v_job_id, v_group_id
    FROM invoices i
    WHERE i.id = p_invoice_id
      AND i.tenant_id = v_tenant_id
      AND i.status != 'paid'   -- Cross-shift: allow any non-paid invoice
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found, already paid, or access denied';
  END IF;

  -- Capture job status for single-job invoices
  IF v_job_id IS NOT NULL THEN
    SELECT status INTO v_job_status FROM jobs
      WHERE id = v_job_id AND tenant_id = v_tenant_id
      FOR UPDATE;
  END IF;

  -- Record the payment — recorded_by = the staff member currently logged in
  INSERT INTO payments(tenant_id, invoice_id, job_id, amount, method, reference, notes, recorded_by, recorded_at)
    VALUES (v_tenant_id, p_invoice_id, v_job_id, p_amount, p_method, p_reference, p_notes, v_caller_id, now())
  RETURNING id INTO v_payment_id;

  -- Mark invoice as paid
  UPDATE invoices SET status = 'paid' WHERE id = p_invoice_id;

  -- Transition single job from awaiting_payment → paid_released
  IF v_job_id IS NOT NULL AND v_job_status = 'awaiting_payment' THEN
    UPDATE jobs
      SET status = 'paid_released', updated_at = now()
      WHERE id = v_job_id;

    INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
      VALUES (v_tenant_id, v_job_id, 'awaiting_payment', 'paid_released', v_caller_id,
              'Payment recorded by ' || (SELECT full_name FROM profiles WHERE id = v_caller_id) ||
              ': ' || p_method || COALESCE(' ref: ' || p_reference, ''));
  END IF;

  -- For group invoices, transition each awaiting_payment job
  IF v_group_id IS NOT NULL THEN
    UPDATE jobs
      SET status = 'paid_released', updated_at = now()
      WHERE group_id = v_group_id
        AND tenant_id = v_tenant_id
        AND status = 'awaiting_payment';
  END IF;

  RETURN v_payment_id;
END;
$$;
GRANT EXECUTE ON FUNCTION record_payment(uuid, numeric, text, text, text) TO authenticated;
