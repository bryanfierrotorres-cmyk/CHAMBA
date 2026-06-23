-- Reseñas de trabajadores (admin + cliente)

CREATE TABLE IF NOT EXISTS worker_reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_role  TEXT        NOT NULL CHECK (reviewer_role IN ('admin', 'client')),
  rating         INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT        NOT NULL CHECK (char_length(trim(comment)) >= 3),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS worker_reviews_worker_idx ON worker_reviews(worker_id);
CREATE INDEX IF NOT EXISTS worker_reviews_reviewer_idx ON worker_reviews(reviewer_id);

-- Actualizar promedio en worker_profiles
CREATE OR REPLACE FUNCTION fn_refresh_worker_rating(p_worker UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
  v_cnt INTEGER;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)::int
    INTO v_avg, v_cnt
    FROM worker_reviews
   WHERE worker_id = p_worker;

  UPDATE worker_profiles
     SET rating_avg    = v_avg,
         total_reviews = COALESCE(v_cnt, 0),
         updated_at    = NOW()
   WHERE worker_id = p_worker;

  IF NOT FOUND THEN
    INSERT INTO worker_profiles (worker_id, skills, total_reviews, availability_status)
    VALUES (p_worker, '{}', COALESCE(v_cnt, 0), 'offline')
    ON CONFLICT (worker_id) DO UPDATE
      SET rating_avg = v_avg, total_reviews = COALESCE(v_cnt, 0), updated_at = NOW();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_worker_reviews_refresh_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM fn_refresh_worker_rating(COALESCE(NEW.worker_id, OLD.worker_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_reviews_rating ON worker_reviews;
CREATE TRIGGER trg_worker_reviews_rating
  AFTER INSERT OR UPDATE OR DELETE ON worker_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_worker_reviews_refresh_rating();

-- RPC: enviar o actualizar reseña
CREATE OR REPLACE FUNCTION submit_worker_review(
  p_worker_id     UUID,
  p_reviewer_id   UUID,
  p_reviewer_role TEXT,
  p_rating        INTEGER,
  p_comment       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row worker_reviews%ROWTYPE;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La calificación debe ser entre 1 y 5');
  END IF;
  IF char_length(trim(p_comment)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El comentario debe tener al menos 3 caracteres');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_worker_id AND role = 'worker') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajador no encontrado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_reviewer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil del revisor no encontrado');
  END IF;
  IF p_reviewer_role NOT IN ('admin', 'client') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rol de revisor inválido');
  END IF;

  INSERT INTO worker_reviews (worker_id, reviewer_id, reviewer_role, rating, comment)
  VALUES (p_worker_id, p_reviewer_id, p_reviewer_role, p_rating, trim(p_comment))
  ON CONFLICT (worker_id, reviewer_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        reviewer_role = EXCLUDED.reviewer_role,
        updated_at = NOW()
  RETURNING * INTO v_row;

  PERFORM fn_refresh_worker_rating(p_worker_id);

  RETURN jsonb_build_object('success', true, 'review', to_jsonb(v_row));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_worker_review(UUID, UUID, TEXT, INTEGER, TEXT) TO anon, authenticated;

-- RPC: listar reseñas con nombre del revisor
CREATE OR REPLACE FUNCTION get_worker_reviews(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'worker_id', r.worker_id,
        'reviewer_id', r.reviewer_id,
        'reviewer_role', r.reviewer_role,
        'rating', r.rating,
        'comment', r.comment,
        'created_at', r.created_at,
        'updated_at', r.updated_at,
        'reviewer', jsonb_build_object(
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM worker_reviews r
  JOIN profiles p ON p.id = r.reviewer_id
  WHERE r.worker_id = p_worker_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_worker_reviews(UUID) TO anon, authenticated;

ALTER TABLE worker_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews: public read" ON worker_reviews;
CREATE POLICY "reviews: public read"
  ON worker_reviews FOR SELECT
  USING (true);
