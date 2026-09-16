-- Migration to add pickup details to the jobs table

ALTER TABLE jobs
ADD COLUMN pickup_name text,
ADD COLUMN pickup_phone text;
