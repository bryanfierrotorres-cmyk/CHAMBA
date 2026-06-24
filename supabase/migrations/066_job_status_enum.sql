-- CHAMBA 066 — Agregar pending_bidding y counter_offered al enum job_status
SET statement_timeout = '120s';

-- Agregar valores al ENUM si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'job_status' AND e.enumlabel = 'pending_bidding') THEN
    ALTER TYPE job_status ADD VALUE 'pending_bidding';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'job_status' AND e.enumlabel = 'counter_offered') THEN
    ALTER TYPE job_status ADD VALUE 'counter_offered';
  END IF;
END $$;
