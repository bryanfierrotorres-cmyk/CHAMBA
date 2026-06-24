-- CHAMBA 063 — Seed Trust Ecosystem Data
SET statement_timeout = '120s';

DO $$
DECLARE
  v_client_id UUID := gen_random_uuid();
  v_client2_id UUID := gen_random_uuid();
  v_worker_id UUID := gen_random_uuid();
  v_job1_id UUID := gen_random_uuid();
  v_job2_id UUID := gen_random_uuid();
  v_job3_id UUID := gen_random_uuid();
  v_assignment1_id UUID := gen_random_uuid();
  v_assignment2_id UUID := gen_random_uuid();
  v_assignment3_id UUID := gen_random_uuid();
BEGIN
  -- 1. Create Profiles
  INSERT INTO profiles (id, full_name, phone, role)
  VALUES (v_client_id, 'Cliente Prueba 123', '12340001', 'client');

  INSERT INTO profiles (id, full_name, phone, role)
  VALUES (v_client2_id, 'Cliente Prueba 456', '12340003', 'client');

  INSERT INTO profiles (id, full_name, phone, role, is_approved, avatar_url)
  VALUES (v_worker_id, 'Técnico Prueba 123', '12340002', 'worker', true, 'https://i.pravatar.cc/300?img=11');

  -- 2. Create Worker Profile (Sello Chamba y Disponibilidad)
  INSERT INTO worker_profiles (worker_id, id_verified, last_location_at, availability_status, rating_avg, total_reviews, total_jobs_done)
  VALUES (v_worker_id, true, NOW(), 'available', 0, 0, 0);

  -- 3. Create Jobs
  INSERT INTO jobs (id, title, description, category, status, operational_phase, pay_amount, created_by, assigned_worker_id)
  VALUES (v_job1_id, 'Trabajo Completo 1', 'Reparación 1', 'limpieza', 'completed', 'completed', 500, v_client_id, v_worker_id);

  INSERT INTO jobs (id, title, description, category, status, operational_phase, pay_amount, created_by, assigned_worker_id)
  VALUES (v_job2_id, 'Trabajo Completo 2', 'Reparación 2', 'limpieza', 'completed', 'completed', 600, v_client_id, v_worker_id);

  INSERT INTO jobs (id, title, description, category, status, operational_phase, pay_amount, created_by, assigned_worker_id)
  VALUES (v_job3_id, 'Trabajo Completo 3', 'Reparación 3', 'limpieza', 'completed', 'completed', 700, v_client_id, v_worker_id);

  -- 4. Create Job Assignments
  INSERT INTO job_assignments (id, job_id, worker_id, selection_status, completed_at)
  VALUES (v_assignment1_id, v_job1_id, v_worker_id, 'approved', NOW());

  INSERT INTO job_assignments (id, job_id, worker_id, selection_status, completed_at)
  VALUES (v_assignment2_id, v_job2_id, v_worker_id, 'approved', NOW());

  INSERT INTO job_assignments (id, job_id, worker_id, selection_status, completed_at)
  VALUES (v_assignment3_id, v_job3_id, v_worker_id, 'approved', NOW());

  -- 5. Create Reviews
  INSERT INTO worker_reviews (worker_id, reviewer_id, reviewer_role, rating, comment)
  VALUES (v_worker_id, v_client_id, 'client', 5, '¡Excelente trabajo! Muy puntual y profesional. Totalmente recomendado.');

  INSERT INTO worker_reviews (worker_id, reviewer_id, reviewer_role, rating, comment)
  VALUES (v_worker_id, v_client2_id, 'client', 4, 'Buen trabajo, pero llegó 10 minutos tarde. De todos modos lo volvería a contratar.');

  -- Logging the worker ID for the user to use
  RAISE NOTICE 'SEED COMPLETED! TEST WORKER ID: %', v_worker_id;
END$$;
