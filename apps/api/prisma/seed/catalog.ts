import type { Prisma } from '@prisma/client';
import { DocumentType, DynamicFieldType, FEATURE_FLAGS, JobType, JobUrgency, PartnerRoleType, PricingMethod } from '@tamam/shared-types';
import type { DynamicFieldInput } from '@tamam/validation';

import { type SeedContext, shekels } from './context';

export interface CatalogSeedResult {
  serviceTypeIds: Map<JobType, string>;
  /** Vehicle type id by code (ECONOMY, FAMILY, PREMIUM, MOTORBIKE, DELIVERY_CAR). */
  vehicleTypeIds: Map<string, string>;
  /** Package category id by code. */
  packageCategoryIds: Map<string, string>;
  /** Home-service category id by slug. */
  categoryIds: Map<string, string>;
}

/* --------------------------------------------------------------- service types */
const SERVICE_TYPES: Array<{ code: JobType; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; colorHex: string; sortOrder: number; isActive: boolean; featureFlagKey: string | null }> = [
  { code: JobType.RIDE, nameAr: 'رحلات', nameEn: 'Rides', descriptionAr: 'توصيل ركاب داخل المدينة وبينها', descriptionEn: 'Passenger rides inside and between cities', colorHex: '#5D3EBC', sortOrder: 1, isActive: true, featureFlagKey: null },
  { code: JobType.DELIVERY, nameAr: 'توصيل طرود', nameEn: 'Delivery', descriptionAr: 'إرسال واستلام الطرود بسرعة', descriptionEn: 'Send and receive parcels quickly', colorHex: '#FFD300', sortOrder: 2, isActive: true, featureFlagKey: null },
  { code: JobType.HOME_SERVICE, nameAr: 'خدمات منزلية', nameEn: 'Home services', descriptionAr: 'فنيون معتمدون لصيانة منزلك', descriptionEn: 'Vetted technicians for your home', colorHex: '#00A67E', sortOrder: 3, isActive: true, featureFlagKey: null },
  // Reserved verticals: the engine already understands them, the modules ship later (spec §2).
  { code: JobType.FOOD, nameAr: 'مطاعم', nameEn: 'Food', descriptionAr: 'قريبًا', descriptionEn: 'Coming soon', colorHex: '#E4572E', sortOrder: 10, isActive: false, featureFlagKey: FEATURE_FLAGS.FOOD_MODULE },
  { code: JobType.GROCERY, nameAr: 'بقالة', nameEn: 'Grocery', descriptionAr: 'قريبًا', descriptionEn: 'Coming soon', colorHex: '#3A7D44', sortOrder: 11, isActive: false, featureFlagKey: FEATURE_FLAGS.GROCERY_MODULE },
  { code: JobType.PHARMACY, nameAr: 'صيدلية', nameEn: 'Pharmacy', descriptionAr: 'قريبًا', descriptionEn: 'Coming soon', colorHex: '#2E86AB', sortOrder: 12, isActive: false, featureFlagKey: FEATURE_FLAGS.PHARMACY_MODULE },
  { code: JobType.SHOPPING, nameAr: 'تسوق', nameEn: 'Shopping', descriptionAr: 'قريبًا', descriptionEn: 'Coming soon', colorHex: '#8E44AD', sortOrder: 13, isActive: false, featureFlagKey: FEATURE_FLAGS.MERCHANT_MODULE },
  // No dedicated flag exists yet — an unknown key resolves to "disabled", which is the intent.
  { code: JobType.MOVING, nameAr: 'نقل أثاث', nameEn: 'Moving', descriptionAr: 'قريبًا', descriptionEn: 'Coming soon', colorHex: '#B07D62', sortOrder: 14, isActive: false, featureFlagKey: 'moving_module' },
  { code: JobType.ROAD_ASSISTANCE, nameAr: 'مساعدة على الطريق', nameEn: 'Road assistance', descriptionAr: 'قريبًا', descriptionEn: 'Coming soon', colorHex: '#C0392B', sortOrder: 15, isActive: false, featureFlagKey: 'road_assistance_module' },
];

