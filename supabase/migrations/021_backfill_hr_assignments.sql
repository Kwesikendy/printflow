-- PrintFlow — 021_backfill_hr_assignments.sql
-- Existing profiles already have operational roles. Populate the HR assignment
-- field from those roles so they are not shown as unassigned.

UPDATE profiles
SET department = CASE
  WHEN role = 'front_desk' THEN 'Front Desk'
  WHEN role = 'printer' AND print_room = 'room_1' THEN 'Print Room 1'
  WHEN role = 'printer' AND print_room = 'room_2' THEN 'Print Room 2'
  WHEN role = 'printer' THEN 'Print Room'
  WHEN role = 'accountant' THEN 'Finance'
  WHEN role = 'admin' THEN 'Administration'
  ELSE department
END
WHERE department IS NULL OR trim(department) = '';
