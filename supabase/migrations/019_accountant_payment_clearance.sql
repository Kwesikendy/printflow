-- ============================================================
-- PrintFlow — 019_accountant_payment_clearance.sql
-- 1. Updates record_payment RPC to allow 'accountant' role
--    in addition to 'front_desk' and 'admin'.
-- 2. Updates transition_job_status RPC to allow 'accountant'
--    role to transition awaiting_payment → paid_released.
-- 3. Updates RLS policies so accountants can insert payments
--    and update invoices and jobs.
-- ============================================================

-- -------------------------------------------------------
-- 1. record_payment — allow front_desk, admin, AND accountant
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
  v_caller_id     uuid := auth.uid();
  v_tenant_id     uuid;
  v_caller_role   text;
  v_job_id        uuid;
  v_group_id      uuid;
  v_invoice_total numeric;
  v_inv_status    text;
  v_payment_id    uuid;
  v_total_paid    numeric;
  v_job_status    text;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk', 'admin', 'accountant') THEN
    RAISE EXCEPTION 'Insufficient permissions to record payment';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- Lock invoice (allow unpaid or partial)
  SELECT i.job_id, i.group_id, i.total, i.status
    INTO v_job_id, v_group_id, v_invoice_total, v_inv_status
    FROM invoices i
    WHERE i.id = p_invoice_id
      AND i.tenant_id = v_tenant_id
      AND i.status != 'paid'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found, already paid, or access denied';
  END IF;

  -- Insert payment
  INSERT INTO payments(tenant_id, invoice_id, job_id, amount, method, reference, notes, recorded_by, recorded_at)
    VALUES (v_tenant_id, p_invoice_id, v_job_id, p_amount, p_method, p_reference, p_notes, v_caller_id, now())
  RETURNING id INTO v_payment_id;

  -- Recalculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments WHERE invoice_id = p_invoice_id;

  IF v_total_paid >= v_invoice_total THEN
    -- Fully paid
    UPDATE invoices SET status = 'paid' WHERE id = p_invoice_id;

    -- Transition single job to paid_released
    IF v_job_id IS NOT NULL THEN
      SELECT status INTO v_job_status FROM jobs WHERE id = v_job_id;
      IF v_job_status = 'awaiting_payment' THEN
        UPDATE jobs SET status = 'paid_released', updated_at = now() WHERE id = v_job_id;

        INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
          VALUES (v_tenant_id, v_job_id, 'awaiting_payment', 'paid_released', v_caller_id,
                  'Payment confirmed by ' || COALESCE((SELECT full_name FROM profiles WHERE id = v_caller_id), v_caller_role) ||
                  ': ' || p_method || COALESCE(' ref: ' || p_reference, ''));
      END IF;
    END IF;

    -- Transition group jobs to paid_released
    IF v_group_id IS NOT NULL THEN
      UPDATE jobs SET status = 'paid_released', updated_at = now()
        WHERE group_id = v_group_id
          AND tenant_id = v_tenant_id
          AND status = 'awaiting_payment';

      INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
        SELECT v_tenant_id, id, 'awaiting_payment', 'paid_released', v_caller_id,
               'Group payment confirmed: ' || p_method || COALESCE(' ref: ' || p_reference, '')
        FROM jobs WHERE group_id = v_group_id AND tenant_id = v_tenant_id AND status = 'paid_released';
    END IF;
  ELSE
    -- Partial payment
    UPDATE invoices SET status = 'partial' WHERE id = p_invoice_id;
  END IF;

  RETURN v_payment_id;
END;
$$;
GRANT EXECUTE ON FUNCTION record_payment(uuid, numeric, text, text, text) TO authenticated;


-- -------------------------------------------------------
-- 2. transition_job_status — allow accountant to release awaiting_payment
-- -------------------------------------------------------
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

  SELECT status INTO v_job_status
    FROM jobs
    WHERE id = p_job_id AND tenant_id = v_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or access denied';
  END IF;

  CASE
    WHEN v_job_status = 'draft' AND p_to_status = 'quoted'
      AND v_caller_role IN ('front_desk','admin') THEN v_allowed := true;

    WHEN v_job_status = 'quoted' AND p_to_status = 'awaiting_payment'
      AND v_caller_role IN ('front_desk','admin') THEN v_allowed := true;

    -- awaiting_payment → paid_released allowed for front_desk, admin, and accountant
    WHEN v_job_status = 'awaiting_payment' AND p_to_status = 'paid_released'
      AND v_caller_role IN ('front_desk','admin','accountant') THEN v_allowed := true;

    WHEN v_job_status = 'paid_released' AND p_to_status = 'in_production'
      AND v_caller_role IN ('printer','admin') THEN v_allowed := true;

    WHEN v_job_status = 'in_production' AND p_to_status = 'completed'
      AND v_caller_role IN ('printer','admin') THEN v_allowed := true;

    WHEN v_job_status = 'completed' AND p_to_status = 'picked_up'
      AND v_caller_role IN ('front_desk','admin') THEN v_allowed := true;

    WHEN p_to_status = 'cancelled'
      AND v_job_status IN ('draft','quoted','awaiting_payment')
      AND v_caller_role IN ('front_desk','admin','accountant') THEN v_allowed := true;

    ELSE v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition: % -> % for role %', v_job_status, p_to_status, v_caller_role;
  END IF;

  UPDATE jobs
    SET status = p_to_status, updated_at = now()
    WHERE id = p_job_id;

  INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
    VALUES (v_tenant_id, p_job_id, v_job_status, p_to_status, v_caller_id, p_notes);
END;
$$;
GRANT EXECUTE ON FUNCTION transition_job_status(uuid, text, text) TO authenticated;


-- -------------------------------------------------------
-- 3. RLS Policies: Allow accountant to insert payments and update invoices/jobs
-- -------------------------------------------------------
DROP POLICY IF EXISTS "payments: front_desk/admin insert" ON payments;
DROP POLICY IF EXISTS "payments: front_desk/admin/accountant insert" ON payments;
CREATE POLICY "payments: front_desk/admin/accountant insert"
  ON payments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin','accountant')
  );

DROP POLICY IF EXISTS "invoices: front_desk/admin update" ON invoices;
DROP POLICY IF EXISTS "invoices: staff update" ON invoices;
CREATE POLICY "invoices: staff update"
  ON invoices FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin','accountant')
  );

DROP POLICY IF EXISTS "jobs: front_desk/admin update" ON jobs;
DROP POLICY IF EXISTS "jobs: staff update" ON jobs;
CREATE POLICY "jobs: staff update"
  ON jobs FOR UPDATE
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('front_desk','admin','accountant')
  );
