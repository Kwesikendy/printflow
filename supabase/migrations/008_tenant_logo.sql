-- ============================================================
-- PrintFlow -- 008_tenant_logo.sql
-- Adds logo_url to tenants for custom branding
-- ============================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url text;
