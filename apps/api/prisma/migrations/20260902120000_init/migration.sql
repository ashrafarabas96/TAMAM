-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'PARTNER', 'ADMIN', 'SUPPORT', 'DISPATCHER', 'FINANCE', 'OPERATIONS_MANAGER', 'MARKETING', 'ANALYST', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "partner_role_type" AS ENUM ('DRIVER', 'COURIER', 'TECHNICIAN', 'SERVICE_PROVIDER');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "availability_status" AS ENUM ('ONLINE', 'OFFLINE', 'BUSY');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('ID', 'DRIVING_LICENSE', 'VEHICLE_LICENSE', 'INSURANCE', 'PROFESSIONAL_CERTIFICATE', 'BUSINESS_DOCUMENT', 'PROFILE_PICTURE');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('RIDE', 'DELIVERY', 'HOME_SERVICE', 'FOOD', 'GROCERY', 'PHARMACY', 'SHOPPING', 'MOVING', 'ROAD_ASSISTANCE');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('DRAFT', 'REQUESTED', 'SEARCHING', 'ASSIGNED', 'PARTNER_EN_ROUTE', 'PARTNER_ARRIVED', 'WAITING_CUSTOMER', 'IN_PROGRESS', 'INSPECTION_STARTED', 'QUOTE_REQUIRED', 'QUOTE_SUBMITTED', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'WORK_STARTED', 'WAITING_FOR_PARTS', 'WORK_COMPLETED', 'CUSTOMER_CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_PARTNER_AVAILABLE', 'DISPUTED');

