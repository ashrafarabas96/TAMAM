-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "chalet_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "chalet_approval_status" AS ENUM ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "chalet_booking_status" AS ENUM ('DRAFT', 'HELD', 'AWAITING_PAYMENT', 'CONFIRMED', 'CHECK_IN_READY', 'CHECKED_IN', 'IN_PROGRESS', 'CHECKED_OUT', 'CLEANING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'DISPUTED');

-- CreateEnum
CREATE TYPE "chalet_booking_source" AS ENUM ('TAMAM', 'OWNER_MANUAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "chalet_block_kind" AS ENUM ('OWNER_BLOCK', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "chalet_pricing_profile" AS ENUM ('CONSERVATIVE', 'BALANCED', 'AGGRESSIVE_OCCUPANCY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "chalet_pricing_mode" AS ENUM ('OFF', 'RECOMMEND_ONLY', 'AUTO');

-- CreateEnum
CREATE TYPE "chalet_rate_rule_kind" AS ENUM ('TIME_OF_DAY', 'DAY_OF_WEEK', 'SPECIAL_DATE');

-- CreateEnum
CREATE TYPE "chalet_offer_kind" AS ENUM ('LAST_MINUTE', 'GAP_FILLER', 'MORNING_SPECIAL', 'EXTENSION', 'LOW_DEMAND', 'DURATION_BUNDLE');

-- CreateEnum
CREATE TYPE "chalet_deposit_type" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "chalet_booking_event_type" AS ENUM ('CREATED', 'HELD', 'HOLD_EXTENDED', 'CONFIRMED', 'PAYMENT_RECEIVED', 'CHECK_IN', 'EXTENSION_OFFERED', 'EXTENDED', 'OVERSTAY', 'CHECK_OUT', 'CLEANING_STARTED', 'CLEANING_COMPLETED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "chalet_cleaning_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- NOTE: prisma migrate diff proposes dropping 8 hand-written indexes here
-- (idx_job_stops_location, idx_job_tracking_points_location, idx_partner_availability_location, idx_saved_places_location, idx_service_zones_area, idx_users_full_name_trgm, idx_users_phone_trgm, idx_vehicles_plate_trgm).
-- They sit on Unsupported() geography/trigram columns that the datamodel cannot
-- describe, so every diff will keep re-proposing them. They are created by
-- 001_postgis_triggers_and_integrity.sql and must stay. The DROPs are removed.

-- CreateTable
CREATE TABLE "chalets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name_ar" VARCHAR(120) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "description_ar" VARCHAR(3000),
    "description_en" VARCHAR(3000),
    "address_line" VARCHAR(300) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "location" geography(Point, 4326),
    "service_zone_id" UUID NOT NULL,
    "maximum_guests" INTEGER NOT NULL,
    "minimum_guests" INTEGER,
    "opening_time" VARCHAR(5) NOT NULL,
    "closing_time" VARCHAR(5) NOT NULL,
    "minimum_booking_duration_minutes" INTEGER NOT NULL,
    "maximum_booking_duration_minutes" INTEGER NOT NULL,
    "booking_interval_minutes" INTEGER NOT NULL DEFAULT 15,
    "default_cleaning_duration_minutes" INTEGER NOT NULL DEFAULT 90,
    "base_hourly_rate_minor" BIGINT NOT NULL,
    "minimum_hourly_rate_minor" BIGINT NOT NULL,
    "maximum_hourly_rate_minor" BIGINT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "deposit_type" "chalet_deposit_type" NOT NULL DEFAULT 'NONE',
    "deposit_amount_minor" BIGINT,
    "deposit_percent" INTEGER,
    "hold_duration_minutes" INTEGER NOT NULL DEFAULT 7,
    "status" "chalet_status" NOT NULL DEFAULT 'DRAFT',
    "approval_status" "chalet_approval_status" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" VARCHAR(500),
    "instant_booking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "smart_pricing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "gap_filler_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_minute_pricing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_extension_offers_enabled" BOOLEAN NOT NULL DEFAULT false,
    "pricing_profile" "chalet_pricing_profile" NOT NULL DEFAULT 'BALANCED',
    "pricing_mode" "chalet_pricing_mode" NOT NULL DEFAULT 'OFF',
    "max_auto_discount_percent" INTEGER,
    "target_occupancy_percent" INTEGER NOT NULL DEFAULT 80,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "cancellation_policy" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chalets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_amenities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chalet_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,

    CONSTRAINT "chalet_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chalet_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chalet_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_number" VARCHAR(20) NOT NULL,
    "chalet_id" UUID NOT NULL,
    "customer_id" UUID,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "blocked_until" TIMESTAMPTZ(6) NOT NULL,
    "booking_duration_minutes" INTEGER NOT NULL,
    "cleaning_duration_minutes" INTEGER NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "base_price_minor" BIGINT NOT NULL,
    "discount_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "service_fee_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "total_amount_minor" BIGINT NOT NULL,
    "deposit_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "pricing_snapshot" JSONB NOT NULL,
    "applied_offer_id" UUID,
    "status" "chalet_booking_status" NOT NULL DEFAULT 'DRAFT',
    "source" "chalet_booking_source" NOT NULL DEFAULT 'TAMAM',
    "hold_expires_at" TIMESTAMPTZ(6),
    "payment_status" "payment_status",
    "payment_id" UUID,
    "cancellation_reason" VARCHAR(500),
    "cancelled_by" UUID,
    "external_note" VARCHAR(500),
    "guest_name" VARCHAR(120),
    "guest_phone" VARCHAR(20),
    "overstay_minutes" INTEGER NOT NULL DEFAULT 0,
    "overstay_fee_minor" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "checked_in_at" TIMESTAMPTZ(6),
    "checked_out_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "chalet_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_booking_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "type" "chalet_booking_event_type" NOT NULL,
    "actor_id" UUID,
    "from_status" "chalet_booking_status",
    "to_status" "chalet_booking_status",
    "data" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chalet_booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chalet_id" UUID NOT NULL,
    "kind" "chalet_block_kind" NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" VARCHAR(300),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chalet_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_rate_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chalet_id" UUID NOT NULL,
    "kind" "chalet_rate_rule_kind" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "day_of_week" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "multiplier" DECIMAL(5,3),
    "hourly_rate_minor" BIGINT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chalet_rate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chalet_id" UUID NOT NULL,
    "kind" "chalet_offer_kind" NOT NULL,
    "title_ar" VARCHAR(120) NOT NULL,
    "title_en" VARCHAR(120) NOT NULL,
    "slot_start_at" TIMESTAMPTZ(6) NOT NULL,
    "slot_end_at" TIMESTAMPTZ(6) NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "hourly_rate_minor" BIGINT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivation_reason" VARCHAR(120),
    "generated_by" VARCHAR(20) NOT NULL DEFAULT 'system',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "bookings" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chalet_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chalet_cleaning_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "chalet_id" UUID NOT NULL,
    "status" "chalet_cleaning_status" NOT NULL DEFAULT 'PENDING',
    "scheduled_start_at" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_end_at" TIMESTAMPTZ(6) NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "assignee_id" UUID,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chalet_cleaning_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chalets_owner_id_idx" ON "chalets"("owner_id");

-- CreateIndex
CREATE INDEX "chalets_service_zone_id_idx" ON "chalets"("service_zone_id");

-- CreateIndex
CREATE INDEX "chalets_status_approval_status_idx" ON "chalets"("status", "approval_status");

-- CreateIndex
CREATE INDEX "chalet_amenities_code_idx" ON "chalet_amenities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "chalet_amenities_chalet_id_code_key" ON "chalet_amenities"("chalet_id", "code");

-- CreateIndex
CREATE INDEX "chalet_media_chalet_id_sort_order_idx" ON "chalet_media"("chalet_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "chalet_media_chalet_id_media_id_key" ON "chalet_media"("chalet_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "chalet_bookings_booking_number_key" ON "chalet_bookings"("booking_number");

-- CreateIndex
CREATE INDEX "chalet_bookings_chalet_id_start_at_idx" ON "chalet_bookings"("chalet_id", "start_at");

-- CreateIndex
CREATE INDEX "chalet_bookings_chalet_id_status_start_at_idx" ON "chalet_bookings"("chalet_id", "status", "start_at");

-- CreateIndex
CREATE INDEX "chalet_bookings_customer_id_start_at_idx" ON "chalet_bookings"("customer_id", "start_at");

-- CreateIndex
CREATE INDEX "chalet_bookings_status_hold_expires_at_idx" ON "chalet_bookings"("status", "hold_expires_at");

-- CreateIndex
CREATE INDEX "chalet_bookings_status_end_at_idx" ON "chalet_bookings"("status", "end_at");

-- CreateIndex
CREATE INDEX "chalet_booking_events_booking_id_created_at_idx" ON "chalet_booking_events"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "chalet_blocks_chalet_id_start_at_idx" ON "chalet_blocks"("chalet_id", "start_at");

-- CreateIndex
CREATE INDEX "chalet_rate_rules_chalet_id_kind_is_active_idx" ON "chalet_rate_rules"("chalet_id", "kind", "is_active");

-- CreateIndex
CREATE INDEX "chalet_offers_chalet_id_is_active_slot_start_at_idx" ON "chalet_offers"("chalet_id", "is_active", "slot_start_at");

-- CreateIndex
CREATE INDEX "chalet_offers_is_active_expires_at_idx" ON "chalet_offers"("is_active", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "chalet_cleaning_tasks_booking_id_key" ON "chalet_cleaning_tasks"("booking_id");

-- CreateIndex
CREATE INDEX "chalet_cleaning_tasks_chalet_id_scheduled_start_at_idx" ON "chalet_cleaning_tasks"("chalet_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "chalet_cleaning_tasks_status_scheduled_end_at_idx" ON "chalet_cleaning_tasks"("status", "scheduled_end_at");

-- AddForeignKey
ALTER TABLE "chalets" ADD CONSTRAINT "chalets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalets" ADD CONSTRAINT "chalets_service_zone_id_fkey" FOREIGN KEY ("service_zone_id") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_amenities" ADD CONSTRAINT "chalet_amenities_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_media" ADD CONSTRAINT "chalet_media_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_media" ADD CONSTRAINT "chalet_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_bookings" ADD CONSTRAINT "chalet_bookings_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_bookings" ADD CONSTRAINT "chalet_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_booking_events" ADD CONSTRAINT "chalet_booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "chalet_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_blocks" ADD CONSTRAINT "chalet_blocks_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_rate_rules" ADD CONSTRAINT "chalet_rate_rules_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_offers" ADD CONSTRAINT "chalet_offers_chalet_id_fkey" FOREIGN KEY ("chalet_id") REFERENCES "chalets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chalet_cleaning_tasks" ADD CONSTRAINT "chalet_cleaning_tasks_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "chalet_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===================== hand-written additions =====================
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
-- Same rule the job and audit logs already follow: the trail is written, never edited.
CREATE OR REPLACE FUNCTION tamam_chalet_booking_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'chalet_booking_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chalet_booking_events_append_only ON chalet_booking_events;
CREATE TRIGGER trg_chalet_booking_events_append_only
  BEFORE UPDATE OR DELETE ON chalet_booking_events
  FOR EACH ROW EXECUTE FUNCTION tamam_chalet_booking_events_append_only();