/* -------------------------------------------------------------- vehicle types */
const VEHICLE_TYPES: Array<{ code: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; seats: number; cargoCapacityKg: number | null; allowedJobTypes: JobType[]; sortOrder: number }> = [
  { code: 'ECONOMY', nameAr: 'اقتصادي', nameEn: 'Economy', descriptionAr: 'سيارة عادية حتى 4 ركاب', descriptionEn: 'Standard car, up to 4 passengers', seats: 4, cargoCapacityKg: null, allowedJobTypes: [JobType.RIDE], sortOrder: 1 },
  { code: 'FAMILY', nameAr: 'عائلي', nameEn: 'Family', descriptionAr: 'سيارة واسعة حتى 6 ركاب', descriptionEn: 'Roomy vehicle, up to 6 passengers', seats: 6, cargoCapacityKg: null, allowedJobTypes: [JobType.RIDE], sortOrder: 2 },
  { code: 'PREMIUM', nameAr: 'مميز', nameEn: 'Premium', descriptionAr: 'سيارة حديثة براحة أعلى', descriptionEn: 'Newer, more comfortable car', seats: 4, cargoCapacityKg: null, allowedJobTypes: [JobType.RIDE], sortOrder: 3 },
  { code: 'MOTORBIKE', nameAr: 'دراجة نارية', nameEn: 'Motorbike', descriptionAr: 'أسرع خيار للطرود الصغيرة', descriptionEn: 'Fastest option for small parcels', seats: 1, cargoCapacityKg: 15, allowedJobTypes: [JobType.DELIVERY], sortOrder: 4 },
  { code: 'DELIVERY_CAR', nameAr: 'سيارة توصيل', nameEn: 'Delivery car', descriptionAr: 'للطرود الكبيرة والهشة', descriptionEn: 'For large or fragile parcels', seats: 2, cargoCapacityKg: 300, allowedJobTypes: [JobType.DELIVERY], sortOrder: 5 },
];

/* ------------------------------------------------------------ package categories */
const PACKAGE_CATEGORIES: Array<{ code: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; maxWeightKg: number | null; isFragile: boolean; isProhibited: boolean; sortOrder: number; vehicleCodes: string[] }> = [
  { code: 'DOCUMENTS', nameAr: 'أوراق ومستندات', nameEn: 'Documents', descriptionAr: 'ظرف أو ملف خفيف', descriptionEn: 'Envelope or light folder', maxWeightKg: 2, isFragile: false, isProhibited: false, sortOrder: 1, vehicleCodes: [] },
  { code: 'SMALL', nameAr: 'طرد صغير', nameEn: 'Small parcel', descriptionAr: 'حتى 5 كغم', descriptionEn: 'Up to 5 kg', maxWeightKg: 5, isFragile: false, isProhibited: false, sortOrder: 2, vehicleCodes: [] },
  { code: 'MEDIUM', nameAr: 'طرد متوسط', nameEn: 'Medium parcel', descriptionAr: 'حتى 15 كغم', descriptionEn: 'Up to 15 kg', maxWeightKg: 15, isFragile: false, isProhibited: false, sortOrder: 3, vehicleCodes: [] },
  { code: 'LARGE', nameAr: 'طرد كبير', nameEn: 'Large parcel', descriptionAr: 'حتى 50 كغم — يحتاج سيارة توصيل', descriptionEn: 'Up to 50 kg — needs a delivery car', maxWeightKg: 50, isFragile: false, isProhibited: false, sortOrder: 4, vehicleCodes: ['DELIVERY_CAR'] },
  { code: 'FRAGILE', nameAr: 'قابل للكسر', nameEn: 'Fragile', descriptionAr: 'زجاج وأجهزة — يحتاج سيارة توصيل', descriptionEn: 'Glass and electronics — needs a delivery car', maxWeightKg: 25, isFragile: true, isProhibited: false, sortOrder: 5, vehicleCodes: ['DELIVERY_CAR'] },
  { code: 'PROHIBITED', nameAr: 'مواد ممنوعة', nameEn: 'Prohibited items', descriptionAr: 'أسلحة، مواد قابلة للاشتعال، مواد مخدرة — لا تُنقل', descriptionEn: 'Weapons, flammables, narcotics — never carried', maxWeightKg: null, isFragile: false, isProhibited: true, sortOrder: 99, vehicleCodes: [] },
];

