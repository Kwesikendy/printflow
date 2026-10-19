-- PrintFlow — 024_fix_ssnit_employer_rate.sql
-- SSNIT's official breakdown is 5.5% employee + 13.0% employer = 18.5% total.
-- Correct any payroll settings created from the earlier provisional default.

UPDATE payroll_settings
SET ssnit_employer_rate = 13,
    updated_at = now()
WHERE ssnit_employer_rate = 13.5;
