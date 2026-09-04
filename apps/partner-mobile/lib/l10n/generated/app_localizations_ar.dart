// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTagline => 'اشتغل وقتما تشاء… تمام';

  @override
  String get appPartnerTag => 'تطبيق الشركاء';

  @override
  String get navHome => 'الرئيسية';

  @override
  String get navJobs => 'المهام';

  @override
  String get navEarnings => 'أرباحي';

  @override
  String get navAccount => 'حسابي';

  @override
  String get offlineBanner =>
      'لا يوجد اتصال بالإنترنت — بعض البيانات قد تكون قديمة.';

  @override
  String activeJobBannerSemantics(String status) {
    return 'مهمة جارية، $status. اضغط لفتحها.';
  }

  @override
  String get realtimeReconnecting => 'جارٍ إعادة الاتصال…';

  @override
  String get actionAdd => 'إضافة';

  @override
  String get actionAllow => 'السماح';

  @override
  String get actionBack => 'رجوع';

  @override
  String get actionCancel => 'إلغاء';

  @override
  String get actionChange => 'تغيير';

  @override
  String get actionCheck => 'تحقّق';

  @override
  String get actionClear => 'مسح';

  @override
  String get actionConfirm => 'تأكيد';

  @override
  String get actionContinue => 'متابعة';

  @override
  String get actionDismiss => 'إخفاء';

  @override
  String get actionLoadMore => 'تحميل المزيد';

  @override
  String get actionMore => 'خيارات أخرى';

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
  String get actionSend => 'إرسال';

  @override
  String get actionSkip => 'تخطٍ';

  @override
  String distanceKm(String value) {
    return '$value كم';
  }

  @override
  String distanceM(String value) {
    return '$value م';
  }

  @override
  String durationMin(String value) {
    return '$value دقيقة';
  }

  @override
  String get signInTitle => 'أهلاً بك في تمام للشركاء';

  @override
  String get signInSubtitle => 'أدخل رقم هاتفك للدخول إلى حساب الشريك';

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
      'بمتابعتك فإنك توافق على شروط الشراكة وسياسة الخصوصية.';

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
  String get errorTitle => 'حدث خطأ';

  @override
  String get errorOfflineTitle => 'لا يوجد اتصال';

  @override
  String get emptyTitle => 'لا يوجد شيء هنا بعد';

  @override
  String get errorGeneric => 'حدث خطأ غير متوقع. حاول مرة أخرى.';

  @override
  String get errorNetwork => 'تعذّر الوصول إلى الخادم. حاول مرة أخرى.';

  @override
  String get errorOffline => 'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.';

  @override
  String get errorNotFound => 'العنصر المطلوب غير موجود.';

  @override
  String get errorForbidden => 'لا تملك صلاحية لهذا الإجراء.';

  @override
  String get errorValidation => 'تحقق من البيانات المدخلة.';

  @override
  String get errorRateLimited => 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة.';

  @override
  String get errorSessionExpired => 'انتهت جلستك، سجّل الدخول من جديد.';

  @override
  String get errorAccountRestricted => 'حسابك مقيّد مؤقتًا.';

  @override
  String get errorAccountSuspended => 'تم إيقاف حسابك. تواصل مع الدعم.';

  @override
  String get errorFeatureDisabled => 'هذه الميزة غير مفعّلة حاليًا.';

  @override
  String get errorDuplicateRequest => 'تم إرسال هذا الطلب مسبقًا.';

  @override
  String get errorInvalidTransition =>
      'حالة المهمة تغيّرت. حدّث الشاشة ثم أعد المحاولة.';

  @override
  String get errorVersionConflict =>
      'تم تحديث المهمة من جهة أخرى، أعد المحاولة.';

  @override
  String get errorOfferExpired => 'انتهت مهلة هذا العرض.';

  @override
  String get errorOfferTaken => 'قبل شريك آخر هذه المهمة.';

  @override
  String get errorPartnerNotAvailable => 'يجب أن تكون متصلًا لاستقبال المهام.';

  @override
  String get errorPartnerNotApproved =>
      'حسابك قيد المراجعة، ولا يمكنك الاتصال بعد.';

  @override
  String get errorOutsideZone => 'موقعك خارج نطاق عملك المعتمد.';

  @override
  String get errorOutsideHours => 'الخدمة خارج ساعات العمل الآن.';

  @override
  String get errorStaleLocation =>
      'موقعك قديم جدًا. تأكد من تفعيل الموقع ثم أعد المحاولة.';

  @override
  String get errorImpossibleMovement =>
      'قراءة الموقع غير منطقية. تحقق من دقة الـ GPS.';

  @override
  String get errorPickupOtpInvalid => 'رمز الاستلام غير صحيح.';

  @override
  String get errorDeliveryOtpInvalid => 'رمز التسليم غير صحيح.';

  @override
  String get errorTripPinInvalid => 'رمز بدء الرحلة غير صحيح.';

  @override
  String get errorQuoteNotApproved =>
      'يجب أن يوافق العميل على عرض السعر أولًا.';

  @override
  String get errorRatingNotAllowed => 'لا يمكن تقييم هذه المهمة.';

  @override
  String get errorInsufficientBalance => 'رصيدك غير كافٍ لهذا السحب.';

  @override
  String get errorUploadInvalid => 'نوع الملف غير مدعوم.';

  @override
  String get errorUploadTooLarge => 'حجم الملف كبير جدًا.';

  @override
  String get errorOtpInvalid => 'الرمز غير صحيح.';

  @override
  String get errorOtpExpired => 'انتهت صلاحية الرمز، اطلب رمزًا جديدًا.';

  @override
  String get errorOtpCooldown => 'انتظر قليلًا قبل طلب رمز جديد.';

  @override
  String get errorOtpTooManyAttempts =>
      'محاولات خاطئة كثيرة، اطلب رمزًا جديدًا.';

  @override
  String get errorCannotCall => 'تعذّر إجراء المكالمة من هذا الجهاز.';

  @override
  String get errorCannotOpenLink => 'تعذّر فتح الرابط.';

  @override
  String get locationUnavailable => 'تعذّر تحديد موقعك الآن.';

  @override
  String get homeGreeting => 'يومك سعيد';

  @override
  String get homeStatusOnline => 'متصل ومستعد للمهام';

  @override
  String get homeStatusOffline => 'غير متصل';

  @override
  String get homeTodayEarnings => 'أرباح اليوم';

  @override
  String get homeCompletedJobs => 'مهام اليوم';

  @override
  String get homeWaitingTitle => 'بانتظار أول عرض';

  @override
  String get homeWaitingBody =>
      'ابقَ ضمن منطقة عملك، وسنرسل لك أقرب مهمة مناسبة فور توفّرها.';

  @override
  String get homeOfflineEmptyTitle => 'أنت غير متصل الآن';

  @override
  String get homeOfflineEmptyBody =>
      'اضغط على زر الاتصال في الأعلى لتبدأ استقبال العروض.';

  @override
  String get homeProfileUnavailable => 'تعذّر تحميل ملفك الآن';

  @override
  String homePendingOffers(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'لديك $countString عرض بانتظار ردّك';
  }

  @override
  String get statsRating => 'التقييم';

  @override
  String get statsCompleted => 'مهام مكتملة';

  @override
  String get statsAcceptance => 'نسبة القبول';

  @override
  String get availabilityOnline => 'متصل';

  @override
  String get availabilityOffline => 'غير متصل';

  @override
  String get availabilityBusy => 'في مهمة';

  @override
  String availabilityToggleSemantics(String state) {
    return 'حالة العمل: $state. اضغط لتغييرها.';
  }

  @override
  String get availabilityPermissionDenied =>
      'نحتاج إذن الموقع لتشغيل وردية العمل.';

  @override
  String get availabilityServiceDisabled =>
      'خدمة الموقع مغلقة على جهازك. فعّلها ثم أعد المحاولة.';

  @override
  String availabilityExpiredDocuments(String documents) {
    return 'انتهت صلاحية: $documents. جدّدها لتتمكن من الاتصال.';
  }

  @override
  String get availabilityActiveJobBlocksOffline =>
      'لا يمكنك إيقاف الاتصال قبل إنهاء المهمة الجارية.';

  @override
  String get goOnlineTitle => 'ابدأ ورديتك';

  @override
  String get goOnlineSubtitle => 'راجع الأذونات والأدوار قبل الاتصال.';

  @override
  String get goOnlineConfirm => 'اتصل الآن';

  @override
  String get goOnlineDone => 'أنت متصل الآن — بالتوفيق!';

  @override
  String get goOnlineLocationTitle => 'تتبّع الموقع أثناء العمل';

  @override
  String get goOnlineLocationBody =>
      'نتابع موقعك فقط أثناء اتصالك، لنرسل لك أقرب المهام ونُظهر وصولك للعميل. يتوقف التتبّع فور إيقاف الاتصال.';

  @override
  String get goOnlineForegroundBody =>
      'سيظهر إشعار دائم أثناء الوردية — هذا ما يبقي التتبّع يعمل عندما تكون الشاشة مغلقة.';

  @override
  String get goOnlinePermissionAlways => 'إذن الموقع: دائمًا — مثالي';

  @override
  String get goOnlinePermissionWhileInUse => 'إذن الموقع: أثناء الاستخدام فقط';

  @override
  String get goOnlinePermissionPending => 'إذن الموقع مطلوب';

  @override
  String get goOnlineRoles => 'الأدوار الفعّالة هذه الوردية';

  @override
  String get goOnlineVehicle => 'المركبة';

  @override
  String get goOnlineNoVehicle => 'لا توجد مركبة مفعّلة لدورك الحالي.';

  @override
  String get goOfflineTitle => 'إيقاف الاتصال';

  @override
  String get goOfflineMessage => 'لن تصلك عروض جديدة حتى تعود للاتصال.';

  @override
  String get goOfflineConfirm => 'أوقف الاتصال';

  @override
  String get backgroundLimitedBanner =>
      'الإذن ممنوح أثناء الاستخدام فقط — قد يتوقف التتبّع عند إغلاق الشاشة.';

  @override
  String get foregroundNotificationTitle => 'تمام — وردية عمل جارية';

  @override
  String get foregroundNotificationIdle => 'متصل وبانتظار العروض';

  @override
  String get foregroundNotificationOnJob => 'مهمة جارية — التتبّع يعمل';

  @override
  String get interruptionPermission =>
      'تم سحب إذن الموقع، لذلك أصبحت غير متصل.';

  @override
  String get interruptionServiceDisabled =>
      'أُغلقت خدمة الموقع، لذلك أصبحت غير متصل.';

  @override
  String get interruptionServer => 'أنهى الخادم ورديتك. يمكنك الاتصال من جديد.';

  @override
  String get interruptionGeneric => 'توقفت وردية العمل.';

  @override
  String get resumeWorkTitle => 'هل تريد متابعة الوردية؟';

  @override
  String get resumeWorkBody =>
      'ما زلت مسجّلاً كمتصل لدى الخادم، لكن التتبّع على هذا الجهاز متوقف.';

  @override
  String get resumeWorkConfirm => 'تابع الوردية';

  @override
  String get resumeWorkDecline => 'أوقف الاتصال';

  @override
  String get warningNoActiveVehicle =>
      'لا توجد مركبة مفعّلة — فعّل مركبة قبل بدء الوردية.';

  @override
  String warningDocumentExpired(String document) {
    return 'انتهت صلاحية $document.';
  }

  @override
  String warningDocumentRejected(String document) {
    return 'تم رفض $document. أعد رفعه.';
  }

  @override
  String warningDocumentExpiring(String document, int days) {
    final intl.NumberFormat daysNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String daysString = daysNumberFormat.format(days);

    return 'تنتهي صلاحية $document خلال $daysString يومًا.';
  }

  @override
  String get offerTitle => 'مهمة جديدة';

  @override
  String get offerAccept => 'قبول';

  @override
  String get offerDecline => 'رفض';

  @override
  String offerSecondsLeft(int seconds) {
    final intl.NumberFormat secondsNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String secondsString = secondsNumberFormat.format(seconds);

    return '$secondsString ث';
  }

  @override
  String offerQueuePosition(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'و$countString عروض أخرى بانتظارك';
  }

  @override
  String get offerEstimatedEarnings => 'أرباحك المتوقعة';

  @override
  String get offerPickup => 'نقطة الاستلام';

  @override
  String get offerServiceLocation => 'موقع الخدمة';

  @override
  String get offerDestination => 'الوجهة';

  @override
  String get offerWaypoint => 'محطة في الطريق';

  @override
  String get offerToPickup => 'المسافة إليك';

  @override
  String get offerEta => 'وقت الوصول';

  @override
  String get offerTripDistance => 'مسافة الرحلة';

  @override
  String get jobTypeRide => 'مشوار';

  @override
  String get jobTypeDelivery => 'توصيل طرد';

  @override
  String get jobTypeFood => 'توصيل طعام';

  @override
  String get jobTypeHomeService => 'خدمة منزلية';

  @override
  String get jobTypeOther => 'خدمة';

  @override
  String get jobStatusDraft => 'مسودة';

  @override
  String get jobStatusSearching => 'جارٍ البحث عن شريك';

  @override
  String get jobStatusAssigned => 'تم إسنادها إليك';

  @override
  String get jobStatusEnRoute => 'أنت في الطريق';

  @override
  String get jobStatusArrived => 'وصلت';

  @override
  String get jobStatusWaitingCustomer => 'بانتظار العميل';

  @override
  String get jobStatusInProgress => 'جارية';

  @override
  String get jobStatusInspection => 'جارٍ الكشف';

  @override
  String get jobStatusQuoteRequired => 'مطلوب عرض سعر';

  @override
  String get jobStatusQuoteSubmitted => 'أُرسل العرض — بانتظار العميل';

  @override
  String get jobStatusQuoteApproved => 'تمت الموافقة على العرض';

  @override
  String get jobStatusQuoteRejected => 'رُفض العرض';

  @override
  String get jobStatusWorkStarted => 'العمل جارٍ';

  @override
  String get jobStatusWaitingForParts => 'بانتظار قطع الغيار';

  @override
  String get jobStatusWorkCompleted => 'انتهى العمل — بانتظار تأكيد العميل';

  @override
  String get jobStatusCustomerConfirmed => 'أكّد العميل';

  @override
  String get jobStatusCompleted => 'مكتملة';

  @override
  String get jobStatusCancelled => 'ملغاة';

  @override
  String get jobStatusNoPartner => 'لم يتوفر شريك';

  @override
  String get jobStatusDisputed => 'قيد النزاع';

  @override
  String get urgencyStandard => 'عادي';

  @override
  String get urgencyUrgent => 'مستعجل';

  @override
  String get urgencyEmergency => 'طارئ';

  @override
  String get paymentCash => 'نقدًا';

  @override
  String get paymentCard => 'بطاقة';

  @override
  String get paymentWallet => 'المحفظة';

  @override
  String get paymentBank => 'حوالة بنكية';

  @override
  String get paymentOnline => 'دفع إلكتروني';

  @override
  String get roleDriver => 'سائق';

  @override
  String get roleCourier => 'مندوب توصيل';

  @override
  String get roleTechnician => 'فنّي';

  @override
  String get roleServiceProvider => 'مزوّد خدمة';

  @override
  String get roleDriverCaption => 'مشاوير بالسيارة داخل مدينتك';

  @override
  String get roleCourierCaption => 'توصيل الطرود والطعام';

  @override
  String get roleTechnicianCaption => 'صيانة وإصلاح في منزل العميل';

  @override
  String get roleServiceProviderCaption => 'خدمات منزلية متخصصة بعرض سعر';

  @override
  String get jobActionEnRoute => 'أنا في الطريق';

  @override
  String get jobActionArrive => 'وصلت';

  @override
  String get jobActionStartRide => 'ابدأ الرحلة';

  @override
  String get jobActionPickedUp => 'استلمت الطرد';

  @override
  String get jobActionStartInspection => 'ابدأ الكشف';

  @override
  String get jobActionCompleteRide => 'أنهِ الرحلة';

  @override
  String get jobActionDeliver => 'سلّم الطرد';

  @override
  String get jobActionSubmitQuote => 'أرسل عرض السعر';

  @override
  String get jobActionStartWork => 'ابدأ العمل';

  @override
  String get jobActionCompleteWork => 'أنهِ العمل';

  @override
  String get jobActionResumeWork => 'استأنف العمل';

  @override
  String get jobActionWaitingForParts => 'بانتظار قطع غيار';

  @override
  String get jobActionChangeOrder => 'أضف عملاً إضافيًا';

  @override
  String get jobPassiveAwaitQuote => 'أرسلنا عرضك إلى العميل، بانتظار قراره.';

  @override
  String get jobPassiveAwaitConfirmation =>
      'بانتظار تأكيد العميل لانتهاء العمل.';

  @override
  String get jobPassiveCancelled => 'أُلغيت هذه المهمة.';

  @override
  String get jobPassiveNothing => 'لا يوجد إجراء مطلوب الآن.';

  @override
  String get jobNavigate => 'الملاحة';

  @override
  String get navigateWith => 'الملاحة عبر';

  @override
  String get navigateGoogleMaps => 'خرائط Google';

  @override
  String get navigateWaze => 'Waze';

  @override
  String get navigateUnavailable => 'لا يوجد تطبيق ملاحة مثبّت على جهازك.';

  @override
  String get jobCurrentTarget => 'وجهتك الآن';

  @override
  String get jobCallCustomer => 'اتصال';

  @override
  String get jobChatCustomer => 'محادثة';

  @override
  String jobWaitingSince(String duration) {
    return 'بانتظار العميل منذ $duration';
  }

  @override
  String arriveTooFar(int meters) {
    final intl.NumberFormat metersNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String metersString = metersNumberFormat.format(meters);

    return 'أنت على بُعد $metersString متر من الموقع. اقترب أكثر ثم أكّد الوصول.';
  }

  @override
  String get jobVersionConflictHint =>
      'تغيّرت المهمة أثناء عملك عليها — راجع التفاصيل قبل المتابعة.';

  @override
  String get tripPinTitle => 'رمز بدء الرحلة';

  @override
  String get tripPinSubtitle => 'اطلب من الراكب الرمز الظاهر في تطبيقه.';

  @override
  String get pickupOtpTitle => 'رمز الاستلام';

  @override
  String get pickupOtpSubtitle => 'اطلب رمز الاستلام من المُرسِل.';

  @override
  String get completeRideConfirm =>
      'سيتم إنهاء الرحلة واحتساب الأجرة النهائية.';

  @override
  String get cancelJobTitle => 'إلغاء المهمة';

  @override
  String get cancelJobSubtitle =>
      'اختر سببًا واضحًا — يؤثر الإلغاء على نسبة قبولك.';

  @override
  String get cancelJobConfirm => 'تأكيد الإلغاء';

  @override
  String get cancelJobReasonRequired => 'التفاصيل (مطلوبة)';

  @override
  String get cancelJobReasonOptional => 'تفاصيل إضافية (اختياري)';

  @override
  String get cancelJobNoShowAfterArrival =>
      'خيار \"العميل لم يحضر\" متاح بعد تأكيد وصولك وانتهاء مدة الانتظار.';

  @override
  String get cancelReasonNoShow => 'العميل لم يحضر';

  @override
  String get cancelReasonUnreachable => 'تعذّر التواصل مع العميل';

  @override
  String get cancelReasonWrongAddress => 'العنوان غير صحيح';

  @override
  String get cancelReasonVehicleIssue => 'عطل في المركبة';

  @override
  String get cancelReasonSafety => 'مخاوف تتعلق بالسلامة';

  @override
  String get cancelReasonOther => 'سبب آخر';

  @override
  String get releaseJobTitle => 'إعادة المهمة للتوزيع';

  @override
  String get releaseJobSubtitle =>
      'ستُعرض المهمة على شريك آخر ولن تُحتسب إلغاءً عليك.';

  @override
  String get releaseJobReason => 'سبب الإعادة';

  @override
  String get releaseJobConfirm => 'أعِد المهمة';

  @override
  String get releaseJobDone => 'أُعيدت المهمة للتوزيع.';

  @override
  String get podTitle => 'إثبات التسليم';

  @override
  String get podSubtitle => 'أكّد تسليم الطرد للمستلم.';

  @override
  String podSubtitleNamed(String name) {
    return 'أكّد تسليم الطرد إلى $name.';
  }

  @override
  String get podModeOtp => 'رمز التسليم';

  @override
  String get podModeManual => 'توقيع وصورة';

  @override
  String get podOtpHint => 'اطلب من المستلم رمز التسليم الظاهر في تطبيقه.';

  @override
  String get podReceiverName => 'اسم المستلم';

  @override
  String get podPhotoLabel => 'صورة التسليم';

  @override
  String get podPhotoHint => 'صورة واضحة للطرد في مكان التسليم.';

  @override
  String get podSignatureLabel => 'توقيع المستلم';

  @override
  String get podSignatureHint => 'اطلب من المستلم التوقيع بإصبعه داخل الإطار.';

  @override
  String get completeWorkTitle => 'إنهاء العمل';

  @override
  String get completeWorkSubtitle => 'وثّق ما أنجزته قبل تسليم المهمة للعميل.';

  @override
  String get completeWorkPhotos => 'صور بعد العمل';

  @override
  String get completeWorkPhotosHint =>
      'صور واضحة تُظهر النتيجة — تحمي حقّك عند أي نزاع.';

  @override
  String get completeWorkApprovedTotal => 'المبلغ المعتمد';

  @override
  String get completeWorkCustomerConfirms =>
      'يؤكد العميل انتهاء العمل، ثم تُضاف أرباحك إلى رصيدك.';

  @override
  String get completionTitle => 'أُنجزت المهمة';

  @override
  String completionSubtitle(String number) {
    return 'المهمة رقم $number';
  }

  @override
  String get completionAwaitingTitle => 'بانتظار تأكيد العميل';

  @override
  String get completionAwaitingSubtitle =>
      'أنهيت العمل. تُضاف الأرباح بعد تأكيد العميل.';

  @override
  String get completionCollectCash => 'حصّل المبلغ نقدًا من العميل.';

  @override
  String get completionPaidElectronically =>
      'تم الدفع إلكترونيًا — لا تحصّل نقدًا.';

  @override
  String get completionYourEarnings => 'أرباحك من هذه المهمة';

  @override
  String get completionRateCustomer => 'قيّم العميل';

  @override
  String get completionBackHome => 'العودة للرئيسية';

  @override
  String get jobsTitle => 'المهام';

  @override
  String get jobsFilterAll => 'الكل';

  @override
  String get jobsFilterActive => 'الجارية';

  @override
  String get jobsFilterCompleted => 'المكتملة';

  @override
  String get jobsFilterCancelled => 'الملغاة';

  @override
  String get jobsFilterByDate => 'تصفية حسب التاريخ';

  @override
  String get jobsEmptyTitle => 'لا توجد مهام';

  @override
  String get jobsEmptyBody => 'ستظهر هنا كل المهام التي نفّذتها.';

  @override
  String get jobDetailTitle => 'تفاصيل المهمة';

  @override
  String get jobEarningsBreakdown => 'تفصيل الأرباح';

  @override
  String get jobNoBreakdown => 'لا يوجد تفصيل متاح لهذه المهمة.';

  @override
  String get jobTotalCharged => 'إجمالي ما دفعه العميل';

  @override
  String get jobRatingTitle => 'تقييم العميل لك';

  @override
  String get jobRatingUnavailable => 'لم يقيّمك العميل بعد.';

  @override
  String jobCancelledReason(String reason) {
    return 'سبب الإلغاء: $reason';
  }

  @override
  String get jobReportProblem => 'الإبلاغ عن مشكلة';

  @override
  String get ratingTitle => 'تقييم العميل';

  @override
  String get ratingPrompt => 'كيف كانت تجربتك مع العميل؟';

  @override
  String get ratingCustomer => 'العميل';

  @override
  String get ratingCommentOptional => 'ملاحظات (اختياري)';

  @override
  String get ratingSubmit => 'إرسال التقييم';

  @override
  String get ratingThanks => 'شكرًا لتقييمك!';

  @override
  String get ratingTagPolite => 'لبق';

  @override
  String get ratingTagPunctual => 'ملتزم بالوقت';

  @override
  String get ratingTagClearAddress => 'عنوان واضح';

  @override
  String get ratingTagEasyParking => 'موقف سهل';

  @override
  String get ratingTagLate => 'تأخر';

  @override
  String get ratingTagRude => 'غير لبق';

  @override
  String get ratingTagWrongAddress => 'عنوان غير صحيح';

  @override
  String get ratingTagExtraStops => 'محطات إضافية غير متفق عليها';

  @override
  String get chatTitle => 'المحادثة';

  @override
  String get chatHint => 'اكتب رسالة…';

  @override
  String get chatEmptyTitle => 'لا توجد رسائل بعد';

  @override
  String get chatEmptyBody => 'اكتب رسالة للتواصل مع العميل.';

  @override
  String get chatLoadOlder => 'عرض الرسائل الأقدم';

  @override
  String get chatSendPhoto => 'إرسال صورة';

  @override
  String get chatSendLocation => 'إرسال الموقع';

  @override
  String get chatSharedLocation => 'تمت مشاركة الموقع';

  @override
  String get quoteBuilderTitle => 'عرض السعر';

  @override
  String get quoteBuilderChangeOrderTitle => 'عمل إضافي';

  @override
  String get quoteItemsTitle => 'البنود';

  @override
  String get quoteAddItem => 'إضافة بند';

  @override
  String get quoteEditItem => 'تعديل البند';

  @override
  String get quoteEmptyHint =>
      'أضف بندًا واحدًا على الأقل ليصل العرض إلى العميل.';

  @override
  String get quoteItemDescription => 'وصف البند';

  @override
  String get quoteItemQuantity => 'الكمية';

  @override
  String get quoteItemUnitPrice => 'سعر الوحدة';

  @override
  String quoteLineTotal(String total) {
    return 'إجمالي البند: $total';
  }

  @override
  String get quoteKindLabor => 'أجرة عمل';

  @override
  String get quoteKindParts => 'قطع غيار';

  @override
  String get quoteKindFee => 'رسوم';

  @override
  String get quoteDiscount => 'خصم';

  @override
  String get quoteDiscountTooLarge => 'الخصم أكبر من مجموع البنود.';

  @override
  String get quoteDescriptionLabel => 'ملاحظات للعميل';

  @override
  String get quoteDurationLabel => 'المدة المتوقعة (دقيقة)';

  @override
  String get quoteDurationHint => 'تساعد العميل على تنظيم وقته.';

  @override
  String get quotePreviewTitle => 'معاينة';

  @override
  String get quotePreviewTotal => 'الإجمالي التقديري';

  @override
  String get quotePreviewDisclaimer =>
      'هذه معاينة على جهازك فقط. يحتسب الخادم الضريبة والرسوم النهائية عند الإرسال، وأرقامه هي المعتمدة.';

  @override
  String get quoteSubmit => 'إرسال العرض';

  @override
  String get quoteSubmitChangeOrder => 'إرسال العمل الإضافي';

  @override
  String get quoteSubmitted => 'أُرسل العرض إلى العميل.';

  @override
  String get quoteChangeOrderHint =>
      'يُضاف العمل الإضافي إلى العرض المعتمد بعد موافقة العميل عليه.';

  @override
  String quoteRejectionNote(String note) {
    return 'ملاحظة العميل على الرفض: $note';
  }

  @override
  String get quoteVersionConflict =>
      'تغيّر العرض من جهة أخرى. حدّث الشاشة ثم أعد الإرسال.';

  @override
  String quoteTitle(int revision) {
    final intl.NumberFormat revisionNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String revisionString = revisionNumberFormat.format(revision);

    return 'عرض السعر رقم $revisionString';
  }

  @override
  String quoteChangeOrderTitle(int revision) {
    final intl.NumberFormat revisionNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String revisionString = revisionNumberFormat.format(revision);

    return 'عمل إضافي رقم $revisionString';
  }

  @override
  String get quoteTotal => 'الإجمالي';

  @override
  String get quoteTax => 'ضريبة';

  @override
  String quoteEstimatedDuration(String minutes) {
    return 'المدة المتوقعة: $minutes دقيقة';
  }

  @override
  String get quoteStatusDraft => 'مسودة';

  @override
  String get quoteStatusSubmitted => 'بانتظار العميل';

  @override
  String get quoteStatusApproved => 'معتمد';

  @override
  String get quoteStatusRejected => 'مرفوض';

  @override
  String get quoteStatusCancelled => 'ملغى';

  @override
  String get quoteStatusSuperseded => 'استُبدل بعرض أحدث';

  @override
  String get earningsTitle => 'أرباحي';

  @override
  String get earningsToday => 'اليوم';

  @override
  String get earningsWeek => 'هذا الأسبوع';

  @override
  String get earningsMonth => 'هذا الشهر';

  @override
  String earningsCompletedJobs(String count) {
    return '$count مهمة مكتملة';
  }

  @override
  String get earningsGross => 'إجمالي الأرباح';

  @override
  String get earningsCommission => 'عمولة تمام';

  @override
  String get earningsBonuses => 'حوافز ومكافآت';

  @override
  String get earningsAdjustments => 'تسويات';

  @override
  String get earningsNet => 'صافي أرباحك';

  @override
  String get earningsWithdrawals => 'مسحوبات';

  @override
  String get earningsBalance => 'الرصيد المتاح';

  @override
  String get statementTitle => 'كشف الحساب';

  @override
  String get statementEmptyTitle => 'لا توجد حركات';

  @override
  String get statementEmptyBody => 'ستظهر هنا كل الحركات المالية على محفظتك.';

  @override
  String statementBalanceAfter(String balance) {
    return 'الرصيد بعدها: $balance';
  }

  @override
  String get withdrawTitle => 'سحب الأرباح';

  @override
  String withdrawAvailable(String amount) {
    return 'المتاح للسحب: $amount';
  }

  @override
  String get withdrawAmount => 'المبلغ';

  @override
  String get withdrawAmountInvalid => 'أدخل مبلغًا صحيحًا.';

  @override
  String get withdrawAll => 'سحب الكل';

  @override
  String get withdrawToAccount => 'إلى الحساب البنكي';

  @override
  String get withdrawConfirm => 'تأكيد السحب';

  @override
  String get withdrawProcessingHint =>
      'تُراجَع طلبات السحب خلال أيام العمل، وتصل الحوالة بعد الموافقة.';

  @override
  String get withdrawRequested => 'أُرسل طلب السحب.';

  @override
  String get withdrawalsTitle => 'طلبات السحب';

  @override
  String get withdrawalsEmptyTitle => 'لا توجد طلبات سحب';

  @override
  String get withdrawalsEmptyBody => 'ستظهر هنا طلبات السحب وحالتها.';

  @override
  String withdrawalFee(String fee) {
    return 'رسوم التحويل: $fee';
  }

  @override
  String get withdrawalStatusRequested => 'قيد المراجعة';

  @override
  String get withdrawalStatusApproved => 'معتمد';

  @override
  String get withdrawalStatusPaid => 'تم التحويل';

  @override
  String get withdrawalStatusRejected => 'مرفوض';

  @override
  String get bankAccountAdd => 'إضافة حساب بنكي';

  @override
  String get bankAccountHint => 'يجب أن يكون الحساب باسمك كما هو في الهوية.';

  @override
  String get bankAccountHolder => 'اسم صاحب الحساب';

  @override
  String get bankAccountBankName => 'اسم البنك';

  @override
  String get bankAccountIban => 'رقم الآيبان (IBAN)';

  @override
  String get onboardingStepPersonal => 'بياناتك';

  @override
  String get onboardingStepRoles => 'نوع العمل';

  @override
  String get onboardingStepSkills => 'مهاراتك';

  @override
  String get onboardingStepDocuments => 'الوثائق';

  @override
  String get onboardingStepVehicle => 'المركبة';

  @override
  String get onboardingStepZones => 'مناطق العمل';

  @override
  String get onboardingStepReview => 'المراجعة';

  @override
  String onboardingStepCounter(int step, int total) {
    final intl.NumberFormat stepNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String stepString = stepNumberFormat.format(step);
    final intl.NumberFormat totalNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String totalString = totalNumberFormat.format(total);

    return 'الخطوة $stepString من $totalString';
  }

  @override
  String get onboardingFullName => 'الاسم الكامل';

  @override
  String get onboardingDateOfBirth => 'تاريخ الميلاد';

  @override
  String get onboardingDateOfBirthHint => 'اختر تاريخ ميلادك';

  @override
  String get onboardingNationalId => 'رقم الهوية';

  @override
  String get onboardingCity => 'المدينة';

  @override
  String get onboardingEmailOptional => 'البريد الإلكتروني (اختياري)';

  @override
  String get onboardingPhotoHint =>
      'صورة شخصية واضحة بخلفية فاتحة — يراها العميل عند وصولك.';

  @override
  String get onboardingRolesHint =>
      'اختر كل ما تنوي العمل به. يمكنك تعديل ذلك لاحقًا من التفضيلات.';

  @override
  String get onboardingSkillsHint =>
      'حدّد الخدمات التي تتقنها ليصلك العمل المناسب فقط.';

  @override
  String get onboardingSkillsLabel => 'مهارة';

  @override
  String get onboardingSkillsHelper =>
      'اكتب مهارة ثم أضفها (مثل: تمديدات صحية).';

  @override
  String get onboardingYearsOfExperience => 'سنوات الخبرة';

  @override
  String get onboardingNoCategories => 'لا توجد تصنيفات متاحة حاليًا';

  @override
  String get onboardingDocumentsHint =>
      'ارفع وثائقك بصورة واضحة وكاملة الأطراف. تُراجَع خلال يوم عمل.';

  @override
  String get onboardingDocumentsComplete => 'اكتملت كل الوثائق المطلوبة.';

  @override
  String get onboardingDocumentsPending => 'ما زالت هناك وثائق مطلوبة.';

  @override
  String get onboardingVehicleHint =>
      'أضف المركبة التي ستعمل بها. يمكنك إضافة غيرها لاحقًا.';

  @override
  String get onboardingZonesHint =>
      'اختر المناطق التي تريد استقبال المهام فيها.';

  @override
  String get onboardingNoZones => 'لا توجد مناطق متاحة حاليًا';

  @override
  String get onboardingReviewHint =>
      'راجع بياناتك قبل الإرسال — يمكنك تعديل أي خطوة.';

  @override
  String get onboardingReviewIncomplete => 'أكمل الخطوات السابقة لعرض الملخّص.';

  @override
  String get onboardingAcceptTerms => 'أوافق على شروط الشراكة وسياسة الخصوصية.';

  @override
  String get onboardingReadTerms => 'اقرأ الشروط';

  @override
  String get onboardingSubmit => 'إرسال الطلب للمراجعة';

  @override
  String get documentNotUploaded => 'لم تُرفع';

  @override
  String get onboardingStatusTitle => 'حالة طلبك';

  @override
  String get onboardingDraftTitle => 'طلبك غير مكتمل';

  @override
  String get onboardingDraftBody =>
      'أكمل الخطوات المتبقية ثم أرسل الطلب للمراجعة.';

  @override
  String get onboardingUnderReviewTitle => 'قيد المراجعة';

  @override
  String get onboardingUnderReviewBody =>
      'نراجع بياناتك ووثائقك الآن. سنُعلمك بالنتيجة عبر إشعار ورسالة نصية خلال يوم عمل.';

  @override
  String get onboardingApprovedTitle => 'تم قبولك';

  @override
  String get onboardingApprovedBody =>
      'أهلاً بك في تمام. يمكنك الاتصال وبدء استقبال المهام.';

  @override
  String get onboardingRejectedTitle => 'يحتاج طلبك إلى تعديل';

  @override
  String get onboardingRejectedBody => 'صحّح النقاط التالية ثم أعد الإرسال.';

  @override
  String get onboardingRejectedWhatToFix => 'ما يجب تصحيحه';

  @override
  String get onboardingRejectedNoDocumentDetail =>
      'لم يوضّح المراجع سببًا محددًا. تواصل مع الدعم للتفاصيل.';

  @override
  String get onboardingResubmit => 'أعد إرسال الطلب';

  @override
  String get onboardingSuspendedTitle => 'حسابك موقوف';

  @override
  String get onboardingSuspendedBody =>
      'تواصل مع الدعم لمعرفة السبب وخطوات إعادة التفعيل.';

  @override
  String get onboardingContactSupport => 'تواصل مع الدعم';

  @override
  String get onboardingReviewProgress => 'تقدّم المراجعة';

  @override
  String onboardingDocumentsApproved(int approved, int total) {
    final intl.NumberFormat approvedNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String approvedString = approvedNumberFormat.format(approved);
    final intl.NumberFormat totalNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String totalString = totalNumberFormat.format(total);

    return 'تمت الموافقة على $approvedString من $totalString وثائق';
  }

  @override
  String onboardingSubmittedOn(String date) {
    return 'أُرسل الطلب في $date';
  }

  @override
  String get onboardingFixRejection => 'صحّح هذه الخطوة ثم تابع.';

  @override
  String get onboardingSeeReasons => 'عرض أسباب الرفض';

  @override
  String get documentsTitle => 'وثائقي';

  @override
  String get documentsRequired => 'وثائق مطلوبة';

  @override
  String get documentsOther => 'وثائق أخرى';

  @override
  String get documentsReviewHint =>
      'تُراجَع الوثائق خلال يوم عمل. سنُعلمك بأي تغيير.';

  @override
  String get documentsBlockingWarning =>
      'لا يمكنك الاتصال حتى تُعتمد كل الوثائق المطلوبة وتكون سارية.';

  @override
  String get documentUpload => 'رفع';

  @override
  String get documentReupload => 'إعادة الرفع';

  @override
  String get documentUploadHint =>
      'صوّر الوثيقة كاملة وواضحة، أو ارفع ملف PDF.';

  @override
  String get documentUploadFailed => 'تعذّر رفع الملف. حاول مرة أخرى.';

  @override
  String get documentUploaded => 'تم رفع الوثيقة.';

  @override
  String get documentNumber => 'رقم الوثيقة';

  @override
  String get documentExpiryDate => 'تاريخ انتهاء الصلاحية';

  @override
  String get documentExpiryHint => 'اختر تاريخ الانتهاء';

  @override
  String documentExpiresOn(String date) {
    return 'تنتهي في $date';
  }

  @override
  String documentRejectionReason(String reason) {
    return 'سبب الرفض: $reason';
  }

  @override
  String get documentStatusPending => 'قيد المراجعة';

  @override
  String get documentStatusApproved => 'معتمدة';

  @override
  String get documentStatusRejected => 'مرفوضة';

  @override
  String get documentStatusExpired => 'منتهية';

  @override
  String get documentId => 'الهوية الشخصية';

  @override
  String get documentDrivingLicense => 'رخصة القيادة';

  @override
  String get documentVehicleLicense => 'رخصة المركبة';

  @override
  String get documentInsurance => 'التأمين';

  @override
  String get documentProfessionalCertificate => 'شهادة مهنية';

  @override
  String get documentBusiness => 'سجل تجاري';

  @override
  String get documentProfilePicture => 'الصورة الشخصية';

  @override
  String get vehiclesTitle => 'مركباتي';

  @override
  String get vehiclesAdd => 'إضافة مركبة';

  @override
  String get vehiclesEmptyTitle => 'لا توجد مركبات';

  @override
  String get vehiclesEmptyBody => 'أضف مركبتك ليتم اعتمادها قبل بدء العمل.';

  @override
  String get vehicleDetailTitle => 'تفاصيل المركبة';

  @override
  String get vehicleType => 'نوع المركبة';

  @override
  String get vehicleBrand => 'الشركة المصنّعة';

  @override
  String get vehicleModel => 'الطراز';

  @override
  String get vehicleYear => 'سنة الصنع';

  @override
  String get vehicleColor => 'اللون';

  @override
  String get vehiclePlate => 'رقم اللوحة';

  @override
  String get vehicleSeats => 'عدد المقاعد';

  @override
  String get vehiclePhotos => 'صور المركبة';

  @override
  String get vehiclePhotosHint => 'صورة أمامية وأخرى للوحة الأرقام على الأقل.';

  @override
  String get vehicleDocuments => 'وثائق المركبة';

  @override
  String get vehicleActive => 'المركبة الفعّالة';

  @override
  String get vehicleIsActive => 'هذه هي المركبة التي تعمل بها الآن.';

  @override
  String get vehicleActivate => 'اجعلها الفعّالة';

  @override
  String vehicleActivated(String vehicle) {
    return 'أصبحت $vehicle مركبتك الفعّالة.';
  }

  @override
  String get vehicleNotActivatable => 'لا يمكن تفعيل مركبة قبل اعتمادها.';

  @override
  String get vehicleReviewNotice =>
      'تُراجَع المركبة الجديدة قبل السماح بالعمل بها.';

  @override
  String get vehicleSubmittedForReview => 'أُرسلت المركبة للمراجعة.';

  @override
  String get vehicleStatusPending => 'قيد المراجعة';

  @override
  String get vehicleStatusApproved => 'معتمدة';

  @override
  String get vehicleStatusRejected => 'مرفوضة';

  @override
  String get vehicleStatusSuspended => 'موقوفة';

  @override
  String get accountTitle => 'حسابي';

  @override
  String get accountNoName => 'أضف اسمك';

  @override
  String get accountApproved => 'شريك معتمد';

  @override
  String get accountNotApproved => 'قيد المراجعة';

  @override
  String get accountGroupWork => 'العمل';

  @override
  String get accountGroupActivity => 'النشاط';

  @override
  String get accountGroupSettings => 'الإعدادات';

  @override
  String get accountGroupHelp => 'المساعدة والأمان';

  @override
  String get accountSignOut => 'تسجيل الخروج';

  @override
  String get accountSignOutConfirm =>
      'سيتم إيقاف اتصالك وإنهاء التتبّع على هذا الجهاز.';

  @override
  String get profileTitle => 'الملف الشخصي';

  @override
  String get profilePhone => 'رقم الهاتف';

  @override
  String get profilePhoneLocked => 'لتغيير الرقم تواصل مع الدعم.';

  @override
  String get profileEmail => 'البريد الإلكتروني';

  @override
  String get profileSaved => 'تم حفظ التغييرات';

  @override
  String get workPreferencesTitle => 'تفضيلات العمل';

  @override
  String get workPreferencesActiveRoles => 'الأدوار الفعّالة';

  @override
  String get workPreferencesActiveRolesHint =>
      'اختر ما تريد استقباله هذه الوردية من بين أدوارك المعتمدة.';

  @override
  String get workPreferencesRolesApplyNextShift =>
      'يُطبَّق هذا الخيار على هذا الجهاز فور اتصالك القادم.';

  @override
  String get workPreferencesZones => 'مناطق العمل';

  @override
  String get workPreferencesZonesHint => 'المناطق التي تصلك فيها المهام.';

  @override
  String get workPreferencesCategories => 'الخدمات';

  @override
  String get workPreferencesCategoriesHint => 'الخدمات المعتمدة في ملفك.';

  @override
  String get workPreferencesCategoriesReviewNotice =>
      'قد تحتاج إضافة خدمة جديدة إلى مراجعة ووثائق إضافية.';

  @override
  String get workPreferencesSaved => 'تم حفظ تفضيلاتك';

  @override
  String get preferencesTitle => 'التفضيلات';

  @override
  String get preferencesLanguage => 'اللغة';

  @override
  String get preferencesAppearance => 'المظهر';

  @override
  String get preferencesNotificationsMovedHint =>
      'إعدادات الإشعارات أصبحت في صفحة مستقلة.';

  @override
  String get themeSystem => 'حسب النظام';

  @override
  String get themeLight => 'فاتح';

  @override
  String get themeDark => 'داكن';

  @override
  String get notificationSettingsTitle => 'إعدادات الإشعارات';

  @override
  String get notificationSettingsOffersAlwaysOn =>
      'إشعارات عروض المهام تبقى مفعّلة دائمًا أثناء الوردية — بدونها لن تصلك المهام.';

  @override
  String get preferencesPush => 'إشعارات التطبيق';

  @override
  String get preferencesPushHint => 'تحديثات المهام والأرباح.';

  @override
  String get preferencesSms => 'الرسائل النصية';

  @override
  String get preferencesEmail => 'البريد الإلكتروني';

  @override
  String get preferencesMarketing => 'العروض التسويقية';

  @override
  String get preferencesMarketingHint => 'أخبار الحوافز والمكافآت فقط.';

  @override
  String get notificationsTitle => 'الإشعارات';

  @override
  String get notificationsEmptyTitle => 'لا توجد إشعارات';

  @override
  String get notificationsEmptyBody => 'سنخبرك هنا بكل جديد عن مهامك وأرباحك.';

  @override
  String get notificationsMarkAllRead => 'تعليم الكل كمقروء';

  @override
  String get sessionsTitle => 'الأجهزة النشطة';

  @override
  String get sessionsEmptyTitle => 'لا توجد أجهزة أخرى';

  @override
  String get sessionsThisDevice => 'هذا الجهاز';

  @override
  String sessionsLastSeen(String when) {
    return 'آخر نشاط $when';
  }

  @override
  String get sessionsRevoke => 'إنهاء الجلسة';

  @override
  String get sessionsSignOutAll => 'تسجيل الخروج من كل الأجهزة';

  @override
  String get sessionsSignOutAllConfirm =>
      'سيتم إنهاء كل الجلسات بما فيها هذا الجهاز.';

  @override
  String get legalTitle => 'الشروط والخصوصية';

  @override
  String get legalTermsTitle => 'شروط الشراكة';

  @override
  String get legalTermsBody =>
      'بعملك مع تمام تلتزم بتقديم بيانات صحيحة، والحفاظ على سريان وثائقك، ومعاملة العملاء باحترام، وتنفيذ المهام التي تقبلها. تُحتسب عمولة تمام على كل مهمة مكتملة وفق النسبة المعلنة في هذه الصفحة، وقد يؤدي الإلغاء المتكرر أو رفض المهام إلى تقليل ما يصلك من عروض.';

  @override
  String get legalCommissionTitle => 'العمولة والأرباح';

  @override
  String get legalCommissionBody =>
      'تُحتسب أرباحك من إجمالي قيمة المهمة بعد خصم عمولة تمام وأي رسوم معلنة. تُضاف الأرباح إلى رصيدك فور اكتمال المهمة وتأكيد العميل، ويمكنك سحبها إلى حسابك البنكي في أي وقت وفق حدّ السحب الأدنى.';

  @override
  String get legalTrackingTitle => 'تتبّع الموقع';

  @override
  String get legalTrackingBody =>
      'يُسجَّل موقعك أثناء اتصالك فقط، ويتوقف التسجيل فور إيقاف الاتصال أو سحب الإذن. نستخدمه لإرسال أقرب المهام إليك، وإظهار وصولك للعميل، وحل النزاعات. لا نشارك موقعك مع أطراف ثالثة لأغراض تسويقية.';

  @override
  String get legalPrivacyTitle => 'الخصوصية';

  @override
  String get legalPrivacyBody =>
      'نحتفظ ببياناتك ووثائقك للمدة التي يفرضها القانون ولأغراض التحقق والمحاسبة فقط. يظهر للعميل اسمك الأول وصورتك وتقييمك وبيانات مركبتك، ولا يظهر رقم هاتفك مباشرة عند تفعيل إخفاء الأرقام.';

  @override
  String legalTermsVersion(String version) {
    return 'إصدار الشروط $version';
  }

  @override
  String get legalDeleteAccount => 'طلب حذف الحساب';

  @override
  String get legalDeleteAccountHint => 'يفتح طلب دعم لمراجعة الحذف.';

  @override
  String get legalDeleteAccountConfirm =>
      'سنفتح طلب دعم لحذف حسابك. تُسوّى الأرباح المستحقة أولًا، وقد نحتفظ بسجلات المهام والفواتير كما يقتضي القانون.';

  @override
  String get legalDeleteAccountCta => 'أرسل الطلب';

  @override
  String get legalDeleteAccountSubject => 'طلب حذف حساب شريك';

  @override
  String get legalDeleteAccountBody =>
      'أرغب بحذف حساب الشريك الخاص بي وبياناتي الشخصية من تمام.';

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
  String get supportEmptyTitle => 'لا توجد طلبات دعم';

  @override
  String get supportEmptyBody => 'افتح طلبًا جديدًا إذا احتجت مساعدة.';

  @override
  String get supportTicketTitle => 'طلب الدعم';

  @override
  String get supportReplyHint => 'اكتب ردك…';

  @override
  String get ticketCategoryJob => 'مشكلة في مهمة';

  @override
  String get ticketCategoryPayment => 'الأرباح والدفع';

  @override
  String get ticketCategoryAccount => 'الحساب والوثائق';

  @override
  String get ticketCategoryCustomer => 'سلوك عميل';

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
  String get mediaAttachPhotos => 'إرفاق صور';

  @override
  String get mediaCamera => 'الكاميرا';

  @override
  String get mediaGallery => 'المعرض';

  @override
  String get bannerLeaveAppTitle => 'فتح رابط خارجي';

  @override
  String bannerLeaveAppMessage(String host) {
    return 'سيتم فتح $host خارج التطبيق.';
  }

  @override
  String bannerPromoCopied(String code) {
    return 'تم نسخ الكود $code.';
  }

  @override
  String get chaletOwnerTitle => 'شاليهاتي';

  @override
  String get chaletOwnerEmpty => 'لا توجد شاليهات';

  @override
  String get chaletOwnerEmptyBody => 'الشاليهات التي تديرها ستظهر هنا.';

  @override
  String get chaletOwnerPending => 'بانتظار الموافقة';

  @override
  String get chaletOwnerRejected => 'مرفوض';

  @override
  String get chaletOwnerLive => 'متاح للحجز';

  @override
  String get chaletOwnerPaused => 'متوقف';

  @override
  String get chaletOccupancy => 'نسبة الإشغال';

  @override
  String chaletOccupancyValue(int percent) {
    return '$percent%';
  }

  @override
  String get chaletRevenue => 'الإيراد';

  @override
  String get chaletBookingsCount => 'الحجوزات';

  @override
  String get chaletCancelledCount => 'الإلغاءات';

  @override
  String get chaletAverageRate => 'متوسط سعر الساعة';

  @override
  String chaletQuietestDay(String day) {
    return 'أهدأ يوم: $day';
  }

  @override
  String get chaletByWeekday => 'الإشغال حسب اليوم';

  @override
  String get chaletByHour => 'الإشغال حسب الساعة';

  @override
  String get chaletGapsTitle => 'فجوات بين الحجوزات';

  @override
  String get chaletGapsEmpty => 'لا توجد فجوات اليوم';

  @override
  String get chaletGapsBody =>
      'الفجوات هي ساعات فارغة محصورة بين حجزين — يصعب بيعها بالسعر الكامل.';

  @override
  String chaletGapDuration(int minutes) {
    return '$minutes دقيقة فارغة';
  }

  @override
  String get chaletBookingsTitle => 'الحجوزات';

  @override
  String get chaletBookingsEmpty => 'لا توجد حجوزات بعد';

  @override
  String get chaletSourceTamam => 'عبر تمام';

  @override
  String get chaletSourceManual => 'سجّلته بنفسك';

  @override
  String get chaletAddExternal => 'تسجيل حجز هاتفي';

  @override
  String get chaletAddExternalBody =>
      'الحجز الذي تستقبله بالهاتف يحجز الوقت تمامًا مثل حجز تمام، فيبقى تقويم تمام هو المرجع الوحيد.';

  @override
  String get chaletGuestName => 'اسم الضيف';

  @override
  String get chaletGuestPhone => 'هاتف الضيف';

  @override
  String get chaletAutomationTitle => 'إعدادات البيع';

  @override
  String get chaletSmartPricing => 'التسعير الذكي';

  @override
  String get chaletSmartPricingBody =>
      'يعدّل السعر حسب إشغال تقويمك، ولا ينزل أبدًا تحت الحد الأدنى الذي حددته.';

  @override
  String get chaletGapFiller => 'عروض الفجوات';

  @override
  String get chaletGapFillerBody =>
      'يعرض الساعات المحصورة بين حجزين بسعر مخفّض.';

  @override
  String get chaletLastMinute => 'عروض اللحظة الأخيرة';

  @override
  String get chaletLastMinuteBody =>
      'يخفّض سعر الساعات القريبة التي ما زالت فارغة.';

  @override
  String get chaletInstantBookingSetting => 'الحجز الفوري';

  @override
  String get chaletInstantBookingBody =>
      'يتيح للضيف تأكيد الحجز دون انتظار موافقتك.';

  @override
  String chaletFloorNotice(String rate) {
    return 'الحد الأدنى الذي حددته: $rate';
  }

  @override
  String get chaletSave => 'حفظ';
}
