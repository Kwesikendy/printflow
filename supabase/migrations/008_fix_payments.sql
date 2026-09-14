-- ============================================================
-- PrintFlow -- 008_fix_payments.sql
-- Drops the NOT NULL constraint on payments.job_id to allow 
-- partial payments for job groups (which don't have a single job_id).
-- ============================================================

ALTER TABLE payments ALTER COLUMN job_id DROP NOT NULL;
