// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTagline => 'كل خدماتك… تمام';

  @override
  String get actionApply => 'تطبيق';

  @override
  String get actionBrowse => 'تصفّح الخدمات';

  @override
  String get actionCancel => 'إلغاء';

  @override
  String get actionChange => 'تغيير';

  @override
  String get actionClear => 'مسح';

  @override
  String get actionContinue => 'متابعة';

  @override
  String get actionCopy => 'نسخ';

  @override
  String get actionDelete => 'حذف';

  @override
  String get actionDismiss => 'إخفاء';

  @override
  String get actionFavorite => 'أضف إلى المفضلة';

  @override
  String get actionUnfavorite => 'إزالة من المفضلة';

  @override
  String get actionLoadMore => 'تحميل المزيد';

  @override
  String get actionManage => 'إدارة';

  @override
  String get actionNext => 'التالي';

  @override
  String get actionOpenSettings => 'فتح الإعدادات';

  @override
  String get actionRemove => 'إزالة';

  @override
  String get actionRetry => 'إعادة المحاولة';

  @override
  String get actionSave => 'حفظ';

  @override
  String get actionSchedule => 'جدولة';

  @override
  String get actionSeeAll => 'عرض الكل';

  @override
  String get actionSend => 'إرسال';

  @override
  String get actionSkip => 'تخطٍ';

  @override
  String get navHome => 'الرئيسية';

  @override
  String get navOrders => 'طلباتي';

  @override
  String get navWallet => 'المحفظة';

  @override
  String get navAccount => 'حسابي';

  @override
  String get onboardingRideTitle => 'مشوارك يبدأ من هنا';

  @override
  String get onboardingRideBody =>
      'اطلب سيارة خلال ثوانٍ، وتابع سائقك على الخريطة حتى الوصول.';

  @override
  String get onboardingDeliveryTitle => 'توصيل أي طرد';

  @override
  String get onboardingDeliveryBody =>
      'أرسل واستلم الطرود داخل مدينتك بسعر واضح قبل الطلب.';

  @override
  String get onboardingServicesTitle => 'خدمات منزلية موثوقة';

  @override
  String get onboardingServicesBody =>
      'سباك، كهربائي، فني تكييف وغيرهم — بفنّيين معتمدين وعرض سعر واضح.';

  @override
  String get onboardingStart => 'لنبدأ';

  @override
  String get signInTitle => 'أهلاً بك في تمام';

  @override
  String get signInSubtitle => 'أدخل رقم هاتفك لإنشاء حساب أو تسجيل الدخول';

  @override
  String get signInPhoneLabel => 'رقم الهاتف';

  @override
  String get signInPhoneHint => '599123456';

  @override
  String get signInSendCode => 'إرسال رمز التحقق';

  @override
  String get signInOtpExplainer => 'سنرسل لك رمزًا من ٦ أرقام عبر رسالة نصية.';

  @override
  String get signInTerms =>
      'بمتابعتك فإنك توافق على شروط الاستخدام وسياسة الخصوصية.';

  @override
  String get signedOutExpired => 'انتهت جلستك، يرجى تسجيل الدخول من جديد.';

  @override
  String get signedOutRevoked => 'تم إنهاء الجلسة من جهاز آخر.';

  @override
  String get otpTitle => 'رمز التحقق';

  @override
  String otpSubtitle(String phone) {
    return 'أرسلنا رمزًا إلى $phone';
  }

  @override
  String get otpVerify => 'تأكيد';

  @override
  String get otpResend => 'إعادة إرسال الرمز';

  @override
  String otpResendIn(int seconds) {
    final intl.NumberFormat secondsNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String secondsString = secondsNumberFormat.format(seconds);

    return 'يمكنك إعادة الإرسال بعد $secondsString ثانية';
  }

  @override
  String otpDevCode(String code) {
    return 'رمز بيئة التطوير: $code';
  }

  @override
  String get nameTitle => 'ما اسمك؟';

  @override
  String get nameSubtitle => 'حتى يعرف الشريك بمن سيلتقي';

  @override
  String get nameFieldLabel => 'الاسم الكامل';

  @override
  String get nameFieldHint => 'مثال: أحمد محمود';

  @override
  String get nameWhy => 'نعرض اسمك للشريك المكلّف بطلبك فقط.';

  @override
  String get locationPermissionTitle => 'فعِّل الموقع للحصول على خدمة أسرع';

  @override
  String get locationPermissionBody =>
      'نستخدم موقعك لتحديد نقطة الانطلاق وحساب وقت الوصول بدقة.';

  @override
  String get locationReasonPickup => 'تحديد نقطة الانطلاق تلقائيًا';

  @override
  String get locationReasonEta => 'حساب وقت الوصول بدقة';

  @override
  String get locationReasonZone => 'معرفة الخدمات المتاحة في منطقتك';

  @override
  String get locationAllow => 'السماح بالوصول للموقع';

  @override
  String get locationChooseManually => 'سأختار العنوان يدويًا';

  @override
  String get locationBlockedHint =>
      'تم رفض إذن الموقع نهائيًا. فعّله من إعدادات النظام.';

  @override
  String get locationServiceOffHint => 'خدمة الموقع مغلقة في جهازك.';

  @override
  String get locationUnavailable => 'تعذّر تحديد موقعك الآن.';

  @override
  String get homeDeliverTo => 'التوصيل إلى';

  @override
  String get homeChooseAddress => 'اختر عنوانك';

  @override
  String get homeChangeAddress => 'تغيير العنوان';

  @override
  String get homeSearchHint => 'ابحث عن خدمة: سباك، كهربائي، تكييف…';

  @override
  String get homePopular => 'الأكثر طلبًا';

  @override
  String get homeRecentOrders => 'طلباتك الأخيرة';

  @override
  String get homeSavedPlaces => 'الأماكن المفضلة';

  @override
  String get homeAddPlace => 'أضف عنوانك الأول لتطلب أسرع';

  @override
  String get homeOffers => 'العروض';

  @override
  String get homeOffersTitle => 'أكواد خصم بانتظارك';

  @override
  String get homeOffersBody =>
      'أدخل الكود الآن ليُطبَّق تلقائيًا على طلبك القادم.';

  @override
  String get homeActiveJob => 'طلب نشط الآن';

  @override
  String get homeSearchingPartner => 'نبحث عن شريك مناسب…';

  @override
  String get serviceRide => 'مشوار';

  @override
  String get serviceRideCaption => 'سيارة خلال دقائق';

  @override
  String get serviceDelivery => 'توصيل';

  @override
  String get serviceDeliveryCaption => 'أرسل طردك الآن';

  @override
  String get serviceHome => 'خدمات منزلية';

  @override
  String get serviceHomeCaption => 'فنيّون معتمدون';

  @override
  String get serviceUrgent => 'خدمة عاجلة';

  @override
  String get serviceUrgentCaption => 'استجابة فورية';

  @override
  String get serviceOther => 'خدمة';

  @override
  String get searchTitle => 'بحث';

  @override
  String get searchNoResultsTitle => 'لا توجد نتائج';

  @override
  String searchNoResultsBody(String query) {
    return 'لم نجد خدمة تطابق «$query».';
  }

  @override
  String get searchDirectoryEmptyTitle => 'لا توجد خدمات في منطقتك بعد';

  @override
  String get searchDirectoryEmptyBody => 'نعمل على التوسّع — جرّب عنوانًا آخر.';

  @override
  String get categoryOrderNow => 'اطلب الآن';

  @override
  String get categorySubcategories => 'اختر ما تحتاجه';

  @override
  String categoryDuration(int minutes) {
    final intl.NumberFormat minutesNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String minutesString = minutesNumberFormat.format(minutes);

    return 'المدة التقديرية $minutesString دقيقة';
  }

  @override
  String get pricingFixed => 'سعر ثابت';

  @override
  String get pricingStartingFrom => 'يبدأ من';

  @override
  String get pricingHourly => 'أجرة الساعة';

  @override
  String get pricingInspectionFee => 'رسوم الكشف';

  @override
  String get pricingDueNow => 'المستحق الآن';

  @override
  String get pricingInspectionExplainer =>
      'تدفع رسوم الكشف عند وصول الفني، ثم يقدّم لك عرض سعر للعمل قبل البدء.';

  @override
  String get ridePickupLabel => 'نقطة الانطلاق';

  @override
  String get ridePickupEmpty => 'اختر نقطة الانطلاق';

  @override
  String get ridePickupTitle => 'نقطة الانطلاق';

  @override
  String get rideDestinationLabel => 'الوجهة';

  @override
  String get rideDestinationEmpty => 'إلى أين تريد الذهاب؟';

  @override
  String get rideDestinationTitle => 'الوجهة';

  @override
  String get rideSwap => 'تبديل الاتجاه';

  @override
  String get rideGetEstimate => 'احسب السعر';

  @override
  String get rideOrderCta => 'اطلب الآن';

  @override
  String get rideScheduleCta => 'احجز للموعد المحدد';

  @override
  String fareSeats(int seats) {
    final intl.NumberFormat seatsNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String seatsString = seatsNumberFormat.format(seats);

    return '$seatsString مقاعد';
  }

  @override
  String fareEtaMinutes(String minutes) {
    return 'خلال $minutes د';
  }

  @override
  String get checkoutPaymentMethod => 'طريقة الدفع';

  @override
  String get checkoutPromoLabel => 'كود الخصم';

  @override
  String get checkoutPromoHint => 'أدخل الكود';

  @override
  String checkoutPromoApplied(String code) {
    return 'تم تطبيق الكود $code';
  }

  @override
  String get checkoutSchedule => 'موعد الطلب';

  @override
  String get checkoutScheduleNow => 'الآن';

  @override
  String get checkoutTotal => 'الإجمالي';

  @override
  String get paymentCash => 'نقدًا';

  @override
  String get paymentWallet => 'المحفظة';

  @override
  String get paymentCard => 'بطاقة';

  @override
  String get paymentOnline => 'دفع إلكتروني';

  @override
  String get deliveryRoute => 'المسار';

  @override
  String get deliveryPickupLabel => 'الاستلام من';

  @override
  String get deliveryPickupTitle => 'مكان الاستلام';

  @override
  String get deliveryDropoffLabel => 'التسليم إلى';

  @override
  String get deliveryDropoffTitle => 'مكان التسليم';

  @override
  String get deliveryPackage => 'تفاصيل الطرد';

  @override
  String get deliverySize => 'الحجم التقريبي';

  @override
  String get deliveryWeight => 'الوزن التقريبي';

  @override
  String get deliveryDescription => 'وصف محتوى الطرد';

  @override
  String get deliveryPhotosHint => 'صور الطرد تساعد الشريك على التحضير.';

  @override
  String get deliverySender => 'بيانات المُرسِل';

  @override
  String get deliveryRecipient => 'بيانات المُستلِم';

  @override
  String get deliveryNotes => 'ملاحظات للتسليم';

  @override
  String get deliveryUrgency => 'الأولوية';

  @override
  String get deliveryContactsRequired =>
      'أكمل اسم ورقم كل من المُرسِل والمُستلِم.';

  @override
  String get deliveryCategoriesUnavailable => 'تعذّر تحميل أنواع الطرود.';

  @override
  String get packageSizeSmall => 'صغير';

  @override
  String get packageSizeMedium => 'متوسط';

  @override
  String get packageSizeLarge => 'كبير';

  @override
  String get packageSizeXl => 'كبير جدًا';

  @override
  String get contactName => 'الاسم';

  @override
  String get contactPhone => 'رقم الهاتف';

  @override
  String get unitKg => 'كغم';

  @override
  String get unitMinutes => 'دقيقة';

  @override
  String get serviceLocationTitle => 'موقع الخدمة';

  @override
  String get serviceLocationEmpty => 'اختر موقع الخدمة';

  @override
  String get serviceSubcategory => 'نوع العمل';

  @override
  String get serviceOptions => 'إضافات';

  @override
  String get serviceProblemTitle => 'وصف المشكلة';

  @override
  String get serviceProblemHint => 'اشرح المشكلة بالتفصيل ليصل الفني مستعدًا.';

  @override
  String get serviceProblemTooShort => 'أضف وصفًا من ٥ أحرف على الأقل.';

  @override
  String get serviceProblemRequired => 'أضف وصفًا للمشكلة قبل الإرسال.';

  @override
  String get serviceMediaOptional => 'أضف صورًا إن أمكن (اختياري).';

  @override
  String serviceMediaRequired(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'مطلوب $countString صورة على الأقل.';
  }

  @override
  String get serviceInstructions => 'تعليمات إضافية';

  @override
  String get serviceUrgencyTitle => 'مستوى الاستعجال';

  @override
  String get serviceUrgencySurcharge => 'تُضاف رسوم استعجال إلى السعر النهائي.';

  @override
  String get serviceWhenTitle => 'موعد الزيارة';

  @override
  String get serviceWhenNow => 'في أقرب وقت';

  @override
  String get serviceWhenScheduled => 'اختر يومًا';

  @override
  String get timeSlotMorning => 'صباحًا';

  @override
  String get timeSlotAfternoon => 'بعد الظهر';

  @override
  String get timeSlotEvening => 'مساءً';

  @override
  String get urgencyStandard => 'عادي';

  @override
  String get urgencyUrgent => 'مستعجل';

  @override
  String get urgencyEmergency => 'طارئ';

  @override
  String get formRequired => 'هذا الحقل مطلوب';

  @override
  String formTooSmall(String min) {
    return 'القيمة أقل من الحد المسموح ($min)';
  }

  @override
  String formTooLarge(String max) {
    return 'القيمة أكبر من الحد المسموح ($max)';
  }

  @override
  String formTooManyItems(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'الحد الأقصى $countString عناصر';
  }

  @override
  String get formNotANumber => 'أدخل رقمًا صحيحًا';

  @override
  String get formInvalidOption => 'اختيار غير صالح';

  @override
  String get formChooseDate => 'اختر التاريخ';

  @override
  String get formChooseTime => 'اختر الوقت';

  @override
  String get mediaAttachPhotos => 'إرفاق صور';

  @override
  String get mediaGallery => 'المعرض';

  @override
  String get mediaCamera => 'الكاميرا';

  @override
  String get ordersTitle => 'طلباتي';

  @override
  String get ordersTabAll => 'الكل';

  @override
  String get ordersTabActive => 'نشط';

  @override
  String get ordersTabCompleted => 'مكتمل';

  @override
  String get ordersTabCancelled => 'ملغي';

  @override
  String get ordersEmptyTitle => 'لا توجد طلبات بعد';

  @override
  String get ordersEmptyBody => 'ابدأ أول طلب لك من الشاشة الرئيسية.';

  @override
  String get ordersEmptyCta => 'اذهب للرئيسية';

  @override
  String get ordersReorder => 'أعد الطلب';

  @override
  String get jobPricePending => 'السعر بعد الكشف';

  @override
  String get jobStatusDraft => 'مسودة';

  @override
  String get jobStatusRequested => 'تم استلام الطلب';

  @override
  String get jobStatusSearching => 'نبحث عن شريك';

  @override
  String get jobStatusAssigned => 'تم تعيين الشريك';

  @override
  String get jobStatusEnRoute => 'الشريك في الطريق';

  @override
  String get jobStatusArrived => 'الشريك وصل';

  @override
  String get jobStatusWaitingCustomer => 'بانتظارك';

  @override
  String get jobStatusInProgress => 'جارٍ التنفيذ';

  @override
  String get jobStatusInspection => 'جارٍ الكشف';

  @override
  String get jobStatusQuoteRequired => 'بانتظار عرض السعر';

  @override
  String get jobStatusQuoteSubmitted => 'عرض سعر بانتظار موافقتك';

  @override
  String get jobStatusQuoteApproved => 'تمت الموافقة على العرض';

  @override
  String get jobStatusQuoteRejected => 'تم رفض العرض';

  @override
  String get jobStatusWorkStarted => 'بدأ العمل';

  @override
  String get jobStatusWaitingForParts => 'بانتظار قطع الغيار';

  @override
  String get jobStatusWorkCompleted => 'انتهى العمل — بانتظار تأكيدك';

  @override
  String get jobStatusCustomerConfirmed => 'تم التأكيد';

  @override
  String get jobStatusCompleted => 'مكتمل';

  @override
  String get jobStatusCancelled => 'ملغي';

  @override
  String get jobStatusNoPartner => 'لا يوجد شريك متاح';

  @override
  String get jobStatusDisputed => 'قيد النزاع';

  @override
  String get trackingTitle => 'تتبّع الطلب';

  @override
  String get trackingSupport => 'الدعم';

  @override
  String trackingEta(String minutes) {
    return 'الوصول خلال $minutes دقيقة';
  }

  @override
  String get trackingEtaUnknown => 'نحدّث وقت الوصول…';

  @override
  String get trackingFinished => 'انتهى هذا الطلب.';

  @override
  String get trackingPollingFallback =>
      'التحديث المباشر غير متاح — نحدّث كل بضع ثوانٍ.';

  @override
  String trackingProgressLabel(int step, int total, String status) {
    final intl.NumberFormat stepNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String stepString = stepNumberFormat.format(step);
    final intl.NumberFormat totalNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String totalString = totalNumberFormat.format(total);

    return 'الخطوة $stepString من $totalString: $status';
  }

  @override
  String get trackingCallPartner => 'اتصال بالشريك';

  @override
  String get trackingChatPartner => 'محادثة الشريك';

  @override
  String get trackingTripPin => 'رمز بدء الرحلة';

  @override
  String get trackingTripPinHint => 'أعطِ هذا الرمز للسائق عند الركوب.';

  @override
  String get trackingDeliveryOtp => 'رمز التسليم';

  @override
  String get trackingDeliveryOtpHint => 'يُطلب هذا الرمز عند تسليم الطرد.';

  @override
  String get trackingNoPartnerTitle => 'لم نجد شريكًا متاحًا';

  @override
  String get trackingNoPartnerBody =>
      'يمكنك إعادة المحاولة الآن أو تعديل الطلب.';

  @override
  String get trackingRetryDispatch => 'أعد البحث عن شريك';

  @override
  String get trackingEstimatedTotal => 'الإجمالي التقديري';

  @override
  String get trackingShare => 'مشاركة الرحلة';

  @override
  String trackingShareMessage(String url) {
    return 'تابع رحلتي عبر تمام: $url';
  }

  @override
  String get trackingSos => 'استغاثة';

  @override
  String get sosTitle => 'إرسال استغاثة';

  @override
  String get sosBody =>
      'سيصل فريق السلامة إشعارًا فوريًا بموقعك وتفاصيل الطلب.';

  @override
  String get sosConfirm => 'أرسل الاستغاثة';

  @override
  String get sosSent => 'تم إرسال الاستغاثة، سنتواصل معك فورًا.';

  @override
  String get cancelTitle => 'إلغاء الطلب';

  @override
  String get cancelSubtitle => 'أخبرنا بالسبب حتى نتحسّن';

  @override
  String get cancelConfirm => 'تأكيد الإلغاء';

  @override
  String get cancelNote => 'تفاصيل إضافية';

  @override
  String get cancelFeeWarning =>
      'قد تُحتسب رسوم إلغاء إذا كان الشريك في طريقه إليك.';

  @override
  String get cancelReasonChangedMind => 'غيّرت رأيي';

  @override
  String get cancelReasonWaitTooLong => 'الانتظار طويل';

  @override
  String get cancelReasonWrongAddress => 'العنوان غير صحيح';

  @override
  String get cancelReasonPriceTooHigh => 'السعر مرتفع';

  @override
  String get cancelReasonPartnerNotMoving => 'الشريك لا يتحرك';

  @override
  String get cancelReasonSafety => 'مخاوف تتعلق بالسلامة';

  @override
  String get cancelReasonDuplicate => 'طلب مكرر';

  @override
  String get cancelReasonOther => 'سبب آخر';

  @override
  String get quoteTitle => 'عرض السعر';

  @override
  String get quoteChangeOrderTitle => 'تعديل على العرض';

  @override
  String get quoteReadyTitle => 'وصل عرض السعر';

  @override
  String get quoteReview => 'مراجعة العرض';

  @override
  String quoteRevision(int revision) {
    final intl.NumberFormat revisionNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String revisionString = revisionNumberFormat.format(revision);

    return 'المراجعة رقم $revisionString';
  }

  @override
  String get quoteApprove => 'الموافقة على العرض';

  @override
  String get quoteReject => 'رفض العرض';

  @override
  String get quoteConfirmReject => 'تأكيد الرفض';

  @override
  String get quoteRejectReason => 'سبب الرفض (اختياري)';

  @override
  String get quoteLabor => 'أجرة العمل';

  @override
  String get quoteParts => 'قطع الغيار';

  @override
  String get quoteFees => 'رسوم إضافية';

  @override
  String get quoteDiscount => 'خصم';

  @override
  String get quoteTax => 'ضريبة';

  @override
  String quoteDuration(int minutes) {
    final intl.NumberFormat minutesNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String minutesString = minutesNumberFormat.format(minutes);

    return 'المدة التقديرية $minutesString دقيقة';
  }

  @override
  String quoteItemMeta(String kind, String quantity) {
    return '$kind · الكمية $quantity';
  }

  @override
  String get workCompletedTitle => 'انتهى العمل';

  @override
  String get workCompletedBody => 'راجع العمل ثم أكّد إنجازه لإتمام الدفع.';

  @override
  String get workConfirmTitle => 'تأكيد إنجاز العمل';

  @override
  String get workConfirmBody =>
      'بتأكيدك، يُعتبر العمل منجزًا ويُحتسب المبلغ النهائي.';

  @override
  String get workConfirmCta => 'تأكيد إنجاز العمل';

  @override
  String get ratingTitle => 'تقييم الخدمة';

  @override
  String get ratingCta => 'قيّم الخدمة';

  @override
  String get ratingPrompt => 'كيف كانت تجربتك؟';

  @override
  String get ratingPartnerFallback => 'الشريك';

  @override
  String get ratingComment => 'أضف تعليقًا (اختياري)';

  @override
  String get ratingThanks => 'شكرًا لتقييمك!';

  @override
  String get ratingTagPunctual => 'ملتزم بالوقت';

  @override
  String get ratingTagPolite => 'لبق';

  @override
  String get ratingTagClean => 'نظيف';

  @override
  String get ratingTagProfessional => 'محترف';

  @override
  String get ratingTagGoodPrice => 'سعر مناسب';

  @override
  String get ratingTagCarefulDriving => 'قيادة آمنة';

  @override
  String get ratingTagLate => 'تأخر';

  @override
  String get ratingTagRude => 'غير لبق';

  @override
  String get ratingTagUnclean => 'غير نظيف';

  @override
  String get ratingTagUnprofessional => 'غير محترف';

  @override
  String get ratingTagOvercharged => 'سعر مبالغ';

  @override
  String get ratingTagUnsafeDriving => 'قيادة غير آمنة';

  @override
  String get receiptTitle => 'الفاتورة';

  @override
  String get receiptCta => 'عرض الفاتورة';

  @override
  String get receiptPayment => 'الدفع';

  @override
  String get receiptRefunded => 'المبلغ المُعاد';

  @override
  String get receiptCancellationFee => 'رسوم الإلغاء';

  @override
  String get receiptProofOfDelivery => 'إثبات التسليم';

  @override
  String receiptReceivedBy(String name) {
    return 'استلمها: $name';
  }

  @override
  String get paymentStatusPending => 'قيد الانتظار';

  @override
  String get paymentStatusAuthorized => 'محجوز';

  @override
  String get paymentStatusCaptured => 'مدفوع';

  @override
  String get paymentStatusFailed => 'فشل الدفع';

  @override
  String get paymentStatusRefunded => 'مُسترد';

  @override
  String get paymentStatusCancelled => 'ملغي';

  @override
  String get chatTitle => 'المحادثة';

  @override
  String get chatHint => 'اكتب رسالة…';

  @override
  String get chatSendPhoto => 'إرسال صورة';

  @override
  String get chatSendLocation => 'إرسال الموقع';

  @override
  String get chatSharedLocation => 'تمت مشاركة الموقع';

  @override
  String get chatLoadOlder => 'عرض الرسائل الأقدم';

  @override
  String get chatEmptyTitle => 'لا توجد رسائل بعد';

  @override
  String get chatEmptyBody => 'اكتب رسالة للتواصل مع الشريك.';

  @override
  String get walletTitle => 'المحفظة';

  @override
  String get walletBalance => 'رصيدك';

  @override
  String get walletPending => 'قيد التسوية';

  @override
  String get walletTopUp => 'شحن الرصيد';

  @override
  String get walletTopUpHint => 'اختر المبلغ ثم أكمل الدفع عبر مزوّد الدفع.';

  @override
  String get walletStatement => 'كشف الحساب';

  @override
  String get walletEmptyTitle => 'لا توجد حركات بعد';

  @override
  String get walletEmptyBody => 'ستظهر هنا كل عمليات الدفع والاسترداد.';

  @override
  String get walletPromos => 'العروض';

  @override
  String get walletReferrals => 'دعوة صديق';

  @override
  String get promosTitle => 'العروض والأكواد';

  @override
  String get promoEnterTitle => 'لديك كود خصم؟';

  @override
  String get promoEnterBody => 'احفظ الكود ليُطبَّق تلقائيًا على طلبك القادم.';

  @override
  String promoSaved(String code) {
    return 'تم حفظ الكود $code';
  }

  @override
  String promoPending(String code) {
    return 'الكود $code سيُطبَّق على طلبك القادم.';
  }

  @override
  String get referralsTitle => 'ادعُ أصدقاءك';

  @override
  String get referralsRewardPrefix => 'يحصل صديقك على';

  @override
  String referralsStats(int invited, int rewarded) {
    final intl.NumberFormat invitedNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String invitedString = invitedNumberFormat.format(invited);
    final intl.NumberFormat rewardedNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String rewardedString = rewardedNumberFormat.format(rewarded);

    return 'دعوت $invitedString صديقًا، وحصلت على $rewardedString مكافأة.';
  }

  @override
  String get referralsShare => 'مشاركة رمز الدعوة';

  @override
  String get referralsCopied => 'تم نسخ الرمز';

  @override
  String get accountTitle => 'حسابي';

  @override
  String get accountNoName => 'أضف اسمك';

  @override
  String get accountGroupActivity => 'نشاطي';

  @override
  String get accountGroupSettings => 'الإعدادات';

  @override
  String get accountGroupHelp => 'المساعدة والأمان';

  @override
  String get accountSignOut => 'تسجيل الخروج';

  @override
  String get accountSignOutConfirm => 'سيتم تسجيل خروجك من هذا الجهاز.';

  @override
  String get favoritesTitle => 'المفضلة';

  @override
  String get favoritesEmptyTitle => 'لا توجد خدمات مفضلة';

  @override
  String get favoritesEmptyBody =>
      'أضف الخدمات التي تستخدمها كثيرًا للوصول السريع.';

  @override
  String get profileTitle => 'الملف الشخصي';

  @override
  String get profileEmail => 'البريد الإلكتروني';

  @override
  String get profilePhone => 'رقم الهاتف';

  @override
  String get profilePhoneLocked => 'لتغيير الرقم تواصل مع الدعم.';

  @override
  String get profileSaved => 'تم حفظ التغييرات';

  @override
  String get preferencesTitle => 'التفضيلات';

  @override
  String get preferencesLanguage => 'اللغة';

  @override
  String get preferencesAppearance => 'المظهر';

  @override
  String get preferencesNotifications => 'الإشعارات';

  @override
  String get preferencesNotificationsUnavailable =>
      'تعذّر تحميل إعدادات الإشعارات.';

  @override
  String get preferencesPush => 'إشعارات التطبيق';

  @override
  String get preferencesSms => 'الرسائل النصية';

  @override
  String get preferencesEmail => 'البريد الإلكتروني';

  @override
  String get preferencesMarketing => 'العروض التسويقية';

  @override
  String get preferencesMarketingHint => 'أخبار العروض والخصومات فقط.';

  @override
  String get themeSystem => 'حسب النظام';

  @override
  String get themeLight => 'فاتح';

  @override
  String get themeDark => 'داكن';

  @override
  String get sessionsTitle => 'الأجهزة النشطة';

  @override
  String get sessionsEmptyTitle => 'لا توجد أجهزة أخرى';

  @override
  String sessionsLastSeen(String when) {
    return 'آخر نشاط $when';
  }

  @override
  String get sessionsThisDevice => 'هذا الجهاز';

  @override
  String get sessionsRevoke => 'إنهاء الجلسة';

  @override
  String get sessionsSignOutAll => 'تسجيل الخروج من كل الأجهزة';

  @override
  String get sessionsSignOutAllConfirm =>
      'سيتم إنهاء كل الجلسات بما فيها هذا الجهاز.';

  @override
  String get savedPlacesTitle => 'الأماكن المحفوظة';

  @override
  String get savedPlacesAdd => 'إضافة مكان';

  @override
  String get savedPlacesEdit => 'تعديل المكان';

  @override
  String get savedPlacesLabel => 'اسم المكان';

  @override
  String get savedPlacesEmptyTitle => 'لم تحفظ أي مكان بعد';

  @override
  String get savedPlacesEmptyBody => 'احفظ المنزل والعمل لتطلب بضغطة واحدة.';

  @override
  String get savedPlacesDeleteTitle => 'حذف المكان';

  @override
  String savedPlacesDeleteBody(String label) {
    return 'سيتم حذف «$label» نهائيًا.';
  }

  @override
  String get placeKindHome => 'المنزل';

  @override
  String get placeKindWork => 'العمل';

  @override
  String get placeKindCustom => 'مكان آخر';

  @override
  String get addressSheetTitle => 'اختر العنوان';

  @override
  String get addressSearchHint => 'ابحث عن شارع أو منطقة';

  @override
  String get addressUseCurrent => 'موقعي الحالي';

  @override
  String get addressPickOnMap => 'تحديد على الخريطة';

  @override
  String get addressManagePlaces => 'إدارة الأماكن المحفوظة';

  @override
  String get addressNoResults => 'لا توجد نتائج مطابقة.';

  @override
  String get addressSearchFailed => 'تعذّر البحث الآن، حاول لاحقًا.';

  @override
  String get addressAttribution => 'نتائج البحث من OpenStreetMap';

  @override
  String get addressBuilding => 'المبنى';

  @override
  String get addressFloor => 'الطابق';

  @override
  String get addressApartment => 'الشقة';

  @override
  String get addressNotes => 'ملاحظات للوصول';

  @override
  String get locationPickerTitle => 'تحديد الموقع';

  @override
  String get locationPickerHint => 'حرّك الخريطة لضبط الدبوس';

  @override
  String get locationPickerMoveMap => 'حرّك الخريطة لتحديد العنوان';

  @override
  String get locationPickerConfirm => 'تأكيد الموقع';

  @override
  String get notificationsTitle => 'الإشعارات';

  @override
  String get notificationsMarkAllRead => 'تعليم الكل كمقروء';

  @override
  String get notificationsEmptyTitle => 'لا توجد إشعارات';

  @override
  String get notificationsEmptyBody => 'سنخبرك هنا بكل جديد عن طلباتك.';

  @override
  String get supportTitle => 'الدعم';

  @override
  String get supportNewTicket => 'طلب دعم جديد';

  @override
  String get supportNewTicketHint => 'صف مشكلتك وسيتواصل معك فريق الدعم.';

  @override
  String get supportSubject => 'الموضوع';

  @override
  String get supportDescription => 'التفاصيل';

  @override
  String get supportReplyHint => 'اكتب ردك…';

  @override
  String get supportTicketTitle => 'طلب الدعم';

  @override
  String get supportEmptyTitle => 'لا توجد طلبات دعم';

  @override
  String get supportEmptyBody => 'افتح طلبًا جديدًا إذا احتجت مساعدة.';

  @override
  String get ticketCategoryPayment => 'الدفع';

  @override
  String get ticketCategoryJob => 'مشكلة في الطلب';

  @override
  String get ticketCategoryPartner => 'سلوك الشريك';

  @override
  String get ticketCategoryLostItem => 'غرض مفقود';

  @override
  String get ticketCategoryAccount => 'الحساب';

  @override
  String get ticketCategorySafety => 'السلامة';

  @override
  String get ticketCategoryOther => 'أخرى';

  @override
  String get ticketStatusOpen => 'مفتوح';

  @override
  String get ticketStatusInProgress => 'قيد المعالجة';

  @override
  String get ticketStatusWaitingUser => 'بانتظار ردك';

  @override
  String get ticketStatusResolved => 'تم الحل';

  @override
  String get ticketStatusClosed => 'مغلق';

  @override
  String get disputesTitle => 'النزاعات';

  @override
  String get disputesEmptyTitle => 'لا توجد نزاعات';

  @override
  String get disputesEmptyBody => 'افتح نزاعًا من صفحة الطلب إذا واجهت مشكلة.';

  @override
  String get disputeDetailTitle => 'تفاصيل النزاع';

  @override
  String get disputeOpen => 'فتح نزاع';

  @override
  String get disputeReasonLabel => 'سبب النزاع';

  @override
  String get disputeDescription => 'اشرح ما حدث';

  @override
  String get disputeRefunded => 'المبلغ المُعاد';

  @override
  String get disputeReasonNotCompleted => 'لم يُنجز العمل';

  @override
  String get disputeReasonPoorQuality => 'جودة سيئة';

  @override
  String get disputeReasonOvercharged => 'مبالغة في السعر';

  @override
  String get disputeReasonDamage => 'أضرار';

  @override
  String get disputeReasonItemMissing => 'غرض مفقود';

  @override
  String get disputeReasonMisconduct => 'سوء تصرف من الشريك';

  @override
  String get disputeReasonOther => 'سبب آخر';

  @override
  String get disputeStatusOpen => 'مفتوح';

  @override
  String get disputeStatusUnderReview => 'قيد المراجعة';

  @override
  String get disputeStatusResolvedCustomer => 'لصالحك';

  @override
  String get disputeStatusResolvedPartner => 'لصالح الشريك';

  @override
  String get disputeStatusResolvedSplit => 'تسوية جزئية';

  @override
  String get disputeStatusRejected => 'مرفوض';

  @override
  String get legalTitle => 'عن التطبيق';

  @override
  String get legalTermsTitle => 'شروط الاستخدام';

  @override
  String get legalTermsBody =>
      'باستخدامك تمام فإنك توافق على تقديم بيانات صحيحة، واحترام الشركاء، وسداد قيمة الخدمات المطلوبة. تُطبَّق رسوم الإلغاء وفق سياسة معلنة داخل التطبيق.';

  @override
  String get legalPrivacyTitle => 'الخصوصية';

  @override
  String get legalPrivacyBody =>
      'نستخدم موقعك ورقم هاتفك لتنفيذ الطلبات فقط. لا نشارك بياناتك مع أطراف ثالثة لأغراض تسويقية، ويمكنك إيقاف الرسائل التسويقية من التفضيلات.';

  @override
  String get legalDeleteAccount => 'طلب حذف الحساب';

  @override
  String get legalDeleteAccountHint => 'يفتح طلب دعم لمراجعة الحذف.';

  @override
  String get legalDeleteAccountConfirm =>
      'سنفتح طلب دعم لحذف حسابك. قد نحتفظ بسجلات الفواتير كما يقتضي القانون.';

  @override
  String get legalDeleteAccountCta => 'أرسل الطلب';

  @override
  String get legalDeleteAccountSubject => 'طلب حذف الحساب';

  @override
  String get legalDeleteAccountBody =>
      'أرغب بحذف حسابي وبياناتي الشخصية من تطبيق تمام.';

  @override
  String bannerPromoCopied(String code) {
    return 'تم نسخ الكود $code وسيُطبَّق على طلبك القادم.';
  }

  @override
  String get bannerLeaveAppTitle => 'فتح رابط خارجي';

  @override
  String bannerLeaveAppMessage(String host) {
    return 'سيتم فتح $host خارج التطبيق.';
  }

  @override
  String get publicTrackTitle => 'تتبّع الرحلة';

  @override
  String publicTrackPartner(String name) {
    return 'الشريك: $name';
  }

  @override
  String get emptyTitle => 'لا يوجد شيء هنا بعد';

  @override
  String get errorTitle => 'حدث خطأ';

  @override
  String get errorOfflineTitle => 'لا يوجد اتصال';

  @override
  String get offlineBanner =>
      'لا يوجد اتصال بالإنترنت — بعض البيانات قد تكون قديمة.';

  @override
  String get errorOffline => 'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.';

  @override
  String get errorNetwork => 'تعذّر الوصول إلى الخادم. حاول مرة أخرى.';

  @override
  String get errorGeneric => 'حدث خطأ غير متوقع. حاول مرة أخرى.';

  @override
  String get errorValidation => 'تحقق من البيانات المدخلة.';

  @override
  String get errorSessionExpired => 'انتهت جلستك، سجّل الدخول من جديد.';

  @override
  String get errorForbidden => 'لا تملك صلاحية لهذا الإجراء.';

  @override
  String get errorNotFound => 'العنصر المطلوب غير موجود.';

  @override
  String get errorRateLimited => 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة.';

  @override
  String get errorOtpInvalid => 'الرمز غير صحيح.';

  @override
  String get errorOtpExpired => 'انتهت صلاحية الرمز، اطلب رمزًا جديدًا.';

  @override
  String get errorOtpTooManyAttempts =>
      'محاولات خاطئة كثيرة، اطلب رمزًا جديدًا.';

  @override
  String get errorOtpCooldown => 'انتظر قليلًا قبل طلب رمز جديد.';

  @override
  String get errorAccountSuspended => 'تم إيقاف حسابك. تواصل مع الدعم.';

  @override
  String get errorAccountRestricted => 'حسابك مقيّد مؤقتًا.';

  @override
  String get errorOutsideZone => 'موقعك خارج نطاق خدمتنا حاليًا.';

  @override
  String get errorServiceUnavailableInZone => 'هذه الخدمة غير متاحة في منطقتك.';

  @override
  String get errorOutsideHours => 'الخدمة خارج ساعات العمل الآن.';

  @override
  String get errorNoPartners => 'لا يوجد شريك متاح حاليًا.';

  @override
  String get errorVersionConflict => 'تم تحديث الطلب، أعد المحاولة.';

  @override
  String get errorJobAlreadyAssigned => 'تم تعيين شريك لهذا الطلب بالفعل.';

  @override
  String get errorInsufficientBalance => 'رصيد المحفظة غير كافٍ.';

  @override
  String get errorPaymentMethodDisabled => 'طريقة الدفع هذه غير متاحة حاليًا.';

  @override
  String get errorPaymentFailed => 'فشلت عملية الدفع.';

  @override
  String get errorPromoInvalid => 'كود الخصم غير صالح.';

  @override
  String get errorPromoExpired => 'انتهت صلاحية كود الخصم.';

  @override
  String get errorPromoUsageExceeded => 'تم استهلاك هذا الكود بالكامل.';

  @override
  String get errorPromoMinOrder => 'قيمة الطلب أقل من الحد المطلوب للكود.';

  @override
  String get errorPromoNotEligible => 'هذا الكود غير متاح لطلبك.';

  @override
  String get errorRatingNotAllowed => 'لا يمكن تقييم هذا الطلب.';

  @override
  String get errorUploadTooLarge => 'حجم الملف كبير جدًا.';

  @override
  String get errorUploadInvalid => 'نوع الملف غير مدعوم.';

  @override
  String get errorFeatureDisabled => 'هذه الميزة غير مفعّلة حاليًا.';

  @override
  String get errorDuplicateRequest => 'تم إرسال هذا الطلب مسبقًا.';

  @override
  String get errorQuoteNotApproved => 'يجب الموافقة على عرض السعر أولًا.';

  @override
  String get errorCannotOpenLink => 'تعذّر فتح الرابط.';
}
