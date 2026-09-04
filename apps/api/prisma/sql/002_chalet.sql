-- =====================================================================
-- TAMAM Chalet — the DDL Prisma cannot express.
--
-- Everything here exists so that double booking is impossible by
-- construction rather than by careful application code. Two customers
-- pressing "confirm" in the same millisecond is not a race the API has to
-- win: the second INSERT is rejected by the database.
--
-- Applied by scripts/db/create-init-migration.sh after 001.
-- Every statement is idempotent.
-- =====================================================================

-- ------------------------------------------------------------ extensions
-- btree_gist lets a GiST index mix an equality column (chalet_id, a uuid)
-- with a range column, which is what an overlap constraint scoped to one
-- chalet needs.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ------------------------------------------------- chalet geography sync
-- Same pattern as every other point in the schema: application code writes
-- lat/lng, the database derives the geography column.
DROP TRIGGER IF EXISTS trg_sync_chalet_location ON chalets;
CREATE TRIGGER trg_sync_chalet_location
  BEFORE INSERT OR UPDATE OF lat, lng ON chalets
  FOR EACH ROW EXECUTE FUNCTION tamam_sync_point_location();

CREATE INDEX IF NOT EXISTS idx_chalets_location ON chalets USING GIST (location);

-- --------------------------------------------------- booking block range
-- A booking occupies its own window *plus* the cleaning that follows it.
-- blocked_until is the right edge of that occupation. It is derived here
-- rather than trusted from the application, so no code path can write a
-- booking that quietly forgets its cleaning buffer.
CREATE OR REPLACE FUNCTION tamam_sync_chalet_booking_block() RETURNS trigger AS $$
BEGIN
  IF NEW.cleaning_duration_minutes IS NULL OR NEW.cleaning_duration_minutes < 0 THEN
    RAISE EXCEPTION 'cleaning_duration_minutes must be zero or positive';
  END IF;
  IF NEW.end_at <= NEW.start_at THEN
    RAISE EXCEPTION 'chalet booking must end after it starts';
  END IF;
  NEW.blocked_until := NEW.end_at + make_interval(mins => NEW.cleaning_duration_minutes);
  NEW.booking_duration_minutes := (EXTRACT(EPOCH FROM (NEW.end_at - NEW.start_at)) / 60)::int;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_chalet_booking_block ON chalet_bookings;
CREATE TRIGGER trg_sync_chalet_booking_block
  BEFORE INSERT OR UPDATE OF start_at, end_at, cleaning_duration_minutes ON chalet_bookings
  FOR EACH ROW EXECUTE FUNCTION tamam_sync_chalet_booking_block();

-- ------------------------------------------------ no overlapping bookings
-- The core guarantee. Two rows on the same chalet whose [start_at,
-- blocked_until) ranges intersect cannot both exist, whichever transaction
-- commits first. Only statuses that actually hold the slot participate:
-- a cancelled or expired booking must not keep blocking the calendar.
--
-- '[)' is deliberate — a booking may begin exactly when the previous one's
-- cleaning ends, and not one minute earlier.
ALTER TABLE chalet_bookings DROP CONSTRAINT IF EXISTS chalet_bookings_no_overlap;
ALTER TABLE chalet_bookings ADD CONSTRAINT chalet_bookings_no_overlap
  EXCLUDE USING gist (
    chalet_id WITH =,
    tstzrange(start_at, blocked_until, '[)') WITH &&
  )
  WHERE (status IN (
    'HELD', 'AWAITING_PAYMENT', 'CONFIRMED', 'CHECK_IN_READY',
    'CHECKED_IN', 'IN_PROGRESS', 'CHECKED_OUT', 'CLEANING'
  ));

-- ------------------------------------------------- no overlapping blocks
-- Owner blocks and maintenance windows cannot overlap each other either;
-- an owner who blocks the same afternoon twice gets one row, not two.
ALTER TABLE chalet_blocks DROP CONSTRAINT IF EXISTS chalet_blocks_no_overlap;
ALTER TABLE chalet_blocks ADD CONSTRAINT chalet_blocks_no_overlap
  EXCLUDE USING gist (
    chalet_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  );

ALTER TABLE chalet_blocks DROP CONSTRAINT IF EXISTS chalet_blocks_positive_range;
ALTER TABLE chalet_blocks ADD CONSTRAINT chalet_blocks_positive_range
  CHECK (end_at > start_at);

-- ------------------------------------------------------- range lookups
-- The availability engine asks "what occupies this chalet between X and Y"
-- on every search. A GiST index over the same expression the constraint
-- uses answers it without scanning the table.
CREATE INDEX IF NOT EXISTS idx_chalet_bookings_range
  ON chalet_bookings USING GIST (chalet_id, tstzrange(start_at, blocked_until, '[)'));

CREATE INDEX IF NOT EXISTS idx_chalet_blocks_range
  ON chalet_blocks USING GIST (chalet_id, tstzrange(start_at, end_at, '[)'));

-- Hold expiry sweeps and reminder sweeps both scan by (status, time).
CREATE INDEX IF NOT EXISTS idx_chalet_bookings_hold_expiry
  ON chalet_bookings (hold_expires_at)
  WHERE status = 'HELD';

CREATE INDEX IF NOT EXISTS idx_chalet_bookings_active_window
  ON chalet_bookings (end_at)
  WHERE status IN ('CONFIRMED', 'CHECK_IN_READY', 'CHECKED_IN', 'IN_PROGRESS');

