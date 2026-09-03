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
  /// **'كل خدماتك… تمام'**
  String get appTagline;

  /// No description provided for @actionApply.
  ///
  /// In ar, this message translates to:
  /// **'تطبيق'**
  String get actionApply;

  /// No description provided for @actionBrowse.
  ///
  /// In ar, this message translates to:
  /// **'تصفّح الخدمات'**
  String get actionBrowse;

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

  /// No description provided for @actionClear.
  ///
  /// In ar, this message translates to:
  /// **'مسح'**
  String get actionClear;

  /// No description provided for @actionContinue.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get actionContinue;

  /// No description provided for @actionCopy.
  ///
  /// In ar, this message translates to:
  /// **'نسخ'**
  String get actionCopy;

  /// No description provided for @actionDelete.
  ///
  /// In ar, this message translates to:
  /// **'حذف'**
  String get actionDelete;

  /// No description provided for @actionDismiss.
  ///
  /// In ar, this message translates to:
  /// **'إخفاء'**
  String get actionDismiss;

  /// No description provided for @actionFavorite.
  ///
  /// In ar, this message translates to:
  /// **'أضف إلى المفضلة'**
  String get actionFavorite;

  /// No description provided for @actionUnfavorite.
  ///
  /// In ar, this message translates to:
  /// **'إزالة من المفضلة'**
  String get actionUnfavorite;

  /// No description provided for @actionLoadMore.
  ///
  /// In ar, this message translates to:
  /// **'تحميل المزيد'**
  String get actionLoadMore;

  /// No description provided for @actionManage.
  ///
  /// In ar, this message translates to:
  /// **'إدارة'**
  String get actionManage;

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

  /// No description provided for @actionSchedule.
  ///
  /// In ar, this message translates to:
  /// **'جدولة'**
  String get actionSchedule;

  /// No description provided for @actionSeeAll.
  ///
  /// In ar, this message translates to:
  /// **'عرض الكل'**
  String get actionSeeAll;

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

  /// No description provided for @navHome.
  ///
  /// In ar, this message translates to:
  /// **'الرئيسية'**
  String get navHome;

  /// No description provided for @navOrders.
  ///
  /// In ar, this message translates to:
  /// **'طلباتي'**
  String get navOrders;

  /// No description provided for @navWallet.
  ///
  /// In ar, this message translates to:
  /// **'المحفظة'**
  String get navWallet;

  /// No description provided for @navAccount.
  ///
  /// In ar, this message translates to:
  /// **'حسابي'**
  String get navAccount;

  /// No description provided for @onboardingRideTitle.
  ///
  /// In ar, this message translates to:
  /// **'مشوارك يبدأ من هنا'**
  String get onboardingRideTitle;

  /// No description provided for @onboardingRideBody.
  ///
  /// In ar, this message translates to:
  /// **'اطلب سيارة خلال ثوانٍ، وتابع سائقك على الخريطة حتى الوصول.'**
  String get onboardingRideBody;

  /// No description provided for @onboardingDeliveryTitle.
  ///
  /// In ar, this message translates to:
  /// **'توصيل أي طرد'**
  String get onboardingDeliveryTitle;

  /// No description provided for @onboardingDeliveryBody.
  ///
  /// In ar, this message translates to:
  /// **'أرسل واستلم الطرود داخل مدينتك بسعر واضح قبل الطلب.'**
  String get onboardingDeliveryBody;

  /// No description provided for @onboardingServicesTitle.
  ///
  /// In ar, this message translates to:
  /// **'خدمات منزلية موثوقة'**
  String get onboardingServicesTitle;

  /// No description provided for @onboardingServicesBody.
  ///
  /// In ar, this message translates to:
  /// **'سباك، كهربائي، فني تكييف وغيرهم — بفنّيين معتمدين وعرض سعر واضح.'**
  String get onboardingServicesBody;

  /// No description provided for @onboardingStart.
  ///
  /// In ar, this message translates to:
  /// **'لنبدأ'**
  String get onboardingStart;

  /// No description provided for @signInTitle.
  ///
  /// In ar, this message translates to:
  /// **'أهلاً بك في تمام'**
  String get signInTitle;

  /// No description provided for @signInSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رقم هاتفك لإنشاء حساب أو تسجيل الدخول'**
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
  /// **'بمتابعتك فإنك توافق على شروط الاستخدام وسياسة الخصوصية.'**
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

  /// No description provided for @nameTitle.
  ///
  /// In ar, this message translates to:
  /// **'ما اسمك؟'**
  String get nameTitle;

  /// No description provided for @nameSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'حتى يعرف الشريك بمن سيلتقي'**
  String get nameSubtitle;

  /// No description provided for @nameFieldLabel.
  ///
  /// In ar, this message translates to:
  /// **'الاسم الكامل'**
  String get nameFieldLabel;

  /// No description provided for @nameFieldHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: أحمد محمود'**
  String get nameFieldHint;

  /// No description provided for @nameWhy.
  ///
  /// In ar, this message translates to:
  /// **'نعرض اسمك للشريك المكلّف بطلبك فقط.'**
  String get nameWhy;

  /// No description provided for @locationPermissionTitle.
  ///
  /// In ar, this message translates to:
  /// **'فعِّل الموقع للحصول على خدمة أسرع'**
  String get locationPermissionTitle;

  /// No description provided for @locationPermissionBody.
  ///
  /// In ar, this message translates to:
  /// **'نستخدم موقعك لتحديد نقطة الانطلاق وحساب وقت الوصول بدقة.'**
  String get locationPermissionBody;

  /// No description provided for @locationReasonPickup.
  ///
  /// In ar, this message translates to:
  /// **'تحديد نقطة الانطلاق تلقائيًا'**
  String get locationReasonPickup;

  /// No description provided for @locationReasonEta.
  ///
  /// In ar, this message translates to:
  /// **'حساب وقت الوصول بدقة'**
  String get locationReasonEta;

  /// No description provided for @locationReasonZone.
  ///
  /// In ar, this message translates to:
  /// **'معرفة الخدمات المتاحة في منطقتك'**
  String get locationReasonZone;

  /// No description provided for @locationAllow.
  ///
  /// In ar, this message translates to:
  /// **'السماح بالوصول للموقع'**
  String get locationAllow;

  /// No description provided for @locationChooseManually.
  ///
  /// In ar, this message translates to:
  /// **'سأختار العنوان يدويًا'**
  String get locationChooseManually;

  /// No description provided for @locationBlockedHint.
  ///
  /// In ar, this message translates to:
  /// **'تم رفض إذن الموقع نهائيًا. فعّله من إعدادات النظام.'**
  String get locationBlockedHint;

  /// No description provided for @locationServiceOffHint.
  ///
  /// In ar, this message translates to:
  /// **'خدمة الموقع مغلقة في جهازك.'**
  String get locationServiceOffHint;

  /// No description provided for @locationUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحديد موقعك الآن.'**
  String get locationUnavailable;

  /// No description provided for @homeDeliverTo.
  ///
  /// In ar, this message translates to:
  /// **'التوصيل إلى'**
  String get homeDeliverTo;

  /// No description provided for @homeChooseAddress.
  ///
  /// In ar, this message translates to:
  /// **'اختر عنوانك'**
  String get homeChooseAddress;

  /// No description provided for @homeChangeAddress.
  ///
  /// In ar, this message translates to:
  /// **'تغيير العنوان'**
  String get homeChangeAddress;

  /// No description provided for @homeSearchHint.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن خدمة: سباك، كهربائي، تكييف…'**
  String get homeSearchHint;

  /// No description provided for @homePopular.
  ///
  /// In ar, this message translates to:
  /// **'الأكثر طلبًا'**
  String get homePopular;

  /// No description provided for @homeRecentOrders.
  ///
  /// In ar, this message translates to:
  /// **'طلباتك الأخيرة'**
  String get homeRecentOrders;

  /// No description provided for @homeSavedPlaces.
  ///
  /// In ar, this message translates to:
  /// **'الأماكن المفضلة'**
  String get homeSavedPlaces;

  /// No description provided for @homeAddPlace.
  ///
  /// In ar, this message translates to:
  /// **'أضف عنوانك الأول لتطلب أسرع'**
  String get homeAddPlace;

  /// No description provided for @homeOffers.
  ///
  /// In ar, this message translates to:
  /// **'العروض'**
  String get homeOffers;

  /// No description provided for @homeOffersTitle.
  ///
  /// In ar, this message translates to:
  /// **'أكواد خصم بانتظارك'**
  String get homeOffersTitle;

  /// No description provided for @homeOffersBody.
  ///
  /// In ar, this message translates to:
  /// **'أدخل الكود الآن ليُطبَّق تلقائيًا على طلبك القادم.'**
  String get homeOffersBody;

  /// No description provided for @homeActiveJob.
  ///
  /// In ar, this message translates to:
  /// **'طلب نشط الآن'**
  String get homeActiveJob;

  /// No description provided for @homeSearchingPartner.
  ///
  /// In ar, this message translates to:
  /// **'نبحث عن شريك مناسب…'**
  String get homeSearchingPartner;

  /// No description provided for @serviceRide.
  ///
  /// In ar, this message translates to:
  /// **'مشوار'**
  String get serviceRide;

  /// No description provided for @serviceRideCaption.
  ///
  /// In ar, this message translates to:
  /// **'سيارة خلال دقائق'**
  String get serviceRideCaption;

  /// No description provided for @serviceDelivery.
  ///
  /// In ar, this message translates to:
  /// **'توصيل'**
  String get serviceDelivery;

  /// No description provided for @serviceDeliveryCaption.
  ///
  /// In ar, this message translates to:
  /// **'أرسل طردك الآن'**
  String get serviceDeliveryCaption;

  /// No description provided for @serviceHome.
  ///
  /// In ar, this message translates to:
  /// **'خدمات منزلية'**
  String get serviceHome;

  /// No description provided for @serviceHomeCaption.
  ///
  /// In ar, this message translates to:
  /// **'فنيّون معتمدون'**
  String get serviceHomeCaption;

  /// No description provided for @serviceUrgent.
  ///
  /// In ar, this message translates to:
  /// **'خدمة عاجلة'**
  String get serviceUrgent;

  /// No description provided for @serviceUrgentCaption.
  ///
  /// In ar, this message translates to:
  /// **'استجابة فورية'**
  String get serviceUrgentCaption;

  /// No description provided for @serviceOther.
  ///
  /// In ar, this message translates to:
  /// **'خدمة'**
  String get serviceOther;

  /// No description provided for @searchTitle.
  ///
  /// In ar, this message translates to:
  /// **'بحث'**
  String get searchTitle;

  /// No description provided for @searchNoResultsTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد نتائج'**
  String get searchNoResultsTitle;

  /// No description provided for @searchNoResultsBody.
  ///
  /// In ar, this message translates to:
  /// **'لم نجد خدمة تطابق «{query}».'**
  String searchNoResultsBody(String query);

  /// No description provided for @searchDirectoryEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد خدمات في منطقتك بعد'**
  String get searchDirectoryEmptyTitle;

  /// No description provided for @searchDirectoryEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'نعمل على التوسّع — جرّب عنوانًا آخر.'**
  String get searchDirectoryEmptyBody;

  /// No description provided for @categoryOrderNow.
  ///
  /// In ar, this message translates to:
  /// **'اطلب الآن'**
  String get categoryOrderNow;

  /// No description provided for @categorySubcategories.
  ///
  /// In ar, this message translates to:
  /// **'اختر ما تحتاجه'**
  String get categorySubcategories;

  /// No description provided for @categoryDuration.
  ///
  /// In ar, this message translates to:
  /// **'المدة التقديرية {minutes} دقيقة'**
  String categoryDuration(int minutes);

  /// No description provided for @pricingFixed.
  ///
  /// In ar, this message translates to:
  /// **'سعر ثابت'**
  String get pricingFixed;

  /// No description provided for @pricingStartingFrom.
  ///
  /// In ar, this message translates to:
  /// **'يبدأ من'**
  String get pricingStartingFrom;

  /// No description provided for @pricingHourly.
  ///
  /// In ar, this message translates to:
  /// **'أجرة الساعة'**
  String get pricingHourly;

  /// No description provided for @pricingInspectionFee.
  ///
  /// In ar, this message translates to:
  /// **'رسوم الكشف'**
  String get pricingInspectionFee;

  /// No description provided for @pricingDueNow.
  ///
  /// In ar, this message translates to:
  /// **'المستحق الآن'**
  String get pricingDueNow;

  /// No description provided for @pricingInspectionExplainer.
  ///
  /// In ar, this message translates to:
  /// **'تدفع رسوم الكشف عند وصول الفني، ثم يقدّم لك عرض سعر للعمل قبل البدء.'**
  String get pricingInspectionExplainer;

  /// No description provided for @ridePickupLabel.
  ///
  /// In ar, this message translates to:
  /// **'نقطة الانطلاق'**
  String get ridePickupLabel;

  /// No description provided for @ridePickupEmpty.
  ///
  /// In ar, this message translates to:
  /// **'اختر نقطة الانطلاق'**
  String get ridePickupEmpty;

  /// No description provided for @ridePickupTitle.
  ///
  /// In ar, this message translates to:
  /// **'نقطة الانطلاق'**
  String get ridePickupTitle;

  /// No description provided for @rideDestinationLabel.
  ///
  /// In ar, this message translates to:
  /// **'الوجهة'**
  String get rideDestinationLabel;

  /// No description provided for @rideDestinationEmpty.
  ///
  /// In ar, this message translates to:
  /// **'إلى أين تريد الذهاب؟'**
  String get rideDestinationEmpty;

  /// No description provided for @rideDestinationTitle.
  ///
  /// In ar, this message translates to:
  /// **'الوجهة'**
  String get rideDestinationTitle;

  /// No description provided for @rideSwap.
  ///
  /// In ar, this message translates to:
  /// **'تبديل الاتجاه'**
  String get rideSwap;

  /// No description provided for @rideGetEstimate.
  ///
  /// In ar, this message translates to:
  /// **'احسب السعر'**
  String get rideGetEstimate;

  /// No description provided for @rideOrderCta.
  ///
  /// In ar, this message translates to:
  /// **'اطلب الآن'**
  String get rideOrderCta;

  /// No description provided for @rideScheduleCta.
  ///
  /// In ar, this message translates to:
  /// **'احجز للموعد المحدد'**
  String get rideScheduleCta;

  /// No description provided for @fareSeats.
  ///
  /// In ar, this message translates to:
  /// **'{seats} مقاعد'**
  String fareSeats(int seats);

  /// No description provided for @fareEtaMinutes.
  ///
  /// In ar, this message translates to:
  /// **'خلال {minutes} د'**
  String fareEtaMinutes(String minutes);

  /// No description provided for @checkoutPaymentMethod.
  ///
  /// In ar, this message translates to:
  /// **'طريقة الدفع'**
  String get checkoutPaymentMethod;

  /// No description provided for @checkoutPromoLabel.
  ///
  /// In ar, this message translates to:
  /// **'كود الخصم'**
  String get checkoutPromoLabel;

  /// No description provided for @checkoutPromoHint.
  ///
  /// In ar, this message translates to:
  /// **'أدخل الكود'**
  String get checkoutPromoHint;

  /// No description provided for @checkoutPromoApplied.
  ///
  /// In ar, this message translates to:
  /// **'تم تطبيق الكود {code}'**
  String checkoutPromoApplied(String code);

  /// No description provided for @checkoutSchedule.
  ///
  /// In ar, this message translates to:
  /// **'موعد الطلب'**
  String get checkoutSchedule;

  /// No description provided for @checkoutScheduleNow.
  ///
  /// In ar, this message translates to:
  /// **'الآن'**
  String get checkoutScheduleNow;

  /// No description provided for @checkoutTotal.
  ///
  /// In ar, this message translates to:
  /// **'الإجمالي'**
  String get checkoutTotal;

  /// No description provided for @paymentCash.
  ///
  /// In ar, this message translates to:
  /// **'نقدًا'**
  String get paymentCash;

  /// No description provided for @paymentWallet.
  ///
  /// In ar, this message translates to:
  /// **'المحفظة'**
  String get paymentWallet;

  /// No description provided for @paymentCard.
  ///
  /// In ar, this message translates to:
  /// **'بطاقة'**
  String get paymentCard;

  /// No description provided for @paymentOnline.
  ///
  /// In ar, this message translates to:
  /// **'دفع إلكتروني'**
  String get paymentOnline;

  /// No description provided for @deliveryRoute.
  ///
  /// In ar, this message translates to:
  /// **'المسار'**
  String get deliveryRoute;

  /// No description provided for @deliveryPickupLabel.
  ///
  /// In ar, this message translates to:
  /// **'الاستلام من'**
  String get deliveryPickupLabel;

  /// No description provided for @deliveryPickupTitle.
  ///
  /// In ar, this message translates to:
  /// **'مكان الاستلام'**
  String get deliveryPickupTitle;

  /// No description provided for @deliveryDropoffLabel.
  ///
  /// In ar, this message translates to:
  /// **'التسليم إلى'**
  String get deliveryDropoffLabel;

  /// No description provided for @deliveryDropoffTitle.
  ///
  /// In ar, this message translates to:
  /// **'مكان التسليم'**
  String get deliveryDropoffTitle;

  /// No description provided for @deliveryPackage.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل الطرد'**
  String get deliveryPackage;

  /// No description provided for @deliverySize.
  ///
  /// In ar, this message translates to:
  /// **'الحجم التقريبي'**
  String get deliverySize;

  /// No description provided for @deliveryWeight.
  ///
  /// In ar, this message translates to:
  /// **'الوزن التقريبي'**
  String get deliveryWeight;

  /// No description provided for @deliveryDescription.
  ///
  /// In ar, this message translates to:
  /// **'وصف محتوى الطرد'**
  String get deliveryDescription;

  /// No description provided for @deliveryPhotosHint.
  ///
  /// In ar, this message translates to:
  /// **'صور الطرد تساعد الشريك على التحضير.'**
  String get deliveryPhotosHint;

  /// No description provided for @deliverySender.
  ///
  /// In ar, this message translates to:
  /// **'بيانات المُرسِل'**
  String get deliverySender;

  /// No description provided for @deliveryRecipient.
  ///
  /// In ar, this message translates to:
  /// **'بيانات المُستلِم'**
  String get deliveryRecipient;

  /// No description provided for @deliveryNotes.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظات للتسليم'**
  String get deliveryNotes;

  /// No description provided for @deliveryUrgency.
  ///
  /// In ar, this message translates to:
  /// **'الأولوية'**
  String get deliveryUrgency;

  /// No description provided for @deliveryContactsRequired.
  ///
  /// In ar, this message translates to:
  /// **'أكمل اسم ورقم كل من المُرسِل والمُستلِم.'**
  String get deliveryContactsRequired;

  /// No description provided for @deliveryCategoriesUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل أنواع الطرود.'**
  String get deliveryCategoriesUnavailable;

  /// No description provided for @packageSizeSmall.
  ///
  /// In ar, this message translates to:
  /// **'صغير'**
  String get packageSizeSmall;

  /// No description provided for @packageSizeMedium.
  ///
  /// In ar, this message translates to:
  /// **'متوسط'**
  String get packageSizeMedium;

  /// No description provided for @packageSizeLarge.
  ///
  /// In ar, this message translates to:
  /// **'كبير'**
  String get packageSizeLarge;

  /// No description provided for @packageSizeXl.
  ///
  /// In ar, this message translates to:
  /// **'كبير جدًا'**
  String get packageSizeXl;

  /// No description provided for @contactName.
  ///
  /// In ar, this message translates to:
  /// **'الاسم'**
  String get contactName;

  /// No description provided for @contactPhone.
  ///
  /// In ar, this message translates to:
  /// **'رقم الهاتف'**
  String get contactPhone;

  /// No description provided for @unitKg.
  ///
  /// In ar, this message translates to:
  /// **'كغم'**
  String get unitKg;

  /// No description provided for @unitMinutes.
  ///
  /// In ar, this message translates to:
  /// **'دقيقة'**
  String get unitMinutes;

  /// No description provided for @serviceLocationTitle.
  ///
  /// In ar, this message translates to:
  /// **'موقع الخدمة'**
  String get serviceLocationTitle;

  /// No description provided for @serviceLocationEmpty.
  ///
  /// In ar, this message translates to:
  /// **'اختر موقع الخدمة'**
  String get serviceLocationEmpty;

  /// No description provided for @serviceSubcategory.
  ///
  /// In ar, this message translates to:
  /// **'نوع العمل'**
  String get serviceSubcategory;

  /// No description provided for @serviceOptions.
  ///
  /// In ar, this message translates to:
  /// **'إضافات'**
  String get serviceOptions;

  /// No description provided for @serviceProblemTitle.
  ///
  /// In ar, this message translates to:
  /// **'وصف المشكلة'**
  String get serviceProblemTitle;

  /// No description provided for @serviceProblemHint.
  ///
  /// In ar, this message translates to:
  /// **'اشرح المشكلة بالتفصيل ليصل الفني مستعدًا.'**
  String get serviceProblemHint;

  /// No description provided for @serviceProblemTooShort.
  ///
  /// In ar, this message translates to:
  /// **'أضف وصفًا من ٥ أحرف على الأقل.'**
  String get serviceProblemTooShort;

  /// No description provided for @serviceProblemRequired.
  ///
  /// In ar, this message translates to:
  /// **'أضف وصفًا للمشكلة قبل الإرسال.'**
  String get serviceProblemRequired;

  /// No description provided for @serviceMediaOptional.
  ///
  /// In ar, this message translates to:
  /// **'أضف صورًا إن أمكن (اختياري).'**
  String get serviceMediaOptional;

  /// No description provided for @serviceMediaRequired.
  ///
  /// In ar, this message translates to:
  /// **'مطلوب {count} صورة على الأقل.'**
  String serviceMediaRequired(int count);

  /// No description provided for @serviceInstructions.
  ///
  /// In ar, this message translates to:
  /// **'تعليمات إضافية'**
  String get serviceInstructions;

  /// No description provided for @serviceUrgencyTitle.
  ///
  /// In ar, this message translates to:
  /// **'مستوى الاستعجال'**
  String get serviceUrgencyTitle;

  /// No description provided for @serviceUrgencySurcharge.
  ///
  /// In ar, this message translates to:
  /// **'تُضاف رسوم استعجال إلى السعر النهائي.'**
  String get serviceUrgencySurcharge;

  /// No description provided for @serviceWhenTitle.
  ///
  /// In ar, this message translates to:
  /// **'موعد الزيارة'**
  String get serviceWhenTitle;

  /// No description provided for @serviceWhenNow.
  ///
  /// In ar, this message translates to:
  /// **'في أقرب وقت'**
  String get serviceWhenNow;

  /// No description provided for @serviceWhenScheduled.
  ///
  /// In ar, this message translates to:
  /// **'اختر يومًا'**
  String get serviceWhenScheduled;

  /// No description provided for @timeSlotMorning.
  ///
  /// In ar, this message translates to:
  /// **'صباحًا'**
  String get timeSlotMorning;

  /// No description provided for @timeSlotAfternoon.
  ///
  /// In ar, this message translates to:
  /// **'بعد الظهر'**
  String get timeSlotAfternoon;

  /// No description provided for @timeSlotEvening.
  ///
  /// In ar, this message translates to:
  /// **'مساءً'**
  String get timeSlotEvening;

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

  /// No description provided for @formRequired.
  ///
  /// In ar, this message translates to:
  /// **'هذا الحقل مطلوب'**
  String get formRequired;

  /// No description provided for @formTooSmall.
  ///
  /// In ar, this message translates to:
  /// **'القيمة أقل من الحد المسموح ({min})'**
  String formTooSmall(String min);

  /// No description provided for @formTooLarge.
  ///
  /// In ar, this message translates to:
  /// **'القيمة أكبر من الحد المسموح ({max})'**
  String formTooLarge(String max);

  /// No description provided for @formTooManyItems.
  ///
  /// In ar, this message translates to:
  /// **'الحد الأقصى {count} عناصر'**
  String formTooManyItems(int count);

  /// No description provided for @formNotANumber.
  ///
  /// In ar, this message translates to:
  /// **'أدخل رقمًا صحيحًا'**
  String get formNotANumber;

  /// No description provided for @formInvalidOption.
  ///
  /// In ar, this message translates to:
  /// **'اختيار غير صالح'**
  String get formInvalidOption;

  /// No description provided for @formChooseDate.
  ///
  /// In ar, this message translates to:
  /// **'اختر التاريخ'**
  String get formChooseDate;

  /// No description provided for @formChooseTime.
  ///
  /// In ar, this message translates to:
  /// **'اختر الوقت'**
  String get formChooseTime;

  /// No description provided for @mediaAttachPhotos.
  ///
  /// In ar, this message translates to:
  /// **'إرفاق صور'**
  String get mediaAttachPhotos;

  /// No description provided for @mediaGallery.
  ///
  /// In ar, this message translates to:
  /// **'المعرض'**
  String get mediaGallery;

  /// No description provided for @mediaCamera.
  ///
  /// In ar, this message translates to:
  /// **'الكاميرا'**
  String get mediaCamera;

  /// No description provided for @ordersTitle.
  ///
  /// In ar, this message translates to:
  /// **'طلباتي'**
  String get ordersTitle;

  /// No description provided for @ordersTabAll.
  ///
  /// In ar, this message translates to:
  /// **'الكل'**
  String get ordersTabAll;

  /// No description provided for @ordersTabActive.
  ///
  /// In ar, this message translates to:
  /// **'نشط'**
  String get ordersTabActive;

  /// No description provided for @ordersTabCompleted.
  ///
  /// In ar, this message translates to:
  /// **'مكتمل'**
  String get ordersTabCompleted;

  /// No description provided for @ordersTabCancelled.
  ///
  /// In ar, this message translates to:
  /// **'ملغي'**
  String get ordersTabCancelled;

  /// No description provided for @ordersEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد طلبات بعد'**
  String get ordersEmptyTitle;

  /// No description provided for @ordersEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ أول طلب لك من الشاشة الرئيسية.'**
  String get ordersEmptyBody;

  /// No description provided for @ordersEmptyCta.
  ///
  /// In ar, this message translates to:
  /// **'اذهب للرئيسية'**
  String get ordersEmptyCta;

  /// No description provided for @ordersReorder.
  ///
  /// In ar, this message translates to:
  /// **'أعد الطلب'**
  String get ordersReorder;

  /// No description provided for @jobPricePending.
  ///
  /// In ar, this message translates to:
  /// **'السعر بعد الكشف'**
  String get jobPricePending;

  /// No description provided for @jobStatusDraft.
  ///
  /// In ar, this message translates to:
  /// **'مسودة'**
  String get jobStatusDraft;

  /// No description provided for @jobStatusRequested.
  ///
  /// In ar, this message translates to:
  /// **'تم استلام الطلب'**
  String get jobStatusRequested;

  /// No description provided for @jobStatusSearching.
  ///
  /// In ar, this message translates to:
  /// **'نبحث عن شريك'**
  String get jobStatusSearching;

  /// No description provided for @jobStatusAssigned.
  ///
  /// In ar, this message translates to:
  /// **'تم تعيين الشريك'**
  String get jobStatusAssigned;

  /// No description provided for @jobStatusEnRoute.
  ///
  /// In ar, this message translates to:
  /// **'الشريك في الطريق'**
  String get jobStatusEnRoute;

  /// No description provided for @jobStatusArrived.
  ///
  /// In ar, this message translates to:
  /// **'الشريك وصل'**
  String get jobStatusArrived;

  /// No description provided for @jobStatusWaitingCustomer.
  ///
  /// In ar, this message translates to:
  /// **'بانتظارك'**
  String get jobStatusWaitingCustomer;

  /// No description provided for @jobStatusInProgress.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ التنفيذ'**
  String get jobStatusInProgress;

  /// No description provided for @jobStatusInspection.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ الكشف'**
  String get jobStatusInspection;

  /// No description provided for @jobStatusQuoteRequired.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار عرض السعر'**
  String get jobStatusQuoteRequired;

  /// No description provided for @jobStatusQuoteSubmitted.
  ///
  /// In ar, this message translates to:
  /// **'عرض سعر بانتظار موافقتك'**
  String get jobStatusQuoteSubmitted;

  /// No description provided for @jobStatusQuoteApproved.
  ///
  /// In ar, this message translates to:
  /// **'تمت الموافقة على العرض'**
  String get jobStatusQuoteApproved;

  /// No description provided for @jobStatusQuoteRejected.
  ///
  /// In ar, this message translates to:
  /// **'تم رفض العرض'**
  String get jobStatusQuoteRejected;

  /// No description provided for @jobStatusWorkStarted.
  ///
  /// In ar, this message translates to:
  /// **'بدأ العمل'**
  String get jobStatusWorkStarted;

  /// No description provided for @jobStatusWaitingForParts.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار قطع الغيار'**
  String get jobStatusWaitingForParts;

  /// No description provided for @jobStatusWorkCompleted.
  ///
  /// In ar, this message translates to:
  /// **'انتهى العمل — بانتظار تأكيدك'**
  String get jobStatusWorkCompleted;

  /// No description provided for @jobStatusCustomerConfirmed.
  ///
  /// In ar, this message translates to:
  /// **'تم التأكيد'**
  String get jobStatusCustomerConfirmed;

  /// No description provided for @jobStatusCompleted.
  ///
  /// In ar, this message translates to:
  /// **'مكتمل'**
  String get jobStatusCompleted;

  /// No description provided for @jobStatusCancelled.
  ///
  /// In ar, this message translates to:
  /// **'ملغي'**
  String get jobStatusCancelled;

  /// No description provided for @jobStatusNoPartner.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد شريك متاح'**
  String get jobStatusNoPartner;

  /// No description provided for @jobStatusDisputed.
  ///
  /// In ar, this message translates to:
  /// **'قيد النزاع'**
  String get jobStatusDisputed;

  /// No description provided for @trackingTitle.
  ///
  /// In ar, this message translates to:
  /// **'تتبّع الطلب'**
  String get trackingTitle;

  /// No description provided for @trackingSupport.
  ///
  /// In ar, this message translates to:
  /// **'الدعم'**
  String get trackingSupport;

  /// No description provided for @trackingEta.
  ///
  /// In ar, this message translates to:
  /// **'الوصول خلال {minutes} دقيقة'**
  String trackingEta(String minutes);

  /// No description provided for @trackingEtaUnknown.
  ///
  /// In ar, this message translates to:
  /// **'نحدّث وقت الوصول…'**
  String get trackingEtaUnknown;

  /// No description provided for @trackingFinished.
  ///
  /// In ar, this message translates to:
  /// **'انتهى هذا الطلب.'**
  String get trackingFinished;

  /// No description provided for @trackingPollingFallback.
  ///
  /// In ar, this message translates to:
  /// **'التحديث المباشر غير متاح — نحدّث كل بضع ثوانٍ.'**
  String get trackingPollingFallback;

  /// No description provided for @trackingProgressLabel.
  ///
  /// In ar, this message translates to:
  /// **'الخطوة {step} من {total}: {status}'**
  String trackingProgressLabel(int step, int total, String status);

  /// No description provided for @trackingCallPartner.
  ///
  /// In ar, this message translates to:
  /// **'اتصال بالشريك'**
  String get trackingCallPartner;

  /// No description provided for @trackingChatPartner.
  ///
  /// In ar, this message translates to:
  /// **'محادثة الشريك'**
  String get trackingChatPartner;

  /// No description provided for @trackingTripPin.
  ///
  /// In ar, this message translates to:
  /// **'رمز بدء الرحلة'**
  String get trackingTripPin;

  /// No description provided for @trackingTripPinHint.
  ///
  /// In ar, this message translates to:
  /// **'أعطِ هذا الرمز للسائق عند الركوب.'**
  String get trackingTripPinHint;

  /// No description provided for @trackingDeliveryOtp.
  ///
  /// In ar, this message translates to:
  /// **'رمز التسليم'**
  String get trackingDeliveryOtp;

  /// No description provided for @trackingDeliveryOtpHint.
  ///
  /// In ar, this message translates to:
  /// **'يُطلب هذا الرمز عند تسليم الطرد.'**
  String get trackingDeliveryOtpHint;

  /// No description provided for @trackingNoPartnerTitle.
  ///
  /// In ar, this message translates to:
  /// **'لم نجد شريكًا متاحًا'**
  String get trackingNoPartnerTitle;

  /// No description provided for @trackingNoPartnerBody.
  ///
  /// In ar, this message translates to:
  /// **'يمكنك إعادة المحاولة الآن أو تعديل الطلب.'**
  String get trackingNoPartnerBody;

  /// No description provided for @trackingRetryDispatch.
  ///
  /// In ar, this message translates to:
  /// **'أعد البحث عن شريك'**
  String get trackingRetryDispatch;

  /// No description provided for @trackingEstimatedTotal.
  ///
  /// In ar, this message translates to:
  /// **'الإجمالي التقديري'**
  String get trackingEstimatedTotal;

  /// No description provided for @trackingShare.
  ///
  /// In ar, this message translates to:
  /// **'مشاركة الرحلة'**
  String get trackingShare;

  /// No description provided for @trackingShareMessage.
  ///
  /// In ar, this message translates to:
  /// **'تابع رحلتي عبر تمام: {url}'**
  String trackingShareMessage(String url);

  /// No description provided for @trackingSos.
  ///
  /// In ar, this message translates to:
  /// **'استغاثة'**
  String get trackingSos;

  /// No description provided for @sosTitle.
  ///
  /// In ar, this message translates to:
  /// **'إرسال استغاثة'**
  String get sosTitle;

  /// No description provided for @sosBody.
  ///
  /// In ar, this message translates to:
  /// **'سيصل فريق السلامة إشعارًا فوريًا بموقعك وتفاصيل الطلب.'**
  String get sosBody;

  /// No description provided for @sosConfirm.
  ///
  /// In ar, this message translates to:
  /// **'أرسل الاستغاثة'**
  String get sosConfirm;

  /// No description provided for @sosSent.
  ///
  /// In ar, this message translates to:
  /// **'تم إرسال الاستغاثة، سنتواصل معك فورًا.'**
  String get sosSent;

  /// No description provided for @cancelTitle.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء الطلب'**
  String get cancelTitle;

  /// No description provided for @cancelSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'أخبرنا بالسبب حتى نتحسّن'**
  String get cancelSubtitle;

  /// No description provided for @cancelConfirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الإلغاء'**
  String get cancelConfirm;

  /// No description provided for @cancelNote.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل إضافية'**
  String get cancelNote;

  /// No description provided for @cancelFeeWarning.
  ///
  /// In ar, this message translates to:
  /// **'قد تُحتسب رسوم إلغاء إذا كان الشريك في طريقه إليك.'**
  String get cancelFeeWarning;

  /// No description provided for @cancelReasonChangedMind.
  ///
  /// In ar, this message translates to:
  /// **'غيّرت رأيي'**
  String get cancelReasonChangedMind;

  /// No description provided for @cancelReasonWaitTooLong.
  ///
  /// In ar, this message translates to:
  /// **'الانتظار طويل'**
  String get cancelReasonWaitTooLong;

  /// No description provided for @cancelReasonWrongAddress.
  ///
  /// In ar, this message translates to:
  /// **'العنوان غير صحيح'**
  String get cancelReasonWrongAddress;

  /// No description provided for @cancelReasonPriceTooHigh.
  ///
  /// In ar, this message translates to:
  /// **'السعر مرتفع'**
  String get cancelReasonPriceTooHigh;

  /// No description provided for @cancelReasonPartnerNotMoving.
  ///
  /// In ar, this message translates to:
  /// **'الشريك لا يتحرك'**
  String get cancelReasonPartnerNotMoving;

  /// No description provided for @cancelReasonSafety.
  ///
  /// In ar, this message translates to:
  /// **'مخاوف تتعلق بالسلامة'**
  String get cancelReasonSafety;

  /// No description provided for @cancelReasonDuplicate.
  ///
  /// In ar, this message translates to:
  /// **'طلب مكرر'**
  String get cancelReasonDuplicate;

  /// No description provided for @cancelReasonOther.
  ///
  /// In ar, this message translates to:
  /// **'سبب آخر'**
  String get cancelReasonOther;

  /// No description provided for @quoteTitle.
  ///
  /// In ar, this message translates to:
  /// **'عرض السعر'**
  String get quoteTitle;

  /// No description provided for @quoteChangeOrderTitle.
  ///
  /// In ar, this message translates to:
  /// **'تعديل على العرض'**
  String get quoteChangeOrderTitle;

  /// No description provided for @quoteReadyTitle.
  ///
  /// In ar, this message translates to:
  /// **'وصل عرض السعر'**
  String get quoteReadyTitle;

  /// No description provided for @quoteReview.
  ///
  /// In ar, this message translates to:
  /// **'مراجعة العرض'**
  String get quoteReview;

  /// No description provided for @quoteRevision.
  ///
  /// In ar, this message translates to:
  /// **'المراجعة رقم {revision}'**
  String quoteRevision(int revision);

  /// No description provided for @quoteApprove.
  ///
  /// In ar, this message translates to:
  /// **'الموافقة على العرض'**
  String get quoteApprove;

  /// No description provided for @quoteReject.
  ///
  /// In ar, this message translates to:
  /// **'رفض العرض'**
  String get quoteReject;

  /// No description provided for @quoteConfirmReject.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الرفض'**
  String get quoteConfirmReject;

  /// No description provided for @quoteRejectReason.
  ///
  /// In ar, this message translates to:
  /// **'سبب الرفض (اختياري)'**
  String get quoteRejectReason;

  /// No description provided for @quoteLabor.
  ///
  /// In ar, this message translates to:
  /// **'أجرة العمل'**
  String get quoteLabor;

  /// No description provided for @quoteParts.
  ///
  /// In ar, this message translates to:
  /// **'قطع الغيار'**
  String get quoteParts;

  /// No description provided for @quoteFees.
  ///
  /// In ar, this message translates to:
  /// **'رسوم إضافية'**
  String get quoteFees;

  /// No description provided for @quoteDiscount.
  ///
  /// In ar, this message translates to:
  /// **'خصم'**
  String get quoteDiscount;

  /// No description provided for @quoteTax.
  ///
  /// In ar, this message translates to:
  /// **'ضريبة'**
  String get quoteTax;

  /// No description provided for @quoteDuration.
  ///
  /// In ar, this message translates to:
  /// **'المدة التقديرية {minutes} دقيقة'**
  String quoteDuration(int minutes);

  /// No description provided for @quoteItemMeta.
  ///
  /// In ar, this message translates to:
  /// **'{kind} · الكمية {quantity}'**
  String quoteItemMeta(String kind, String quantity);

  /// No description provided for @workCompletedTitle.
  ///
  /// In ar, this message translates to:
  /// **'انتهى العمل'**
  String get workCompletedTitle;

  /// No description provided for @workCompletedBody.
  ///
  /// In ar, this message translates to:
  /// **'راجع العمل ثم أكّد إنجازه لإتمام الدفع.'**
  String get workCompletedBody;

  /// No description provided for @workConfirmTitle.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد إنجاز العمل'**
  String get workConfirmTitle;

  /// No description provided for @workConfirmBody.
  ///
  /// In ar, this message translates to:
  /// **'بتأكيدك، يُعتبر العمل منجزًا ويُحتسب المبلغ النهائي.'**
  String get workConfirmBody;

  /// No description provided for @workConfirmCta.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد إنجاز العمل'**
  String get workConfirmCta;

  /// No description provided for @ratingTitle.
  ///
  /// In ar, this message translates to:
  /// **'تقييم الخدمة'**
  String get ratingTitle;

  /// No description provided for @ratingCta.
  ///
  /// In ar, this message translates to:
  /// **'قيّم الخدمة'**
  String get ratingCta;

  /// No description provided for @ratingPrompt.
  ///
  /// In ar, this message translates to:
  /// **'كيف كانت تجربتك؟'**
  String get ratingPrompt;

  /// No description provided for @ratingPartnerFallback.
  ///
  /// In ar, this message translates to:
  /// **'الشريك'**
  String get ratingPartnerFallback;

  /// No description provided for @ratingComment.
  ///
  /// In ar, this message translates to:
  /// **'أضف تعليقًا (اختياري)'**
  String get ratingComment;

  /// No description provided for @ratingThanks.
  ///
  /// In ar, this message translates to:
  /// **'شكرًا لتقييمك!'**
  String get ratingThanks;

  /// No description provided for @ratingTagPunctual.
  ///
  /// In ar, this message translates to:
  /// **'ملتزم بالوقت'**
  String get ratingTagPunctual;

  /// No description provided for @ratingTagPolite.
  ///
  /// In ar, this message translates to:
  /// **'لبق'**
  String get ratingTagPolite;

  /// No description provided for @ratingTagClean.
  ///
  /// In ar, this message translates to:
  /// **'نظيف'**
  String get ratingTagClean;

  /// No description provided for @ratingTagProfessional.
  ///
  /// In ar, this message translates to:
  /// **'محترف'**
  String get ratingTagProfessional;

  /// No description provided for @ratingTagGoodPrice.
  ///
  /// In ar, this message translates to:
  /// **'سعر مناسب'**
  String get ratingTagGoodPrice;

  /// No description provided for @ratingTagCarefulDriving.
  ///
  /// In ar, this message translates to:
  /// **'قيادة آمنة'**
  String get ratingTagCarefulDriving;

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

  /// No description provided for @ratingTagUnclean.
  ///
  /// In ar, this message translates to:
  /// **'غير نظيف'**
  String get ratingTagUnclean;

  /// No description provided for @ratingTagUnprofessional.
  ///
  /// In ar, this message translates to:
  /// **'غير محترف'**
  String get ratingTagUnprofessional;

  /// No description provided for @ratingTagOvercharged.
  ///
  /// In ar, this message translates to:
  /// **'سعر مبالغ'**
  String get ratingTagOvercharged;

  /// No description provided for @ratingTagUnsafeDriving.
  ///
  /// In ar, this message translates to:
  /// **'قيادة غير آمنة'**
  String get ratingTagUnsafeDriving;

  /// No description provided for @receiptTitle.
  ///
  /// In ar, this message translates to:
  /// **'الفاتورة'**
  String get receiptTitle;

  /// No description provided for @receiptCta.
  ///
  /// In ar, this message translates to:
  /// **'عرض الفاتورة'**
  String get receiptCta;

  /// No description provided for @receiptPayment.
  ///
  /// In ar, this message translates to:
  /// **'الدفع'**
  String get receiptPayment;

  /// No description provided for @receiptRefunded.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ المُعاد'**
  String get receiptRefunded;

  /// No description provided for @receiptCancellationFee.
  ///
  /// In ar, this message translates to:
  /// **'رسوم الإلغاء'**
  String get receiptCancellationFee;

  /// No description provided for @receiptProofOfDelivery.
  ///
  /// In ar, this message translates to:
  /// **'إثبات التسليم'**
  String get receiptProofOfDelivery;

  /// No description provided for @receiptReceivedBy.
  ///
  /// In ar, this message translates to:
  /// **'استلمها: {name}'**
  String receiptReceivedBy(String name);

  /// No description provided for @paymentStatusPending.
  ///
  /// In ar, this message translates to:
  /// **'قيد الانتظار'**
  String get paymentStatusPending;

  /// No description provided for @paymentStatusAuthorized.
  ///
  /// In ar, this message translates to:
  /// **'محجوز'**
  String get paymentStatusAuthorized;

  /// No description provided for @paymentStatusCaptured.
  ///
  /// In ar, this message translates to:
  /// **'مدفوع'**
  String get paymentStatusCaptured;

  /// No description provided for @paymentStatusFailed.
  ///
  /// In ar, this message translates to:
  /// **'فشل الدفع'**
  String get paymentStatusFailed;

  /// No description provided for @paymentStatusRefunded.
  ///
  /// In ar, this message translates to:
  /// **'مُسترد'**
  String get paymentStatusRefunded;

  /// No description provided for @paymentStatusCancelled.
  ///
  /// In ar, this message translates to:
  /// **'ملغي'**
  String get paymentStatusCancelled;

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

  /// No description provided for @chatLoadOlder.
  ///
  /// In ar, this message translates to:
  /// **'عرض الرسائل الأقدم'**
  String get chatLoadOlder;

  /// No description provided for @chatEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد رسائل بعد'**
  String get chatEmptyTitle;

  /// No description provided for @chatEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'اكتب رسالة للتواصل مع الشريك.'**
  String get chatEmptyBody;

  /// No description provided for @walletTitle.
  ///
  /// In ar, this message translates to:
  /// **'المحفظة'**
  String get walletTitle;

  /// No description provided for @walletBalance.
  ///
  /// In ar, this message translates to:
  /// **'رصيدك'**
  String get walletBalance;

  /// No description provided for @walletPending.
  ///
  /// In ar, this message translates to:
  /// **'قيد التسوية'**
  String get walletPending;

  /// No description provided for @walletTopUp.
  ///
  /// In ar, this message translates to:
  /// **'شحن الرصيد'**
  String get walletTopUp;

  /// No description provided for @walletTopUpHint.
  ///
  /// In ar, this message translates to:
  /// **'اختر المبلغ ثم أكمل الدفع عبر مزوّد الدفع.'**
  String get walletTopUpHint;

  /// No description provided for @walletStatement.
  ///
  /// In ar, this message translates to:
  /// **'كشف الحساب'**
  String get walletStatement;

  /// No description provided for @walletEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد حركات بعد'**
  String get walletEmptyTitle;

  /// No description provided for @walletEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'ستظهر هنا كل عمليات الدفع والاسترداد.'**
  String get walletEmptyBody;

  /// No description provided for @walletPromos.
  ///
  /// In ar, this message translates to:
  /// **'العروض'**
  String get walletPromos;

  /// No description provided for @walletReferrals.
  ///
  /// In ar, this message translates to:
  /// **'دعوة صديق'**
  String get walletReferrals;

  /// No description provided for @promosTitle.
  ///
  /// In ar, this message translates to:
  /// **'العروض والأكواد'**
  String get promosTitle;

  /// No description provided for @promoEnterTitle.
  ///
  /// In ar, this message translates to:
  /// **'لديك كود خصم؟'**
  String get promoEnterTitle;

  /// No description provided for @promoEnterBody.
  ///
  /// In ar, this message translates to:
  /// **'احفظ الكود ليُطبَّق تلقائيًا على طلبك القادم.'**
  String get promoEnterBody;

  /// No description provided for @promoSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ الكود {code}'**
  String promoSaved(String code);

  /// No description provided for @promoPending.
  ///
  /// In ar, this message translates to:
  /// **'الكود {code} سيُطبَّق على طلبك القادم.'**
  String promoPending(String code);

  /// No description provided for @referralsTitle.
  ///
  /// In ar, this message translates to:
  /// **'ادعُ أصدقاءك'**
  String get referralsTitle;

  /// No description provided for @referralsRewardPrefix.
  ///
  /// In ar, this message translates to:
  /// **'يحصل صديقك على'**
  String get referralsRewardPrefix;

  /// No description provided for @referralsStats.
  ///
  /// In ar, this message translates to:
  /// **'دعوت {invited} صديقًا، وحصلت على {rewarded} مكافأة.'**
  String referralsStats(int invited, int rewarded);

  /// No description provided for @referralsShare.
  ///
  /// In ar, this message translates to:
  /// **'مشاركة رمز الدعوة'**
  String get referralsShare;

  /// No description provided for @referralsCopied.
  ///
  /// In ar, this message translates to:
  /// **'تم نسخ الرمز'**
  String get referralsCopied;

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

  /// No description provided for @accountGroupActivity.
  ///
  /// In ar, this message translates to:
  /// **'نشاطي'**
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
  /// **'سيتم تسجيل خروجك من هذا الجهاز.'**
  String get accountSignOutConfirm;

  /// No description provided for @favoritesTitle.
  ///
  /// In ar, this message translates to:
  /// **'المفضلة'**
  String get favoritesTitle;

  /// No description provided for @favoritesEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد خدمات مفضلة'**
  String get favoritesEmptyTitle;

  /// No description provided for @favoritesEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'أضف الخدمات التي تستخدمها كثيرًا للوصول السريع.'**
  String get favoritesEmptyBody;

  /// No description provided for @profileTitle.
  ///
  /// In ar, this message translates to:
  /// **'الملف الشخصي'**
  String get profileTitle;

  /// No description provided for @profileEmail.
  ///
  /// In ar, this message translates to:
  /// **'البريد الإلكتروني'**
  String get profileEmail;

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

  /// No description provided for @profileSaved.
  ///
  /// In ar, this message translates to:
  /// **'تم حفظ التغييرات'**
  String get profileSaved;

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

  /// No description provided for @preferencesNotifications.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get preferencesNotifications;

  /// No description provided for @preferencesNotificationsUnavailable.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر تحميل إعدادات الإشعارات.'**
  String get preferencesNotificationsUnavailable;

  /// No description provided for @preferencesPush.
  ///
  /// In ar, this message translates to:
  /// **'إشعارات التطبيق'**
  String get preferencesPush;

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
  /// **'أخبار العروض والخصومات فقط.'**
  String get preferencesMarketingHint;

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

  /// No description provided for @sessionsLastSeen.
  ///
  /// In ar, this message translates to:
  /// **'آخر نشاط {when}'**
  String sessionsLastSeen(String when);

  /// No description provided for @sessionsThisDevice.
  ///
  /// In ar, this message translates to:
  /// **'هذا الجهاز'**
  String get sessionsThisDevice;

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

  /// No description provided for @savedPlacesTitle.
  ///
  /// In ar, this message translates to:
  /// **'الأماكن المحفوظة'**
  String get savedPlacesTitle;

  /// No description provided for @savedPlacesAdd.
  ///
  /// In ar, this message translates to:
  /// **'إضافة مكان'**
  String get savedPlacesAdd;

  /// No description provided for @savedPlacesEdit.
  ///
  /// In ar, this message translates to:
  /// **'تعديل المكان'**
  String get savedPlacesEdit;

  /// No description provided for @savedPlacesLabel.
  ///
  /// In ar, this message translates to:
  /// **'اسم المكان'**
  String get savedPlacesLabel;

  /// No description provided for @savedPlacesEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لم تحفظ أي مكان بعد'**
  String get savedPlacesEmptyTitle;

  /// No description provided for @savedPlacesEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'احفظ المنزل والعمل لتطلب بضغطة واحدة.'**
  String get savedPlacesEmptyBody;

  /// No description provided for @savedPlacesDeleteTitle.
  ///
  /// In ar, this message translates to:
  /// **'حذف المكان'**
  String get savedPlacesDeleteTitle;

  /// No description provided for @savedPlacesDeleteBody.
  ///
  /// In ar, this message translates to:
  /// **'سيتم حذف «{label}» نهائيًا.'**
  String savedPlacesDeleteBody(String label);

  /// No description provided for @placeKindHome.
  ///
  /// In ar, this message translates to:
  /// **'المنزل'**
  String get placeKindHome;

  /// No description provided for @placeKindWork.
  ///
  /// In ar, this message translates to:
  /// **'العمل'**
  String get placeKindWork;

  /// No description provided for @placeKindCustom.
  ///
  /// In ar, this message translates to:
  /// **'مكان آخر'**
  String get placeKindCustom;

  /// No description provided for @addressSheetTitle.
  ///
  /// In ar, this message translates to:
  /// **'اختر العنوان'**
  String get addressSheetTitle;

  /// No description provided for @addressSearchHint.
  ///
  /// In ar, this message translates to:
  /// **'ابحث عن شارع أو منطقة'**
  String get addressSearchHint;

  /// No description provided for @addressUseCurrent.
  ///
  /// In ar, this message translates to:
  /// **'موقعي الحالي'**
  String get addressUseCurrent;

  /// No description provided for @addressPickOnMap.
  ///
  /// In ar, this message translates to:
  /// **'تحديد على الخريطة'**
  String get addressPickOnMap;

  /// No description provided for @addressManagePlaces.
  ///
  /// In ar, this message translates to:
  /// **'إدارة الأماكن المحفوظة'**
  String get addressManagePlaces;

  /// No description provided for @addressNoResults.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد نتائج مطابقة.'**
  String get addressNoResults;

  /// No description provided for @addressSearchFailed.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر البحث الآن، حاول لاحقًا.'**
  String get addressSearchFailed;

  /// No description provided for @addressAttribution.
  ///
  /// In ar, this message translates to:
  /// **'نتائج البحث من OpenStreetMap'**
  String get addressAttribution;

  /// No description provided for @addressBuilding.
  ///
  /// In ar, this message translates to:
  /// **'المبنى'**
  String get addressBuilding;

  /// No description provided for @addressFloor.
  ///
  /// In ar, this message translates to:
  /// **'الطابق'**
  String get addressFloor;

  /// No description provided for @addressApartment.
  ///
  /// In ar, this message translates to:
  /// **'الشقة'**
  String get addressApartment;

  /// No description provided for @addressNotes.
  ///
  /// In ar, this message translates to:
  /// **'ملاحظات للوصول'**
  String get addressNotes;

  /// No description provided for @locationPickerTitle.
  ///
  /// In ar, this message translates to:
  /// **'تحديد الموقع'**
  String get locationPickerTitle;

  /// No description provided for @locationPickerHint.
  ///
  /// In ar, this message translates to:
  /// **'حرّك الخريطة لضبط الدبوس'**
  String get locationPickerHint;

  /// No description provided for @locationPickerMoveMap.
  ///
  /// In ar, this message translates to:
  /// **'حرّك الخريطة لتحديد العنوان'**
  String get locationPickerMoveMap;

  /// No description provided for @locationPickerConfirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد الموقع'**
  String get locationPickerConfirm;

  /// No description provided for @notificationsTitle.
  ///
  /// In ar, this message translates to:
  /// **'الإشعارات'**
  String get notificationsTitle;

  /// No description provided for @notificationsMarkAllRead.
  ///
  /// In ar, this message translates to:
  /// **'تعليم الكل كمقروء'**
  String get notificationsMarkAllRead;

  /// No description provided for @notificationsEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد إشعارات'**
  String get notificationsEmptyTitle;

  /// No description provided for @notificationsEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'سنخبرك هنا بكل جديد عن طلباتك.'**
  String get notificationsEmptyBody;

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

  /// No description provided for @supportReplyHint.
  ///
  /// In ar, this message translates to:
  /// **'اكتب ردك…'**
  String get supportReplyHint;

  /// No description provided for @supportTicketTitle.
  ///
  /// In ar, this message translates to:
  /// **'طلب الدعم'**
  String get supportTicketTitle;

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

  /// No description provided for @ticketCategoryPayment.
  ///
  /// In ar, this message translates to:
  /// **'الدفع'**
  String get ticketCategoryPayment;

  /// No description provided for @ticketCategoryJob.
  ///
  /// In ar, this message translates to:
  /// **'مشكلة في الطلب'**
  String get ticketCategoryJob;

  /// No description provided for @ticketCategoryPartner.
  ///
  /// In ar, this message translates to:
  /// **'سلوك الشريك'**
  String get ticketCategoryPartner;

  /// No description provided for @ticketCategoryLostItem.
  ///
  /// In ar, this message translates to:
  /// **'غرض مفقود'**
  String get ticketCategoryLostItem;

  /// No description provided for @ticketCategoryAccount.
  ///
  /// In ar, this message translates to:
  /// **'الحساب'**
  String get ticketCategoryAccount;

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

  /// No description provided for @disputesTitle.
  ///
  /// In ar, this message translates to:
  /// **'النزاعات'**
  String get disputesTitle;

  /// No description provided for @disputesEmptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد نزاعات'**
  String get disputesEmptyTitle;

  /// No description provided for @disputesEmptyBody.
  ///
  /// In ar, this message translates to:
  /// **'افتح نزاعًا من صفحة الطلب إذا واجهت مشكلة.'**
  String get disputesEmptyBody;

  /// No description provided for @disputeDetailTitle.
  ///
  /// In ar, this message translates to:
  /// **'تفاصيل النزاع'**
  String get disputeDetailTitle;

  /// No description provided for @disputeOpen.
  ///
  /// In ar, this message translates to:
  /// **'فتح نزاع'**
  String get disputeOpen;

  /// No description provided for @disputeReasonLabel.
  ///
  /// In ar, this message translates to:
  /// **'سبب النزاع'**
  String get disputeReasonLabel;

  /// No description provided for @disputeDescription.
  ///
  /// In ar, this message translates to:
  /// **'اشرح ما حدث'**
  String get disputeDescription;

  /// No description provided for @disputeRefunded.
  ///
  /// In ar, this message translates to:
  /// **'المبلغ المُعاد'**
  String get disputeRefunded;

  /// No description provided for @disputeReasonNotCompleted.
  ///
  /// In ar, this message translates to:
  /// **'لم يُنجز العمل'**
  String get disputeReasonNotCompleted;

  /// No description provided for @disputeReasonPoorQuality.
  ///
  /// In ar, this message translates to:
  /// **'جودة سيئة'**
  String get disputeReasonPoorQuality;

  /// No description provided for @disputeReasonOvercharged.
  ///
  /// In ar, this message translates to:
  /// **'مبالغة في السعر'**
  String get disputeReasonOvercharged;

  /// No description provided for @disputeReasonDamage.
  ///
  /// In ar, this message translates to:
  /// **'أضرار'**
  String get disputeReasonDamage;

  /// No description provided for @disputeReasonItemMissing.
  ///
  /// In ar, this message translates to:
  /// **'غرض مفقود'**
  String get disputeReasonItemMissing;

  /// No description provided for @disputeReasonMisconduct.
  ///
  /// In ar, this message translates to:
  /// **'سوء تصرف من الشريك'**
  String get disputeReasonMisconduct;

  /// No description provided for @disputeReasonOther.
  ///
  /// In ar, this message translates to:
  /// **'سبب آخر'**
  String get disputeReasonOther;

  /// No description provided for @disputeStatusOpen.
  ///
  /// In ar, this message translates to:
  /// **'مفتوح'**
  String get disputeStatusOpen;

  /// No description provided for @disputeStatusUnderReview.
  ///
  /// In ar, this message translates to:
  /// **'قيد المراجعة'**
  String get disputeStatusUnderReview;

  /// No description provided for @disputeStatusResolvedCustomer.
  ///
  /// In ar, this message translates to:
  /// **'لصالحك'**
  String get disputeStatusResolvedCustomer;

  /// No description provided for @disputeStatusResolvedPartner.
  ///
  /// In ar, this message translates to:
  /// **'لصالح الشريك'**
  String get disputeStatusResolvedPartner;

  /// No description provided for @disputeStatusResolvedSplit.
  ///
  /// In ar, this message translates to:
  /// **'تسوية جزئية'**
  String get disputeStatusResolvedSplit;

  /// No description provided for @disputeStatusRejected.
  ///
  /// In ar, this message translates to:
  /// **'مرفوض'**
  String get disputeStatusRejected;

  /// No description provided for @legalTitle.
  ///
  /// In ar, this message translates to:
  /// **'عن التطبيق'**
  String get legalTitle;

  /// No description provided for @legalTermsTitle.
  ///
  /// In ar, this message translates to:
  /// **'شروط الاستخدام'**
  String get legalTermsTitle;

  /// No description provided for @legalTermsBody.
  ///
  /// In ar, this message translates to:
  /// **'باستخدامك تمام فإنك توافق على تقديم بيانات صحيحة، واحترام الشركاء، وسداد قيمة الخدمات المطلوبة. تُطبَّق رسوم الإلغاء وفق سياسة معلنة داخل التطبيق.'**
  String get legalTermsBody;

  /// No description provided for @legalPrivacyTitle.
  ///
  /// In ar, this message translates to:
  /// **'الخصوصية'**
  String get legalPrivacyTitle;

  /// No description provided for @legalPrivacyBody.
  ///
  /// In ar, this message translates to:
  /// **'نستخدم موقعك ورقم هاتفك لتنفيذ الطلبات فقط. لا نشارك بياناتك مع أطراف ثالثة لأغراض تسويقية، ويمكنك إيقاف الرسائل التسويقية من التفضيلات.'**
  String get legalPrivacyBody;

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
  /// **'سنفتح طلب دعم لحذف حسابك. قد نحتفظ بسجلات الفواتير كما يقتضي القانون.'**
  String get legalDeleteAccountConfirm;

  /// No description provided for @legalDeleteAccountCta.
  ///
  /// In ar, this message translates to:
  /// **'أرسل الطلب'**
  String get legalDeleteAccountCta;

  /// No description provided for @legalDeleteAccountSubject.
  ///
  /// In ar, this message translates to:
  /// **'طلب حذف الحساب'**
  String get legalDeleteAccountSubject;

  /// No description provided for @legalDeleteAccountBody.
  ///
  /// In ar, this message translates to:
  /// **'أرغب بحذف حسابي وبياناتي الشخصية من تطبيق تمام.'**
  String get legalDeleteAccountBody;

  /// No description provided for @bannerPromoCopied.
  ///
  /// In ar, this message translates to:
  /// **'تم نسخ الكود {code} وسيُطبَّق على طلبك القادم.'**
  String bannerPromoCopied(String code);

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

  /// No description provided for @publicTrackTitle.
  ///
  /// In ar, this message translates to:
  /// **'تتبّع الرحلة'**
  String get publicTrackTitle;

  /// No description provided for @publicTrackPartner.
  ///
  /// In ar, this message translates to:
  /// **'الشريك: {name}'**
  String publicTrackPartner(String name);

  /// No description provided for @emptyTitle.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد شيء هنا بعد'**
  String get emptyTitle;

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

  /// No description provided for @offlineBanner.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اتصال بالإنترنت — بعض البيانات قد تكون قديمة.'**
  String get offlineBanner;

  /// No description provided for @errorOffline.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.'**
  String get errorOffline;

  /// No description provided for @errorNetwork.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر الوصول إلى الخادم. حاول مرة أخرى.'**
  String get errorNetwork;

  /// No description provided for @errorGeneric.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ غير متوقع. حاول مرة أخرى.'**
  String get errorGeneric;

  /// No description provided for @errorValidation.
  ///
  /// In ar, this message translates to:
  /// **'تحقق من البيانات المدخلة.'**
  String get errorValidation;

  /// No description provided for @errorSessionExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت جلستك، سجّل الدخول من جديد.'**
  String get errorSessionExpired;

  /// No description provided for @errorForbidden.
  ///
  /// In ar, this message translates to:
  /// **'لا تملك صلاحية لهذا الإجراء.'**
  String get errorForbidden;

  /// No description provided for @errorNotFound.
  ///
  /// In ar, this message translates to:
  /// **'العنصر المطلوب غير موجود.'**
  String get errorNotFound;

  /// No description provided for @errorRateLimited.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة.'**
  String get errorRateLimited;

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

  /// No description provided for @errorOtpTooManyAttempts.
  ///
  /// In ar, this message translates to:
  /// **'محاولات خاطئة كثيرة، اطلب رمزًا جديدًا.'**
  String get errorOtpTooManyAttempts;

  /// No description provided for @errorOtpCooldown.
  ///
  /// In ar, this message translates to:
  /// **'انتظر قليلًا قبل طلب رمز جديد.'**
  String get errorOtpCooldown;

  /// No description provided for @errorAccountSuspended.
  ///
  /// In ar, this message translates to:
  /// **'تم إيقاف حسابك. تواصل مع الدعم.'**
  String get errorAccountSuspended;

  /// No description provided for @errorAccountRestricted.
  ///
  /// In ar, this message translates to:
  /// **'حسابك مقيّد مؤقتًا.'**
  String get errorAccountRestricted;

  /// No description provided for @errorOutsideZone.
  ///
  /// In ar, this message translates to:
  /// **'موقعك خارج نطاق خدمتنا حاليًا.'**
  String get errorOutsideZone;

  /// No description provided for @errorServiceUnavailableInZone.
  ///
  /// In ar, this message translates to:
  /// **'هذه الخدمة غير متاحة في منطقتك.'**
  String get errorServiceUnavailableInZone;

  /// No description provided for @errorOutsideHours.
  ///
  /// In ar, this message translates to:
  /// **'الخدمة خارج ساعات العمل الآن.'**
  String get errorOutsideHours;

  /// No description provided for @errorNoPartners.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد شريك متاح حاليًا.'**
  String get errorNoPartners;

  /// No description provided for @errorVersionConflict.
  ///
  /// In ar, this message translates to:
  /// **'تم تحديث الطلب، أعد المحاولة.'**
  String get errorVersionConflict;

  /// No description provided for @errorJobAlreadyAssigned.
  ///
  /// In ar, this message translates to:
  /// **'تم تعيين شريك لهذا الطلب بالفعل.'**
  String get errorJobAlreadyAssigned;

  /// No description provided for @errorInsufficientBalance.
  ///
  /// In ar, this message translates to:
  /// **'رصيد المحفظة غير كافٍ.'**
  String get errorInsufficientBalance;

  /// No description provided for @errorPaymentMethodDisabled.
  ///
  /// In ar, this message translates to:
  /// **'طريقة الدفع هذه غير متاحة حاليًا.'**
  String get errorPaymentMethodDisabled;

  /// No description provided for @errorPaymentFailed.
  ///
  /// In ar, this message translates to:
  /// **'فشلت عملية الدفع.'**
  String get errorPaymentFailed;

  /// No description provided for @errorPromoInvalid.
  ///
  /// In ar, this message translates to:
  /// **'كود الخصم غير صالح.'**
  String get errorPromoInvalid;

  /// No description provided for @errorPromoExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية كود الخصم.'**
  String get errorPromoExpired;

  /// No description provided for @errorPromoUsageExceeded.
  ///
  /// In ar, this message translates to:
  /// **'تم استهلاك هذا الكود بالكامل.'**
  String get errorPromoUsageExceeded;

  /// No description provided for @errorPromoMinOrder.
  ///
  /// In ar, this message translates to:
  /// **'قيمة الطلب أقل من الحد المطلوب للكود.'**
  String get errorPromoMinOrder;

  /// No description provided for @errorPromoNotEligible.
  ///
  /// In ar, this message translates to:
  /// **'هذا الكود غير متاح لطلبك.'**
  String get errorPromoNotEligible;

  /// No description provided for @errorRatingNotAllowed.
  ///
  /// In ar, this message translates to:
  /// **'لا يمكن تقييم هذا الطلب.'**
  String get errorRatingNotAllowed;

  /// No description provided for @errorUploadTooLarge.
  ///
  /// In ar, this message translates to:
  /// **'حجم الملف كبير جدًا.'**
  String get errorUploadTooLarge;

  /// No description provided for @errorUploadInvalid.
  ///
  /// In ar, this message translates to:
  /// **'نوع الملف غير مدعوم.'**
  String get errorUploadInvalid;

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

  /// No description provided for @errorQuoteNotApproved.
  ///
  /// In ar, this message translates to:
  /// **'يجب الموافقة على عرض السعر أولًا.'**
  String get errorQuoteNotApproved;

  /// No description provided for @errorCannotOpenLink.
  ///
  /// In ar, this message translates to:
  /// **'تعذّر فتح الرابط.'**
  String get errorCannotOpenLink;
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
