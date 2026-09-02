-- =====================================================================
-- TAMAM — hand-written DDL appended to the generated init migration.
-- Everything Prisma cannot express: PostGIS sync triggers, GIST indexes,
-- partial unique indexes (race protection), immutability guards for the
-- financial ledger & audit log, trigram search indexes, and check constraints.
-- Applied by scripts/db/create-init-migration.sh (idempotent statements).
-- =====================================================================

-- ------------------------------------------------------------ extensions
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------ geography sync triggers
-- Keep geography columns derived from lat/lng so application code never
-- has to write WKT. Prisma creates rows with lat/lng; the DB fills location.
CREATE OR REPLACE FUNCTION tamam_sync_point_location() RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng::double precision, NEW.lat::double precision), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_point_location ON saved_places;
CREATE TRIGGER trg_sync_point_location BEFORE INSERT OR UPDATE OF lat, lng ON saved_places
  FOR EACH ROW EXECUTE FUNCTION tamam_sync_point_location();

DROP TRIGGER IF EXISTS trg_sync_point_location ON job_stops;
CREATE TRIGGER trg_sync_point_location BEFORE INSERT OR UPDATE OF lat, lng ON job_stops
  FOR EACH ROW EXECUTE FUNCTION tamam_sync_point_location();

DROP TRIGGER IF EXISTS trg_sync_point_location ON job_tracking_points;
CREATE TRIGGER trg_sync_point_location BEFORE INSERT OR UPDATE OF lat, lng ON job_tracking_points
  FOR EACH ROW EXECUTE FUNCTION tamam_sync_point_location();

DROP TRIGGER IF EXISTS trg_sync_point_location ON partner_availability;
CREATE TRIGGER trg_sync_point_location BEFORE INSERT OR UPDATE OF lat, lng ON partner_availability
  FOR EACH ROW EXECUTE FUNCTION tamam_sync_point_location();

CREATE OR REPLACE FUNCTION tamam_sync_zone_area() RETURNS trigger AS $$
DECLARE
  geom geometry;
BEGIN
  geom := ST_SetSRID(ST_GeomFromGeoJSON(NEW.polygon_geojson::text), 4326);
  IF NOT ST_IsValid(geom) THEN
    geom := ST_MakeValid(geom);
  END IF;
  IF GeometryType(geom) <> 'POLYGON' THEN
    RAISE EXCEPTION 'service_zones.polygon_geojson must be a single Polygon (got %)', GeometryType(geom);
  END IF;
  NEW.area := geom::geography;
  NEW.center_lat := ST_Y(ST_PointOnSurface(geom));
  NEW.center_lng := ST_X(ST_PointOnSurface(geom));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_zone_area ON service_zones;
CREATE TRIGGER trg_sync_zone_area BEFORE INSERT OR UPDATE OF polygon_geojson ON service_zones
  FOR EACH ROW EXECUTE FUNCTION tamam_sync_zone_area();

-- ------------------------------------------------------- spatial indexes
CREATE INDEX IF NOT EXISTS idx_partner_availability_location ON partner_availability USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_partner_availability_online_location ON partner_availability USING GIST (location) WHERE status = 'ONLINE';
CREATE INDEX IF NOT EXISTS idx_service_zones_area ON service_zones USING GIST (area);
CREATE INDEX IF NOT EXISTS idx_job_stops_location ON job_stops USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_saved_places_location ON saved_places USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_job_tracking_points_location ON job_tracking_points USING GIST (location);

