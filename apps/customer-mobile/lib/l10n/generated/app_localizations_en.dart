// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTagline => 'Everything you need — sorted';

  @override
  String get actionApply => 'Apply';

  @override
  String get actionBrowse => 'Browse services';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionChange => 'Change';

  @override
  String get actionClear => 'Clear';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionCopy => 'Copy';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionDismiss => 'Dismiss';

  @override
  String get actionFavorite => 'Add to favourites';

  @override
  String get actionUnfavorite => 'Remove from favourites';

  @override
  String get actionLoadMore => 'Load more';

  @override
  String get actionManage => 'Manage';

  @override
  String get actionNext => 'Next';

  @override
  String get actionOpenSettings => 'Open settings';

  @override
  String get actionRemove => 'Remove';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionSave => 'Save';

  @override
  String get actionSchedule => 'Schedule';

  @override
  String get actionSeeAll => 'See all';

  @override
  String get actionSend => 'Send';

  @override
  String get actionSkip => 'Skip';

  @override
  String get navHome => 'Home';

  @override
  String get navOrders => 'Orders';

  @override
  String get navWallet => 'Wallet';

  @override
  String get navAccount => 'Account';

  @override
  String get onboardingRideTitle => 'Your ride starts here';

  @override
  String get onboardingRideBody =>
      'Book a car in seconds and follow your driver on the map all the way.';

  @override
  String get onboardingDeliveryTitle => 'Deliver anything';

  @override
  String get onboardingDeliveryBody =>
      'Send and receive parcels across your city, with the price shown up front.';

  @override
  String get onboardingServicesTitle => 'Home services you can trust';

  @override
  String get onboardingServicesBody =>
      'Plumbers, electricians, AC technicians and more — verified, with a clear quote.';

  @override
  String get onboardingStart => 'Get started';

  @override
  String get signInTitle => 'Welcome to TAMAM';

  @override
  String get signInSubtitle =>
      'Enter your phone number to sign in or create an account';

  @override
  String get signInPhoneLabel => 'Phone number';

  @override
  String get signInPhoneHint => '599123456';

  @override
  String get signInSendCode => 'Send code';

  @override
  String get signInOtpExplainer => 'We will text you a 6-digit code.';

  @override
  String get signInTerms =>
      'By continuing you agree to our Terms of Use and Privacy Policy.';

  @override
  String get signedOutExpired => 'Your session ended. Please sign in again.';

  @override
  String get signedOutRevoked => 'This session was ended from another device.';

  @override
  String get otpTitle => 'Verification code';

  @override
  String otpSubtitle(String phone) {
    return 'We sent a code to $phone';
  }

  @override
  String get otpVerify => 'Verify';

  @override
  String get otpResend => 'Resend code';

  @override
  String otpResendIn(int seconds) {
    final intl.NumberFormat secondsNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String secondsString = secondsNumberFormat.format(seconds);

    return 'You can resend in $secondsString seconds';
  }

  @override
  String otpDevCode(String code) {
    return 'Development code: $code';
  }

  @override
  String get nameTitle => 'What is your name?';

  @override
  String get nameSubtitle => 'So your partner knows who to look for';

  @override
  String get nameFieldLabel => 'Full name';

  @override
  String get nameFieldHint => 'e.g. Ahmad Mahmoud';

  @override
  String get nameWhy =>
      'Your name is only shown to the partner assigned to your order.';

  @override
  String get locationPermissionTitle => 'Turn on location for faster service';

  @override
  String get locationPermissionBody =>
      'We use your location to set the pickup point and estimate arrival accurately.';

  @override
  String get locationReasonPickup => 'Set your pickup point automatically';

  @override
  String get locationReasonEta => 'Estimate arrival time accurately';

  @override
  String get locationReasonZone => 'Show the services available in your area';

  @override
  String get locationAllow => 'Allow location access';

  @override
  String get locationChooseManually => 'I will pick the address myself';

  @override
  String get locationBlockedHint =>
      'Location permission is permanently denied. Enable it in system settings.';

  @override
  String get locationServiceOffHint =>
      'Location services are switched off on this device.';

  @override
  String get locationUnavailable => 'We could not get your location right now.';

  @override
  String get homeDeliverTo => 'Deliver to';

  @override
  String get homeChooseAddress => 'Choose your address';

  @override
  String get homeChangeAddress => 'Change address';

  @override
  String get homeSearchHint => 'Search a service: plumber, electrician, AC…';

  @override
  String get homePopular => 'Most requested';

  @override
  String get homeRecentOrders => 'Your recent orders';

  @override
  String get homeSavedPlaces => 'Saved places';

  @override
  String get homeAddPlace => 'Add your first address to order faster';

  @override
  String get homeOffers => 'Offers';

  @override
  String get homeOffersTitle => 'Discount codes waiting for you';

  @override
  String get homeOffersBody =>
      'Enter a code now and it applies to your next order.';

  @override
  String get homeActiveJob => 'Active order';

  @override
  String get homeSearchingPartner => 'Finding a partner…';

  @override
  String get serviceRide => 'Ride';

  @override
  String get serviceRideCaption => 'A car in minutes';

  @override
  String get serviceDelivery => 'Delivery';

  @override
  String get serviceDeliveryCaption => 'Send a parcel now';

  @override
  String get serviceHome => 'Home services';

  @override
  String get serviceHomeCaption => 'Verified technicians';

  @override
  String get serviceUrgent => 'Urgent service';

  @override
  String get serviceUrgentCaption => 'Fast response';

  @override
  String get serviceOther => 'Service';

  @override
  String get searchTitle => 'Search';

  @override
  String get searchNoResultsTitle => 'No results';

  @override
  String searchNoResultsBody(String query) {
    return 'Nothing matched “$query”.';
  }

  @override
  String get searchDirectoryEmptyTitle => 'No services in your area yet';

  @override
  String get searchDirectoryEmptyBody =>
      'We are expanding — try another address.';

  @override
  String get categoryOrderNow => 'Order now';

  @override
  String get categorySubcategories => 'Choose what you need';

  @override
  String categoryDuration(int minutes) {
    final intl.NumberFormat minutesNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String minutesString = minutesNumberFormat.format(minutes);

    return 'About $minutesString minutes';
  }

  @override
  String get pricingFixed => 'Fixed price';

  @override
  String get pricingStartingFrom => 'Starting from';

  @override
  String get pricingHourly => 'Hourly rate';

  @override
  String get pricingInspectionFee => 'Inspection fee';

  @override
  String get pricingDueNow => 'Due now';

  @override
  String get pricingInspectionExplainer =>
      'You pay the inspection fee when the technician arrives; they then send a quote before starting work.';

  @override
  String get ridePickupLabel => 'Pickup';

  @override
  String get ridePickupEmpty => 'Choose a pickup point';

  @override
  String get ridePickupTitle => 'Pickup point';

  @override
  String get rideDestinationLabel => 'Destination';

  @override
  String get rideDestinationEmpty => 'Where to?';

  @override
  String get rideDestinationTitle => 'Destination';

  @override
  String get rideSwap => 'Swap';

  @override
  String get rideGetEstimate => 'Get a price';

  @override
  String get rideOrderCta => 'Order now';

  @override
  String get rideScheduleCta => 'Book for the chosen time';

  @override
  String fareSeats(int seats) {
    final intl.NumberFormat seatsNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String seatsString = seatsNumberFormat.format(seats);

    return '$seatsString seats';
  }

  @override
  String fareEtaMinutes(String minutes) {
    return 'in $minutes min';
  }

  @override
  String get checkoutPaymentMethod => 'Payment method';

  @override
  String get checkoutPromoLabel => 'Promo code';

  @override
  String get checkoutPromoHint => 'Enter code';

  @override
  String checkoutPromoApplied(String code) {
    return 'Code $code applied';
  }

  @override
  String get checkoutSchedule => 'When';

  @override
  String get checkoutScheduleNow => 'Now';

  @override
  String get checkoutTotal => 'Total';

  @override
  String get paymentCash => 'Cash';

  @override
  String get paymentWallet => 'Wallet';

  @override
  String get paymentCard => 'Card';

  @override
  String get paymentOnline => 'Online payment';

  @override
  String get deliveryRoute => 'Route';

  @override
  String get deliveryPickupLabel => 'Pick up from';

  @override
  String get deliveryPickupTitle => 'Pickup location';

  @override
  String get deliveryDropoffLabel => 'Deliver to';

  @override
  String get deliveryDropoffTitle => 'Drop-off location';

  @override
  String get deliveryPackage => 'Package details';

  @override
  String get deliverySize => 'Approximate size';

  @override
  String get deliveryWeight => 'Approximate weight';

  @override
  String get deliveryDescription => 'What is inside';

  @override
  String get deliveryPhotosHint => 'Photos help the partner come prepared.';

  @override
  String get deliverySender => 'Sender';

  @override
  String get deliveryRecipient => 'Recipient';

  @override
  String get deliveryNotes => 'Delivery notes';

  @override
  String get deliveryUrgency => 'Priority';

  @override
  String get deliveryContactsRequired =>
      'Add a name and phone for both sender and recipient.';

  @override
  String get deliveryCategoriesUnavailable =>
      'Package types could not be loaded.';

  @override
  String get packageSizeSmall => 'Small';

  @override
  String get packageSizeMedium => 'Medium';

  @override
  String get packageSizeLarge => 'Large';

  @override
  String get packageSizeXl => 'Extra large';

  @override
  String get contactName => 'Name';

  @override
  String get contactPhone => 'Phone';

  @override
  String get unitKg => 'kg';

  @override
  String get unitMinutes => 'min';

  @override
  String get serviceLocationTitle => 'Service location';

  @override
  String get serviceLocationEmpty => 'Choose the service location';

  @override
  String get serviceSubcategory => 'Type of work';

  @override
  String get serviceOptions => 'Add-ons';

  @override
  String get serviceProblemTitle => 'Describe the problem';

  @override
  String get serviceProblemHint =>
      'Explain the problem so the technician arrives prepared.';

  @override
  String get serviceProblemTooShort => 'Add at least 5 characters.';

  @override
  String get serviceProblemRequired => 'Describe the problem before ordering.';

  @override
  String get serviceMediaOptional => 'Add photos if you can (optional).';

  @override
  String serviceMediaRequired(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'At least $countString photo(s) required.';
  }

  @override
  String get serviceInstructions => 'Extra instructions';

  @override
  String get serviceUrgencyTitle => 'Urgency';

  @override
  String get serviceUrgencySurcharge =>
      'An urgency surcharge is added to the final price.';

  @override
  String get serviceWhenTitle => 'Visit time';

  @override
  String get serviceWhenNow => 'As soon as possible';

  @override
  String get serviceWhenScheduled => 'Pick a day';

  @override
  String get timeSlotMorning => 'Morning';

  @override
  String get timeSlotAfternoon => 'Afternoon';

  @override
  String get timeSlotEvening => 'Evening';

  @override
  String get urgencyStandard => 'Standard';

  @override
  String get urgencyUrgent => 'Urgent';

  @override
  String get urgencyEmergency => 'Emergency';

  @override
  String get formRequired => 'This field is required';

  @override
  String formTooSmall(String min) {
    return 'Below the allowed minimum ($min)';
  }

  @override
  String formTooLarge(String max) {
    return 'Above the allowed maximum ($max)';
  }

  @override
  String formTooManyItems(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'At most $countString items';
  }

  @override
  String get formNotANumber => 'Enter a valid number';

  @override
  String get formInvalidOption => 'Invalid choice';

  @override
  String get formChooseDate => 'Choose a date';

  @override
  String get formChooseTime => 'Choose a time';

  @override
  String get mediaAttachPhotos => 'Attach photos';

  @override
  String get mediaGallery => 'Gallery';

  @override
  String get mediaCamera => 'Camera';

  @override
  String get ordersTitle => 'My orders';

  @override
  String get ordersTabAll => 'All';

  @override
  String get ordersTabActive => 'Active';

  @override
  String get ordersTabCompleted => 'Completed';

  @override
  String get ordersTabCancelled => 'Cancelled';

  @override
  String get ordersEmptyTitle => 'No orders yet';

  @override
  String get ordersEmptyBody => 'Start your first order from home.';

  @override
  String get ordersEmptyCta => 'Go to home';

  @override
  String get ordersReorder => 'Reorder';

  @override
  String get jobPricePending => 'Price after inspection';

  @override
  String get jobStatusDraft => 'Draft';

  @override
  String get jobStatusRequested => 'Order received';

  @override
  String get jobStatusSearching => 'Finding a partner';

  @override
  String get jobStatusAssigned => 'Partner assigned';

  @override
  String get jobStatusEnRoute => 'Partner on the way';

  @override
  String get jobStatusArrived => 'Partner arrived';

  @override
  String get jobStatusWaitingCustomer => 'Waiting for you';

  @override
  String get jobStatusInProgress => 'In progress';

  @override
  String get jobStatusInspection => 'Inspection in progress';

  @override
  String get jobStatusQuoteRequired => 'Quote pending';

  @override
  String get jobStatusQuoteSubmitted => 'Quote awaiting your approval';

  @override
  String get jobStatusQuoteApproved => 'Quote approved';

  @override
  String get jobStatusQuoteRejected => 'Quote rejected';

  @override
  String get jobStatusWorkStarted => 'Work started';

  @override
  String get jobStatusWaitingForParts => 'Waiting for parts';

  @override
  String get jobStatusWorkCompleted => 'Work finished — confirm please';

  @override
  String get jobStatusCustomerConfirmed => 'Confirmed';

  @override
  String get jobStatusCompleted => 'Completed';

  @override
  String get jobStatusCancelled => 'Cancelled';

  @override
  String get jobStatusNoPartner => 'No partner available';

  @override
  String get jobStatusDisputed => 'Disputed';

  @override
  String get trackingTitle => 'Track order';

  @override
  String get trackingSupport => 'Support';

  @override
  String trackingEta(String minutes) {
    return 'Arriving in $minutes min';
  }

  @override
  String get trackingEtaUnknown => 'Updating arrival time…';

  @override
  String get trackingFinished => 'This order is finished.';

  @override
  String get trackingPollingFallback =>
      'Live updates unavailable — refreshing every few seconds.';

  @override
  String trackingProgressLabel(int step, int total, String status) {
    final intl.NumberFormat stepNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String stepString = stepNumberFormat.format(step);
    final intl.NumberFormat totalNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String totalString = totalNumberFormat.format(total);

    return 'Step $stepString of $totalString: $status';
  }

  @override
  String get trackingCallPartner => 'Call partner';

  @override
  String get trackingChatPartner => 'Chat with partner';

  @override
  String get trackingTripPin => 'Trip PIN';

  @override
  String get trackingTripPinHint =>
      'Give this code to the driver when you get in.';

  @override
  String get trackingDeliveryOtp => 'Delivery code';

  @override
  String get trackingDeliveryOtpHint => 'This code is needed at hand-over.';

  @override
  String get trackingNoPartnerTitle => 'No partner was available';

  @override
  String get trackingNoPartnerBody =>
      'You can try again now or change the order.';

  @override
  String get trackingRetryDispatch => 'Search again';

  @override
  String get trackingEstimatedTotal => 'Estimated total';

  @override
  String get trackingShare => 'Share trip';

  @override
  String trackingShareMessage(String url) {
    return 'Follow my trip on TAMAM: $url';
  }

  @override
  String get trackingSos => 'SOS';

  @override
  String get sosTitle => 'Send an SOS';

  @override
  String get sosBody =>
      'Our safety team is alerted immediately with your location and order details.';

  @override
  String get sosConfirm => 'Send SOS';

  @override
  String get sosSent => 'SOS sent. We are contacting you now.';

  @override
  String get cancelTitle => 'Cancel order';

  @override
  String get cancelSubtitle => 'Tell us why, so we can improve';

  @override
  String get cancelConfirm => 'Confirm cancellation';

  @override
  String get cancelNote => 'More details';

  @override
  String get cancelFeeWarning =>
      'A cancellation fee may apply if the partner is already on the way.';

  @override
  String get cancelReasonChangedMind => 'I changed my mind';

  @override
  String get cancelReasonWaitTooLong => 'The wait is too long';

  @override
  String get cancelReasonWrongAddress => 'Wrong address';

  @override
  String get cancelReasonPriceTooHigh => 'The price is too high';

  @override
  String get cancelReasonPartnerNotMoving => 'The partner is not moving';

  @override
  String get cancelReasonSafety => 'Safety concern';

  @override
  String get cancelReasonDuplicate => 'Duplicate order';

  @override
  String get cancelReasonOther => 'Other';

  @override
  String get quoteTitle => 'Quote';

  @override
  String get quoteChangeOrderTitle => 'Change order';

  @override
  String get quoteReadyTitle => 'Your quote is ready';

  @override
  String get quoteReview => 'Review quote';

  @override
  String quoteRevision(int revision) {
    final intl.NumberFormat revisionNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String revisionString = revisionNumberFormat.format(revision);

    return 'Revision $revisionString';
  }

  @override
  String get quoteApprove => 'Approve quote';

  @override
  String get quoteReject => 'Reject quote';

  @override
  String get quoteConfirmReject => 'Confirm rejection';

  @override
  String get quoteRejectReason => 'Reason (optional)';

  @override
  String get quoteLabor => 'Labour';

  @override
  String get quoteParts => 'Parts';

  @override
  String get quoteFees => 'Additional fees';

  @override
  String get quoteDiscount => 'Discount';

  @override
  String get quoteTax => 'Tax';

  @override
  String quoteDuration(int minutes) {
    final intl.NumberFormat minutesNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String minutesString = minutesNumberFormat.format(minutes);

    return 'Estimated $minutesString minutes';
  }

  @override
  String quoteItemMeta(String kind, String quantity) {
    return '$kind · qty $quantity';
  }

  @override
  String get workCompletedTitle => 'Work finished';

  @override
  String get workCompletedBody =>
      'Check the work, then confirm it to complete payment.';

  @override
  String get workConfirmTitle => 'Confirm the work';

  @override
  String get workConfirmBody =>
      'Confirming marks the work done and settles the final amount.';

  @override
  String get workConfirmCta => 'Confirm work';

  @override
  String get ratingTitle => 'Rate the service';

  @override
  String get ratingCta => 'Rate the service';

  @override
  String get ratingPrompt => 'How was your experience?';

  @override
  String get ratingPartnerFallback => 'Your partner';

  @override
  String get ratingComment => 'Add a comment (optional)';

  @override
  String get ratingThanks => 'Thanks for your rating!';

  @override
  String get ratingTagPunctual => 'On time';

  @override
  String get ratingTagPolite => 'Polite';

  @override
  String get ratingTagClean => 'Clean';

  @override
  String get ratingTagProfessional => 'Professional';

  @override
  String get ratingTagGoodPrice => 'Fair price';

  @override
  String get ratingTagCarefulDriving => 'Safe driving';

  @override
  String get ratingTagLate => 'Late';

  @override
  String get ratingTagRude => 'Rude';

  @override
  String get ratingTagUnclean => 'Not clean';

  @override
  String get ratingTagUnprofessional => 'Unprofessional';

  @override
  String get ratingTagOvercharged => 'Overcharged';

  @override
  String get ratingTagUnsafeDriving => 'Unsafe driving';

  @override
  String get receiptTitle => 'Receipt';

  @override
  String get receiptCta => 'View receipt';

  @override
  String get receiptPayment => 'Payment';

  @override
  String get receiptRefunded => 'Refunded';

  @override
  String get receiptCancellationFee => 'Cancellation fee';

  @override
  String get receiptProofOfDelivery => 'Proof of delivery';

  @override
  String receiptReceivedBy(String name) {
    return 'Received by $name';
  }

  @override
  String get paymentStatusPending => 'Pending';

  @override
  String get paymentStatusAuthorized => 'Authorised';

  @override
  String get paymentStatusCaptured => 'Paid';

  @override
  String get paymentStatusFailed => 'Failed';

  @override
  String get paymentStatusRefunded => 'Refunded';

  @override
  String get paymentStatusCancelled => 'Cancelled';

  @override
  String get chatTitle => 'Chat';

  @override
  String get chatHint => 'Write a message…';

  @override
  String get chatSendPhoto => 'Send a photo';

  @override
  String get chatSendLocation => 'Send location';

  @override
  String get chatSharedLocation => 'Location shared';

  @override
  String get chatLoadOlder => 'Show older messages';

  @override
  String get chatEmptyTitle => 'No messages yet';

  @override
  String get chatEmptyBody => 'Write a message to reach your partner.';

  @override
  String get walletTitle => 'Wallet';

  @override
  String get walletBalance => 'Your balance';

  @override
  String get walletPending => 'Pending';

  @override
  String get walletTopUp => 'Top up';

  @override
  String get walletTopUpHint =>
      'Choose an amount, then finish payment with the provider.';

  @override
  String get walletStatement => 'Statement';

  @override
  String get walletEmptyTitle => 'No transactions yet';

  @override
  String get walletEmptyBody => 'Every payment and refund will appear here.';

  @override
  String get walletPromos => 'Offers';

  @override
  String get walletReferrals => 'Invite a friend';

  @override
  String get promosTitle => 'Offers and codes';

  @override
  String get promoEnterTitle => 'Have a promo code?';

  @override
  String get promoEnterBody =>
      'Save it and we will apply it to your next order.';

  @override
  String promoSaved(String code) {
    return 'Code $code saved';
  }

  @override
  String promoPending(String code) {
    return 'Code $code will be applied to your next order.';
  }

  @override
  String get referralsTitle => 'Invite your friends';

  @override
  String get referralsRewardPrefix => 'Your friend gets';

  @override
  String referralsStats(int invited, int rewarded) {
    final intl.NumberFormat invitedNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String invitedString = invitedNumberFormat.format(invited);
    final intl.NumberFormat rewardedNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String rewardedString = rewardedNumberFormat.format(rewarded);

    return 'You invited $invitedString friends and earned $rewardedString rewards.';
  }

  @override
  String get referralsShare => 'Share invite code';

  @override
  String get referralsCopied => 'Code copied';

  @override
  String get accountTitle => 'Account';

  @override
  String get accountNoName => 'Add your name';

  @override
  String get accountGroupActivity => 'Activity';

  @override
  String get accountGroupSettings => 'Settings';

  @override
  String get accountGroupHelp => 'Help and safety';

  @override
  String get accountSignOut => 'Sign out';

  @override
  String get accountSignOutConfirm => 'You will be signed out on this device.';

  @override
  String get favoritesTitle => 'Favourites';

  @override
  String get favoritesEmptyTitle => 'No favourites yet';

  @override
  String get favoritesEmptyBody =>
      'Add the services you use most for quick access.';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileEmail => 'E-mail';

  @override
  String get profilePhone => 'Phone number';

  @override
  String get profilePhoneLocked => 'Contact support to change your number.';

  @override
  String get profileSaved => 'Changes saved';

  @override
  String get preferencesTitle => 'Preferences';

  @override
  String get preferencesLanguage => 'Language';

  @override
  String get preferencesAppearance => 'Appearance';

  @override
  String get preferencesNotifications => 'Notifications';

  @override
  String get preferencesNotificationsUnavailable =>
      'Notification settings could not be loaded.';

  @override
  String get preferencesPush => 'Push notifications';

  @override
  String get preferencesSms => 'SMS';

  @override
  String get preferencesEmail => 'E-mail';

  @override
  String get preferencesMarketing => 'Marketing offers';

  @override
  String get preferencesMarketingHint => 'Only offers and discounts.';

  @override
  String get themeSystem => 'System';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String get sessionsTitle => 'Active devices';

  @override
  String get sessionsEmptyTitle => 'No other devices';

  @override
  String sessionsLastSeen(String when) {
    return 'Last active $when';
  }

  @override
  String get sessionsThisDevice => 'This device';

  @override
  String get sessionsRevoke => 'End session';

  @override
  String get sessionsSignOutAll => 'Sign out everywhere';

  @override
  String get sessionsSignOutAllConfirm =>
      'Every session ends, including this device.';

  @override
  String get savedPlacesTitle => 'Saved places';

  @override
  String get savedPlacesAdd => 'Add a place';

  @override
  String get savedPlacesEdit => 'Edit place';

  @override
  String get savedPlacesLabel => 'Place name';

  @override
  String get savedPlacesEmptyTitle => 'No saved places yet';

  @override
  String get savedPlacesEmptyBody =>
      'Save home and work to order with one tap.';

  @override
  String get savedPlacesDeleteTitle => 'Delete place';

  @override
  String savedPlacesDeleteBody(String label) {
    return '“$label” will be deleted.';
  }

  @override
  String get placeKindHome => 'Home';

  @override
  String get placeKindWork => 'Work';

  @override
  String get placeKindCustom => 'Other';

  @override
  String get addressSheetTitle => 'Choose an address';

  @override
  String get addressSearchHint => 'Search a street or area';

  @override
  String get addressUseCurrent => 'My location';

  @override
  String get addressPickOnMap => 'Pick on map';

  @override
  String get addressManagePlaces => 'Manage saved places';

  @override
  String get addressNoResults => 'No matching results.';

  @override
  String get addressSearchFailed => 'Search is unavailable right now.';

  @override
  String get addressAttribution => 'Search results from OpenStreetMap';

  @override
  String get addressBuilding => 'Building';

  @override
  String get addressFloor => 'Floor';

  @override
  String get addressApartment => 'Apartment';

  @override
  String get addressNotes => 'Arrival notes';

  @override
  String get locationPickerTitle => 'Pick a location';

  @override
  String get locationPickerHint => 'Move the map to place the pin';

  @override
  String get locationPickerMoveMap => 'Move the map to set the address';

  @override
  String get locationPickerConfirm => 'Confirm location';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsMarkAllRead => 'Mark all read';

  @override
  String get notificationsEmptyTitle => 'No notifications';

  @override
  String get notificationsEmptyBody =>
      'We will tell you here about your orders.';

  @override
  String get supportTitle => 'Support';

  @override
  String get supportNewTicket => 'New support request';

  @override
  String get supportNewTicketHint =>
      'Describe the problem and our team will reply.';

  @override
  String get supportSubject => 'Subject';

  @override
  String get supportDescription => 'Details';

  @override
  String get supportReplyHint => 'Write a reply…';

  @override
  String get supportTicketTitle => 'Support request';

  @override
  String get supportEmptyTitle => 'No support requests';

  @override
  String get supportEmptyBody => 'Open a request if you need help.';

  @override
  String get ticketCategoryPayment => 'Payment';

  @override
  String get ticketCategoryJob => 'Order issue';

  @override
  String get ticketCategoryPartner => 'Partner behaviour';

  @override
  String get ticketCategoryLostItem => 'Lost item';

  @override
  String get ticketCategoryAccount => 'Account';

  @override
  String get ticketCategorySafety => 'Safety';

  @override
  String get ticketCategoryOther => 'Other';

  @override
  String get ticketStatusOpen => 'Open';

  @override
  String get ticketStatusInProgress => 'In progress';

  @override
  String get ticketStatusWaitingUser => 'Waiting for you';

  @override
  String get ticketStatusResolved => 'Resolved';

  @override
  String get ticketStatusClosed => 'Closed';

  @override
  String get disputesTitle => 'Disputes';

  @override
  String get disputesEmptyTitle => 'No disputes';

  @override
  String get disputesEmptyBody =>
      'Open one from an order if something went wrong.';

  @override
  String get disputeDetailTitle => 'Dispute details';

  @override
  String get disputeOpen => 'Open a dispute';

  @override
  String get disputeReasonLabel => 'Reason';

  @override
  String get disputeDescription => 'Explain what happened';

  @override
  String get disputeRefunded => 'Refunded';

  @override
  String get disputeReasonNotCompleted => 'Work not completed';

  @override
  String get disputeReasonPoorQuality => 'Poor quality';

  @override
  String get disputeReasonOvercharged => 'Overcharged';

  @override
  String get disputeReasonDamage => 'Damage';

  @override
  String get disputeReasonItemMissing => 'Item missing';

  @override
  String get disputeReasonMisconduct => 'Partner misconduct';

  @override
  String get disputeReasonOther => 'Other';

  @override
  String get disputeStatusOpen => 'Open';

  @override
  String get disputeStatusUnderReview => 'Under review';

  @override
  String get disputeStatusResolvedCustomer => 'Resolved for you';

  @override
  String get disputeStatusResolvedPartner => 'Resolved for the partner';

  @override
  String get disputeStatusResolvedSplit => 'Partially settled';

  @override
  String get disputeStatusRejected => 'Rejected';

  @override
  String get legalTitle => 'About';

  @override
  String get legalTermsTitle => 'Terms of use';

  @override
  String get legalTermsBody =>
      'By using TAMAM you agree to provide accurate details, treat partners with respect, and pay for the services you request. Cancellation fees follow the policy shown in the app.';

  @override
  String get legalPrivacyTitle => 'Privacy';

  @override
  String get legalPrivacyBody =>
      'We use your location and phone number only to fulfil orders. We do not share your data with third parties for marketing, and you can switch marketing messages off in Preferences.';

  @override
  String get legalDeleteAccount => 'Request account deletion';

  @override
  String get legalDeleteAccountHint => 'Opens a support request for review.';

  @override
  String get legalDeleteAccountConfirm =>
      'We will open a support request to delete your account. Invoicing records may be kept as the law requires.';

  @override
  String get legalDeleteAccountCta => 'Send request';

  @override
  String get legalDeleteAccountSubject => 'Account deletion request';

  @override
  String get legalDeleteAccountBody =>
      'I would like my TAMAM account and personal data deleted.';

  @override
  String bannerPromoCopied(String code) {
    return 'Code $code copied — it will apply to your next order.';
  }

  @override
  String get bannerLeaveAppTitle => 'Open an external link';

  @override
  String bannerLeaveAppMessage(String host) {
    return '$host will open outside the app.';
  }

  @override
  String get publicTrackTitle => 'Trip tracking';

  @override
  String publicTrackPartner(String name) {
    return 'Partner: $name';
  }

  @override
  String get emptyTitle => 'Nothing here yet';

  @override
  String get errorTitle => 'Something went wrong';

  @override
  String get errorOfflineTitle => 'You are offline';

  @override
  String get offlineBanner =>
      'No internet connection — some data may be out of date.';

  @override
  String get errorOffline => 'Check your internet connection and try again.';

  @override
  String get errorNetwork => 'We could not reach the server. Try again.';

  @override
  String get errorGeneric => 'An unexpected error occurred. Please try again.';

  @override
  String get errorValidation => 'Please check the details you entered.';

  @override
  String get errorSessionExpired =>
      'Your session expired. Please sign in again.';

  @override
  String get errorForbidden => 'You are not allowed to do that.';

  @override
  String get errorNotFound => 'We could not find that.';

  @override
  String get errorRateLimited =>
      'Too many attempts. Wait a moment and try again.';

  @override
  String get errorOtpInvalid => 'That code is not correct.';

  @override
  String get errorOtpExpired => 'The code expired. Request a new one.';

  @override
  String get errorOtpTooManyAttempts =>
      'Too many wrong attempts. Request a new code.';

  @override
  String get errorOtpCooldown =>
      'Wait a moment before requesting another code.';

  @override
  String get errorAccountSuspended =>
      'Your account is suspended. Contact support.';

  @override
  String get errorAccountRestricted =>
      'Your account is temporarily restricted.';

  @override
  String get errorOutsideZone => 'We do not operate at this location yet.';

  @override
  String get errorServiceUnavailableInZone =>
      'This service is not available in your area.';

  @override
  String get errorOutsideHours =>
      'This service is outside working hours right now.';

  @override
  String get errorNoPartners => 'No partner is available right now.';

  @override
  String get errorVersionConflict => 'The order changed. Please try again.';

  @override
  String get errorJobAlreadyAssigned => 'This order already has a partner.';

  @override
  String get errorInsufficientBalance => 'Your wallet balance is not enough.';

  @override
  String get errorPaymentMethodDisabled =>
      'That payment method is unavailable right now.';

  @override
  String get errorPaymentFailed => 'The payment failed.';

  @override
  String get errorPromoInvalid => 'That promo code is not valid.';

  @override
  String get errorPromoExpired => 'That promo code has expired.';

  @override
  String get errorPromoUsageExceeded => 'This code has been fully used.';

  @override
  String get errorPromoMinOrder => 'Your order is below the code\'s minimum.';

  @override
  String get errorPromoNotEligible => 'This code does not apply to your order.';

  @override
  String get errorRatingNotAllowed => 'This order cannot be rated.';

  @override
  String get errorUploadTooLarge => 'That file is too large.';

  @override
  String get errorUploadInvalid => 'That file type is not supported.';

  @override
  String get errorFeatureDisabled => 'That feature is switched off right now.';

  @override
  String get errorDuplicateRequest => 'This request was already sent.';

  @override
  String get errorQuoteNotApproved => 'The quote must be approved first.';

  @override
  String get errorCannotOpenLink => 'The link could not be opened.';

  @override
  String get serviceChalet => 'Chalet';

  @override
  String get serviceChaletCaption => 'Book by the hour';

  @override
  String get chaletTitle => 'TAMAM Chalet';

  @override
  String get chaletSearchHint => 'Find a chalet';

  @override
  String chaletGuests(int count) {
    return '$count guests';
  }

  @override
  String get chaletGuestsFilter => 'Guests';

  @override
  String chaletUpToGuests(int count) {
    return 'Up to $count guests';
  }

  @override
  String get chaletPerHour => '/ hour';

  @override
  String get chaletNoResults => 'No chalets match';

  @override
  String get chaletNoResultsBody => 'Try a different day or a smaller party.';

  @override
  String get chaletInstantBooking => 'Instant booking';

  @override
  String get chaletPickDay => 'Pick a day';

  @override
  String get chaletPickDuration => 'How long';

  @override
  String get chaletPickTime => 'Start time';

  @override
  String chaletDurationHours(String hours) {
    return '$hours hours';
  }

  @override
  String chaletDurationHoursAndHalf(String hours) {
    return '$hours½ hours';
  }

  @override
  String get chaletNoTimesToday => 'Nothing free on this day';

  @override
  String get chaletNoTimesBody => 'Try another day, or a shorter stay.';

  @override
  String chaletCleaningNote(int minutes) {
    return '$minutes minutes after every booking are for cleaning and cannot be booked.';
  }

  @override
  String get chaletGapBadge => 'Between two bookings';

  @override
  String get chaletSlotTaken =>
      'That time overlaps another booking or its cleaning window';

  @override
  String get chaletSlotBlocked => 'The owner has blocked that time';

  @override
  String get chaletSlotOutsideHours => 'That time is outside opening hours';

  @override
  String get chaletSlotTooShort => 'That booking length is not allowed here';

  @override
  String get chaletSlotOffGrid =>
      'Bookings start on the owner\'s own time intervals';

  @override
  String get chaletAlternatives => 'Nearby times that work';

  @override
  String get chaletPriceTitle => 'Price breakdown';

  @override
  String get chaletPriceHourly => 'Hourly rate';

  @override
  String get chaletPriceSubtotal => 'Subtotal';

  @override
  String get chaletPriceDeposit => 'Deposit';

  @override
  String get chaletPriceTotal => 'Total';

  @override
  String get chaletPriceFloorNote => 'This is the owner\'s own minimum rate.';

  @override
  String get chaletHoldTitle => 'Time held for you';

  @override
  String get chaletHoldBody =>
      'The slot is yours while you pay. Finish before the timer runs out.';

  @override
  String chaletHoldRemaining(String time) {
    return '$time left';
  }

  @override
  String get chaletHoldExpired => 'The hold ran out and the time is free again';

  @override
  String get chaletConfirm => 'Confirm booking';

  @override
  String get chaletConfirmed => 'Your booking is confirmed';

  @override
  String chaletConfirmedBody(String number) {
    return 'Booking $number';
  }

  @override
  String chaletBookingFrom(String time) {
    return 'From $time';
  }

  @override
  String chaletBookingTo(String time) {
    return 'To $time';
  }

  @override
  String get chaletCancelBooking => 'Cancel booking';

  @override
  String get chaletCancelReason => 'Reason for cancelling';

  @override
  String get chaletAmenities => 'Amenities';

  @override
  String get chaletAbout => 'About';

  @override
  String get chaletOpeningHours => 'Opening hours';

  @override
  String chaletFrom(String open, String close) {
    return '$open to $close';
  }

  @override
  String get chaletBookNow => 'Book now';

  @override
  String get chaletSelectTimeFirst => 'Pick a time to continue';
}