-- Active offers are read on every chalet detail view.
CREATE INDEX IF NOT EXISTS idx_chalet_offers_live
  ON chalet_offers (chalet_id, slot_start_at)
  WHERE is_active = true;

-- ----------------------------------------------------- sanity constraints
ALTER TABLE chalets DROP CONSTRAINT IF EXISTS chalets_price_floor_below_base;
ALTER TABLE chalets ADD CONSTRAINT chalets_price_floor_below_base
  CHECK (minimum_hourly_rate_minor <= base_hourly_rate_minor);

ALTER TABLE chalets DROP CONSTRAINT IF EXISTS chalets_price_ceiling_above_base;
ALTER TABLE chalets ADD CONSTRAINT chalets_price_ceiling_above_base
  CHECK (maximum_hourly_rate_minor IS NULL OR maximum_hourly_rate_minor >= base_hourly_rate_minor);

ALTER TABLE chalets DROP CONSTRAINT IF EXISTS chalets_duration_bounds;
ALTER TABLE chalets ADD CONSTRAINT chalets_duration_bounds
  CHECK (
    minimum_booking_duration_minutes > 0
    AND maximum_booking_duration_minutes >= minimum_booking_duration_minutes
    AND booking_interval_minutes > 0
    AND minimum_booking_duration_minutes % booking_interval_minutes = 0
  );

ALTER TABLE chalets DROP CONSTRAINT IF EXISTS chalets_guest_bounds;
ALTER TABLE chalets ADD CONSTRAINT chalets_guest_bounds
  CHECK (maximum_guests > 0 AND (minimum_guests IS NULL OR minimum_guests <= maximum_guests));

ALTER TABLE chalet_bookings DROP CONSTRAINT IF EXISTS chalet_bookings_guest_positive;
ALTER TABLE chalet_bookings ADD CONSTRAINT chalet_bookings_guest_positive
  CHECK (guest_count > 0);

ALTER TABLE chalet_bookings DROP CONSTRAINT IF EXISTS chalet_bookings_total_non_negative;
ALTER TABLE chalet_bookings ADD CONSTRAINT chalet_bookings_total_non_negative
  CHECK (total_amount_minor >= 0 AND discount_amount_minor >= 0);

-- A held booking without an expiry would occupy the calendar for ever.
ALTER TABLE chalet_bookings DROP CONSTRAINT IF EXISTS chalet_bookings_hold_has_expiry;
ALTER TABLE chalet_bookings ADD CONSTRAINT chalet_bookings_hold_has_expiry
  CHECK (status <> 'HELD' OR hold_expires_at IS NOT NULL);

ALTER TABLE chalet_offers DROP CONSTRAINT IF EXISTS chalet_offers_discount_bounds;
ALTER TABLE chalet_offers ADD CONSTRAINT chalet_offers_discount_bounds
  CHECK (discount_percent BETWEEN 0 AND 90);

ALTER TABLE chalet_offers DROP CONSTRAINT IF EXISTS chalet_offers_slot_range;
ALTER TABLE chalet_offers ADD CONSTRAINT chalet_offers_slot_range
  CHECK (slot_end_at > slot_start_at AND expires_at > starts_at);

-- --------------------------------------------- pricing snapshot immutable
-- A confirmed booking's price is history. The owner may reprice the chalet
-- freely; what a customer already agreed to pay does not move.
CREATE OR REPLACE FUNCTION tamam_chalet_pricing_snapshot_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('CONFIRMED', 'CHECK_IN_READY', 'CHECKED_IN', 'IN_PROGRESS',
                    'CHECKED_OUT', 'CLEANING', 'COMPLETED')
     AND NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot THEN
    RAISE EXCEPTION 'pricing_snapshot of a confirmed chalet booking is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chalet_pricing_snapshot_immutable ON chalet_bookings;
CREATE TRIGGER trg_chalet_pricing_snapshot_immutable
  BEFORE UPDATE ON chalet_bookings
  FOR EACH ROW EXECUTE FUNCTION tamam_chalet_pricing_snapshot_immutable();

-- --------------------------------------------------- booking events append-only
-- Same rule the ledger and audit logs already follow: the trail is written,
-- never edited.
--
-- With one difference. Those tables have no deletable parent; this one hangs off
-- chalet_bookings with ON DELETE CASCADE. A blanket DELETE ban would make that
-- cascade impossible to fire, so a chalet could never be deleted and neither
-- could a booking — the constraint and the foreign key would contradict each
-- other, and the foreign key would lose silently at runtime.
--
-- So the rule is stated as what it actually means: an event may not be edited,
-- and may not be removed from a booking that still exists. A cascade deletes the
-- parent first, so by the time this fires for one the booking is already gone
-- and the trail goes with it — which is not a rewrite of history, since the
-- history's subject no longer exists.
CREATE OR REPLACE FUNCTION tamam_chalet_booking_events_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM chalet_bookings WHERE id = OLD.booking_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'chalet_booking_events is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chalet_booking_events_append_only ON chalet_booking_events;
CREATE TRIGGER trg_chalet_booking_events_append_only
  BEFORE UPDATE OR DELETE ON chalet_booking_events
  FOR EACH ROW EXECUTE FUNCTION tamam_chalet_booking_events_append_only();