-- --------------------------------------------------------- search indexes
CREATE INDEX IF NOT EXISTS idx_service_categories_search_trgm ON service_categories USING GIN ((name_ar || ' ' || name_en || ' ' || search_keywords) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_search_trgm ON service_subcategories USING GIN ((name_ar || ' ' || name_en || ' ' || search_keywords) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm ON users USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_phone_trgm ON users USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_trgm ON vehicles USING GIN (plate_normalized gin_trgm_ops);

-- ------------------------------------------ dispatch race protection (§22)
-- At most ONE accepted assignment per job, enforced by the database itself.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_assignments_one_accepted ON job_assignments (job_id) WHERE status = 'ACCEPTED';
-- A partner can hold at most one OFFERED/ACCEPTED assignment per job.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_assignments_partner_open ON job_assignments (job_id, partner_id) WHERE status IN ('OFFERED', 'ACCEPTED');

-- One review per direction per job is already unique; one active share link token is unique by hash.

-- --------------------------------------------- money & data integrity checks
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS chk_jobs_totals_non_negative;
ALTER TABLE jobs ADD CONSTRAINT chk_jobs_totals_non_negative CHECK (
  (estimated_total_minor IS NULL OR estimated_total_minor >= 0) AND
  (final_total_minor IS NULL OR final_total_minor >= 0) AND
  promo_discount_minor >= 0 AND cancellation_fee_minor >= 0
);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS chk_jobs_currency_iso;
ALTER TABLE jobs ADD CONSTRAINT chk_jobs_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS chk_ledger_entries_positive;
ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_entries_positive CHECK (amount_minor > 0);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_amounts;
ALTER TABLE payments ADD CONSTRAINT chk_payments_amounts CHECK (amount_minor >= 0 AND captured_minor >= 0 AND refunded_minor >= 0 AND refunded_minor <= captured_minor);

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS chk_reviews_rating_range;
ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS chk_campaigns_rollout;
ALTER TABLE campaigns ADD CONSTRAINT chk_campaigns_rollout CHECK (rollout_percent BETWEEN 1 AND 100);

ALTER TABLE service_quotes DROP CONSTRAINT IF EXISTS chk_quotes_non_negative;
ALTER TABLE service_quotes ADD CONSTRAINT chk_quotes_non_negative CHECK (labor_cost_minor >= 0 AND parts_cost_minor >= 0 AND additional_fees_minor >= 0 AND discount_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0);

ALTER TABLE zone_operating_hours DROP CONSTRAINT IF EXISTS chk_zone_hours_day;
ALTER TABLE zone_operating_hours ADD CONSTRAINT chk_zone_hours_day CHECK (day_of_week BETWEEN 0 AND 6);

-- ---------------------------------------------- immutability guards (§56, §85, §98)
CREATE OR REPLACE FUNCTION tamam_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only (% not allowed)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_entries_immutable ON ledger_entries;
CREATE TRIGGER trg_ledger_entries_immutable BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION tamam_forbid_mutation();

DROP TRIGGER IF EXISTS trg_ledger_transactions_immutable ON ledger_transactions;
CREATE TRIGGER trg_ledger_transactions_immutable BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION tamam_forbid_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION tamam_forbid_mutation();

DROP TRIGGER IF EXISTS trg_job_events_immutable ON job_events;
CREATE TRIGGER trg_job_events_immutable BEFORE UPDATE OR DELETE ON job_events
  FOR EACH ROW EXECUTE FUNCTION tamam_forbid_mutation();

DROP TRIGGER IF EXISTS trg_pricing_snapshots_immutable ON pricing_snapshots;
CREATE TRIGGER trg_pricing_snapshots_immutable BEFORE UPDATE OR DELETE ON pricing_snapshots
  FOR EACH ROW EXECUTE FUNCTION tamam_forbid_mutation();

-- ------------------------------------------------ wallet balance guard (§144)
-- balance_minor may only change through the ledger service, which sets a
-- transaction-local flag. Direct UPDATE wallets SET balance_minor = ... fails.
CREATE OR REPLACE FUNCTION tamam_guard_wallet_balance() RETURNS trigger AS $$
BEGIN
  IF NEW.balance_minor IS DISTINCT FROM OLD.balance_minor OR NEW.pending_minor IS DISTINCT FROM OLD.pending_minor THEN
    IF current_setting('tamam.ledger_write', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'wallet balances can only be changed through the ledger (set tamam.ledger_write)'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_wallet_balance ON wallets;
CREATE TRIGGER trg_guard_wallet_balance BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION tamam_guard_wallet_balance();

-- --------------------------------------------- ledger balance recomputation
-- Recompute a wallet balance from its ledger entries (spec §56: must be possible).
CREATE OR REPLACE FUNCTION tamam_ledger_balance(p_account_id uuid) RETURNS bigint AS $$
  SELECT COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount_minor ELSE -amount_minor END), 0)::bigint
  FROM ledger_entries WHERE account_id = p_account_id;
$$ LANGUAGE sql STABLE;

-- Balanced-transaction assertion, run as a constraint trigger at commit time.
CREATE OR REPLACE FUNCTION tamam_assert_balanced_transaction() RETURNS trigger AS $$
DECLARE
  v_debits bigint;
  v_credits bigint;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount_minor ELSE 0 END), 0)
    INTO v_debits, v_credits
    FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'ledger transaction % is unbalanced (debits=% credits=%)', NEW.transaction_id, v_debits, v_credits
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_entries_balanced ON ledger_entries;
CREATE CONSTRAINT TRIGGER trg_ledger_entries_balanced AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tamam_assert_balanced_transaction();

-- ------------------------------------------------------ helper functions
-- Next value for a named counter (job numbers etc.), atomic via UPSERT.
CREATE OR REPLACE FUNCTION tamam_next_counter(p_key varchar) RETURNS bigint AS $$
  INSERT INTO counters (key, value) VALUES (p_key, 1)
  ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
  RETURNING value;
$$ LANGUAGE sql;

-- Find the active service zone containing a point (NULL if none) — §74.
CREATE OR REPLACE FUNCTION tamam_zone_for_point(p_lat double precision, p_lng double precision) RETURNS uuid AS $$
  SELECT id FROM service_zones
  WHERE is_active = true
    AND ST_Covers(area, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
  ORDER BY ST_Area(area) ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------- seed system rows
INSERT INTO counters (key, value) VALUES ('job_number', 0), ('ticket_number', 0), ('dispute_number', 0), ('receipt_number', 0)
ON CONFLICT (key) DO NOTHING;