/* ------------------------------------------------------- home-service catalogue */
interface OptionSeed {
  nameAr: string;
  nameEn: string;
  priceMinor: bigint;
}
interface SubcategorySeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  searchKeywords: string;
  estimatedDurationMin: number;
  options?: OptionSeed[];
}
interface CategorySeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  searchKeywords: string;
  pricingMethod: PricingMethod;
  requiredPartnerRole: PartnerRoleType;
  inspectionFeeMinor: bigint | null;
  hourlyRateMinor: bigint | null;
  startingFromMinor: bigint | null;
  urgencyLevels: JobUrgency[];
  isFeatured: boolean;
  sortOrder: number;
  requiredFields: DynamicFieldInput[];
  subcategories: SubcategorySeed[];
}

const notesField: DynamicFieldInput = {
  key: 'notes',
  type: DynamicFieldType.TEXTAREA,
  label: { ar: 'ملاحظات إضافية', en: 'Additional notes' },
  placeholder: { ar: 'صف المشكلة بالتفصيل', en: 'Describe the problem in detail' },
  required: false,
  max: 1000,
  sortOrder: 90,
};

const urgencyField: DynamicFieldInput = {
  key: 'urgency_note',
  type: DynamicFieldType.SELECT,
  label: { ar: 'مدى الاستعجال', en: 'How urgent is it?' },
  required: true,
  options: [
    { value: 'today', label: { ar: 'اليوم', en: 'Today' } },
    { value: 'this_week', label: { ar: 'خلال الأسبوع', en: 'This week' } },
    { value: 'emergency', label: { ar: 'طارئ الآن', en: 'Emergency now' } },
  ],
  sortOrder: 20,
};

const INSPECTION_FEE = shekels(30); // 3000 agorot, waived when the quote is approved

