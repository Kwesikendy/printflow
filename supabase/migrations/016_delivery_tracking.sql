-- ============================================================
-- PrintFlow — 016_delivery_tracking.sql
-- Add delivery tracking fields for Courier / Rider Dispatch (Mavis)
-- ============================================================

-- 1. Add delivery fields to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'delivery')),
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_phone text,
ADD COLUMN IF NOT EXISTS delivery_rider_name text,
ADD COLUMN IF NOT EXISTS delivery_rider_phone text,
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'dispatched', 'delivered')),
ADD COLUMN IF NOT EXISTS delivery_dispatched_at timestamptz,
ADD COLUMN IF NOT EXISTS delivery_delivered_at timestamptz;

-- 2. Add delivery fields to job_groups table for multi-job orders
ALTER TABLE public.job_groups
ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'delivery')),
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_phone text;

-- 3. Create index for fast delivery queue lookup
CREATE INDEX IF NOT EXISTS idx_jobs_delivery_status ON public.jobs(status, delivery_method, delivery_status);
