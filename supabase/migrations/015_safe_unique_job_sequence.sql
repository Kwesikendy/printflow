-- ============================================================
-- PrintFlow — 015_safe_unique_job_sequence.sql
-- 1. Guarantees 100% collision-free job and invoice numbering
-- 2. Scans for the next unused number so duplicate key errors never happen
-- 3. Prevents start_new_day from resetting sequence counters to 0
-- ============================================================

CREATE OR REPLACE FUNCTION get_next_job_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
  v_candidate text;
  v_exists boolean;
BEGIN
  -- Read and lock the sequence row
  SELECT last_job INTO v_next
    FROM job_sequences
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
      VALUES (p_tenant_id, 0, 0, now());
    v_next := 0;
  END IF;

  -- Find the next genuinely unused job number in this tenant
  LOOP
    v_next := COALESCE(v_next, 0) + 1;
    v_candidate := 'PF-' || lpad(v_next::text, 5, '0');

    SELECT EXISTS (
      SELECT 1 FROM jobs WHERE tenant_id = p_tenant_id AND job_number = v_candidate
    ) INTO v_exists;

    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;

  UPDATE job_sequences
    SET last_job = v_next
    WHERE tenant_id = p_tenant_id;

  RETURN v_candidate;
END;
$$;
GRANT EXECUTE ON FUNCTION get_next_job_number(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
  v_candidate text;
  v_exists boolean;
BEGIN
  -- Read and lock the sequence row
  SELECT last_inv INTO v_next
    FROM job_sequences
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
      VALUES (p_tenant_id, 0, 0, now());
    v_next := 0;
  END IF;

  -- Find the next genuinely unused invoice number in this tenant
  LOOP
    v_next := COALESCE(v_next, 0) + 1;
    v_candidate := 'INV-' || lpad(v_next::text, 5, '0');

    SELECT EXISTS (
      SELECT 1 FROM invoices WHERE tenant_id = p_tenant_id AND invoice_number = v_candidate
    ) INTO v_exists;

    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;

  UPDATE job_sequences
    SET last_inv = v_next
    WHERE tenant_id = p_tenant_id;

  RETURN v_candidate;
END;
$$;
GRANT EXECUTE ON FUNCTION get_next_invoice_number(uuid) TO authenticated;

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

  -- Only advance shift start timestamp to now.
  -- Do NOT reset last_job/last_inv to 0, which causes duplicate key collisions with existing jobs.
  UPDATE job_sequences
    SET last_reset_time = now()
    WHERE tenant_id = v_tenant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION start_new_day() TO authenticated;