const CATEGORIES: CategorySeed[] = [
  {
    slug: 'plumbing',
    nameAr: 'سباك',
    nameEn: 'Plumbing',
    descriptionAr: 'تسريبات، مجاري، مغاسل وسخانات',
    descriptionEn: 'Leaks, drains, sinks and water heaters',
    searchKeywords: 'سباك سباكة تسريب ماء مجاري مغسلة بانيو سخان plumber plumbing leak drain sink water heater',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD, JobUrgency.URGENT, JobUrgency.EMERGENCY],
    isFeatured: true,
    sortOrder: 1,
    requiredFields: [
      {
        key: 'leak_location',
        type: DynamicFieldType.SELECT,
        label: { ar: 'مكان التسريب', en: 'Leak location' },
        required: true,
        options: [
          { value: 'kitchen', label: { ar: 'المطبخ', en: 'Kitchen' } },
          { value: 'bathroom', label: { ar: 'الحمام', en: 'Bathroom' } },
          { value: 'roof_tank', label: { ar: 'خزان السطح', en: 'Roof tank' } },
          { value: 'main_pipe', label: { ar: 'الماسورة الرئيسية', en: 'Main pipe' } },
          { value: 'unknown', label: { ar: 'غير معروف', en: 'Not sure' } },
        ],
        sortOrder: 10,
      },
      urgencyField,
      notesField,
    ],
    subcategories: [
      { slug: 'water-leak', nameAr: 'تسريب مياه', nameEn: 'Water leak', searchKeywords: 'تسريب ماء leak', estimatedDurationMin: 90 },
      { slug: 'sink', nameAr: 'مغسلة', nameEn: 'Sink', searchKeywords: 'مغسلة حوض sink basin', estimatedDurationMin: 60 },
      { slug: 'toilet', nameAr: 'كرسي حمام', nameEn: 'Toilet', searchKeywords: 'كرسي حمام تواليت toilet', estimatedDurationMin: 60 },
      { slug: 'pipes', nameAr: 'مواسير', nameEn: 'Pipes', searchKeywords: 'مواسير أنابيب pipes piping', estimatedDurationMin: 120 },
      { slug: 'water-heater', nameAr: 'سخان مياه', nameEn: 'Water heater', searchKeywords: 'سخان بويلر water heater boiler', estimatedDurationMin: 120 },
    ],
  },
  {
    slug: 'electrician',
    nameAr: 'كهربائي',
    nameEn: 'Electrician',
    descriptionAr: 'انقطاع كهرباء، مقابس، إنارة ولوحات',
    descriptionEn: 'Outages, sockets, lighting and panels',
    searchKeywords: 'كهربائي كهرباء تمديدات مقبس إنارة لوحة electrician electric socket lighting panel',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD, JobUrgency.URGENT, JobUrgency.EMERGENCY],
    isFeatured: true,
    sortOrder: 2,
    requiredFields: [urgencyField, notesField],
    subcategories: [
      { slug: 'power-outage', nameAr: 'انقطاع كهرباء', nameEn: 'Power outage', searchKeywords: 'انقطاع كهرباء outage', estimatedDurationMin: 60 },
      { slug: 'socket', nameAr: 'مقبس كهرباء', nameEn: 'Socket', searchKeywords: 'مقبس بريزة socket outlet', estimatedDurationMin: 45 },
      { slug: 'lighting', nameAr: 'إنارة', nameEn: 'Lighting', searchKeywords: 'إنارة لمبة ثريا lighting lamp', estimatedDurationMin: 60 },
      { slug: 'panel', nameAr: 'لوحة كهرباء', nameEn: 'Electrical panel', searchKeywords: 'لوحة طبلون panel breaker', estimatedDurationMin: 120 },
    ],
  },
  {
    slug: 'ac-technician',
    nameAr: 'فني تكييف',
    nameEn: 'AC technician',
    descriptionAr: 'تركيب، تنظيف، شحن غاز وصيانة المكيفات',
    descriptionEn: 'AC installation, cleaning, gas refill and repair',
    searchKeywords: 'تكييف مكيف سبليت غاز فريون تبريد air conditioning ac split gas freon cooling',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD, JobUrgency.URGENT],
    isFeatured: true,
    sortOrder: 3,
    requiredFields: [urgencyField, notesField],
    subcategories: [
      { slug: 'installation', nameAr: 'تركيب مكيف', nameEn: 'Installation', searchKeywords: 'تركيب install', estimatedDurationMin: 180 },
      {
        slug: 'cleaning',
        nameAr: 'تنظيف مكيف',
        nameEn: 'Cleaning',
        searchKeywords: 'تنظيف غسيل cleaning',
        estimatedDurationMin: 90,
        options: [{ nameAr: 'وحدة إضافية', nameEn: 'Second unit', priceMinor: shekels(50) }],
      },
      { slug: 'gas-refill', nameAr: 'شحن غاز', nameEn: 'Gas refill', searchKeywords: 'غاز فريون gas freon', estimatedDurationMin: 90 },
      { slug: 'repair', nameAr: 'إصلاح عطل', nameEn: 'Repair', searchKeywords: 'إصلاح عطل repair fix', estimatedDurationMin: 120 },
    ],
  },
  {
    slug: 'appliance-repair',
    nameAr: 'فني أجهزة',
    nameEn: 'Appliance repair',
    descriptionAr: 'غسالات، ثلاجات، أفران وغسالات صحون',
    descriptionEn: 'Washing machines, fridges, ovens and dishwashers',
    searchKeywords: 'أجهزة غسالة ثلاجة فرن جلاية appliance washing machine fridge oven dishwasher',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD, JobUrgency.URGENT],
    isFeatured: false,
    sortOrder: 4,
    requiredFields: [notesField],
    subcategories: [
      { slug: 'washing-machine', nameAr: 'غسالة', nameEn: 'Washing machine', searchKeywords: 'غسالة washing machine', estimatedDurationMin: 90 },
      { slug: 'fridge', nameAr: 'ثلاجة', nameEn: 'Refrigerator', searchKeywords: 'ثلاجة براد fridge', estimatedDurationMin: 90 },
      { slug: 'oven', nameAr: 'فرن', nameEn: 'Oven', searchKeywords: 'فرن غاز oven', estimatedDurationMin: 90 },
    ],
  },
  {
    slug: 'locksmith',
    nameAr: 'أقفال',
    nameEn: 'Locksmith',
    descriptionAr: 'فتح أبواب، تغيير أسطوانات وأقفال أمان',
    descriptionEn: 'Door opening, cylinder changes and security locks',
    searchKeywords: 'أقفال قفل مفتاح باب سيلندر locksmith lock key door cylinder',
    pricingMethod: PricingMethod.STARTING_FROM,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: null,
    hourlyRateMinor: null,
    startingFromMinor: shekels(80),
    urgencyLevels: [JobUrgency.STANDARD, JobUrgency.URGENT, JobUrgency.EMERGENCY],
    isFeatured: false,
    sortOrder: 5,
    requiredFields: [urgencyField, notesField],
    subcategories: [
      { slug: 'door-opening', nameAr: 'فتح باب', nameEn: 'Door opening', searchKeywords: 'فتح باب open door', estimatedDurationMin: 45 },
      { slug: 'lock-change', nameAr: 'تغيير قفل', nameEn: 'Lock change', searchKeywords: 'تغيير قفل change lock', estimatedDurationMin: 60 },
    ],
  },
  {
    slug: 'carpenter',
    nameAr: 'نجار',
    nameEn: 'Carpenter',
    descriptionAr: 'أبواب، خزائن ومطابخ خشبية',
    descriptionEn: 'Doors, wardrobes and wooden kitchens',
    searchKeywords: 'نجار خشب باب خزانة مطبخ carpenter wood door wardrobe kitchen',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD],
    isFeatured: false,
    sortOrder: 6,
    requiredFields: [notesField],
    subcategories: [
      { slug: 'door-repair', nameAr: 'إصلاح باب', nameEn: 'Door repair', searchKeywords: 'باب door', estimatedDurationMin: 90 },
      { slug: 'wardrobe', nameAr: 'خزانة', nameEn: 'Wardrobe', searchKeywords: 'خزانة wardrobe', estimatedDurationMin: 180 },
    ],
  },
  {
    slug: 'painter',
    nameAr: 'دهان',
    nameEn: 'Painter',
    descriptionAr: 'دهان داخلي وخارجي ومعالجة رطوبة',
    descriptionEn: 'Interior and exterior painting, damp treatment',
    searchKeywords: 'دهان بويا طلاء جدران painter paint walls',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.SERVICE_PROVIDER,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD],
    isFeatured: false,
    sortOrder: 7,
    requiredFields: [notesField],
    subcategories: [
      { slug: 'interior', nameAr: 'دهان داخلي', nameEn: 'Interior painting', searchKeywords: 'داخلي interior', estimatedDurationMin: 240 },
      { slug: 'exterior', nameAr: 'دهان خارجي', nameEn: 'Exterior painting', searchKeywords: 'خارجي exterior', estimatedDurationMin: 300 },
    ],
  },
  {
    slug: 'aluminium',
    nameAr: 'ألمنيوم',
    nameEn: 'Aluminium',
    descriptionAr: 'شبابيك، أبواب ومظلات ألمنيوم',
    descriptionEn: 'Aluminium windows, doors and canopies',
    searchKeywords: 'ألمنيوم شباك مظلة زجاج aluminium window canopy glass',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD],
    isFeatured: false,
    sortOrder: 8,
    requiredFields: [notesField],
    subcategories: [
      { slug: 'window', nameAr: 'شباك ألمنيوم', nameEn: 'Aluminium window', searchKeywords: 'شباك window', estimatedDurationMin: 180 },
      { slug: 'mosquito-net', nameAr: 'شبك حماية', nameEn: 'Mosquito net', searchKeywords: 'شبك ناموسية net', estimatedDurationMin: 90 },
    ],
  },
  {
    slug: 'device-maintenance',
    nameAr: 'صيانة أجهزة',
    nameEn: 'Device maintenance',
    descriptionAr: 'حواسيب، شاشات وأجهزة إلكترونية',
    descriptionEn: 'Computers, TVs and electronics',
    searchKeywords: 'صيانة أجهزة حاسوب لابتوب شاشة تلفزيون device maintenance computer laptop tv screen',
    pricingMethod: PricingMethod.INSPECTION_QUOTE,
    requiredPartnerRole: PartnerRoleType.TECHNICIAN,
    inspectionFeeMinor: INSPECTION_FEE,
    hourlyRateMinor: null,
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD],
    isFeatured: false,
    sortOrder: 9,
    requiredFields: [notesField],
    subcategories: [
      { slug: 'laptop', nameAr: 'حاسوب محمول', nameEn: 'Laptop', searchKeywords: 'لابتوب laptop', estimatedDurationMin: 120 },
      { slug: 'tv', nameAr: 'تلفزيون', nameEn: 'Television', searchKeywords: 'تلفزيون شاشة tv', estimatedDurationMin: 120 },
    ],
  },
  {
    slug: 'cleaning',
    nameAr: 'تنظيف',
    nameEn: 'Cleaning',
    descriptionAr: 'تنظيف منازل ومكاتب بالساعة',
    descriptionEn: 'Hourly home and office cleaning',
    searchKeywords: 'تنظيف نظافة تعقيم بيت مكتب cleaning cleaner housekeeping office',
    pricingMethod: PricingMethod.HOURLY,
    requiredPartnerRole: PartnerRoleType.SERVICE_PROVIDER,
    inspectionFeeMinor: null,
    hourlyRateMinor: shekels(60),
    startingFromMinor: null,
    urgencyLevels: [JobUrgency.STANDARD, JobUrgency.URGENT],
    isFeatured: true,
    sortOrder: 10,
    requiredFields: [
      {
        key: 'property_size',
        type: DynamicFieldType.SELECT,
        label: { ar: 'حجم المكان', en: 'Property size' },
        required: true,
        options: [
          { value: 'studio', label: { ar: 'استوديو', en: 'Studio' } },
          { value: 'apartment', label: { ar: 'شقة', en: 'Apartment' } },
          { value: 'house', label: { ar: 'بيت', en: 'House' } },
          { value: 'office', label: { ar: 'مكتب', en: 'Office' } },
        ],
        sortOrder: 10,
      },
      notesField,
    ],
    subcategories: [
      { slug: 'home', nameAr: 'تنظيف منزل', nameEn: 'Home cleaning', searchKeywords: 'منزل بيت home', estimatedDurationMin: 180 },
      { slug: 'office', nameAr: 'تنظيف مكتب', nameEn: 'Office cleaning', searchKeywords: 'مكتب office', estimatedDurationMin: 180 },
    ],
  },
];

