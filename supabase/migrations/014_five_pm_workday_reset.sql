-- ============================================================
-- PrintFlow — 014_five_pm_workday_reset.sql
-- 1. Automates workday reset at 5:00 PM (17:00 GMT/Africa/Accra)
-- 2. get_next_job_number and get_next_invoice_number automatically
--    detect 5:00 PM boundary and reset last_job/last_inv back to 1.
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_workday_start()
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN extract(hour from timezone('Africa/Accra', now())) >= 17 THEN
      timezone('Africa/Accra', date_trunc('day', timezone('Africa/Accra', now())) + interval '17 hours')
    ELSE
      timezone('Africa/Accra', date_trunc('day', timezone('Africa/Accra', now())) - interval '1 day' + interval '17 hours')
  END;
$$;
GRANT EXECUTE ON FUNCTION get_current_workday_start() TO authenticated;

CREATE OR REPLACE FUNCTION get_next_job_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
  v_workday_start timestamptz;
  v_seq record;
BEGIN
  -- Determine current 5:00 PM workday cycle start
  SELECT get_current_workday_start() INTO v_workday_start;

  -- Lock and read sequence row for this tenant
  SELECT last_job, last_inv, last_reset_time INTO v_seq
    FROM job_sequences
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
      VALUES (p_tenant_id, 1, 0, v_workday_start)
    RETURNING last_job INTO v_next;
  ELSIF v_seq.last_reset_time < v_workday_start THEN
    -- A new 5:00 PM workday has started! Automatically reset to 1
    UPDATE job_sequences
      SET last_job = 1,
          last_inv = 0,
          last_reset_time = v_workday_start
      WHERE tenant_id = p_tenant_id
      RETURNING last_job INTO v_next;
  ELSE
    -- Same workday cycle, increment
    UPDATE job_sequences
      SET last_job = job_sequences.last_job + 1
      WHERE tenant_id = p_tenant_id
      RETURNING last_job INTO v_next;
  END IF;

  RETURN 'PF-' || lpad(v_next::text, 5, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION get_next_job_number(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next integer;
  v_workday_start timestamptz;
  v_seq record;
BEGIN
  -- Determine current 5:00 PM workday cycle start
  SELECT get_current_workday_start() INTO v_workday_start;

  -- Lock and read sequence row for this tenant
  SELECT last_job, last_inv, last_reset_time INTO v_seq
    FROM job_sequences
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO job_sequences(tenant_id, last_job, last_inv, last_reset_time)
      VALUES (p_tenant_id, 0, 1, v_workday_start)
    RETURNING last_inv INTO v_next;
  ELSIF v_seq.last_reset_time < v_workday_start THEN
    -- A new 5:00 PM workday has started! Automatically reset to 1
    UPDATE job_sequences
      SET last_job = 0,
          last_inv = 1,
          last_reset_time = v_workday_start
      WHERE tenant_id = p_tenant_id
      RETURNING last_inv INTO v_next;
  ELSE
    -- Same workday cycle, increment
    UPDATE job_sequences
      SET last_inv = job_sequences.last_inv + 1
      WHERE tenant_id = p_tenant_id
      RETURNING last_inv INTO v_next;
  END IF;

  RETURN 'INV-' || lpad(v_next::text, 5, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION get_next_invoice_number(uuid) TO authenticated;