-- CreateEnum
CREATE TYPE "job_urgency" AS ENUM ('STANDARD', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "scheduling_mode" AS ENUM ('NOW', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "job_stop_kind" AS ENUM ('PICKUP', 'DROPOFF', 'WAYPOINT', 'SERVICE_LOCATION');

-- CreateEnum
CREATE TYPE "job_actor_type" AS ENUM ('CUSTOMER', 'PARTNER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "quote_kind" AS ENUM ('INITIAL', 'CHANGE_ORDER');

-- CreateEnum
CREATE TYPE "quote_item_kind" AS ENUM ('LABOR', 'PARTS', 'FEE');

-- CreateEnum
CREATE TYPE "pricing_method" AS ENUM ('METERED', 'DISTANCE_WEIGHT', 'FIXED', 'INSPECTION_QUOTE', 'HOURLY', 'STARTING_FROM', 'CUSTOM_QUOTE');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'WALLET', 'CARD', 'BANK', 'EXTERNAL_GATEWAY');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "wallet_owner_type" AS ENUM ('CUSTOMER', 'PARTNER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "ledger_account_type" AS ENUM ('CUSTOMER_WALLET', 'PARTNER_WALLET', 'PLATFORM_REVENUE', 'PLATFORM_CASH_CLEARING', 'PLATFORM_GATEWAY_CLEARING', 'PLATFORM_PROMO_EXPENSE', 'PLATFORM_REFUND_EXPENSE', 'PLATFORM_PAYABLES');

-- CreateEnum
CREATE TYPE "ledger_entry_direction" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ledger_transaction_type" AS ENUM ('JOB_CHARGE', 'JOB_COMMISSION', 'PARTNER_EARNING', 'CASH_COLLECTED', 'WALLET_TOPUP', 'WALLET_WITHDRAWAL', 'REFUND', 'PROMO_DISCOUNT', 'REFERRAL_REWARD', 'CANCELLATION_FEE', 'BONUS', 'MANUAL_ADJUSTMENT', 'DISPUTE_SETTLEMENT');

-- CreateEnum
CREATE TYPE "withdrawal_status" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "promo_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "commission_scope" AS ENUM ('GLOBAL', 'JOB_TYPE', 'CATEGORY', 'ZONE', 'PARTNER', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('PUSH', 'IN_APP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'IMAGE', 'LOCATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ticket_category" AS ENUM ('PAYMENT', 'JOB_ISSUE', 'PARTNER_BEHAVIOUR', 'CUSTOMER_BEHAVIOUR', 'LOST_ITEM', 'ACCOUNT', 'SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'RESOLVED_SPLIT', 'REJECTED');

-- CreateEnum
CREATE TYPE "banner_placement" AS ENUM ('HOME_HERO', 'HOME_INLINE', 'SERVICE_CATEGORY_TOP', 'CHECKOUT_PROMO', 'ORDER_TRACKING', 'PARTNER_HOME');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "banner_audience" AS ENUM ('CUSTOMER', 'PARTNER');

-- CreateEnum
CREATE TYPE "banner_action_type" AS ENUM ('NONE', 'DEEP_LINK', 'EXTERNAL_URL', 'PROMO_CODE', 'SERVICE_CATEGORY');

-- CreateEnum
CREATE TYPE "banner_event_type" AS ENUM ('IMPRESSION', 'CLICK', 'DISMISS');

-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "media_purpose" AS ENUM ('PROFILE', 'PARTNER_DOCUMENT', 'VEHICLE_PHOTO', 'JOB_ATTACHMENT', 'PROOF_OF_DELIVERY', 'CHAT', 'SUPPORT', 'DISPUTE_EVIDENCE', 'BANNER_CREATIVE', 'SERVICE_ICON');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'READY', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "restriction_target_type" AS ENUM ('USER', 'PARTNER', 'DEVICE');

-- CreateEnum
CREATE TYPE "restriction_kind" AS ENUM ('BLOCK_JOBS', 'BLOCK_PROMOS', 'BLOCK_WALLET', 'BLOCK_LOGIN', 'REQUIRE_REVIEW');

-- CreateEnum
CREATE TYPE "risk_signal" AS ENUM ('EXCESSIVE_CANCELLATIONS', 'PROMO_ABUSE', 'MULTIPLE_ACCOUNTS', 'IMPOSSIBLE_GPS_MOVEMENT', 'REPEATED_FAILED_PAYMENTS', 'UNUSUAL_REFERRAL_BEHAVIOUR');

-- CreateEnum
CREATE TYPE "saved_place_kind" AS ENUM ('HOME', 'WORK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "package_size" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XL');

-- CreateEnum
CREATE TYPE "review_direction" AS ENUM ('CUSTOMER_TO_PARTNER', 'PARTNER_TO_CUSTOMER');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('ios', 'android', 'web', 'unknown');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(6),
    "email" VARCHAR(200),
    "full_name" VARCHAR(120),
    "profile_image_id" UUID,
    "language" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Jerusalem',
    "account_status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "status_reason" VARCHAR(500),
    "status_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(40) NOT NULL,
    "description" VARCHAR(300),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_permissions" (
    "key" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" VARCHAR(80) NOT NULL,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "admin_role_id" UUID,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "admin_credentials" (
    "user_id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6),
    "totp_secret_enc" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "device_name" VARCHAR(120),
    "platform" "device_platform" NOT NULL DEFAULT 'unknown',
    "app_version" VARCHAR(40),
    "refresh_token_hash" VARCHAR(128) NOT NULL,
    "token_family" UUID NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "purpose" VARCHAR(30) NOT NULL DEFAULT 'LOGIN',
    "audience" VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(64),
    "device_id" VARCHAR(128),
    "provider_ref" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "platform" "device_platform" NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "user_id" UUID NOT NULL,
    "rating_sum" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "cancelled_jobs" INTEGER NOT NULL DEFAULT 0,
    "referral_code" VARCHAR(12) NOT NULL,
    "referred_by_id" UUID,
    "first_job_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "saved_places" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "kind" "saved_place_kind" NOT NULL DEFAULT 'CUSTOM',
    "label" VARCHAR(60) NOT NULL,
    "formatted" VARCHAR(300) NOT NULL,
    "street" VARCHAR(120),
    "building" VARCHAR(60),
    "floor" VARCHAR(20),
    "apartment" VARCHAR(20),
    "city" VARCHAR(80),
    "notes" VARCHAR(300),
    "place_id" VARCHAR(200),
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "location" geography(Point, 4326),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "saved_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_services" (
    "customer_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_services_pkey" PRIMARY KEY ("customer_id","category_id")
);

-- CreateTable
CREATE TABLE "partner_profiles" (
    "user_id" UUID NOT NULL,
    "verification_status" "verification_status" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" VARCHAR(500),
    "suspended_until" TIMESTAMPTZ(6),
    "onboarding_step" INTEGER NOT NULL DEFAULT 0,
    "accepted_terms_version" VARCHAR(20),
    "date_of_birth" DATE,
    "national_id_enc" VARCHAR(255),
    "city" VARCHAR(80),
    "years_of_experience" INTEGER,
    "rating_sum" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "cancelled_jobs" INTEGER NOT NULL DEFAULT 0,
    "offers_received" INTEGER NOT NULL DEFAULT 0,
    "offers_accepted" INTEGER NOT NULL DEFAULT 0,
    "penalty_points" INTEGER NOT NULL DEFAULT 0,
    "active_vehicle_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "partner_roles" (
    "partner_id" UUID NOT NULL,
    "role" "partner_role_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_roles_pkey" PRIMARY KEY ("partner_id","role")
);

-- CreateTable
CREATE TABLE "partner_skills" (
    "partner_id" UUID NOT NULL,
    "skill" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_skills_pkey" PRIMARY KEY ("partner_id","skill")
);

-- CreateTable
CREATE TABLE "partner_categories" (
    "partner_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_categories_pkey" PRIMARY KEY ("partner_id","category_id")
);

-- CreateTable
CREATE TABLE "partner_zones" (
    "partner_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_zones_pkey" PRIMARY KEY ("partner_id","zone_id")
);

-- CreateTable
CREATE TABLE "partner_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "type" "document_type" NOT NULL,
    "number" VARCHAR(60),
    "media_id" UUID NOT NULL,
    "issued_at" DATE,
    "expires_at" DATE,
    "status" "document_status" NOT NULL DEFAULT 'PENDING',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(500),
    "expiry_notified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "partner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_availability" (
    "partner_id" UUID NOT NULL,
    "status" "availability_status" NOT NULL DEFAULT 'OFFLINE',
    "active_roles" "partner_role_type"[],
    "last_heartbeat_at" TIMESTAMPTZ(6),
    "last_location_at" TIMESTAMPTZ(6),
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "location" geography(Point, 4326),
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(6,2),
    "accuracy" DECIMAL(7,2),
    "battery_percent" INTEGER,
    "current_job_id" UUID,
    "online_since" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "partner_availability_pkey" PRIMARY KEY ("partner_id")
);

-- CreateTable
CREATE TABLE "partner_bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "bank_name" VARCHAR(80) NOT NULL,
    "account_holder" VARCHAR(80) NOT NULL,
    "iban_enc" VARCHAR(255) NOT NULL,
    "iban_last4" VARCHAR(4) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "description_ar" VARCHAR(300),
    "description_en" VARCHAR(300),
    "icon_media_id" UUID,
    "seats" INTEGER NOT NULL,
    "cargo_capacity_kg" DECIMAL(8,2),
    "allowed_job_types" "job_type"[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "vehicle_type_id" UUID NOT NULL,
    "brand" VARCHAR(40) NOT NULL,
    "model" VARCHAR(40) NOT NULL,
    "year" INTEGER NOT NULL,
    "color" VARCHAR(30) NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "plate_normalized" VARCHAR(20) NOT NULL,
    "seats" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "vehicle_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("vehicle_id","media_id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicle_id" UUID NOT NULL,
    "type" "document_type" NOT NULL,
    "number" VARCHAR(60),
    "media_id" UUID NOT NULL,
    "issued_at" DATE,
    "expires_at" DATE,
    "status" "document_status" NOT NULL DEFAULT 'PENDING',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" "job_type" NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "description_ar" VARCHAR(300),
    "description_en" VARCHAR(300),
    "icon_media_id" UUID,
    "color_hex" VARCHAR(7) NOT NULL DEFAULT '#5D3EBC',
    "feature_flag_key" VARCHAR(60),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_type_id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "description_ar" VARCHAR(500),
    "description_en" VARCHAR(500),
    "search_keywords" VARCHAR(1000) NOT NULL DEFAULT '',
    "icon_media_id" UUID,
    "image_media_id" UUID,
    "color_hex" VARCHAR(7),
    "pricing_method" "pricing_method" NOT NULL,
    "required_partner_role" "partner_role_type" NOT NULL,
    "required_document_types" "document_type"[],
    "required_fields" JSONB NOT NULL DEFAULT '[]',
    "required_media" JSONB NOT NULL DEFAULT '{"images":true,"video":true,"audio":true,"minImages":0,"maxImages":6}',
    "allows_instant" BOOLEAN NOT NULL DEFAULT true,
    "allows_scheduled" BOOLEAN NOT NULL DEFAULT true,
    "urgency_levels" "job_urgency"[] DEFAULT ARRAY['STANDARD']::"job_urgency"[],
    "inspection_fee_minor" BIGINT,
    "starting_from_minor" BIGINT,
    "hourly_rate_minor" BIGINT,
    "fixed_price_minor" BIGINT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "workflow_config" JSONB NOT NULL DEFAULT '{"skipInspection":false,"requiresQuote":true,"requiresCustomerConfirmation":true,"autoConfirmHours":24}',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_category_zones" (
    "category_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,

    CONSTRAINT "service_category_zones_pkey" PRIMARY KEY ("category_id","zone_id")
);

-- CreateTable
CREATE TABLE "service_subcategories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "description_ar" VARCHAR(500),
    "description_en" VARCHAR(500),
    "search_keywords" VARCHAR(1000) NOT NULL DEFAULT '',
    "icon_media_id" UUID,
    "fixed_price_minor" BIGINT,
    "starting_from_minor" BIGINT,
    "estimated_duration_min" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subcategory_id" UUID NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "price_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "description_ar" VARCHAR(300),
    "description_en" VARCHAR(300),
    "max_weight_kg" DECIMAL(8,2),
    "requires_vehicle_type_ids" UUID[],
    "is_fragile" BOOLEAN NOT NULL DEFAULT false,
    "is_prohibited" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "package_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Jerusalem',
    "polygon_geojson" JSONB NOT NULL,
    "area" geography(Polygon, 4326),
    "center_lat" DECIMAL(9,6) NOT NULL,
    "center_lng" DECIMAL(9,6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_operating_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zone_id" UUID NOT NULL,
    "rule_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "opens_at" VARCHAR(5) NOT NULL,
    "closes_at" VARCHAR(5) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "zone_operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_service_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zone_id" UUID NOT NULL,
    "service_type_id" UUID,
    "category_id" UUID,
    "vehicle_type_id" UUID,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "zone_service_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" VARCHAR(20) NOT NULL,
    "type" "job_type" NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "customer_id" UUID NOT NULL,
    "partner_id" UUID,
    "vehicle_id" UUID,
    "vehicle_type_id" UUID,
    "category_id" UUID,
    "subcategory_id" UUID,
    "zone_id" UUID NOT NULL,
    "scheduling" "scheduling_mode" NOT NULL DEFAULT 'NOW',
    "scheduled_for" TIMESTAMPTZ(6),
    "urgency" "job_urgency" NOT NULL DEFAULT 'STANDARD',
    "currency" VARCHAR(3) NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "estimated_total_minor" BIGINT,
    "final_total_minor" BIGINT,
    "breakdown" JSONB NOT NULL DEFAULT '[]',
    "pricing_snapshot_id" UUID,
    "distance_meters" INTEGER,
    "duration_seconds" INTEGER,
    "actual_distance_meters" INTEGER,
    "actual_duration_seconds" INTEGER,
    "route_polyline" TEXT,
    "eta_to_pickup_seconds" INTEGER,
    "eta_to_destination_seconds" INTEGER,
    "description" VARCHAR(2000),
    "notes" VARCHAR(500),
    "dynamic_fields" JSONB NOT NULL DEFAULT '{}',
    "preferred_date" DATE,
    "preferred_time_slot" VARCHAR(20),
    "trip_pin_required" BOOLEAN NOT NULL DEFAULT false,
    "trip_pin_hash" VARCHAR(128),
    "trip_pin_enc" VARCHAR(255),
    "pickup_otp_required" BOOLEAN NOT NULL DEFAULT false,
    "pickup_otp_hash" VARCHAR(128),
    "pickup_otp_enc" VARCHAR(255),
    "delivery_otp_required" BOOLEAN NOT NULL DEFAULT false,
    "delivery_otp_hash" VARCHAR(128),
    "delivery_otp_enc" VARCHAR(255),
    "promo_code_id" UUID,
    "promo_discount_minor" BIGINT NOT NULL DEFAULT 0,
    "cancellation_reason_code" VARCHAR(40),
    "cancellation_reason_text" VARCHAR(500),
    "cancelled_by" "job_actor_type",
    "cancellation_fee_minor" BIGINT NOT NULL DEFAULT 0,
    "dispatch_wave" INTEGER NOT NULL DEFAULT 0,
    "dispatch_started_at" TIMESTAMPTZ(6),
    "dispatch_deadline_at" TIMESTAMPTZ(6),
    "assigned_at" TIMESTAMPTZ(6),
    "partner_arrived_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "attributed_campaign_id" UUID,
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" "job_stop_kind" NOT NULL,
    "formatted" VARCHAR(300) NOT NULL,
    "street" VARCHAR(120),
    "building" VARCHAR(60),
    "floor" VARCHAR(20),
    "apartment" VARCHAR(20),
    "city" VARCHAR(80),
    "notes" VARCHAR(300),
    "place_id" VARCHAR(200),
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "location" geography(Point, 4326),
    "contact_name" VARCHAR(80),
    "contact_phone_enc" VARCHAR(255),
    "arrived_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "context" VARCHAR(20) NOT NULL DEFAULT 'PROBLEM',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_service_options" (
    "job_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "price_minor" BIGINT NOT NULL,

    CONSTRAINT "job_service_options_pkey" PRIMARY KEY ("job_id","option_id")
);

-- CreateTable
CREATE TABLE "job_delivery_details" (
    "job_id" UUID NOT NULL,
    "package_category_id" UUID NOT NULL,
    "approximate_size" "package_size" NOT NULL,
    "approximate_weight_kg" DECIMAL(8,2),
    "sender_name" VARCHAR(80) NOT NULL,
    "sender_phone_enc" VARCHAR(255) NOT NULL,
    "recipient_name" VARCHAR(80) NOT NULL,
    "recipient_phone_enc" VARCHAR(255) NOT NULL,
    "delivery_notes" VARCHAR(500),
    "pickup_verified_at" TIMESTAMPTZ(6),
    "pickup_verified_method" VARCHAR(20),
    "pod_receiver_name" VARCHAR(80),
    "pod_photo_media_id" UUID,
    "pod_signature_media_id" UUID,
    "pod_lat" DECIMAL(9,6),
    "pod_lng" DECIMAL(9,6),
    "pod_otp_verified" BOOLEAN NOT NULL DEFAULT false,
    "pod_timestamp" TIMESTAMPTZ(6),

    CONSTRAINT "job_delivery_details_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "wave" INTEGER NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'OFFERED',
    "score" DECIMAL(8,4) NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "eta_seconds" INTEGER NOT NULL,
    "estimated_earnings_minor" BIGINT NOT NULL,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "assigned_by_id" UUID,
    "offered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "responded_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "release_reason" VARCHAR(200),

    CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "from_status" "job_status",
    "to_status" "job_status",
    "actor_type" "job_actor_type" NOT NULL,
    "actor_id" UUID,
    "data" JSONB,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_tracking_points" (
    "id" BIGSERIAL NOT NULL,
    "job_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "location" geography(Point, 4326),
    "accuracy" DECIMAL(7,2) NOT NULL,
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(6,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_tracking_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_share_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sos_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "note" VARCHAR(300),
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "kind" "quote_kind" NOT NULL DEFAULT 'INITIAL',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "quote_status" NOT NULL DEFAULT 'SUBMITTED',
    "supersedes_quote_id" UUID,
    "currency" VARCHAR(3) NOT NULL,
    "labor_cost_minor" BIGINT NOT NULL,
    "parts_cost_minor" BIGINT NOT NULL,
    "additional_fees_minor" BIGINT NOT NULL,
    "discount_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL,
    "description" VARCHAR(1000),
    "estimated_duration_min" INTEGER,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    "decided_by_id" UUID,
    "decision_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_quote_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "kind" "quote_item_kind" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_type" "job_type" NOT NULL,
    "zone_id" UUID,
    "vehicle_type_id" UUID,
    "category_id" UUID,
    "currency" VARCHAR(3) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "rule" JSONB NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pricing_rule_id" UUID,
    "job_type" "job_type" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "rule" JSONB NOT NULL,
    "surge_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "commission_percent" DECIMAL(5,2) NOT NULL,
    "commission_fixed_minor" BIGINT NOT NULL DEFAULT 0,
    "inputs" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surge_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zone_id" UUID NOT NULL,
    "job_type" "job_type" NOT NULL,
    "multiplier" DECIMAL(4,2) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surge_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" "commission_scope" NOT NULL,
    "job_type" "job_type",
    "category_id" UUID,
    "zone_id" UUID,
    "partner_id" UUID,
    "campaign_code" VARCHAR(40),
    "percent" DECIMAL(5,2) NOT NULL,
    "fixed_minor" BIGINT NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commission_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_type" "job_type",
    "zone_id" UUID,
    "currency" VARCHAR(3) NOT NULL,
    "grace_period_seconds" INTEGER NOT NULL,
    "fee_before_arrival_minor" BIGINT NOT NULL,
    "fee_after_arrival_minor" BIGINT NOT NULL,
    "fee_after_start_minor" BIGINT NOT NULL DEFAULT 0,
    "partner_fee_on_cancel_minor" BIGINT NOT NULL DEFAULT 0,
    "partner_penalty_points" INTEGER NOT NULL DEFAULT 1,
    "customer_no_show_fee_minor" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "captured_minor" BIGINT NOT NULL DEFAULT 0,
    "refunded_minor" BIGINT NOT NULL DEFAULT 0,
    "provider" VARCHAR(40) NOT NULL,
    "provider_ref" VARCHAR(120),
    "provider_payload" JSONB,
    "failure_code" VARCHAR(60),
    "failure_reason" VARCHAR(300),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "authorized_at" TIMESTAMPTZ(6),
    "captured_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "provider_ref" VARCHAR(120),
    "response_code" VARCHAR(60),
    "response_message" VARCHAR(300),
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "dispute_id" UUID,
    "status" "refund_status" NOT NULL DEFAULT 'PENDING',
    "currency" VARCHAR(3) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "issued_by_id" UUID NOT NULL,
    "provider_ref" VARCHAR(120),
    "ledger_transaction_id" UUID,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "failure_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(40) NOT NULL,
    "event_id" VARCHAR(160) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_ok" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" VARCHAR(160) NOT NULL,
    "scope" VARCHAR(60) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "status_code" INTEGER,
    "response_body" JSONB,
    "locked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_type" "wallet_owner_type" NOT NULL,
    "customer_id" UUID,
    "partner_id" UUID,
    "currency" VARCHAR(3) NOT NULL,
    "balance_minor" BIGINT NOT NULL DEFAULT 0,
    "pending_minor" BIGINT NOT NULL DEFAULT 0,
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ledger_account_type" NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "wallet_id" UUID,
    "currency" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ledger_transaction_type" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "job_id" UUID,
    "payment_id" UUID,
    "refund_id" UUID,
    "withdrawal_id" UUID,
    "dispute_id" UUID,
    "reference" VARCHAR(160),
    "description" VARCHAR(300) NOT NULL,
    "reason" VARCHAR(500),
    "actor_id" UUID,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "ledger_entry_direction" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "balance_after_minor" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "status" "withdrawal_status" NOT NULL DEFAULT 'REQUESTED',
    "currency" VARCHAR(3) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "fee_minor" BIGINT NOT NULL DEFAULT 0,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_reason" VARCHAR(500),
    "provider_reference" VARCHAR(120),
    "paid_at" TIMESTAMPTZ(6),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "number" VARCHAR(24) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "customer_name" VARCHAR(120) NOT NULL,
    "service_name_ar" VARCHAR(120) NOT NULL,
    "service_name_en" VARCHAR(120) NOT NULL,
    "tax_number" VARCHAR(40),
    "pdf_media_id" UUID,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(300),
    "type" "promo_type" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "max_discount_minor" BIGINT,
    "min_order_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "first_order_only" BOOLEAN NOT NULL DEFAULT false,
    "job_types" "job_type"[],
    "payment_methods" "payment_method"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_categories" (
    "promo_code_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "promo_code_categories_pkey" PRIMARY KEY ("promo_code_id","category_id")
);

-- CreateTable
CREATE TABLE "promo_code_zones" (
    "promo_code_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,

    CONSTRAINT "promo_code_zones_pkey" PRIMARY KEY ("promo_code_id","zone_id")
);

-- CreateTable
CREATE TABLE "promo_code_users" (
    "promo_code_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "promo_code_users_pkey" PRIMARY KEY ("promo_code_id","user_id")
);

-- CreateTable
CREATE TABLE "promo_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promo_code_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "discount_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inviter_reward_minor" BIGINT NOT NULL,
    "invitee_reward_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reward_on" VARCHAR(30) NOT NULL DEFAULT 'FIRST_COMPLETED_JOB',
    "min_first_job_minor" BIGINT NOT NULL DEFAULT 0,
    "max_rewards_per_inviter" INTEGER NOT NULL DEFAULT 50,
    "code_expiry_days" INTEGER NOT NULL DEFAULT 90,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referral_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "trigger_job_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "inviter_reward_minor" BIGINT NOT NULL,
    "invitee_reward_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "fraud_flags" TEXT[],
    "granted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "ratee_id" UUID NOT NULL,
    "direction" "review_direction" NOT NULL,
    "rating" INTEGER NOT NULL,
    "tags" TEXT[],
    "comment" VARCHAR(500),
    "editable_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_members" (
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "last_read_at" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("chat_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chat_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "type" "message_type" NOT NULL DEFAULT 'TEXT',
    "text" VARCHAR(2000),
    "media_id" UUID,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "client_message_id" VARCHAR(64) NOT NULL,
    "delivered_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event" VARCHAR(60) NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "title_ar" VARCHAR(160) NOT NULL,
    "title_en" VARCHAR(160) NOT NULL,
    "body_ar" VARCHAR(1000) NOT NULL,
    "body_en" VARCHAR(1000) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "event" VARCHAR(60) NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'QUEUED',
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "data" JSONB,
    "job_id" UUID,
    "provider_ref" VARCHAR(160),
    "failure_reason" VARCHAR(300),
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" VARCHAR(20) NOT NULL,
    "category" "ticket_category" NOT NULL,
    "priority" "ticket_priority" NOT NULL DEFAULT 'NORMAL',
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "subject" VARCHAR(120) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "raised_by_id" UUID NOT NULL,
    "raised_by_role" VARCHAR(20) NOT NULL,
    "job_id" UUID,
    "assigned_agent_id" UUID,
    "first_response_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" VARCHAR(3000) NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "message_id" UUID,
    "media_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reported_id" UUID NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "description" VARCHAR(2000),
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "ticket_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" VARCHAR(20) NOT NULL,
    "job_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "opened_by_role" VARCHAR(20) NOT NULL,
    "status" "dispute_status" NOT NULL DEFAULT 'OPEN',
    "reason" VARCHAR(40) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "requested_refund_minor" BIGINT,
    "refund_minor" BIGINT NOT NULL DEFAULT 0,
    "partner_adjustment_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_reason" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dispute_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" VARCHAR(3000) NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dispute_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploader_id" UUID,
    "kind" "media_kind" NOT NULL,
    "purpose" "media_purpose" NOT NULL,
    "status" "media_status" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "bucket" VARCHAR(80) NOT NULL,
    "object_key" VARCHAR(300) NOT NULL,
    "thumbnail_key" VARCHAR(300),
    "medium_key" VARCHAR(300),
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "original_filename" VARCHAR(200),
    "sha256" VARCHAR(64),
    "exif_stripped" BOOLEAN NOT NULL DEFAULT false,
    "scan_status" VARCHAR(20) NOT NULL DEFAULT 'NOT_SCANNED',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "status" "campaign_status" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "audiences" "banner_audience"[],
    "languages" TEXT[],
    "platforms" TEXT[],
    "new_customers_only" BOOLEAN NOT NULL DEFAULT false,
    "min_completed_jobs" INTEGER,
    "max_completed_jobs" INTEGER,
    "service_type_interest" "job_type"[],
    "rollout_percent" INTEGER NOT NULL DEFAULT 100,
    "frequency_cap_per_day" INTEGER,
    "created_by_id" UUID NOT NULL,
    "published_by_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_zones" (
    "campaign_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,

    CONSTRAINT "campaign_zones_pkey" PRIMARY KEY ("campaign_id","zone_id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "placement" "banner_placement" NOT NULL,
    "headline_ar" VARCHAR(120),
    "headline_en" VARCHAR(120),
    "subheadline_ar" VARCHAR(120),
    "subheadline_en" VARCHAR(120),
    "cta_label_ar" VARCHAR(40),
    "cta_label_en" VARCHAR(40),
    "badge_ar" VARCHAR(30),
    "badge_en" VARCHAR(30),
    "image_ar_media_id" UUID NOT NULL,
    "image_en_media_id" UUID NOT NULL,
    "theme" VARCHAR(30) NOT NULL DEFAULT 'purple',
    "action_type" "banner_action_type" NOT NULL DEFAULT 'NONE',
    "action_value" VARCHAR(500),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_events" (
    "id" BIGSERIAL NOT NULL,
    "banner_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID,
    "session_id" VARCHAR(128) NOT NULL,
    "type" "banner_event_type" NOT NULL,
    "placement" "banner_placement" NOT NULL,
    "platform" VARCHAR(10),
    "zone_id" UUID,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banner_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_daily_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "banner_id" UUID NOT NULL,
    "placement" "banner_placement" NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "unique_impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "dismissals" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banner_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" VARCHAR(60) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout" JSONB,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "min" DECIMAL(18,4),
    "max" DECIMAL(18,4),
    "unit" VARCHAR(20),
    "group" VARCHAR(30) NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "actor_role" VARCHAR(40),
    "action" VARCHAR(80) NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(80),
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" VARCHAR(500),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "device_session_id" UUID,
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "signal" "risk_signal" NOT NULL,
    "score" INTEGER NOT NULL,
    "details" JSONB,
    "job_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restrictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "restriction_target_type" NOT NULL,
    "target_id" VARCHAR(128) NOT NULL,
    "kind" "restriction_kind" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "lifted_at" TIMESTAMPTZ(6),
    "lifted_by_id" UUID,
    "lift_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_kpis" (
    "date" DATE NOT NULL,
    "zone_id" UUID,
    "jobs_created" INTEGER NOT NULL DEFAULT 0,
    "jobs_completed" INTEGER NOT NULL DEFAULT 0,
    "jobs_cancelled" INTEGER NOT NULL DEFAULT 0,
    "gmv_minor" BIGINT NOT NULL DEFAULT 0,
    "platform_revenue_minor" BIGINT NOT NULL DEFAULT 0,
    "avg_dispatch_seconds" INTEGER,
    "avg_pickup_eta_seconds" INTEGER,
    "active_customers" INTEGER NOT NULL DEFAULT 0,
    "repeat_customers" INTEGER NOT NULL DEFAULT 0,
    "active_partners" INTEGER NOT NULL DEFAULT 0,
    "partner_utilization" DECIMAL(5,4),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_kpis_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "user_id" UUID,
    "session_id" VARCHAR(128),
    "platform" VARCHAR(10),
    "app_version" VARCHAR(40),
    "job_id" UUID,
    "zone_id" UUID,
    "props" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "key" VARCHAR(40) NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "admin_credentials_email_key" ON "admin_credentials"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_token_family_idx" ON "user_sessions"("token_family");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "otp_requests_phone_created_at_idx" ON "otp_requests"("phone", "created_at");

-- CreateIndex
CREATE INDEX "otp_requests_expires_at_idx" ON "otp_requests"("expires_at");

-- CreateIndex
CREATE INDEX "push_tokens_token_idx" ON "push_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_user_id_device_id_key" ON "push_tokens"("user_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_referral_code_key" ON "customer_profiles"("referral_code");

-- CreateIndex
CREATE INDEX "saved_places_customer_id_idx" ON "saved_places"("customer_id");

-- CreateIndex
CREATE INDEX "partner_profiles_verification_status_idx" ON "partner_profiles"("verification_status");

-- CreateIndex
CREATE INDEX "partner_roles_role_is_active_idx" ON "partner_roles"("role", "is_active");

-- CreateIndex
CREATE INDEX "partner_categories_category_id_idx" ON "partner_categories"("category_id");

-- CreateIndex
CREATE INDEX "partner_zones_zone_id_idx" ON "partner_zones"("zone_id");

-- CreateIndex
CREATE INDEX "partner_documents_partner_id_type_idx" ON "partner_documents"("partner_id", "type");

-- CreateIndex
CREATE INDEX "partner_documents_status_idx" ON "partner_documents"("status");

-- CreateIndex
CREATE INDEX "partner_documents_expires_at_idx" ON "partner_documents"("expires_at");

-- CreateIndex
CREATE INDEX "partner_availability_status_idx" ON "partner_availability"("status");

-- CreateIndex
CREATE INDEX "partner_availability_last_heartbeat_at_idx" ON "partner_availability"("last_heartbeat_at");

-- CreateIndex
CREATE INDEX "partner_bank_accounts_partner_id_idx" ON "partner_bank_accounts"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_types_code_key" ON "vehicle_types"("code");

-- CreateIndex
CREATE INDEX "vehicles_partner_id_idx" ON "vehicles"("partner_id");

-- CreateIndex
CREATE INDEX "vehicles_verification_status_idx" ON "vehicles"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_normalized_key" ON "vehicles"("plate_normalized");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicle_id_type_idx" ON "vehicle_documents"("vehicle_id", "type");

-- CreateIndex
CREATE INDEX "vehicle_documents_expires_at_idx" ON "vehicle_documents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_types_code_key" ON "service_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_service_type_id_is_active_sort_order_idx" ON "service_categories"("service_type_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "service_subcategories_category_id_slug_key" ON "service_subcategories"("category_id", "slug");

-- CreateIndex
CREATE INDEX "service_options_subcategory_id_idx" ON "service_options"("subcategory_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_categories_code_key" ON "package_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_zones_code_key" ON "service_zones"("code");

-- CreateIndex
CREATE INDEX "service_zones_is_active_idx" ON "service_zones"("is_active");

-- CreateIndex
CREATE INDEX "zone_operating_hours_zone_id_day_of_week_idx" ON "zone_operating_hours"("zone_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "zone_service_rules_zone_id_service_type_id_category_id_vehi_key" ON "zone_service_rules"("zone_id", "service_type_id", "category_id", "vehicle_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_number_key" ON "jobs"("number");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_idempotency_key_key" ON "jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "jobs_customer_id_created_at_idx" ON "jobs"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_partner_id_created_at_idx" ON "jobs"("partner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_status_type_idx" ON "jobs"("status", "type");

-- CreateIndex
CREATE INDEX "jobs_zone_id_status_idx" ON "jobs"("zone_id", "status");

-- CreateIndex
CREATE INDEX "jobs_scheduling_scheduled_for_idx" ON "jobs"("scheduling", "scheduled_for");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "job_stops_job_id_sequence_key" ON "job_stops"("job_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "job_media_job_id_media_id_key" ON "job_media"("job_id", "media_id");

-- CreateIndex
CREATE INDEX "job_assignments_job_id_status_idx" ON "job_assignments"("job_id", "status");

-- CreateIndex
CREATE INDEX "job_assignments_partner_id_status_idx" ON "job_assignments"("partner_id", "status");

-- CreateIndex
CREATE INDEX "job_assignments_expires_at_idx" ON "job_assignments"("expires_at");

-- CreateIndex
CREATE INDEX "job_events_job_id_created_at_idx" ON "job_events"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "job_events_type_created_at_idx" ON "job_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "job_tracking_points_job_id_recorded_at_idx" ON "job_tracking_points"("job_id", "recorded_at");

-- CreateIndex
CREATE INDEX "job_tracking_points_recorded_at_idx" ON "job_tracking_points"("recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_share_links_token_hash_key" ON "job_share_links"("token_hash");

-- CreateIndex
CREATE INDEX "job_share_links_job_id_idx" ON "job_share_links"("job_id");

-- CreateIndex
CREATE INDEX "sos_alerts_job_id_idx" ON "sos_alerts"("job_id");

-- CreateIndex
CREATE INDEX "sos_alerts_resolved_at_idx" ON "sos_alerts"("resolved_at");

-- CreateIndex
CREATE INDEX "service_quotes_job_id_revision_idx" ON "service_quotes"("job_id", "revision");

-- CreateIndex
CREATE INDEX "service_quotes_status_idx" ON "service_quotes"("status");

-- CreateIndex
CREATE INDEX "service_quote_items_quote_id_idx" ON "service_quote_items"("quote_id");

-- CreateIndex
CREATE INDEX "pricing_rules_job_type_zone_id_is_active_priority_idx" ON "pricing_rules"("job_type", "zone_id", "is_active", "priority" DESC);

-- CreateIndex
CREATE INDEX "surge_overrides_zone_id_job_type_starts_at_ends_at_idx" ON "surge_overrides"("zone_id", "job_type", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "commission_policies_scope_is_active_priority_idx" ON "commission_policies"("scope", "is_active", "priority" DESC);

-- CreateIndex
CREATE INDEX "cancellation_policies_job_type_zone_id_is_active_idx" ON "cancellation_policies"("job_type", "zone_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_job_id_idx" ON "payments"("job_id");

-- CreateIndex
CREATE INDEX "payments_customer_id_created_at_idx" ON "payments"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_provider_ref_idx" ON "payments"("provider_ref");

-- CreateIndex
CREATE INDEX "payment_attempts_payment_id_idx" ON "payment_attempts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "webhook_events_processed_at_idx" ON "webhook_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_customer_id_key" ON "wallets"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_partner_id_key" ON "wallets"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_wallet_id_key" ON "ledger_accounts"("wallet_id");

-- CreateIndex
CREATE INDEX "ledger_accounts_type_currency_idx" ON "ledger_accounts"("type", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key_key" ON "ledger_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_transactions_job_id_idx" ON "ledger_transactions"("job_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_type_created_at_idx" ON "ledger_transactions"("type", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_idempotency_key_key" ON "withdrawals"("idempotency_key");

-- CreateIndex
CREATE INDEX "withdrawals_partner_id_created_at_idx" ON "withdrawals"("partner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_job_id_key" ON "receipts"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_number_key" ON "receipts"("number");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_is_active_starts_at_ends_at_idx" ON "promo_codes"("is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "promo_redemptions_job_id_key" ON "promo_redemptions"("job_id");

-- CreateIndex
CREATE INDEX "promo_redemptions_promo_code_id_customer_id_idx" ON "promo_redemptions"("promo_code_id", "customer_id");

-- CreateIndex
CREATE INDEX "referral_rewards_inviter_id_idx" ON "referral_rewards"("inviter_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_invitee_id_key" ON "referral_rewards"("invitee_id");

-- CreateIndex
CREATE INDEX "reviews_ratee_id_created_at_idx" ON "reviews"("ratee_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_job_id_direction_key" ON "reviews"("job_id", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "chats_job_id_key" ON "chats"("job_id");

-- CreateIndex
CREATE INDEX "chat_members_user_id_idx" ON "chat_members"("user_id");

-- CreateIndex
CREATE INDEX "messages_chat_id_created_at_idx" ON "messages"("chat_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "messages_chat_id_sender_id_client_message_id_key" ON "messages"("chat_id", "sender_id", "client_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_event_channel_key" ON "notification_templates"("event", "channel");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_number_key" ON "support_tickets"("number");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "support_tickets_raised_by_id_idx" ON "support_tickets"("raised_by_id");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_agent_id_idx" ON "support_tickets"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "user_reports_reported_id_idx" ON "user_reports"("reported_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_number_key" ON "disputes"("number");

-- CreateIndex
CREATE INDEX "disputes_job_id_idx" ON "disputes"("job_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "dispute_messages_dispute_id_created_at_idx" ON "dispute_messages"("dispute_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");

-- CreateIndex
CREATE INDEX "media_assets_uploader_id_created_at_idx" ON "media_assets"("uploader_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_assets_status_expires_at_idx" ON "media_assets"("status", "expires_at");

-- CreateIndex
CREATE INDEX "campaigns_status_starts_at_ends_at_idx" ON "campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "banners_campaign_id_placement_is_active_idx" ON "banners"("campaign_id", "placement", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "banner_events_dedupe_key_key" ON "banner_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "banner_events_campaign_id_occurred_at_idx" ON "banner_events"("campaign_id", "occurred_at");

-- CreateIndex
CREATE INDEX "banner_events_banner_id_type_occurred_at_idx" ON "banner_events"("banner_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "banner_events_user_id_campaign_id_type_occurred_at_idx" ON "banner_events"("user_id", "campaign_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "banner_daily_stats_campaign_id_date_idx" ON "banner_daily_stats"("campaign_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "banner_daily_stats_banner_id_date_key" ON "banner_daily_stats"("banner_id", "date");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "risk_signals_user_id_created_at_idx" ON "risk_signals"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "risk_signals_signal_reviewed_at_idx" ON "risk_signals"("signal", "reviewed_at");

-- CreateIndex
CREATE INDEX "restrictions_target_type_target_id_lifted_at_idx" ON "restrictions"("target_type", "target_id", "lifted_at");

-- CreateIndex
CREATE INDEX "analytics_events_name_occurred_at_idx" ON "analytics_events"("name", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_occurred_at_idx" ON "analytics_events"("user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profile_image_id_fkey" FOREIGN KEY ("profile_image_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "admin_permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_admin_role_id_fkey" FOREIGN KEY ("admin_role_id") REFERENCES "admin_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_credentials" ADD CONSTRAINT "admin_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_services" ADD CONSTRAINT "favorite_services_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_services" ADD CONSTRAINT "favorite_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_active_vehicle_id_fkey" FOREIGN KEY ("active_vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_roles" ADD CONSTRAINT "partner_roles_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_skills" ADD CONSTRAINT "partner_skills_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_categories" ADD CONSTRAINT "partner_categories_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_categories" ADD CONSTRAINT "partner_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_zones" ADD CONSTRAINT "partner_zones_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_zones" ADD CONSTRAINT "partner_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_availability" ADD CONSTRAINT "partner_availability_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_bank_accounts" ADD CONSTRAINT "partner_bank_accounts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_icon_media_id_fkey" FOREIGN KEY ("icon_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_types" ADD CONSTRAINT "service_types_icon_media_id_fkey" FOREIGN KEY ("icon_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_icon_media_id_fkey" FOREIGN KEY ("icon_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_category_zones" ADD CONSTRAINT "service_category_zones_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_category_zones" ADD CONSTRAINT "service_category_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_subcategories" ADD CONSTRAINT "service_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_subcategories" ADD CONSTRAINT "service_subcategories_icon_media_id_fkey" FOREIGN KEY ("icon_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_options" ADD CONSTRAINT "service_options_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "service_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_operating_hours" ADD CONSTRAINT "zone_operating_hours_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_operating_hours" ADD CONSTRAINT "zone_operating_hours_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "zone_service_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_service_rules" ADD CONSTRAINT "zone_service_rules_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_service_rules" ADD CONSTRAINT "zone_service_rules_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_service_rules" ADD CONSTRAINT "zone_service_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_service_rules" ADD CONSTRAINT "zone_service_rules_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "service_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pricing_snapshot_id_fkey" FOREIGN KEY ("pricing_snapshot_id") REFERENCES "pricing_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_attributed_campaign_id_fkey" FOREIGN KEY ("attributed_campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_stops" ADD CONSTRAINT "job_stops_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_media" ADD CONSTRAINT "job_media_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_media" ADD CONSTRAINT "job_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_service_options" ADD CONSTRAINT "job_service_options_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_service_options" ADD CONSTRAINT "job_service_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "service_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_delivery_details" ADD CONSTRAINT "job_delivery_details_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_delivery_details" ADD CONSTRAINT "job_delivery_details_package_category_id_fkey" FOREIGN KEY ("package_category_id") REFERENCES "package_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_delivery_details" ADD CONSTRAINT "job_delivery_details_pod_photo_media_id_fkey" FOREIGN KEY ("pod_photo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_delivery_details" ADD CONSTRAINT "job_delivery_details_pod_signature_media_id_fkey" FOREIGN KEY ("pod_signature_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tracking_points" ADD CONSTRAINT "job_tracking_points_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tracking_points" ADD CONSTRAINT "job_tracking_points_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_share_links" ADD CONSTRAINT "job_share_links_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_supersedes_quote_id_fkey" FOREIGN KEY ("supersedes_quote_id") REFERENCES "service_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quote_items" ADD CONSTRAINT "service_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "service_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surge_overrides" ADD CONSTRAINT "surge_overrides_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "partner_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_categories" ADD CONSTRAINT "promo_code_categories_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_categories" ADD CONSTRAINT "promo_code_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_zones" ADD CONSTRAINT "promo_code_zones_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_zones" ADD CONSTRAINT "promo_code_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_users" ADD CONSTRAINT "promo_code_users_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "referral_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "customer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "customer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_ratee_id_fkey" FOREIGN KEY ("ratee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_zones" ADD CONSTRAINT "campaign_zones_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_zones" ADD CONSTRAINT "campaign_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_image_ar_media_id_fkey" FOREIGN KEY ("image_ar_media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_image_en_media_id_fkey" FOREIGN KEY ("image_en_media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_events" ADD CONSTRAINT "banner_events_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_events" ADD CONSTRAINT "banner_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_events" ADD CONSTRAINT "banner_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_daily_stats" ADD CONSTRAINT "banner_daily_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_daily_stats" ADD CONSTRAINT "banner_daily_stats_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===================== hand-written additions =====================
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
