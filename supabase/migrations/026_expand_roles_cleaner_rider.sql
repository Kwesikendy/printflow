-- ============================================================
-- PrintFlow — 026_expand_roles_cleaner_rider.sql
-- Expand profiles.role check constraint to allow 'cleaner' and 'rider'
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('front_desk', 'printer', 'accountant', 'admin', 'cleaner', 'rider'));
