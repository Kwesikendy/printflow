-- ============================================================
-- PrintFlow -- 007_partial_payments.sql
-- Adds partial invoice status and updates record_payment
-- to support partial payments with balance tracking
-- ============================================================

-- invoice_status is a plain text CHECK constraint (not an enum)
-- Drop the old constraint and replace it with one that includes 'partial'
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('unpaid', 'partial', 'paid'));

-- ============================================================
-- UPDATED record_payment RPC
-- Supports partial payments; only marks invoice 'paid' when
-- the sum of all payments >= invoice total
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
  v_caller_id     uuid := auth.uid();
  v_tenant_id     uuid;
  v_caller_role   text;
  v_job_id        uuid;
  v_group_id      uuid;
  v_invoice_total numeric;
  v_inv_status    text;
  v_payment_id    uuid;
  v_total_paid    numeric;
BEGIN
  SELECT p.tenant_id, p.role
    INTO v_tenant_id, v_caller_role
    FROM profiles p WHERE p.id = v_caller_id;

  IF v_caller_role NOT IN ('front_desk','admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to record payment';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- Fetch invoice (allow unpaid OR partial)
  SELECT i.job_id, i.group_id, i.total, i.status
    INTO v_job_id, v_group_id, v_invoice_total, v_inv_status
    FROM invoices i
    WHERE i.id = p_invoice_id
      AND i.tenant_id = v_tenant_id
      AND i.status IN ('unpaid','partial')
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found, already paid, or access denied';
  END IF;

  -- Check amount does not exceed remaining balance
  IF p_amount > (v_invoice_total - COALESCE((
      SELECT SUM(amount) FROM payments WHERE invoice_id = p_invoice_id
    ), 0)) THEN
    RAISE EXCEPTION 'Payment amount exceeds remaining balance';
  END IF;

  -- Insert payment
  INSERT INTO payments(tenant_id, invoice_id, job_id, amount, method, reference, notes, recorded_by)
    VALUES (v_tenant_id, p_invoice_id, v_job_id, p_amount, p_method, p_reference, p_notes, v_caller_id)
  RETURNING id INTO v_payment_id;

  -- Recalculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments WHERE invoice_id = p_invoice_id;

  IF v_total_paid >= v_invoice_total THEN
    -- Fully paid
    UPDATE invoices SET status = 'paid' WHERE id = p_invoice_id;

    -- Transition all jobs in this group to paid_released
    IF v_group_id IS NOT NULL THEN
      UPDATE jobs SET status = 'paid_released', updated_at = now()
        WHERE group_id = v_group_id AND status = 'awaiting_payment' AND tenant_id = v_tenant_id;

      INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
        SELECT v_tenant_id, id, 'awaiting_payment', 'paid_released', v_caller_id,
               'Full payment recorded: ' || p_method || COALESCE(' ref: ' || p_reference, '')
        FROM jobs WHERE group_id = v_group_id AND tenant_id = v_tenant_id;

    ELSIF v_job_id IS NOT NULL THEN
      UPDATE jobs SET status = 'paid_released', updated_at = now()
        WHERE id = v_job_id AND tenant_id = v_tenant_id;

      INSERT INTO job_status_events(tenant_id, job_id, from_status, to_status, actor_id, notes)
        VALUES (v_tenant_id, v_job_id, 'awaiting_payment', 'paid_released', v_caller_id,
                'Full payment recorded: ' || p_method || COALESCE(' ref: ' || p_reference, ''));
    END IF;

  ELSE
    -- Partial payment
    UPDATE invoices SET status = 'partial' WHERE id = p_invoice_id;
  END IF;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_payment(uuid, numeric, text, text, text) TO authenticated;
