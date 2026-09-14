-- ============================================================
-- PrintFlow -- 009_allow_manual_release.sql
-- Updates transition_job_status to allow manual transitions 
-- from awaiting_payment to paid_released by front_desk/admin.
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

    -- awaiting_payment → paid_released (front_desk, admin) - allow manual override
    WHEN v_job_status = 'awaiting_payment' AND p_to_status = 'paid_released'
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
