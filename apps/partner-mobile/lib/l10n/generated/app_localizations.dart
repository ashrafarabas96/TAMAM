import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en')
  ];

  /// No description provided for @appTagline.
  ///
  /// In ar, this message translates to:
  /// **'اشتغل وقتما تشاء… تمام'**
  String get appTagline;

  /// No description provided for @appPartnerTag.
  ///
  /// In ar, this message translates to:
  /// **'تطبيق الشركاء'**
  String get appPartnerTag;

  /// No description provided for @navHome.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get navHome;

  /// No description provided for @navJobs.
  ///
  /// In ar, this message translates to:
  /// **'المهام'**
  String get navJobs;

  /// No description provided for @navEarnings.
  ///
  /// In ar, this message translates to:
  /// **'أرباحي'**
  String get navEarnings;

  /// No description provided for @navAccount.
  ///
  /// In ar, this message translates to:
  /// **'حسابي'**
  String get navAccount;

  /// No description provided for @offlineBanner.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اتصال بالإنترنت — بعض البيانات قد تكون قديمة.'**
  String get offlineBanner;

  /// No description provided for @activeJobBannerSemantics.
  ///
  /// In ar, this message translates to:
  /// **'مهمة جارية، {status}. اضغط لفتحها.'**
  String activeJobBannerSemantics(String status);

  /// No description provided for @realtimeReconnecting.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ إعادة الاتصال…'**
  String get realtimeReconnecting;

  /// No description provided for @actionAdd.
  ///
  /// In ar, this message translates to:
  /// **'إضافة'**
  String get actionAdd;

  /// No description provided for @actionAllow.
  ///
  /// In ar, this message translates to:
  /// **'السماح'**
  String get actionAllow;

  /// No description provided for @actionBack.
  ///
  /// In ar, this message translates to:
  /// **'رجوع'**
  String get actionBack;

  /// No description provided for @actionCancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get actionCancel;

  /// No description provided for @actionChange.
  ///
  /// In ar, this message translates to:
  /// **'تغيير'**
  String get actionChange;

  /// No description provided for @actionCheck.
  ///
  /// In ar, this message translates to:
  /// **'تحقّق'**
  String get actionCheck;

  /// No description provided for @actionClear.
  ///
  /// In ar, this message translates to:
  /// **'مسح'**
  String get actionClear;

  /// No description provided for @actionConfirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد'**
  String get actionConfirm;

  /// No description provided for @actionContinue.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get actionContinue;

  /// No description provided for @actionDismiss.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء'**
  String get actionDismiss;

  /// No description provided for @actionLoadMore.
  ///
  /// In ar, this message translates to:
  /// **'تحميل المزيد'**
  String get actionLoadMore;

  /// No description provided for @actionMore.
  ///
  /// In ar, this message translates to:
  /// **'خيارات أخرى'**
  String get actionMore;

  /// No description provided for @actionNext.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get actionNext;

  /// No description provided for @actionOpenSettings.
  ///
  /// In ar, this message translates to:
  /// **'فتح الإعدادات'**
  String get actionOpenSettings;

  /// No description provided for @actionRemove.
  ///
  /// In ar, this message translates to:
  /// **'إزالة'**
  String get actionRemove;

  /// No description provided for @actionRetry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get actionRetry;

  /// No description provided for @actionSave.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get actionSave;

  /// No description provided for @actionSend.
  ///
  /// In ar, this message translates to:
  /// **'إرسال'**
  String get actionSend;

  /// No description provided for @actionSkip.
  ///
  /// In ar, this message translates to:
  /// **'تخطٍ'**
  String get actionSkip;

  /// No description provided for @distanceKm.
  ///
  /// In ar, this message translates to:
  /// **'{value} كم'**
  String distanceKm(String value);

  /// No description provided for @distanceM.
  ///
  /// In ar, this message translates to:
  /// **'{value} م'**
  String distanceM(String value);

  /// No description provided for @durationMin.
  ///
  /// In ar, this message translates to:
  /// **'{value} دقيقة'**
  String durationMin(String value);

  /// No description provided for @signInTitle.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً بك في تمام للشركاء'**
  String get signInTitle;

  /// No description provided for @signInSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رقم هاتفك للدخول إلى حساب الشريك'**
  String get signInSubtitle;

  /// No description provided for @signInPhoneLabel.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف'**
  String get signInPhoneLabel;

  /// No description provided for @signInPhoneHint.
  ///
  /// In ar, this message translates to:
  /// **'599123456'**
  String get signInPhoneHint;

  /// No description provided for @signInSendCode.
  ///
  /// In ar, this message translates to:
  /// **'إرسال رمز التحقق'**
  String get signInSendCode;

  /// No description provided for @signInOtpExplainer.
  ///
  /// In ar, this message translates to:
  /// **'سنرسل لك رمزًا من ٦ أرقام عبر رسالة نصية.'**
  String get signInOtpExplainer;

  /// No description provided for @signInTerms.
  ///
  /// In ar, this message translates to:
  /// **'بمتابعتك فإنك توافق على شروط الشراكة وسياسة الخصوصية.'**
  String get signInTerms;

  /// No description provided for @signedOutExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت جلستك، يرجى تسجيل الدخول من جديد.'**
  String get signedOutExpired;

  /// No description provided for @signedOutRevoked.
  ///
  /// In ar, this message translates to:
  /// **'تم إنهاء الجلسة من جهاز آخر.'**
  String get signedOutRevoked;

  /// No description provided for @otpTitle.
  ///
  /// In ar, this message translates to:
  /// **'رمز التحقق'**
  String get otpTitle;

  /// No description provided for @otpSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'أرسلنا رمزًا إلى {phone}'**
  String otpSubtitle(String phone);

  /// No description provided for @otpVerify.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد'**
  String get otpVerify;

  /// No description provided for @otpResend.
  ///
  /// In ar, this message translates to:
  /// **'إعادة إرسال الرمز'**
  String get otpResend;

  /// No description provided for @otpResendIn.
  ///
  /// In ar, this message translates to:
  /// **'يمكنك إعادة الإرسال بعد {seconds} ثانية'**
  String otpResendIn(int seconds);

  /// No description provided for @otpDevCode.
  ///
  /// In ar, this message translates to:
  /// **'رمز بيئة التطوير: {code}'**
  String otpDevCode(String code);

  /// No description provided for @errorTitle.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ'**
  String get errorTitle;

  /// No description provided for @errorOfflineTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اتصال'**
  String get errorOfflineTitle;

  /// No description provided for @emptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد شيء هنا بعد'**
  String get emptyTitle;

  /// No description provided for @errorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ غير متوقع. حاول مرة أخرى.'**
  String get errorGeneric;

  /// No description provided for @errorNetwork.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الوصول إلى الخادم. حاول مرة أخرى.'**
  String get errorNetwork;

  /// No description provided for @errorOffline.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.'**
  String get errorOffline;

  /// No description provided for @errorNotFound.
  ///
  /// In ar, this message translates to:
  /// **'العنصر المطلوب غير موجود.'**
  String get errorNotFound;

  /// No description provided for @errorForbidden.
  ///
  /// In ar, this message translates to:
  /// **'لا تملك صلاحية لهذا الإجراء.'**
  String get errorForbidden;

  /// No description provided for @errorValidation.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من البيانات المدخلة.'**
  String get errorValidation;

  /// No description provided for @errorRateLimited.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة.'**
  String get errorRateLimited;

  /// No description provided for @errorSessionExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت جلستك، سجّل الدخول من جديد.'**
  String get errorSessionExpired;

  /// No description provided for @errorAccountRestricted.
  ///
  /// In ar, this message translates to:
  /// **'حسابك مقيّد مؤقتًا.'**
  String get errorAccountRestricted;

  /// No description provided for @errorAccountSuspended.
  ///
  /// In ar, this message translates to:
  /// **'تم إيقاف حسابك. تواصل مع الدعم.'**
  String get errorAccountSuspended;

  /// No description provided for @errorFeatureDisabled.
  ///
  /// In ar, this message translates to:
  /// **'هذه الميزة غير مفعّلة حاليًا.'**
  String get errorFeatureDisabled;

  /// No description provided for @errorDuplicateRequest.
  ///
  /// In ar, this message translates to:
  /// **'تم إرسال هذا الطلب مسبقًا.'**
  String get errorDuplicateRequest;

  /// No description provided for @errorInvalidTransition.
  ///
  /// In ar, this message translates to:
  /// **'حالة المهمة تغيّرت. حدّث الشاشة ثم أعد المحاولة.'**
  String get errorInvalidTransition;

  /// No description provided for @errorVersionConflict.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث المهمة من جهة أخرى، أعد المحاولة.'**
  String get errorVersionConflict;

  /// No description provided for @errorOfferExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت مهلة هذا العرض.'**
  String get errorOfferExpired;

  /// No description provided for @errorOfferTaken.
  ///
  /// In ar, this message translates to:
  /// **'قبل شريك آخر هذه المهمة.'**
  String get errorOfferTaken;

  /// No description provided for @errorPartnerNotAvailable.
  ///
  /// In ar, this message translates to:
  /// **'يجب أن تكون متصلًا لاستقبال المهام.'**
  String get errorPartnerNotAvailable;

  /// No description provided for @errorPartnerNotApproved.
  ///
  /// In ar, this message translates to:
  /// **'حسابك قيد المراجعة، ولا يمكنك الاتصال بعد.'**
  String get errorPartnerNotApproved;

  /// No description provided for @errorOutsideZone.
  ///
  /// In ar, this message translates to:
  /// **'موقعك خارج نطاق عملك المعتمد.'**
  String get errorOutsideZone;

  /// No description provided for @errorOutsideHours.
  ///
  /// In ar, this message translates to:
  /// **'الخدمة خارج ساعات العمل الآن.'**
  String get errorOutsideHours;

  /// No description provided for @errorStaleLocation.
  ///
  /// In ar, this message translates to:
  /// **'موقعك قديم جدًا. تأكد من تفعيل الموقع ثم أعد المحاولة.'**
  String get errorStaleLocation;

  /// No description provided for @errorImpossibleMovement.
  ///
  /// In ar, this message translates to:
  /// **'قراءة الموقع غير منطقية. تحقق من دقة الـ GPS.'**
  String get errorImpossibleMovement;

  /// No description provided for @errorPickupOtpInvalid.
  ///
  /// In ar, this message translates to:
  /// **'رمز الاستلام غير صحيح.'**
  String get errorPickupOtpInvalid;

  /// No description provided for @errorDeliveryOtpInvalid.
  ///
  /// In ar, this message translates to:
  /// **'رمز التسليم غير صحيح.'**
  String get errorDeliveryOtpInvalid;

  /// No description provided for @errorTripPinInvalid.
  ///
  /// In ar, this message translates to:
  /// **'رمز بدء الرحلة غير صحيح.'**
  String get errorTripPinInvalid;

  /// No description provided for @errorQuoteNotApproved.
  ///
  /// In ar, this message translates to:
  /// **'يجب أن يوافق العميل على عرض السعر أولًا.'**
  String get errorQuoteNotApproved;

  /// No description provided for @errorRatingNotAllowed.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن تقييم هذه المهمة.'**
  String get errorRatingNotAllowed;

  /// No description provided for @errorInsufficientBalance.
  ///
  /// In ar, this message translates to:
  /// **'رصيدك غير كافٍ لهذا السحب.'**
  String get errorInsufficientBalance;

  /// No description provided for @errorUploadInvalid.
  ///
  /// In ar, this message translates to:
  /// **'نوع الملف غير مدعوم.'**
  String get errorUploadInvalid;

  /// No description provided for @errorUploadTooLarge.
  ///
  /// In ar, this message translates to:
  /// **'حجم الملف كبير جدًا.'**
  String get errorUploadTooLarge;

  /// No description provided for @errorOtpInvalid.
  ///
  /// In ar, this message translates to:
  /// **'الرمز غير صحيح.'**
  String get errorOtpInvalid;

  /// No description provided for @errorOtpExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية الرمز، اطلب رمزًا جديدًا.'**
  String get errorOtpExpired;

  /// No description provided for @errorOtpCooldown.
  ///
  /// In ar, this message translates to:
  /// **'انتظر قليلًا قبل طلب رمز جديد.'**
  String get errorOtpCooldown;

  /// No description provided for @errorOtpTooManyAttempts.
  ///
  /// In ar, this message translates to:
  /// **'محاولات خاطئة كثيرة، اطلب رمزًا جديدًا.'**
  String get errorOtpTooManyAttempts;

  /// No description provided for @errorCannotCall.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر إجراء المكالمة من هذا الجهاز.'**
  String get errorCannotCall;

  /// No description provided for @errorCannotOpenLink.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر فتح الرابط.'**
  String get errorCannotOpenLink;

  /// No description provided for @locationUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحديد موقعك الآن.'**
  String get locationUnavailable;

  /// No description provided for @homeGreeting.
  ///
  /// In ar, this message translates to:
  /// **'يومك سعيد'**
  String get homeGreeting;

  /// No description provided for @homeStatusOnline.
  ///
  /// In ar, this message translates to:
  /// **'متصل ومستعد للمهام'**
  String get homeStatusOnline;

  /// No description provided for @homeStatusOffline.
  ///
  /// In ar, this message translates to:
  /// **'غير متصل'**
  String get homeStatusOffline;

  /// No description provided for @homeTodayEarnings.
  ///
  /// In ar, this message translates to:
  /// **'أرباح اليوم'**
  String get homeTodayEarnings;

  /// No description provided for @homeCompletedJobs.
  ///
  /// In ar, this message translates to:
  /// **'مهام اليوم'**
  String get homeCompletedJobs;

  /// No description provided for @homeWaitingTitle.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار أول عرض'**
  String get homeWaitingTitle;

  /// No description provided for @homeWaitingBody.
  ///
  /// In ar, this message translates to:
  /// **'ابقَ ضمن منطقة عملك، وسنرسل لك أقرب مهمة مناسبة فور توفّرها.'**
  String get homeWaitingBody;

  /// No description provided for @homeOfflineEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'أنت غير متصل الآن'**
  String get homeOfflineEmptyTitle;

  /// No description provided for @homeOfflineEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'اضغط على زر الاتصال في الأعلى لتبدأ استقبال العروض.'**
  String get homeOfflineEmptyBody;

  /// No description provided for @homeProfileUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل ملفك الآن'**
  String get homeProfileUnavailable;

  /// No description provided for @homePendingOffers.
  ///
  /// In ar, this message translates to:
  /// **'لديك {count} عرض بانتظار ردّك'**
  String homePendingOffers(int count);

  /// No description provided for @statsRating.
  ///
  /// In ar, this message translates to:
  /// **'التقييم'**
  String get statsRating;

  /// No description provided for @statsCompleted.
  ///
  /// In ar, this message translates to:
  /// **'مهام مكتملة'**
  String get statsCompleted;

  /// No description provided for @statsAcceptance.
  ///
  /// In ar, this message translates to:
  /// **'نسبة القبول'**
  String get statsAcceptance;

  /// No description provided for @availabilityOnline.
  ///
  /// In ar, this message translates to:
  /// **'متصل'**
  String get availabilityOnline;

  /// No description provided for @availabilityOffline.
  ///
  /// In ar, this message translates to:
  /// **'غير متصل'**
  String get availabilityOffline;

  /// No description provided for @availabilityBusy.
  ///
  /// In ar, this message translates to:
  /// **'في مهمة'**
  String get availabilityBusy;

  /// No description provided for @availabilityToggleSemantics.
  ///
  /// In ar, this message translates to:
  /// **'حالة العمل: {state}. اضغط لتغييرها.'**
  String availabilityToggleSemantics(String state);

  /// No description provided for @availabilityPermissionDenied.
  ///
  /// In ar, this message translates to:
  /// **'نحتاج إذن الموقع لتشغيل وردية العمل.'**
  String get availabilityPermissionDenied;

  /// No description provided for @availabilityServiceDisabled.
  ///
  /// In ar, this message translates to:
  /// **'خدمة الموقع مغلقة على جهازك. فعّلها ثم أعد المحاولة.'**
  String get availabilityServiceDisabled;

  /// No description provided for @availabilityExpiredDocuments.
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية: {documents}. جدّدها لتتمكن من الاتصال.'**
  String availabilityExpiredDocuments(String documents);

  /// No description provided for @availabilityActiveJobBlocksOffline.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكنك إيقاف الاتصال قبل إنهاء المهمة الجارية.'**
  String get availabilityActiveJobBlocksOffline;

  /// No description provided for @goOnlineTitle.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ ورديتك'**
  String get goOnlineTitle;

  /// No description provided for @goOnlineSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'راجع الأذونات والأدوار قبل الاتصال.'**
  String get goOnlineSubtitle;

  /// No description provided for @goOnlineConfirm.
  ///
  /// In ar, this message translates to:
  /// **'اتصل الآن'**
  String get goOnlineConfirm;

  /// No description provided for @goOnlineDone.
  ///
  /// In ar, this message translates to:
  /// **'أنت متصل الآن — بالتوفيق!'**
  String get goOnlineDone;

  /// No description provided for @goOnlineLocationTitle.
  ///
  /// In ar, this message translates to:
  /// **'تتبّع الموقع أثناء العمل'**
  String get goOnlineLocationTitle;

  /// No description provided for @goOnlineLocationBody.
  ///
  /// In ar, this message translates to:
  /// **'نتابع موقعك فقط أثناء اتصالك، لنرسل لك أقرب المهام ونُظهر وصولك للعميل. يتوقف التتبّع فور إيقاف الاتصال.'**
  String get goOnlineLocationBody;

  /// No description provided for @goOnlineForegroundBody.
  ///
  /// In ar, this message translates to:
  /// **'سيظهر إشعار دائم أثناء الوردية — هذا ما يبقي التتبّع يعمل عندما تكون الشاشة مغلقة.'**
  String get goOnlineForegroundBody;

  /// No description provided for @goOnlinePermissionAlways.
  ///
  /// In ar, this message translates to:
  /// **'إذن الموقع: دائمًا — مثالي'**
  String get goOnlinePermissionAlways;

  /// No description provided for @goOnlinePermissionWhileInUse.
  ///
  /// In ar, this message translates to:
  /// **'إذن الموقع: أثناء الاستخدام فقط'**
  String get goOnlinePermissionWhileInUse;

  /// No description provided for @goOnlinePermissionPending.
  ///
  /// In ar, this message translates to:
  /// **'إذن الموقع مطلوب'**
  String get goOnlinePermissionPending;

  /// No description provided for @goOnlineRoles.
  ///
  /// In ar, this message translates to:
  /// **'الأدوار الفعّالة هذه الوردية'**
  String get goOnlineRoles;

  /// No description provided for @goOnlineVehicle.
  ///
  /// In ar, this message translates to:
  /// **'المركبة'**
  String get goOnlineVehicle;

  /// No description provided for @goOnlineNoVehicle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مركبة مفعّلة لدورك الحالي.'**
  String get goOnlineNoVehicle;

  /// No description provided for @goOfflineTitle.
  ///
  /// In ar, this message translates to:
  /// **'إيقاف الاتصال'**
  String get goOfflineTitle;

  /// No description provided for @goOfflineMessage.
  ///
  /// In ar, this message translates to:
  /// **'لن تصلك عروض جديدة حتى تعود للاتصال.'**
  String get goOfflineMessage;

  /// No description provided for @goOfflineConfirm.
  ///
  /// In ar, this message translates to:
  /// **'أوقف الاتصال'**
  String get goOfflineConfirm;

  /// No description provided for @backgroundLimitedBanner.
  ///
  /// In ar, this message translates to:
  /// **'الإذن ممنوح أثناء الاستخدام فقط — قد يتوقف التتبّع عند إغلاق الشاشة.'**
  String get backgroundLimitedBanner;

  /// No description provided for @foregroundNotificationTitle.
  ///
  /// In ar, this message translates to:
  /// **'تمام — وردية عمل جارية'**
  String get foregroundNotificationTitle;

  /// No description provided for @foregroundNotificationIdle.
  ///
  /// In ar, this message translates to:
  /// **'متصل وبانتظار العروض'**
  String get foregroundNotificationIdle;

  /// No description provided for @foregroundNotificationOnJob.
  ///
  /// In ar, this message translates to:
  /// **'مهمة جارية — التتبّع يعمل'**
  String get foregroundNotificationOnJob;

  /// No description provided for @interruptionPermission.
  ///
  /// In ar, this message translates to:
  /// **'تم سحب إذن الموقع، لذلك أصبحت غير متصل.'**
  String get interruptionPermission;

  /// No description provided for @interruptionServiceDisabled.
  ///
  /// In ar, this message translates to:
  /// **'أُغلقت خدمة الموقع، لذلك أصبحت غير متصل.'**
  String get interruptionServiceDisabled;

  /// No description provided for @interruptionServer.
  ///
  /// In ar, this message translates to:
  /// **'أنهى الخادم ورديتك. يمكنك الاتصال من جديد.'**
  String get interruptionServer;

  /// No description provided for @interruptionGeneric.
  ///
  /// In ar, this message translates to:
  /// **'توقفت وردية العمل.'**
  String get interruptionGeneric;

  /// No description provided for @resumeWorkTitle.
  ///
  /// In ar, this message translates to:
  /// **'هل تريد متابعة الوردية؟'**
  String get resumeWorkTitle;

  /// No description provided for @resumeWorkBody.
  ///
  /// In ar, this message translates to:
  /// **'ما زلت مسجّلاً كمتصل لدى الخادم، لكن التتبّع على هذا الجهاز متوقف.'**
  String get resumeWorkBody;

  /// No description provided for @resumeWorkConfirm.
  ///
  /// In ar, this message translates to:
  /// **'تابع الوردية'**
  String get resumeWorkConfirm;

  /// No description provided for @resumeWorkDecline.
  ///
  /// In ar, this message translates to:
  /// **'أوقف الاتصال'**
  String get resumeWorkDecline;

  /// No description provided for @warningNoActiveVehicle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مركبة مفعّلة — فعّل مركبة قبل بدء الوردية.'**
  String get warningNoActiveVehicle;

  /// No description provided for @warningDocumentExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية {document}.'**
  String warningDocumentExpired(String document);

  /// No description provided for @warningDocumentRejected.
  ///
  /// In ar, this message translates to:
  /// **'تم رفض {document}. أعد رفعه.'**
  String warningDocumentRejected(String document);

  /// No description provided for @warningDocumentExpiring.
  ///
  /// In ar, this message translates to:
  /// **'تنتهي صلاحية {document} خلال {days} يومًا.'**
  String warningDocumentExpiring(String document, int days);

  /// No description provided for @offerTitle.
  ///
  /// In ar, this message translates to:
  /// **'مهمة جديدة'**
  String get offerTitle;

  /// No description provided for @offerAccept.
  ///
  /// In ar, this message translates to:
  /// **'قبول'**
  String get offerAccept;

  /// No description provided for @offerDecline.
  ///
  /// In ar, this message translates to:
  /// **'رفض'**
  String get offerDecline;

  /// No description provided for @offerSecondsLeft.
  ///
  /// In ar, this message translates to:
  /// **'{seconds} ث'**
  String offerSecondsLeft(int seconds);

  /// No description provided for @offerQueuePosition.
  ///
  /// In ar, this message translates to:
  /// **'و{count} عروض أخرى بانتظارك'**
  String offerQueuePosition(int count);

  /// No description provided for @offerEstimatedEarnings.
  ///
  /// In ar, this message translates to:
  /// **'أرباحك المتوقعة'**
  String get offerEstimatedEarnings;

  /// No description provided for @offerPickup.
  ///
  /// In ar, this message translates to:
  /// **'نقطة الاستلام'**
  String get offerPickup;

  /// No description provided for @offerServiceLocation.
  ///
  /// In ar, this message translates to:
  /// **'موقع الخدمة'**
  String get offerServiceLocation;

  /// No description provided for @offerDestination.
  ///
  /// In ar, this message translates to:
  /// **'الوجهة'**
  String get offerDestination;

  /// No description provided for @offerWaypoint.
  ///
  /// In ar, this message translates to:
  /// **'محطة في الطريق'**
  String get offerWaypoint;

  /// No description provided for @offerToPickup.
  ///
  /// In ar, this message translates to:
  /// **'المسافة إليك'**
  String get offerToPickup;

  /// No description provided for @offerEta.
  ///
  /// In ar, this message translates to:
  /// **'وقت الوصول'**
  String get offerEta;

  /// No description provided for @offerTripDistance.
  ///
  /// In ar, this message translates to:
  /// **'مسافة الرحلة'**
  String get offerTripDistance;

  /// No description provided for @jobTypeRide.
  ///
  /// In ar, this message translates to:
  /// **'مشوار'**
  String get jobTypeRide;

  /// No description provided for @jobTypeDelivery.
  ///
  /// In ar, this message translates to:
  /// **'توصيل طرد'**
  String get jobTypeDelivery;

  /// No description provided for @jobTypeFood.
  ///
  /// In ar, this message translates to:
  /// **'توصيل طعام'**
  String get jobTypeFood;

  /// No description provided for @jobTypeHomeService.
  ///
  /// In ar, this message translates to:
  /// **'خدمة منزلية'**
  String get jobTypeHomeService;

  /// No description provided for @jobTypeOther.
  ///
  /// In ar, this message translates to:
  /// **'خدمة'**
  String get jobTypeOther;

  /// No description provided for @jobStatusDraft.
  ///
  /// In ar, this message translates to:
  /// **'مسودة'**
  String get jobStatusDraft;

  /// No description provided for @jobStatusSearching.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ البحث عن شريك'**
  String get jobStatusSearching;

  /// No description provided for @jobStatusAssigned.
  ///
  /// In ar, this message translates to:
  /// **'تم إسنادها إليك'**
  String get jobStatusAssigned;

  /// No description provided for @jobStatusEnRoute.
  ///
  /// In ar, this message translates to:
  /// **'أنت في الطريق'**
  String get jobStatusEnRoute;

  /// No description provided for @jobStatusArrived.
  ///
  /// In ar, this message translates to:
  /// **'وصلت'**
  String get jobStatusArrived;

  /// No description provided for @jobStatusWaitingCustomer.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار العميل'**
  String get jobStatusWaitingCustomer;

  /// No description provided for @jobStatusInProgress.
  ///
  /// In ar, this message translates to:
  /// **'جارية'**
  String get jobStatusInProgress;

  /// No description provided for @jobStatusInspection.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ الكشف'**
  String get jobStatusInspection;

  /// No description provided for @jobStatusQuoteRequired.
  ///
  /// In ar, this message translates to:
  /// **'مطلوب عرض سعر'**
  String get jobStatusQuoteRequired;

  /// No description provided for @jobStatusQuoteSubmitted.
  ///
  /// In ar, this message translates to:
  /// **'أُرسل العرض — بانتظار العميل'**
  String get jobStatusQuoteSubmitted;

  /// No description provided for @jobStatusQuoteApproved.
  ///
  /// In ar, this message translates to:
  /// **'تمت الموافقة على العرض'**
  String get jobStatusQuoteApproved;

  /// No description provided for @jobStatusQuoteRejected.
  ///
  /// In ar, this message translates to:
  /// **'رُفض العرض'**
  String get jobStatusQuoteRejected;

  /// No description provided for @jobStatusWorkStarted.
  ///
  /// In ar, this message translates to:
  /// **'العمل جارٍ'**
  String get jobStatusWorkStarted;

  /// No description provided for @jobStatusWaitingForParts.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار قطع الغيار'**
  String get jobStatusWaitingForParts;

  /// No description provided for @jobStatusWorkCompleted.
  ///
  /// In ar, this message translates to:
  /// **'انتهى العمل — بانتظار تأكيد العميل'**
  String get jobStatusWorkCompleted;

  /// No description provided for @jobStatusCustomerConfirmed.
  ///
  /// In ar, this message translates to:
  /// **'أكّد العميل'**
  String get jobStatusCustomerConfirmed;

  /// No description provided for @jobStatusCompleted.
  ///
  /// In ar, this message translates to:
  /// **'مكتملة'**
  String get jobStatusCompleted;

  /// No description provided for @jobStatusCancelled.
  ///
  /// In ar, this message translates to:
  /// **'ملغاة'**
  String get jobStatusCancelled;

  /// No description provided for @jobStatusNoPartner.
  ///
  /// In ar, this message translates to:
  /// **'لم يتوفر شريك'**
  String get jobStatusNoPartner;

  /// No description provided for @jobStatusDisputed.
  ///
  /// In ar, this message translates to:
  /// **'قيد النزاع'**
  String get jobStatusDisputed;

  /// No description provided for @urgencyStandard.
  ///
  /// In ar, this message translates to:
  /// **'عادي'**
  String get urgencyStandard;

  /// No description provided for @urgencyUrgent.
  ///
  /// In ar, this message translates to:
  /// **'مستعجل'**
  String get urgencyUrgent;

  /// No description provided for @urgencyEmergency.
  ///
  /// In ar, this message translates to:
  /// **'طارئ'**
  String get urgencyEmergency;

  /// No description provided for @paymentCash.
  ///
  /// In ar, this message translates to:
  /// **'نقدًا'**
  String get paymentCash;

  /// No description provided for @paymentCard.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة'**
  String get paymentCard;

  /// No description provided for @paymentWallet.
  ///
  /// In ar, this message translates to:
  /// **'المحفظة'**
  String get paymentWallet;

  /// No description provided for @paymentBank.
  ///
  /// In ar, this message translates to:
  /// **'حوالة بنكية'**
  String get paymentBank;

  /// No description provided for @paymentOnline.
  ///
  /// In ar, this message translates to:
  /// **'دفع إلكتروني'**
  String get paymentOnline;

  /// No description provided for @roleDriver.
  ///
  /// In ar, this message translates to:
  /// **'سائق'**
  String get roleDriver;

  /// No description provided for @roleCourier.
  ///
  /// In ar, this message translates to:
  /// **'مندوب توصيل'**
  String get roleCourier;

  /// No description provided for @roleTechnician.
  ///
  /// In ar, this message translates to:
  /// **'فنّي'**
  String get roleTechnician;

  /// No description provided for @roleServiceProvider.
  ///
  /// In ar, this message translates to:
  /// **'مزوّد خدمة'**
  String get roleServiceProvider;

  /// No description provided for @roleDriverCaption.
  ///
  /// In ar, this message translates to:
  /// **'مشاوير بالسيارة داخل مدينتك'**
  String get roleDriverCaption;

  /// No description provided for @roleCourierCaption.
  ///
  /// In ar, this message translates to:
  /// **'توصيل الطرود والطعام'**
  String get roleCourierCaption;

  /// No description provided for @roleTechnicianCaption.
  ///
  /// In ar, this message translates to:
  /// **'صيانة وإصلاح في منزل العميل'**
  String get roleTechnicianCaption;

  /// No description provided for @roleServiceProviderCaption.
  ///
  /// In ar, this message translates to:
  /// **'خدمات منزلية متخصصة بعرض سعر'**
  String get roleServiceProviderCaption;

  /// No description provided for @jobActionEnRoute.
  ///
  /// In ar, this message translates to:
  /// **'أنا في الطريق'**
  String get jobActionEnRoute;

  /// No description provided for @jobActionArrive.
  ///
  /// In ar, this message translates to:
  /// **'وصلت'**
  String get jobActionArrive;

  /// No description provided for @jobActionStartRide.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ الرحلة'**
  String get jobActionStartRide;

  /// No description provided for @jobActionPickedUp.
  ///
  /// In ar, this message translates to:
  /// **'استلمت الطرد'**
  String get jobActionPickedUp;

  /// No description provided for @jobActionStartInspection.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ الكشف'**
  String get jobActionStartInspection;

  /// No description provided for @jobActionCompleteRide.
  ///
  /// In ar, this message translates to:
  /// **'أنهِ الرحلة'**
  String get jobActionCompleteRide;

  /// No description provided for @jobActionDeliver.
  ///
  /// In ar, this message translates to:
  /// **'سلّم الطرد'**
  String get jobActionDeliver;

  /// No description provided for @jobActionSubmitQuote.
  ///
  /// In ar, this message translates to:
  /// **'أرسل عرض السعر'**
  String get jobActionSubmitQuote;

  /// No description provided for @jobActionStartWork.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ العمل'**
  String get jobActionStartWork;

  /// No description provided for @jobActionCompleteWork.
  ///
  /// In ar, this message translates to:
  /// **'أنهِ العمل'**
  String get jobActionCompleteWork;

  /// No description provided for @jobActionResumeWork.
  ///
  /// In ar, this message translates to:
  /// **'استأنف العمل'**
  String get jobActionResumeWork;

  /// No description provided for @jobActionWaitingForParts.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار قطع غيار'**
  String get jobActionWaitingForParts;

  /// No description provided for @jobActionChangeOrder.
  ///
  /// In ar, this message translates to:
  /// **'أضف عملاً إضافيًا'**
  String get jobActionChangeOrder;

  /// No description provided for @jobPassiveAwaitQuote.
  ///
  /// In ar, this message translates to:
  /// **'أرسلنا عرضك إلى العميل، بانتظار قراره.'**
  String get jobPassiveAwaitQuote;

  /// No description provided for @jobPassiveAwaitConfirmation.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار تأكيد العميل لانتهاء العمل.'**
  String get jobPassiveAwaitConfirmation;

  /// No description provided for @jobPassiveCancelled.
  ///
  /// In ar, this message translates to:
  /// **'أُلغيت هذه المهمة.'**
  String get jobPassiveCancelled;

  /// No description provided for @jobPassiveNothing.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد إجراء مطلوب الآن.'**
  String get jobPassiveNothing;

  /// No description provided for @jobNavigate.
  ///
  /// In ar, this message translates to:
  /// **'الملاحة'**
  String get jobNavigate;

  /// No description provided for @navigateWith.
  ///
  /// In ar, this message translates to:
  /// **'الملاحة عبر'**
  String get navigateWith;

  /// No description provided for @navigateGoogleMaps.
  ///
  /// In ar, this message translates to:
  /// **'خرائط Google'**
  String get navigateGoogleMaps;

  /// No description provided for @navigateWaze.
  ///
  /// In ar, this message translates to:
  /// **'Waze'**
  String get navigateWaze;

  /// No description provided for @navigateUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد تطبيق ملاحة مثبّت على جهازك.'**
  String get navigateUnavailable;

  /// No description provided for @jobCurrentTarget.
  ///
  /// In ar, this message translates to:
  /// **'وجهتك الآن'**
  String get jobCurrentTarget;

  /// No description provided for @jobCallCustomer.
  ///
  /// In ar, this message translates to:
  /// **'اتصال'**
  String get jobCallCustomer;

  /// No description provided for @jobChatCustomer.
  ///
  /// In ar, this message translates to:
  /// **'محادثة'**
  String get jobChatCustomer;

  /// No description provided for @jobWaitingSince.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار العميل منذ {duration}'**
  String jobWaitingSince(String duration);

  /// No description provided for @arriveTooFar.
  ///
  /// In ar, this message translates to:
  /// **'أنت على بُعد {meters} متر من الموقع. اقترب أكثر ثم أكّد الوصول.'**
  String arriveTooFar(int meters);

  /// No description provided for @jobVersionConflictHint.
  ///
  /// In ar, this message translates to:
  /// **'تغيّرت المهمة أثناء عملك عليها — راجع التفاصيل قبل المتابعة.'**
  String get jobVersionConflictHint;

  /// No description provided for @tripPinTitle.
  ///
  /// In ar, this message translates to:
  /// **'رمز بدء الرحلة'**
  String get tripPinTitle;

  /// No description provided for @tripPinSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'اطلب من الراكب الرمز الظاهر في تطبيقه.'**
  String get tripPinSubtitle;

  /// No description provided for @pickupOtpTitle.
  ///
  /// In ar, this message translates to:
  /// **'رمز الاستلام'**
  String get pickupOtpTitle;

  /// No description provided for @pickupOtpSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'اطلب رمز الاستلام من المُرسِل.'**
  String get pickupOtpSubtitle;

  /// No description provided for @completeRideConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيتم إنهاء الرحلة واحتساب الأجرة النهائية.'**
  String get completeRideConfirm;

  /// No description provided for @cancelJobTitle.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء المهمة'**
  String get cancelJobTitle;

  /// No description provided for @cancelJobSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'اختر سببًا واضحًا — يؤثر الإلغاء على نسبة قبولك.'**
  String get cancelJobSubtitle;

  /// No description provided for @cancelJobConfirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الإلغاء'**
  String get cancelJobConfirm;

  /// No description provided for @cancelJobReasonRequired.
  ///
  /// In ar, this message translates to:
  /// **'التفاصيل (مطلوبة)'**
  String get cancelJobReasonRequired;

  /// No description provided for @cancelJobReasonOptional.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل إضافية (اختياري)'**
  String get cancelJobReasonOptional;

  /// No description provided for @cancelJobNoShowAfterArrival.
  ///
  /// In ar, this message translates to:
  /// **'خيار \"العميل لم يحضر\" متاح بعد تأكيد وصولك وانتهاء مدة الانتظار.'**
  String get cancelJobNoShowAfterArrival;

  /// No description provided for @cancelReasonNoShow.
  ///
  /// In ar, this message translates to:
  /// **'العميل لم يحضر'**
  String get cancelReasonNoShow;

  /// No description provided for @cancelReasonUnreachable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر التواصل مع العميل'**
  String get cancelReasonUnreachable;

  /// No description provided for @cancelReasonWrongAddress.
  ///
  /// In ar, this message translates to:
  /// **'العنوان غير صحيح'**
  String get cancelReasonWrongAddress;

  /// No description provided for @cancelReasonVehicleIssue.
  ///
  /// In ar, this message translates to:
  /// **'عطل في المركبة'**
  String get cancelReasonVehicleIssue;

  /// No description provided for @cancelReasonSafety.
  ///
  /// In ar, this message translates to:
  /// **'مخاوف تتعلق بالسلامة'**
  String get cancelReasonSafety;

  /// No description provided for @cancelReasonOther.
  ///
  /// In ar, this message translates to:
  /// **'سبب آخر'**
  String get cancelReasonOther;

  /// No description provided for @releaseJobTitle.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المهمة للتوزيع'**
  String get releaseJobTitle;

  /// No description provided for @releaseJobSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'ستُعرض المهمة على شريك آخر ولن تُحتسب إلغاءً عليك.'**
  String get releaseJobSubtitle;

  /// No description provided for @releaseJobReason.
  ///
  /// In ar, this message translates to:
  /// **'سبب الإعادة'**
  String get releaseJobReason;

  /// No description provided for @releaseJobConfirm.
  ///
  /// In ar, this message translates to:
  /// **'أعِد المهمة'**
  String get releaseJobConfirm;

  /// No description provided for @releaseJobDone.
  ///
  /// In ar, this message translates to:
  /// **'أُعيدت المهمة للتوزيع.'**
  String get releaseJobDone;

  /// No description provided for @podTitle.
  ///
  /// In ar, this message translates to:
  /// **'إثبات التسليم'**
  String get podTitle;

  /// No description provided for @podSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'أكّد تسليم الطرد للمستلم.'**
  String get podSubtitle;

  /// No description provided for @podSubtitleNamed.
  ///
  /// In ar, this message translates to:
  /// **'أكّد تسليم الطرد إلى {name}.'**
  String podSubtitleNamed(String name);

  /// No description provided for @podModeOtp.
  ///
  /// In ar, this message translates to:
  /// **'رمز التسليم'**
  String get podModeOtp;

  /// No description provided for @podModeManual.
  ///
  /// In ar, this message translates to:
  /// **'توقيع وصورة'**
  String get podModeManual;

  /// No description provided for @podOtpHint.
  ///
  /// In ar, this message translates to:
  /// **'اطلب من المستلم رمز التسليم الظاهر في تطبيقه.'**
  String get podOtpHint;

  /// No description provided for @podReceiverName.
  ///
  /// In ar, this message translates to:
  /// **'اسم المستلم'**
  String get podReceiverName;

  /// No description provided for @podPhotoLabel.
  ///
  /// In ar, this message translates to:
  /// **'صورة التسليم'**
  String get podPhotoLabel;

  /// No description provided for @podPhotoHint.
  ///
  /// In ar, this message translates to:
  /// **'صورة واضحة للطرد في مكان التسليم.'**
  String get podPhotoHint;

  /// No description provided for @podSignatureLabel.
  ///
  /// In ar, this message translates to:
  /// **'توقيع المستلم'**
  String get podSignatureLabel;

  /// No description provided for @podSignatureHint.
  ///
  /// In ar, this message translates to:
  /// **'اطلب من المستلم التوقيع بإصبعه داخل الإطار.'**
  String get podSignatureHint;

  /// No description provided for @completeWorkTitle.
  ///
  /// In ar, this message translates to:
  /// **'إنهاء العمل'**
  String get completeWorkTitle;

  /// No description provided for @completeWorkSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'وثّق ما أنجزته قبل تسليم المهمة للعميل.'**
  String get completeWorkSubtitle;

  /// No description provided for @completeWorkPhotos.
  ///
  /// In ar, this message translates to:
  /// **'صور بعد العمل'**
  String get completeWorkPhotos;

  /// No description provided for @completeWorkPhotosHint.
  ///
  /// In ar, this message translates to:
  /// **'صور واضحة تُظهر النتيجة — تحمي حقّك عند أي نزاع.'**
  String get completeWorkPhotosHint;

  /// No description provided for @completeWorkApprovedTotal.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ المعتمد'**
  String get completeWorkApprovedTotal;

  /// No description provided for @completeWorkCustomerConfirms.
  ///
  /// In ar, this message translates to:
  /// **'يؤكد العميل انتهاء العمل، ثم تُضاف أرباحك إلى رصيدك.'**
  String get completeWorkCustomerConfirms;

  /// No description provided for @completionTitle.
  ///
  /// In ar, this message translates to:
  /// **'أُنجزت المهمة'**
  String get completionTitle;

  /// No description provided for @completionSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'المهمة رقم {number}'**
  String completionSubtitle(String number);

  /// No description provided for @completionAwaitingTitle.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار تأكيد العميل'**
  String get completionAwaitingTitle;

  /// No description provided for @completionAwaitingSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'أنهيت العمل. تُضاف الأرباح بعد تأكيد العميل.'**
  String get completionAwaitingSubtitle;

  /// No description provided for @completionCollectCash.
  ///
  /// In ar, this message translates to:
  /// **'حصّل المبلغ نقدًا من العميل.'**
  String get completionCollectCash;

  /// No description provided for @completionPaidElectronically.
  ///
  /// In ar, this message translates to:
  /// **'تم الدفع إلكترونيًا — لا تحصّل نقدًا.'**
  String get completionPaidElectronically;

  /// No description provided for @completionYourEarnings.
  ///
  /// In ar, this message translates to:
  /// **'أرباحك من هذه المهمة'**
  String get completionYourEarnings;

  /// No description provided for @completionRateCustomer.
  ///
  /// In ar, this message translates to:
  /// **'قيّم العميل'**
  String get completionRateCustomer;

  /// No description provided for @completionBackHome.
  ///
  /// In ar, this message translates to:
  /// **'العودة للرئيسية'**
  String get completionBackHome;

  /// No description provided for @jobsTitle.
  ///
  /// In ar, this message translates to:
  /// **'المهام'**
  String get jobsTitle;

  /// No description provided for @jobsFilterAll.
  ///
  /// In ar, this message translates to:
  /// **'الكل'**
  String get jobsFilterAll;

  /// No description provided for @jobsFilterActive.
  ///
  /// In ar, this message translates to:
  /// **'الجارية'**
  String get jobsFilterActive;

  /// No description provided for @jobsFilterCompleted.
  ///
  /// In ar, this message translates to:
  /// **'المكتملة'**
  String get jobsFilterCompleted;

  /// No description provided for @jobsFilterCancelled.
  ///
  /// In ar, this message translates to:
  /// **'الملغاة'**
  String get jobsFilterCancelled;

  /// No description provided for @jobsFilterByDate.
  ///
  /// In ar, this message translates to:
  /// **'تصفية حسب التاريخ'**
  String get jobsFilterByDate;

  /// No description provided for @jobsEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مهام'**
  String get jobsEmptyTitle;

  /// No description provided for @jobsEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'ستظهر هنا كل المهام التي نفّذتها.'**
  String get jobsEmptyBody;

  /// No description provided for @jobDetailTitle.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل المهمة'**
  String get jobDetailTitle;

  /// No description provided for @jobEarningsBreakdown.
  ///
  /// In ar, this message translates to:
  /// **'تفصيل الأرباح'**
  String get jobEarningsBreakdown;

  /// No description provided for @jobNoBreakdown.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد تفصيل متاح لهذه المهمة.'**
  String get jobNoBreakdown;

  /// No description provided for @jobTotalCharged.
  ///
  /// In ar, this message translates to:
  /// **'إجمالي ما دفعه العميل'**
  String get jobTotalCharged;

  /// No description provided for @jobRatingTitle.
  ///
  /// In ar, this message translates to:
  /// **'تقييم العميل لك'**
  String get jobRatingTitle;

  /// No description provided for @jobRatingUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'لم يقيّمك العميل بعد.'**
  String get jobRatingUnavailable;

  /// No description provided for @jobCancelledReason.
  ///
  /// In ar, this message translates to:
  /// **'سبب الإلغاء: {reason}'**
  String jobCancelledReason(String reason);

  /// No description provided for @jobReportProblem.
  ///
  /// In ar, this message translates to:
  /// **'الإبلاغ عن مشكلة'**
  String get jobReportProblem;

  /// No description provided for @ratingTitle.
  ///
  /// In ar, this message translates to:
  /// **'تقييم العميل'**
  String get ratingTitle;

  /// No description provided for @ratingPrompt.
  ///
  /// In ar, this message translates to:
  /// **'كيف كانت تجربتك مع العميل؟'**
  String get ratingPrompt;

  /// No description provided for @ratingCustomer.
  ///
  /// In ar, this message translates to:
  /// **'العميل'**
  String get ratingCustomer;

  /// No description provided for @ratingCommentOptional.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظات (اختياري)'**
  String get ratingCommentOptional;

  /// No description provided for @ratingSubmit.
  ///
  /// In ar, this message translates to:
  /// **'إرسال التقييم'**
  String get ratingSubmit;

  /// No description provided for @ratingThanks.
  ///
  /// In ar, this message translates to:
  /// **'شكرًا لتقييمك!'**
  String get ratingThanks;

  /// No description provided for @ratingTagPolite.
  ///
  /// In ar, this message translates to:
  /// **'لبق'**
  String get ratingTagPolite;

  /// No description provided for @ratingTagPunctual.
  ///
  /// In ar, this message translates to:
  /// **'ملتزم بالوقت'**
  String get ratingTagPunctual;

  /// No description provided for @ratingTagClearAddress.
  ///
  /// In ar, this message translates to:
  /// **'عنوان واضح'**
  String get ratingTagClearAddress;

  /// No description provided for @ratingTagEasyParking.
  ///
  /// In ar, this message translates to:
  /// **'موقف سهل'**
  String get ratingTagEasyParking;

  /// No description provided for @ratingTagLate.
  ///
  /// In ar, this message translates to:
  /// **'تأخر'**
  String get ratingTagLate;

  /// No description provided for @ratingTagRude.
  ///
  /// In ar, this message translates to:
  /// **'غير لبق'**
  String get ratingTagRude;

  /// No description provided for @ratingTagWrongAddress.
  ///
  /// In ar, this message translates to:
  /// **'عنوان غير صحيح'**
  String get ratingTagWrongAddress;

  /// No description provided for @ratingTagExtraStops.
  ///
  /// In ar, this message translates to:
  /// **'محطات إضافية غير متفق عليها'**
  String get ratingTagExtraStops;

  /// No description provided for @chatTitle.
  ///
  /// In ar, this message translates to:
  /// **'المحادثة'**
  String get chatTitle;

  /// No description provided for @chatHint.
  ///
  /// In ar, this message translates to:
  /// **'اكتب رسالة…'**
  String get chatHint;

  /// No description provided for @chatEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد رسائل بعد'**
  String get chatEmptyTitle;

  /// No description provided for @chatEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'اكتب رسالة للتواصل مع العميل.'**
  String get chatEmptyBody;

  /// No description provided for @chatLoadOlder.
  ///
  /// In ar, this message translates to:
  /// **'عرض الرسائل الأقدم'**
  String get chatLoadOlder;

  /// No description provided for @chatSendPhoto.
  ///
  /// In ar, this message translates to:
  /// **'إرسال صورة'**
  String get chatSendPhoto;

  /// No description provided for @chatSendLocation.
  ///
  /// In ar, this message translates to:
  /// **'إرسال الموقع'**
  String get chatSendLocation;

  /// No description provided for @chatSharedLocation.
  ///
  /// In ar, this message translates to:
  /// **'تمت مشاركة الموقع'**
  String get chatSharedLocation;

  /// No description provided for @quoteBuilderTitle.
  ///
  /// In ar, this message translates to:
  /// **'عرض السعر'**
  String get quoteBuilderTitle;

  /// No description provided for @quoteBuilderChangeOrderTitle.
  ///
  /// In ar, this message translates to:
  /// **'عمل إضافي'**
  String get quoteBuilderChangeOrderTitle;

  /// No description provided for @quoteItemsTitle.
  ///
  /// In ar, this message translates to:
  /// **'البنود'**
  String get quoteItemsTitle;

  /// No description provided for @quoteAddItem.
  ///
  /// In ar, this message translates to:
  /// **'إضافة بند'**
  String get quoteAddItem;

  /// No description provided for @quoteEditItem.
  ///
  /// In ar, this message translates to:
  /// **'تعديل البند'**
  String get quoteEditItem;

  /// No description provided for @quoteEmptyHint.
  ///
  /// In ar, this message translates to:
  /// **'أضف بندًا واحدًا على الأقل ليصل العرض إلى العميل.'**
  String get quoteEmptyHint;

  /// No description provided for @quoteItemDescription.
  ///
  /// In ar, this message translates to:
  /// **'وصف البند'**
  String get quoteItemDescription;

  /// No description provided for @quoteItemQuantity.
  ///
  /// In ar, this message translates to:
  /// **'الكمية'**
  String get quoteItemQuantity;

  /// No description provided for @quoteItemUnitPrice.
  ///
  /// In ar, this message translates to:
  /// **'سعر الوحدة'**
  String get quoteItemUnitPrice;

  /// No description provided for @quoteLineTotal.
  ///
  /// In ar, this message translates to:
  /// **'إجمالي البند: {total}'**
  String quoteLineTotal(String total);

  /// No description provided for @quoteKindLabor.
  ///
  /// In ar, this message translates to:
  /// **'أجرة عمل'**
  String get quoteKindLabor;

  /// No description provided for @quoteKindParts.
  ///
  /// In ar, this message translates to:
  /// **'قطع غيار'**
  String get quoteKindParts;

  /// No description provided for @quoteKindFee.
  ///
  /// In ar, this message translates to:
  /// **'رسوم'**
  String get quoteKindFee;

  /// No description provided for @quoteDiscount.
  ///
  /// In ar, this message translates to:
  /// **'خصم'**
  String get quoteDiscount;

  /// No description provided for @quoteDiscountTooLarge.
  ///
  /// In ar, this message translates to:
  /// **'الخصم أكبر من مجموع البنود.'**
  String get quoteDiscountTooLarge;

  /// No description provided for @quoteDescriptionLabel.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظات للعميل'**
  String get quoteDescriptionLabel;

  /// No description provided for @quoteDurationLabel.
  ///
  /// In ar, this message translates to:
  /// **'المدة المتوقعة (دقيقة)'**
  String get quoteDurationLabel;

  /// No description provided for @quoteDurationHint.
  ///
  /// In ar, this message translates to:
  /// **'تساعد العميل على تنظيم وقته.'**
  String get quoteDurationHint;

  /// No description provided for @quotePreviewTitle.
  ///
  /// In ar, this message translates to:
  /// **'معاينة'**
  String get quotePreviewTitle;

  /// No description provided for @quotePreviewTotal.
  ///
  /// In ar, this message translates to:
  /// **'الإجمالي التقديري'**
  String get quotePreviewTotal;

  /// No description provided for @quotePreviewDisclaimer.
  ///
  /// In ar, this message translates to:
  /// **'هذه معاينة على جهازك فقط. يحتسب الخادم الضريبة والرسوم النهائية عند الإرسال، وأرقامه هي المعتمدة.'**
  String get quotePreviewDisclaimer;

  /// No description provided for @quoteSubmit.
  ///
  /// In ar, this message translates to:
  /// **'إرسال العرض'**
  String get quoteSubmit;

  /// No description provided for @quoteSubmitChangeOrder.
  ///
  /// In ar, this message translates to:
  /// **'إرسال العمل الإضافي'**
  String get quoteSubmitChangeOrder;

  /// No description provided for @quoteSubmitted.
  ///
  /// In ar, this message translates to:
  /// **'أُرسل العرض إلى العميل.'**
  String get quoteSubmitted;

  /// No description provided for @quoteChangeOrderHint.
  ///
  /// In ar, this message translates to:
  /// **'يُضاف العمل الإضافي إلى العرض المعتمد بعد موافقة العميل عليه.'**
  String get quoteChangeOrderHint;

  /// No description provided for @quoteRejectionNote.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظة العميل على الرفض: {note}'**
  String quoteRejectionNote(String note);

  /// No description provided for @quoteVersionConflict.
  ///
  /// In ar, this message translates to:
  /// **'تغيّر العرض من جهة أخرى. حدّث الشاشة ثم أعد الإرسال.'**
  String get quoteVersionConflict;

  /// No description provided for @quoteTitle.
  ///
  /// In ar, this message translates to:
  /// **'عرض السعر رقم {revision}'**
  String quoteTitle(int revision);

  /// No description provided for @quoteChangeOrderTitle.
  ///
  /// In ar, this message translates to:
  /// **'عمل إضافي رقم {revision}'**
  String quoteChangeOrderTitle(int revision);

  /// No description provided for @quoteTotal.
  ///
  /// In ar, this message translates to:
  /// **'الإجمالي'**
  String get quoteTotal;

  /// No description provided for @quoteTax.
  ///
  /// In ar, this message translates to:
  /// **'ضريبة'**
  String get quoteTax;

  /// No description provided for @quoteEstimatedDuration.
  ///
  /// In ar, this message translates to:
  /// **'المدة المتوقعة: {minutes} دقيقة'**
  String quoteEstimatedDuration(String minutes);

  /// No description provided for @quoteStatusDraft.
  ///
  /// In ar, this message translates to:
  /// **'مسودة'**
  String get quoteStatusDraft;

  /// No description provided for @quoteStatusSubmitted.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار العميل'**
  String get quoteStatusSubmitted;

  /// No description provided for @quoteStatusApproved.
  ///
  /// In ar, this message translates to:
  /// **'معتمد'**
  String get quoteStatusApproved;

  /// No description provided for @quoteStatusRejected.
  ///
  /// In ar, this message translates to:
  /// **'مرفوض'**
  String get quoteStatusRejected;

  /// No description provided for @quoteStatusCancelled.
  ///
  /// In ar, this message translates to:
  /// **'ملغى'**
  String get quoteStatusCancelled;

  /// No description provided for @quoteStatusSuperseded.
  ///
  /// In ar, this message translates to:
  /// **'استُبدل بعرض أحدث'**
  String get quoteStatusSuperseded;

  /// No description provided for @earningsTitle.
  ///
  /// In ar, this message translates to:
  /// **'أرباحي'**
  String get earningsTitle;

  /// No description provided for @earningsToday.
  ///
  /// In ar, this message translates to:
  /// **'اليوم'**
  String get earningsToday;

  /// No description provided for @earningsWeek.
  ///
  /// In ar, this message translates to:
  /// **'هذا الأسبوع'**
  String get earningsWeek;

  /// No description provided for @earningsMonth.
  ///
  /// In ar, this message translates to:
  /// **'هذا الشهر'**
  String get earningsMonth;

  /// No description provided for @earningsCompletedJobs.
  ///
  /// In ar, this message translates to:
  /// **'{count} مهمة مكتملة'**
  String earningsCompletedJobs(String count);

  /// No description provided for @earningsGross.
  ///
  /// In ar, this message translates to:
  /// **'إجمالي الأرباح'**
  String get earningsGross;

  /// No description provided for @earningsCommission.
  ///
  /// In ar, this message translates to:
  /// **'عمولة تمام'**
  String get earningsCommission;

  /// No description provided for @earningsBonuses.
  ///
  /// In ar, this message translates to:
  /// **'حوافز ومكافآت'**
  String get earningsBonuses;

  /// No description provided for @earningsAdjustments.
  ///
  /// In ar, this message translates to:
  /// **'تسويات'**
  String get earningsAdjustments;

  /// No description provided for @earningsNet.
  ///
  /// In ar, this message translates to:
  /// **'صافي أرباحك'**
  String get earningsNet;

  /// No description provided for @earningsWithdrawals.
  ///
  /// In ar, this message translates to:
  /// **'مسحوبات'**
  String get earningsWithdrawals;

  /// No description provided for @earningsBalance.
  ///
  /// In ar, this message translates to:
  /// **'الرصيد المتاح'**
  String get earningsBalance;

  /// No description provided for @statementTitle.
  ///
  /// In ar, this message translates to:
  /// **'كشف الحساب'**
  String get statementTitle;

  /// No description provided for @statementEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد حركات'**
  String get statementEmptyTitle;

  /// No description provided for @statementEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'ستظهر هنا كل الحركات المالية على محفظتك.'**
  String get statementEmptyBody;

  /// No description provided for @statementBalanceAfter.
  ///
  /// In ar, this message translates to:
  /// **'الرصيد بعدها: {balance}'**
  String statementBalanceAfter(String balance);

  /// No description provided for @withdrawTitle.
  ///
  /// In ar, this message translates to:
  /// **'سحب الأرباح'**
  String get withdrawTitle;

  /// No description provided for @withdrawAvailable.
  ///
  /// In ar, this message translates to:
  /// **'المتاح للسحب: {amount}'**
  String withdrawAvailable(String amount);

  /// No description provided for @withdrawAmount.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ'**
  String get withdrawAmount;

  /// No description provided for @withdrawAmountInvalid.
  ///
  /// In ar, this message translates to:
  /// **'أدخل مبلغًا صحيحًا.'**
  String get withdrawAmountInvalid;

  /// No description provided for @withdrawAll.
  ///
  /// In ar, this message translates to:
  /// **'سحب الكل'**
  String get withdrawAll;

  /// No description provided for @withdrawToAccount.
  ///
  /// In ar, this message translates to:
  /// **'إلى الحساب البنكي'**
  String get withdrawToAccount;

  /// No description provided for @withdrawConfirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد السحب'**
  String get withdrawConfirm;

  /// No description provided for @withdrawProcessingHint.
  ///
  /// In ar, this message translates to:
  /// **'تُراجَع طلبات السحب خلال أيام العمل، وتصل الحوالة بعد الموافقة.'**
  String get withdrawProcessingHint;

  /// No description provided for @withdrawRequested.
  ///
  /// In ar, this message translates to:
  /// **'أُرسل طلب السحب.'**
  String get withdrawRequested;

  /// No description provided for @withdrawalsTitle.
  ///
  /// In ar, this message translates to:
  /// **'طلبات السحب'**
  String get withdrawalsTitle;

  /// No description provided for @withdrawalsEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد طلبات سحب'**
  String get withdrawalsEmptyTitle;

  /// No description provided for @withdrawalsEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'ستظهر هنا طلبات السحب وحالتها.'**
  String get withdrawalsEmptyBody;

  /// No description provided for @withdrawalFee.
  ///
  /// In ar, this message translates to:
  /// **'رسوم التحويل: {fee}'**
  String withdrawalFee(String fee);

  /// No description provided for @withdrawalStatusRequested.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get withdrawalStatusRequested;

  /// No description provided for @withdrawalStatusApproved.
  ///
  /// In ar, this message translates to:
  /// **'معتمد'**
  String get withdrawalStatusApproved;

  /// No description provided for @withdrawalStatusPaid.
  ///
  /// In ar, this message translates to:
  /// **'تم التحويل'**
  String get withdrawalStatusPaid;

  /// No description provided for @withdrawalStatusRejected.
  ///
  /// In ar, this message translates to:
  /// **'مرفوض'**
  String get withdrawalStatusRejected;

  /// No description provided for @bankAccountAdd.
  ///
  /// In ar, this message translates to:
  /// **'إضافة حساب بنكي'**
  String get bankAccountAdd;

  /// No description provided for @bankAccountHint.
  ///
  /// In ar, this message translates to:
  /// **'يجب أن يكون الحساب باسمك كما هو في الهوية.'**
  String get bankAccountHint;

  /// No description provided for @bankAccountHolder.
  ///
  /// In ar, this message translates to:
  /// **'اسم صاحب الحساب'**
  String get bankAccountHolder;

  /// No description provided for @bankAccountBankName.
  ///
  /// In ar, this message translates to:
  /// **'اسم البنك'**
  String get bankAccountBankName;

  /// No description provided for @bankAccountIban.
  ///
  /// In ar, this message translates to:
  /// **'رقم الآيبان (IBAN)'**
  String get bankAccountIban;

  /// No description provided for @onboardingStepPersonal.
  ///
  /// In ar, this message translates to:
  /// **'بياناتك'**
  String get onboardingStepPersonal;

  /// No description provided for @onboardingStepRoles.
  ///
  /// In ar, this message translates to:
  /// **'نوع العمل'**
  String get onboardingStepRoles;

  /// No description provided for @onboardingStepSkills.
  ///
  /// In ar, this message translates to:
  /// **'مهاراتك'**
  String get onboardingStepSkills;

  /// No description provided for @onboardingStepDocuments.
  ///
  /// In ar, this message translates to:
  /// **'الوثائق'**
  String get onboardingStepDocuments;

  /// No description provided for @onboardingStepVehicle.
  ///
  /// In ar, this message translates to:
  /// **'المركبة'**
  String get onboardingStepVehicle;

  /// No description provided for @onboardingStepZones.
  ///
  /// In ar, this message translates to:
  /// **'مناطق العمل'**
  String get onboardingStepZones;

  /// No description provided for @onboardingStepReview.
  ///
  /// In ar, this message translates to:
  /// **'المراجعة'**
  String get onboardingStepReview;

  /// No description provided for @onboardingStepCounter.
  ///
  /// In ar, this message translates to:
  /// **'الخطوة {step} من {total}'**
  String onboardingStepCounter(int step, int total);

  /// No description provided for @onboardingFullName.
  ///
  /// In ar, this message translates to:
  /// **'الاسم الكامل'**
  String get onboardingFullName;

  /// No description provided for @onboardingDateOfBirth.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ الميلاد'**
  String get onboardingDateOfBirth;

  /// No description provided for @onboardingDateOfBirthHint.
  ///
  /// In ar, this message translates to:
  /// **'اختر تاريخ ميلادك'**
  String get onboardingDateOfBirthHint;

  /// No description provided for @onboardingNationalId.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهوية'**
  String get onboardingNationalId;

  /// No description provided for @onboardingCity.
  ///
  /// In ar, this message translates to:
  /// **'المدينة'**
  String get onboardingCity;

  /// No description provided for @onboardingEmailOptional.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني (اختياري)'**
  String get onboardingEmailOptional;

  /// No description provided for @onboardingPhotoHint.
  ///
  /// In ar, this message translates to:
  /// **'صورة شخصية واضحة بخلفية فاتحة — يراها العميل عند وصولك.'**
  String get onboardingPhotoHint;

  /// No description provided for @onboardingRolesHint.
  ///
  /// In ar, this message translates to:
  /// **'اختر كل ما تنوي العمل به. يمكنك تعديل ذلك لاحقًا من التفضيلات.'**
  String get onboardingRolesHint;

  /// No description provided for @onboardingSkillsHint.
  ///
  /// In ar, this message translates to:
  /// **'حدّد الخدمات التي تتقنها ليصلك العمل المناسب فقط.'**
  String get onboardingSkillsHint;

  /// No description provided for @onboardingSkillsLabel.
  ///
  /// In ar, this message translates to:
  /// **'مهارة'**
  String get onboardingSkillsLabel;

  /// No description provided for @onboardingSkillsHelper.
  ///
  /// In ar, this message translates to:
  /// **'اكتب مهارة ثم أضفها (مثل: تمديدات صحية).'**
  String get onboardingSkillsHelper;

  /// No description provided for @onboardingYearsOfExperience.
  ///
  /// In ar, this message translates to:
  /// **'سنوات الخبرة'**
  String get onboardingYearsOfExperience;

  /// No description provided for @onboardingNoCategories.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد تصنيفات متاحة حاليًا'**
  String get onboardingNoCategories;

  /// No description provided for @onboardingDocumentsHint.
  ///
  /// In ar, this message translates to:
  /// **'ارفع وثائقك بصورة واضحة وكاملة الأطراف. تُراجَع خلال يوم عمل.'**
  String get onboardingDocumentsHint;

  /// No description provided for @onboardingDocumentsComplete.
  ///
  /// In ar, this message translates to:
  /// **'اكتملت كل الوثائق المطلوبة.'**
  String get onboardingDocumentsComplete;

  /// No description provided for @onboardingDocumentsPending.
  ///
  /// In ar, this message translates to:
  /// **'ما زالت هناك وثائق مطلوبة.'**
  String get onboardingDocumentsPending;

  /// No description provided for @onboardingVehicleHint.
  ///
  /// In ar, this message translates to:
  /// **'أضف المركبة التي ستعمل بها. يمكنك إضافة غيرها لاحقًا.'**
  String get onboardingVehicleHint;

  /// No description provided for @onboardingZonesHint.
  ///
  /// In ar, this message translates to:
  /// **'اختر المناطق التي تريد استقبال المهام فيها.'**
  String get onboardingZonesHint;

  /// No description provided for @onboardingNoZones.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مناطق متاحة حاليًا'**
  String get onboardingNoZones;

  /// No description provided for @onboardingReviewHint.
  ///
  /// In ar, this message translates to:
  /// **'راجع بياناتك قبل الإرسال — يمكنك تعديل أي خطوة.'**
  String get onboardingReviewHint;

  /// No description provided for @onboardingReviewIncomplete.
  ///
  /// In ar, this message translates to:
  /// **'أكمل الخطوات السابقة لعرض الملخّص.'**
  String get onboardingReviewIncomplete;

  /// No description provided for @onboardingAcceptTerms.
  ///
  /// In ar, this message translates to:
  /// **'أوافق على شروط الشراكة وسياسة الخصوصية.'**
  String get onboardingAcceptTerms;

  /// No description provided for @onboardingReadTerms.
  ///
  /// In ar, this message translates to:
  /// **'اقرأ الشروط'**
  String get onboardingReadTerms;

  /// No description provided for @onboardingSubmit.
  ///
  /// In ar, this message translates to:
  /// **'إرسال الطلب للمراجعة'**
  String get onboardingSubmit;

  /// No description provided for @documentNotUploaded.
  ///
  /// In ar, this message translates to:
  /// **'لم تُرفع'**
  String get documentNotUploaded;

  /// No description provided for @onboardingStatusTitle.
  ///
  /// In ar, this message translates to:
  /// **'حالة طلبك'**
  String get onboardingStatusTitle;

  /// No description provided for @onboardingDraftTitle.
  ///
  /// In ar, this message translates to:
  /// **'طلبك غير مكتمل'**
  String get onboardingDraftTitle;

  /// No description provided for @onboardingDraftBody.
  ///
  /// In ar, this message translates to:
  /// **'أكمل الخطوات المتبقية ثم أرسل الطلب للمراجعة.'**
  String get onboardingDraftBody;

  /// No description provided for @onboardingUnderReviewTitle.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get onboardingUnderReviewTitle;

  /// No description provided for @onboardingUnderReviewBody.
  ///
  /// In ar, this message translates to:
  /// **'نراجع بياناتك ووثائقك الآن. سنُعلمك بالنتيجة عبر إشعار ورسالة نصية خلال يوم عمل.'**
  String get onboardingUnderReviewBody;

  /// No description provided for @onboardingApprovedTitle.
  ///
  /// In ar, this message translates to:
  /// **'تم قبولك'**
  String get onboardingApprovedTitle;

  /// No description provided for @onboardingApprovedBody.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً بك في تمام. يمكنك الاتصال وبدء استقبال المهام.'**
  String get onboardingApprovedBody;

  /// No description provided for @onboardingRejectedTitle.
  ///
  /// In ar, this message translates to:
  /// **'يحتاج طلبك إلى تعديل'**
  String get onboardingRejectedTitle;

  /// No description provided for @onboardingRejectedBody.
  ///
  /// In ar, this message translates to:
  /// **'صحّح النقاط التالية ثم أعد الإرسال.'**
  String get onboardingRejectedBody;

  /// No description provided for @onboardingRejectedWhatToFix.
  ///
  /// In ar, this message translates to:
  /// **'ما يجب تصحيحه'**
  String get onboardingRejectedWhatToFix;

  /// No description provided for @onboardingRejectedNoDocumentDetail.
  ///
  /// In ar, this message translates to:
  /// **'لم يوضّح المراجع سببًا محددًا. تواصل مع الدعم للتفاصيل.'**
  String get onboardingRejectedNoDocumentDetail;

  /// No description provided for @onboardingResubmit.
  ///
  /// In ar, this message translates to:
  /// **'أعد إرسال الطلب'**
  String get onboardingResubmit;

  /// No description provided for @onboardingSuspendedTitle.
  ///
  /// In ar, this message translates to:
  /// **'حسابك موقوف'**
  String get onboardingSuspendedTitle;

  /// No description provided for @onboardingSuspendedBody.
  ///
  /// In ar, this message translates to:
  /// **'تواصل مع الدعم لمعرفة السبب وخطوات إعادة التفعيل.'**
  String get onboardingSuspendedBody;

  /// No description provided for @onboardingContactSupport.
  ///
  /// In ar, this message translates to:
  /// **'تواصل مع الدعم'**
  String get onboardingContactSupport;

  /// No description provided for @onboardingReviewProgress.
  ///
  /// In ar, this message translates to:
  /// **'تقدّم المراجعة'**
  String get onboardingReviewProgress;

  /// No description provided for @onboardingDocumentsApproved.
  ///
  /// In ar, this message translates to:
  /// **'تمت الموافقة على {approved} من {total} وثائق'**
  String onboardingDocumentsApproved(int approved, int total);

  /// No description provided for @onboardingSubmittedOn.
  ///
  /// In ar, this message translates to:
  /// **'أُرسل الطلب في {date}'**
  String onboardingSubmittedOn(String date);

  /// No description provided for @onboardingFixRejection.
  ///
  /// In ar, this message translates to:
  /// **'صحّح هذه الخطوة ثم تابع.'**
  String get onboardingFixRejection;

  /// No description provided for @onboardingSeeReasons.
  ///
  /// In ar, this message translates to:
  /// **'عرض أسباب الرفض'**
  String get onboardingSeeReasons;

  /// No description provided for @documentsTitle.
  ///
  /// In ar, this message translates to:
  /// **'وثائقي'**
  String get documentsTitle;

  /// No description provided for @documentsRequired.
  ///
  /// In ar, this message translates to:
  /// **'وثائق مطلوبة'**
  String get documentsRequired;

  /// No description provided for @documentsOther.
  ///
  /// In ar, this message translates to:
  /// **'وثائق أخرى'**
  String get documentsOther;

  /// No description provided for @documentsReviewHint.
  ///
  /// In ar, this message translates to:
  /// **'تُراجَع الوثائق خلال يوم عمل. سنُعلمك بأي تغيير.'**
  String get documentsReviewHint;

  /// No description provided for @documentsBlockingWarning.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكنك الاتصال حتى تُعتمد كل الوثائق المطلوبة وتكون سارية.'**
  String get documentsBlockingWarning;

  /// No description provided for @documentUpload.
  ///
  /// In ar, this message translates to:
  /// **'رفع'**
  String get documentUpload;

  /// No description provided for @documentReupload.
  ///
  /// In ar, this message translates to:
  /// **'إعادة الرفع'**
  String get documentReupload;

  /// No description provided for @documentUploadHint.
  ///
  /// In ar, this message translates to:
  /// **'صوّر الوثيقة كاملة وواضحة، أو ارفع ملف PDF.'**
  String get documentUploadHint;

  /// No description provided for @documentUploadFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر رفع الملف. حاول مرة أخرى.'**
  String get documentUploadFailed;

  /// No description provided for @documentUploaded.
  ///
  /// In ar, this message translates to:
  /// **'تم رفع الوثيقة.'**
  String get documentUploaded;

  /// No description provided for @documentNumber.
  ///
  /// In ar, this message translates to:
  /// **'رقم الوثيقة'**
  String get documentNumber;

  /// No description provided for @documentExpiryDate.
  ///
  /// In ar, this message translates to:
  /// **'تاريخ انتهاء الصلاحية'**
  String get documentExpiryDate;

  /// No description provided for @documentExpiryHint.
  ///
  /// In ar, this message translates to:
  /// **'اختر تاريخ الانتهاء'**
  String get documentExpiryHint;

  /// No description provided for @documentExpiresOn.
  ///
  /// In ar, this message translates to:
  /// **'تنتهي في {date}'**
  String documentExpiresOn(String date);

  /// No description provided for @documentRejectionReason.
  ///
  /// In ar, this message translates to:
  /// **'سبب الرفض: {reason}'**
  String documentRejectionReason(String reason);

  /// No description provided for @documentStatusPending.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get documentStatusPending;

  /// No description provided for @documentStatusApproved.
  ///
  /// In ar, this message translates to:
  /// **'معتمدة'**
  String get documentStatusApproved;

  /// No description provided for @documentStatusRejected.
  ///
  /// In ar, this message translates to:
  /// **'مرفوضة'**
  String get documentStatusRejected;

  /// No description provided for @documentStatusExpired.
  ///
  /// In ar, this message translates to:
  /// **'منتهية'**
  String get documentStatusExpired;

  /// No description provided for @documentId.
  ///
  /// In ar, this message translates to:
  /// **'الهوية الشخصية'**
  String get documentId;

  /// No description provided for @documentDrivingLicense.
  ///
  /// In ar, this message translates to:
  /// **'رخصة القيادة'**
  String get documentDrivingLicense;

  /// No description provided for @documentVehicleLicense.
  ///
  /// In ar, this message translates to:
  /// **'رخصة المركبة'**
  String get documentVehicleLicense;

  /// No description provided for @documentInsurance.
  ///
  /// In ar, this message translates to:
  /// **'التأمين'**
  String get documentInsurance;

  /// No description provided for @documentProfessionalCertificate.
  ///
  /// In ar, this message translates to:
  /// **'شهادة مهنية'**
  String get documentProfessionalCertificate;

  /// No description provided for @documentBusiness.
  ///
  /// In ar, this message translates to:
  /// **'سجل تجاري'**
  String get documentBusiness;

  /// No description provided for @documentProfilePicture.
  ///
  /// In ar, this message translates to:
  /// **'الصورة الشخصية'**
  String get documentProfilePicture;

  /// No description provided for @vehiclesTitle.
  ///
  /// In ar, this message translates to:
  /// **'مركباتي'**
  String get vehiclesTitle;

  /// No description provided for @vehiclesAdd.
  ///
  /// In ar, this message translates to:
  /// **'إضافة مركبة'**
  String get vehiclesAdd;

  /// No description provided for @vehiclesEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد مركبات'**
  String get vehiclesEmptyTitle;

  /// No description provided for @vehiclesEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'أضف مركبتك ليتم اعتمادها قبل بدء العمل.'**
  String get vehiclesEmptyBody;

  /// No description provided for @vehicleDetailTitle.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل المركبة'**
  String get vehicleDetailTitle;

  /// No description provided for @vehicleType.
  ///
  /// In ar, this message translates to:
  /// **'نوع المركبة'**
  String get vehicleType;

  /// No description provided for @vehicleBrand.
  ///
  /// In ar, this message translates to:
  /// **'الشركة المصنّعة'**
  String get vehicleBrand;

  /// No description provided for @vehicleModel.
  ///
  /// In ar, this message translates to:
  /// **'الطراز'**
  String get vehicleModel;

  /// No description provided for @vehicleYear.
  ///
  /// In ar, this message translates to:
  /// **'سنة الصنع'**
  String get vehicleYear;

  /// No description provided for @vehicleColor.
  ///
  /// In ar, this message translates to:
  /// **'اللون'**
  String get vehicleColor;

  /// No description provided for @vehiclePlate.
  ///
  /// In ar, this message translates to:
  /// **'رقم اللوحة'**
  String get vehiclePlate;

  /// No description provided for @vehicleSeats.
  ///
  /// In ar, this message translates to:
  /// **'عدد المقاعد'**
  String get vehicleSeats;

  /// No description provided for @vehiclePhotos.
  ///
  /// In ar, this message translates to:
  /// **'صور المركبة'**
  String get vehiclePhotos;

  /// No description provided for @vehiclePhotosHint.
  ///
  /// In ar, this message translates to:
  /// **'صورة أمامية وأخرى للوحة الأرقام على الأقل.'**
  String get vehiclePhotosHint;

  /// No description provided for @vehicleDocuments.
  ///
  /// In ar, this message translates to:
  /// **'وثائق المركبة'**
  String get vehicleDocuments;

  /// No description provided for @vehicleActive.
  ///
  /// In ar, this message translates to:
  /// **'المركبة الفعّالة'**
  String get vehicleActive;

  /// No description provided for @vehicleIsActive.
  ///
  /// In ar, this message translates to:
  /// **'هذه هي المركبة التي تعمل بها الآن.'**
  String get vehicleIsActive;

  /// No description provided for @vehicleActivate.
  ///
  /// In ar, this message translates to:
  /// **'اجعلها الفعّالة'**
  String get vehicleActivate;

  /// No description provided for @vehicleActivated.
  ///
  /// In ar, this message translates to:
  /// **'أصبحت {vehicle} مركبتك الفعّالة.'**
  String vehicleActivated(String vehicle);

  /// No description provided for @vehicleNotActivatable.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن تفعيل مركبة قبل اعتمادها.'**
  String get vehicleNotActivatable;

  /// No description provided for @vehicleReviewNotice.
  ///
  /// In ar, this message translates to:
  /// **'تُراجَع المركبة الجديدة قبل السماح بالعمل بها.'**
  String get vehicleReviewNotice;

  /// No description provided for @vehicleSubmittedForReview.
  ///
  /// In ar, this message translates to:
  /// **'أُرسلت المركبة للمراجعة.'**
  String get vehicleSubmittedForReview;

  /// No description provided for @vehicleStatusPending.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get vehicleStatusPending;

  /// No description provided for @vehicleStatusApproved.
  ///
  /// In ar, this message translates to:
  /// **'معتمدة'**
  String get vehicleStatusApproved;

  /// No description provided for @vehicleStatusRejected.
  ///
  /// In ar, this message translates to:
  /// **'مرفوضة'**
  String get vehicleStatusRejected;

  /// No description provided for @vehicleStatusSuspended.
  ///
  /// In ar, this message translates to:
  /// **'موقوفة'**
  String get vehicleStatusSuspended;

  /// No description provided for @accountTitle.
  ///
  /// In ar, this message translates to:
  /// **'حسابي'**
  String get accountTitle;

  /// No description provided for @accountNoName.
  ///
  /// In ar, this message translates to:
  /// **'أضف اسمك'**
  String get accountNoName;

  /// No description provided for @accountApproved.
  ///
  /// In ar, this message translates to:
  /// **'شريك معتمد'**
  String get accountApproved;

  /// No description provided for @accountNotApproved.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get accountNotApproved;

  /// No description provided for @accountGroupWork.
  ///
  /// In ar, this message translates to:
  /// **'العمل'**
  String get accountGroupWork;

  /// No description provided for @accountGroupActivity.
  ///
  /// In ar, this message translates to:
  /// **'النشاط'**
  String get accountGroupActivity;

  /// No description provided for @accountGroupSettings.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get accountGroupSettings;

  /// No description provided for @accountGroupHelp.
  ///
  /// In ar, this message translates to:
  /// **'المساعدة والأمان'**
  String get accountGroupHelp;

  /// No description provided for @accountSignOut.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get accountSignOut;

  /// No description provided for @accountSignOutConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيتم إيقاف اتصالك وإنهاء التتبّع على هذا الجهاز.'**
  String get accountSignOutConfirm;

  /// No description provided for @profileTitle.
  ///
  /// In ar, this message translates to:
  /// **'الملف الشخصي'**
  String get profileTitle;

  /// No description provided for @profilePhone.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف'**
  String get profilePhone;

  /// No description provided for @profilePhoneLocked.
  ///
  /// In ar, this message translates to:
  /// **'لتغيير الرقم تواصل مع الدعم.'**
  String get profilePhoneLocked;

  /// No description provided for @profileEmail.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get profileEmail;

  /// No description provided for @profileSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ التغييرات'**
  String get profileSaved;

  /// No description provided for @workPreferencesTitle.
  ///
  /// In ar, this message translates to:
  /// **'تفضيلات العمل'**
  String get workPreferencesTitle;

  /// No description provided for @workPreferencesActiveRoles.
  ///
  /// In ar, this message translates to:
  /// **'الأدوار الفعّالة'**
  String get workPreferencesActiveRoles;

  /// No description provided for @workPreferencesActiveRolesHint.
  ///
  /// In ar, this message translates to:
  /// **'اختر ما تريد استقباله هذه الوردية من بين أدوارك المعتمدة.'**
  String get workPreferencesActiveRolesHint;

  /// No description provided for @workPreferencesRolesApplyNextShift.
  ///
  /// In ar, this message translates to:
  /// **'يُطبَّق هذا الخيار على هذا الجهاز فور اتصالك القادم.'**
  String get workPreferencesRolesApplyNextShift;

  /// No description provided for @workPreferencesZones.
  ///
  /// In ar, this message translates to:
  /// **'مناطق العمل'**
  String get workPreferencesZones;

  /// No description provided for @workPreferencesZonesHint.
  ///
  /// In ar, this message translates to:
  /// **'المناطق التي تصلك فيها المهام.'**
  String get workPreferencesZonesHint;

  /// No description provided for @workPreferencesCategories.
  ///
  /// In ar, this message translates to:
  /// **'الخدمات'**
  String get workPreferencesCategories;

  /// No description provided for @workPreferencesCategoriesHint.
  ///
  /// In ar, this message translates to:
  /// **'الخدمات المعتمدة في ملفك.'**
  String get workPreferencesCategoriesHint;

  /// No description provided for @workPreferencesCategoriesReviewNotice.
  ///
  /// In ar, this message translates to:
  /// **'قد تحتاج إضافة خدمة جديدة إلى مراجعة ووثائق إضافية.'**
  String get workPreferencesCategoriesReviewNotice;

  /// No description provided for @workPreferencesSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ تفضيلاتك'**
  String get workPreferencesSaved;

  /// No description provided for @preferencesTitle.
  ///
  /// In ar, this message translates to:
  /// **'التفضيلات'**
  String get preferencesTitle;

  /// No description provided for @preferencesLanguage.
  ///
  /// In ar, this message translates to:
  /// **'اللغة'**
  String get preferencesLanguage;

  /// No description provided for @preferencesAppearance.
  ///
  /// In ar, this message translates to:
  /// **'المظهر'**
  String get preferencesAppearance;

  /// No description provided for @preferencesNotificationsMovedHint.
  ///
  /// In ar, this message translates to:
  /// **'إعدادات الإشعارات أصبحت في صفحة مستقلة.'**
  String get preferencesNotificationsMovedHint;

  /// No description provided for @themeSystem.
  ///
  /// In ar, this message translates to:
  /// **'حسب النظام'**
  String get themeSystem;

  /// No description provided for @themeLight.
  ///
  /// In ar, this message translates to:
  /// **'فاتح'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In ar, this message translates to:
  /// **'داكن'**
  String get themeDark;

  /// No description provided for @notificationSettingsTitle.
  ///
  /// In ar, this message translates to:
  /// **'إعدادات الإشعارات'**
  String get notificationSettingsTitle;

  /// No description provided for @notificationSettingsOffersAlwaysOn.
  ///
  /// In ar, this message translates to:
  /// **'إشعارات عروض المهام تبقى مفعّلة دائمًا أثناء الوردية — بدونها لن تصلك المهام.'**
  String get notificationSettingsOffersAlwaysOn;

  /// No description provided for @preferencesPush.
  ///
  /// In ar, this message translates to:
  /// **'إشعارات التطبيق'**
  String get preferencesPush;

  /// No description provided for @preferencesPushHint.
  ///
  /// In ar, this message translates to:
  /// **'تحديثات المهام والأرباح.'**
  String get preferencesPushHint;

  /// No description provided for @preferencesSms.
  ///
  /// In ar, this message translates to:
  /// **'الرسائل النصية'**
  String get preferencesSms;

  /// No description provided for @preferencesEmail.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get preferencesEmail;

  /// No description provided for @preferencesMarketing.
  ///
  /// In ar, this message translates to:
  /// **'العروض التسويقية'**
  String get preferencesMarketing;

  /// No description provided for @preferencesMarketingHint.
  ///
  /// In ar, this message translates to:
  /// **'أخبار الحوافز والمكافآت فقط.'**
  String get preferencesMarketingHint;

  /// No description provided for @notificationsTitle.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get notificationsTitle;

  /// No description provided for @notificationsEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إشعارات'**
  String get notificationsEmptyTitle;

  /// No description provided for @notificationsEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'سنخبرك هنا بكل جديد عن مهامك وأرباحك.'**
  String get notificationsEmptyBody;

  /// No description provided for @notificationsMarkAllRead.
  ///
  /// In ar, this message translates to:
  /// **'تعليم الكل كمقروء'**
  String get notificationsMarkAllRead;

  /// No description provided for @sessionsTitle.
  ///
  /// In ar, this message translates to:
  /// **'الأجهزة النشطة'**
  String get sessionsTitle;

  /// No description provided for @sessionsEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد أجهزة أخرى'**
  String get sessionsEmptyTitle;

  /// No description provided for @sessionsThisDevice.
  ///
  /// In ar, this message translates to:
  /// **'هذا الجهاز'**
  String get sessionsThisDevice;

  /// No description provided for @sessionsLastSeen.
  ///
  /// In ar, this message translates to:
  /// **'آخر نشاط {when}'**
  String sessionsLastSeen(String when);

  /// No description provided for @sessionsRevoke.
  ///
  /// In ar, this message translates to:
  /// **'إنهاء الجلسة'**
  String get sessionsRevoke;

  /// No description provided for @sessionsSignOutAll.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج من كل الأجهزة'**
  String get sessionsSignOutAll;

  /// No description provided for @sessionsSignOutAllConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيتم إنهاء كل الجلسات بما فيها هذا الجهاز.'**
  String get sessionsSignOutAllConfirm;

  /// No description provided for @legalTitle.
  ///
  /// In ar, this message translates to:
  /// **'الشروط والخصوصية'**
  String get legalTitle;

  /// No description provided for @legalTermsTitle.
  ///
  /// In ar, this message translates to:
  /// **'شروط الشراكة'**
  String get legalTermsTitle;

  /// No description provided for @legalTermsBody.
  ///
  /// In ar, this message translates to:
  /// **'بعملك مع تمام تلتزم بتقديم بيانات صحيحة، والحفاظ على سريان وثائقك، ومعاملة العملاء باحترام، وتنفيذ المهام التي تقبلها. تُحتسب عمولة تمام على كل مهمة مكتملة وفق النسبة المعلنة في هذه الصفحة، وقد يؤدي الإلغاء المتكرر أو رفض المهام إلى تقليل ما يصلك من عروض.'**
  String get legalTermsBody;

  /// No description provided for @legalCommissionTitle.
  ///
  /// In ar, this message translates to:
  /// **'العمولة والأرباح'**
  String get legalCommissionTitle;

  /// No description provided for @legalCommissionBody.
  ///
  /// In ar, this message translates to:
  /// **'تُحتسب أرباحك من إجمالي قيمة المهمة بعد خصم عمولة تمام وأي رسوم معلنة. تُضاف الأرباح إلى رصيدك فور اكتمال المهمة وتأكيد العميل، ويمكنك سحبها إلى حسابك البنكي في أي وقت وفق حدّ السحب الأدنى.'**
  String get legalCommissionBody;

  /// No description provided for @legalTrackingTitle.
  ///
  /// In ar, this message translates to:
  /// **'تتبّع الموقع'**
  String get legalTrackingTitle;

  /// No description provided for @legalTrackingBody.
  ///
  /// In ar, this message translates to:
  /// **'يُسجَّل موقعك أثناء اتصالك فقط، ويتوقف التسجيل فور إيقاف الاتصال أو سحب الإذن. نستخدمه لإرسال أقرب المهام إليك، وإظهار وصولك للعميل، وحل النزاعات. لا نشارك موقعك مع أطراف ثالثة لأغراض تسويقية.'**
  String get legalTrackingBody;

  /// No description provided for @legalPrivacyTitle.
  ///
  /// In ar, this message translates to:
  /// **'الخصوصية'**
  String get legalPrivacyTitle;

  /// No description provided for @legalPrivacyBody.
  ///
  /// In ar, this message translates to:
  /// **'نحتفظ ببياناتك ووثائقك للمدة التي يفرضها القانون ولأغراض التحقق والمحاسبة فقط. يظهر للعميل اسمك الأول وصورتك وتقييمك وبيانات مركبتك، ولا يظهر رقم هاتفك مباشرة عند تفعيل إخفاء الأرقام.'**
  String get legalPrivacyBody;

  /// No description provided for @legalTermsVersion.
  ///
  /// In ar, this message translates to:
  /// **'إصدار الشروط {version}'**
  String legalTermsVersion(String version);

  /// No description provided for @legalDeleteAccount.
  ///
  /// In ar, this message translates to:
  /// **'طلب حذف الحساب'**
  String get legalDeleteAccount;

  /// No description provided for @legalDeleteAccountHint.
  ///
  /// In ar, this message translates to:
  /// **'يفتح طلب دعم لمراجعة الحذف.'**
  String get legalDeleteAccountHint;

  /// No description provided for @legalDeleteAccountConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سنفتح طلب دعم لحذف حسابك. تُسوّى الأرباح المستحقة أولًا، وقد نحتفظ بسجلات المهام والفواتير كما يقتضي القانون.'**
  String get legalDeleteAccountConfirm;

  /// No description provided for @legalDeleteAccountCta.
  ///
  /// In ar, this message translates to:
  /// **'أرسل الطلب'**
  String get legalDeleteAccountCta;

  /// No description provided for @legalDeleteAccountSubject.
  ///
  /// In ar, this message translates to:
  /// **'طلب حذف حساب شريك'**
  String get legalDeleteAccountSubject;

  /// No description provided for @legalDeleteAccountBody.
  ///
  /// In ar, this message translates to:
  /// **'أرغب بحذف حساب الشريك الخاص بي وبياناتي الشخصية من تمام.'**
  String get legalDeleteAccountBody;

  /// No description provided for @supportTitle.
  ///
  /// In ar, this message translates to:
  /// **'الدعم'**
  String get supportTitle;

  /// No description provided for @supportNewTicket.
  ///
  /// In ar, this message translates to:
  /// **'طلب دعم جديد'**
  String get supportNewTicket;

  /// No description provided for @supportNewTicketHint.
  ///
  /// In ar, this message translates to:
  /// **'صف مشكلتك وسيتواصل معك فريق الدعم.'**
  String get supportNewTicketHint;

  /// No description provided for @supportSubject.
  ///
  /// In ar, this message translates to:
  /// **'الموضوع'**
  String get supportSubject;

  /// No description provided for @supportDescription.
  ///
  /// In ar, this message translates to:
  /// **'التفاصيل'**
  String get supportDescription;

  /// No description provided for @supportEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد طلبات دعم'**
  String get supportEmptyTitle;

  /// No description provided for @supportEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'افتح طلبًا جديدًا إذا احتجت مساعدة.'**
  String get supportEmptyBody;

  /// No description provided for @supportTicketTitle.
  ///
  /// In ar, this message translates to:
  /// **'طلب الدعم'**
  String get supportTicketTitle;

  /// No description provided for @supportReplyHint.
  ///
  /// In ar, this message translates to:
  /// **'اكتب ردك…'**
  String get supportReplyHint;

  /// No description provided for @ticketCategoryJob.
  ///
  /// In ar, this message translates to:
  /// **'مشكلة في مهمة'**
  String get ticketCategoryJob;

  /// No description provided for @ticketCategoryPayment.
  ///
  /// In ar, this message translates to:
  /// **'الأرباح والدفع'**
  String get ticketCategoryPayment;

  /// No description provided for @ticketCategoryAccount.
  ///
  /// In ar, this message translates to:
  /// **'الحساب والوثائق'**
  String get ticketCategoryAccount;

  /// No description provided for @ticketCategoryCustomer.
  ///
  /// In ar, this message translates to:
  /// **'سلوك عميل'**
  String get ticketCategoryCustomer;

  /// No description provided for @ticketCategorySafety.
  ///
  /// In ar, this message translates to:
  /// **'السلامة'**
  String get ticketCategorySafety;

  /// No description provided for @ticketCategoryOther.
  ///
  /// In ar, this message translates to:
  /// **'أخرى'**
  String get ticketCategoryOther;

  /// No description provided for @ticketStatusOpen.
  ///
  /// In ar, this message translates to:
  /// **'مفتوح'**
  String get ticketStatusOpen;

  /// No description provided for @ticketStatusInProgress.
  ///
  /// In ar, this message translates to:
  /// **'قيد المعالجة'**
  String get ticketStatusInProgress;

  /// No description provided for @ticketStatusWaitingUser.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار ردك'**
  String get ticketStatusWaitingUser;

  /// No description provided for @ticketStatusResolved.
  ///
  /// In ar, this message translates to:
  /// **'تم الحل'**
  String get ticketStatusResolved;

  /// No description provided for @ticketStatusClosed.
  ///
  /// In ar, this message translates to:
  /// **'مغلق'**
  String get ticketStatusClosed;

  /// No description provided for @mediaAttachPhotos.
  ///
  /// In ar, this message translates to:
  /// **'إرفاق صور'**
  String get mediaAttachPhotos;

  /// No description provided for @mediaCamera.
  ///
  /// In ar, this message translates to:
  /// **'الكاميرا'**
  String get mediaCamera;

  /// No description provided for @mediaGallery.
  ///
  /// In ar, this message translates to:
  /// **'المعرض'**
  String get mediaGallery;

  /// No description provided for @bannerLeaveAppTitle.
  ///
  /// In ar, this message translates to:
  /// **'فتح رابط خارجي'**
  String get bannerLeaveAppTitle;

  /// No description provided for @bannerLeaveAppMessage.
  ///
  /// In ar, this message translates to:
  /// **'سيتم فتح {host} خارج التطبيق.'**
  String bannerLeaveAppMessage(String host);

  /// No description provided for @bannerPromoCopied.
  ///
  /// In ar, this message translates to:
  /// **'تم نسخ الكود {code}.'**
  String bannerPromoCopied(String code);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
