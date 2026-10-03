-- ============================================================
-- PrintFlow -- 013_profile_print_room.sql
-- Adds print_room column to profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS print_room text
  CHECK (print_room IS NULL OR print_room IN ('room_1', 'room_2'));
