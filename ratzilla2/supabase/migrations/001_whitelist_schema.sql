-- Blackwater Labs whitelist management schema
-- Run via Supabase CLI: supabase db push

CREATE TYPE wallet_status AS ENUM (
  'unconfirmed',
  'confirmed',
  'needs_review',
  'removed'
);

CREATE TYPE confirmation_method AS ENUM (
  'manual_check',
  'wallet_signature',
  'admin'
);

CREATE TABLE admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  original_filename TEXT,
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  invalid_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE whitelist_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  wallet_address_normalised TEXT NOT NULL UNIQUE,
  status wallet_status NOT NULL DEFAULT 'unconfirmed',
  is_active BOOLEAN NOT NULL DEFAULT true,
  wl_spots INT NOT NULL DEFAULT 1 CHECK (wl_spots > 0),
  source TEXT,
  import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  internal_notes TEXT,
  confirmation_method confirmation_method,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  wallet_id UUID REFERENCES whitelist_wallets(id) ON DELETE SET NULL,
  wallet_address_snapshot TEXT,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rate_limit_entries (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX idx_whitelist_wallets_normalised ON whitelist_wallets(wallet_address_normalised);
CREATE INDEX idx_whitelist_wallets_status ON whitelist_wallets(status);
CREATE INDEX idx_whitelist_wallets_is_active ON whitelist_wallets(is_active);
CREATE INDEX idx_whitelist_wallets_confirmed_at ON whitelist_wallets(confirmed_at DESC NULLS LAST);
CREATE INDEX idx_whitelist_wallets_import_batch ON whitelist_wallets(import_batch_id);
CREATE INDEX idx_whitelist_wallets_created_at ON whitelist_wallets(created_at DESC);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX idx_audit_events_wallet_id ON audit_events(wallet_id);
CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);

CREATE OR REPLACE FUNCTION update_whitelist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER whitelist_wallets_updated_at
  BEFORE UPDATE ON whitelist_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_whitelist_updated_at();

CREATE OR REPLACE FUNCTION is_whitelist_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
$$;

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_profiles_select_self
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_whitelist_admin());

CREATE POLICY admin_profiles_admin_all
  ON admin_profiles FOR ALL
  TO authenticated
  USING (is_whitelist_admin())
  WITH CHECK (is_whitelist_admin());

CREATE POLICY import_batches_admin_all
  ON import_batches FOR ALL
  TO authenticated
  USING (is_whitelist_admin())
  WITH CHECK (is_whitelist_admin());

CREATE POLICY whitelist_wallets_admin_all
  ON whitelist_wallets FOR ALL
  TO authenticated
  USING (is_whitelist_admin())
  WITH CHECK (is_whitelist_admin());

CREATE POLICY audit_events_admin_all
  ON audit_events FOR ALL
  TO authenticated
  USING (is_whitelist_admin())
  WITH CHECK (is_whitelist_admin());

CREATE POLICY rate_limit_service_role
  ON rate_limit_entries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket_key TEXT,
  p_window_seconds INT,
  p_max_requests INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO rate_limit_entries (bucket_key, window_start, request_count)
  VALUES (p_bucket_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET request_count = rate_limit_entries.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public_lookup_wallet(p_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalised TEXT;
  v_row whitelist_wallets%ROWTYPE;
BEGIN
  v_normalised := lower(trim(p_address));

  IF v_normalised = '' OR v_normalised !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_address');
  END IF;

  SELECT *
  INTO v_row
  FROM whitelist_wallets
  WHERE wallet_address_normalised = v_normalised
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF NOT v_row.is_active OR v_row.status = 'removed' THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'found',
    'wallet_address', v_row.wallet_address,
    'status', v_row.status,
    'confirmed', v_row.status = 'confirmed',
    'wl_spots', v_row.wl_spots
  );
END;
$$;

REVOKE ALL ON FUNCTION public_lookup_wallet(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_lookup_wallet(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public_confirm_wallet(p_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalised TEXT;
  v_row whitelist_wallets%ROWTYPE;
BEGIN
  v_normalised := lower(trim(p_address));

  IF v_normalised = '' OR v_normalised !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_address');
  END IF;

  SELECT *
  INTO v_row
  FROM whitelist_wallets
  WHERE wallet_address_normalised = v_normalised
  LIMIT 1;

  IF NOT FOUND OR NOT v_row.is_active OR v_row.status = 'removed' THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF v_row.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_confirmed',
      'wallet_address', v_row.wallet_address,
      'confirmed_at', v_row.confirmed_at
    );
  END IF;

  UPDATE whitelist_wallets
  SET
    status = 'confirmed',
    confirmation_method = 'manual_check',
    confirmed_at = now(),
    updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  INSERT INTO audit_events (
    event_type,
    wallet_id,
    wallet_address_snapshot,
    event_source,
    metadata
  ) VALUES (
    'wallet_confirmed_public',
    v_row.id,
    v_row.wallet_address,
    'public',
    jsonb_build_object('confirmation_method', 'manual_check')
  );

  RETURN jsonb_build_object(
    'outcome', 'confirmed',
    'wallet_address', v_row.wallet_address,
    'confirmed_at', v_row.confirmed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public_confirm_wallet(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_confirm_wallet(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_active INT;
  v_confirmed INT;
  v_unconfirmed INT;
  v_needs_review INT;
  v_removed INT;
  v_manual INT;
  v_recent_confirmed INT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total_active
  FROM whitelist_wallets
  WHERE is_active = true AND status != 'removed';

  SELECT count(*) INTO v_confirmed
  FROM whitelist_wallets
  WHERE is_active = true AND status = 'confirmed';

  SELECT count(*) INTO v_unconfirmed
  FROM whitelist_wallets
  WHERE is_active = true AND status = 'unconfirmed';

  SELECT count(*) INTO v_needs_review
  FROM whitelist_wallets
  WHERE is_active = true AND status = 'needs_review';

  SELECT count(*) INTO v_removed
  FROM whitelist_wallets
  WHERE status = 'removed' OR is_active = false;

  SELECT count(*) INTO v_manual
  FROM whitelist_wallets
  WHERE source = 'manual';

  SELECT count(*) INTO v_recent_confirmed
  FROM whitelist_wallets
  WHERE status = 'confirmed'
    AND confirmed_at >= now() - interval '7 days';

  RETURN jsonb_build_object(
    'total_active', v_total_active,
    'confirmed', v_confirmed,
    'unconfirmed', v_unconfirmed,
    'needs_review', v_needs_review,
    'removed', v_removed,
    'manual', v_manual,
    'recent_confirmed', v_recent_confirmed,
    'confirmation_progress',
      CASE WHEN v_total_active > 0
        THEN round((v_confirmed::numeric / v_total_active) * 100, 1)
        ELSE 0
      END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION log_admin_audit(
  p_event_type TEXT,
  p_wallet_id UUID,
  p_wallet_address TEXT,
  p_event_source TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO audit_events (
    event_type,
    wallet_id,
    wallet_address_snapshot,
    admin_user_id,
    event_source,
    metadata
  ) VALUES (
    p_event_type,
    p_wallet_id,
    p_wallet_address,
    auth.uid(),
    p_event_source,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_admin_audit(TEXT, UUID, TEXT, TEXT, JSONB) TO authenticated;