const REQUIRED_DOCUMENTS = [DocumentType.ID, DocumentType.PROFESSIONAL_CERTIFICATE];

const WORKFLOW_QUOTE = { skipInspection: false, requiresQuote: true, requiresCustomerConfirmation: true, autoConfirmHours: 24 };
/** Priced services (hourly / starting-from) need no inspection quote — the price is known upfront. */
const WORKFLOW_DIRECT = { skipInspection: true, requiresQuote: false, requiresCustomerConfirmation: true, autoConfirmHours: 24 };

const REQUIRED_MEDIA = { images: true, video: true, audio: true, minImages: 0, maxImages: 6 };

export async function seedCatalog(ctx: SeedContext): Promise<CatalogSeedResult> {
  const { prisma, summary, currency } = ctx;
  const serviceTypeIds = new Map<JobType, string>();
  const vehicleTypeIds = new Map<string, string>();
  const packageCategoryIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();

  for (const st of SERVICE_TYPES) {
    const row = await prisma.serviceType.upsert({
      where: { code: st.code },
      update: { nameAr: st.nameAr, nameEn: st.nameEn, descriptionAr: st.descriptionAr, descriptionEn: st.descriptionEn, colorHex: st.colorHex, sortOrder: st.sortOrder, isActive: st.isActive, featureFlagKey: st.featureFlagKey },
      create: { code: st.code, nameAr: st.nameAr, nameEn: st.nameEn, descriptionAr: st.descriptionAr, descriptionEn: st.descriptionEn, colorHex: st.colorHex, sortOrder: st.sortOrder, isActive: st.isActive, featureFlagKey: st.featureFlagKey },
    });
    serviceTypeIds.set(st.code, row.id);
  }
  summary.set('service types', SERVICE_TYPES.length);

  for (const vt of VEHICLE_TYPES) {
    const row = await prisma.vehicleType.upsert({
      where: { code: vt.code },
      update: { nameAr: vt.nameAr, nameEn: vt.nameEn, descriptionAr: vt.descriptionAr, descriptionEn: vt.descriptionEn, seats: vt.seats, cargoCapacityKg: vt.cargoCapacityKg, allowedJobTypes: vt.allowedJobTypes, sortOrder: vt.sortOrder, isActive: true },
      create: { code: vt.code, nameAr: vt.nameAr, nameEn: vt.nameEn, descriptionAr: vt.descriptionAr, descriptionEn: vt.descriptionEn, seats: vt.seats, cargoCapacityKg: vt.cargoCapacityKg, allowedJobTypes: vt.allowedJobTypes, sortOrder: vt.sortOrder, isActive: true },
    });
    vehicleTypeIds.set(vt.code, row.id);
  }
  summary.set('vehicle types', VEHICLE_TYPES.length);

  for (const pc of PACKAGE_CATEGORIES) {
    const requiresVehicleTypeIds = pc.vehicleCodes.map((code) => vehicleTypeIds.get(code)).filter((id): id is string => !!id);
    const row = await prisma.packageCategory.upsert({
      where: { code: pc.code },
      update: { nameAr: pc.nameAr, nameEn: pc.nameEn, descriptionAr: pc.descriptionAr, descriptionEn: pc.descriptionEn, maxWeightKg: pc.maxWeightKg, requiresVehicleTypeIds, isFragile: pc.isFragile, isProhibited: pc.isProhibited, sortOrder: pc.sortOrder, isActive: !pc.isProhibited },
      create: { code: pc.code, nameAr: pc.nameAr, nameEn: pc.nameEn, descriptionAr: pc.descriptionAr, descriptionEn: pc.descriptionEn, maxWeightKg: pc.maxWeightKg, requiresVehicleTypeIds, isFragile: pc.isFragile, isProhibited: pc.isProhibited, sortOrder: pc.sortOrder, isActive: !pc.isProhibited },
    });
    packageCategoryIds.set(pc.code, row.id);
  }
  summary.set('package categories', PACKAGE_CATEGORIES.length);

  const homeServiceTypeId = serviceTypeIds.get(JobType.HOME_SERVICE);
  if (!homeServiceTypeId) throw new Error('HOME_SERVICE service type was not created');

  let subcategoryCount = 0;
  let optionCount = 0;
  for (const cat of CATEGORIES) {
    const workflowConfig = cat.pricingMethod === PricingMethod.INSPECTION_QUOTE ? WORKFLOW_QUOTE : WORKFLOW_DIRECT;
    const data = {
      serviceTypeId: homeServiceTypeId,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      descriptionAr: cat.descriptionAr,
      descriptionEn: cat.descriptionEn,
      searchKeywords: cat.searchKeywords,
      pricingMethod: cat.pricingMethod,
      requiredPartnerRole: cat.requiredPartnerRole,
      requiredDocumentTypes: REQUIRED_DOCUMENTS,
      requiredFields: cat.requiredFields as unknown as Prisma.InputJsonValue,
      requiredMedia: REQUIRED_MEDIA as unknown as Prisma.InputJsonValue,
      allowsInstant: true,
      allowsScheduled: true,
      urgencyLevels: cat.urgencyLevels,
      inspectionFeeMinor: cat.inspectionFeeMinor,
      startingFromMinor: cat.startingFromMinor,
      hourlyRateMinor: cat.hourlyRateMinor,
      fixedPriceMinor: null,
      currency,
      workflowConfig: workflowConfig as unknown as Prisma.InputJsonValue,
      isFeatured: cat.isFeatured,
      sortOrder: cat.sortOrder,
      isActive: true,
    };
    const row = await prisma.serviceCategory.upsert({ where: { slug: cat.slug }, update: data, create: { slug: cat.slug, ...data } });
    categoryIds.set(cat.slug, row.id);

    for (const [index, sub] of cat.subcategories.entries()) {
      const subData = {
        nameAr: sub.nameAr,
        nameEn: sub.nameEn,
        searchKeywords: sub.searchKeywords,
        estimatedDurationMin: sub.estimatedDurationMin,
        sortOrder: index + 1,
        isActive: true,
      };
      const subRow = await prisma.serviceSubcategory.upsert({
        where: { categoryId_slug: { categoryId: row.id, slug: sub.slug } },
        update: subData,
        create: { categoryId: row.id, slug: sub.slug, ...subData },
      });
      subcategoryCount += 1;

      for (const option of sub.options ?? []) {
        // service_options has no natural unique key — match on (subcategory, English name).
        const existing = await prisma.serviceOption.findFirst({ where: { subcategoryId: subRow.id, nameEn: option.nameEn } });
        if (existing) {
          await prisma.serviceOption.update({ where: { id: existing.id }, data: { nameAr: option.nameAr, priceMinor: option.priceMinor, currency, isActive: true } });
        } else {
          await prisma.serviceOption.create({ data: { subcategoryId: subRow.id, nameAr: option.nameAr, nameEn: option.nameEn, priceMinor: option.priceMinor, currency, isActive: true } });
        }
        optionCount += 1;
      }
    }
  }
  summary.set('home-service categories', CATEGORIES.length);
  summary.set('subcategories', subcategoryCount);
  summary.set('service options', optionCount);

  return { serviceTypeIds, vehicleTypeIds, packageCategoryIds, categoryIds };
}
