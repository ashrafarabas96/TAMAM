// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTagline => 'Work whenever you want — sorted';

  @override
  String get appPartnerTag => 'Partner app';

  @override
  String get navHome => 'Home';

  @override
  String get navJobs => 'Jobs';

  @override
  String get navEarnings => 'Earnings';

  @override
  String get navAccount => 'Account';

  @override
  String get offlineBanner =>
      'No internet connection — some data may be out of date.';

  @override
  String activeJobBannerSemantics(String status) {
    return 'Job in progress, $status. Tap to open.';
  }

  @override
  String get realtimeReconnecting => 'Reconnecting…';

  @override
  String get actionAdd => 'Add';

  @override
  String get actionAllow => 'Allow';

  @override
  String get actionBack => 'Back';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionChange => 'Change';

  @override
  String get actionCheck => 'Check';

  @override
  String get actionClear => 'Clear';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionDismiss => 'Dismiss';

  @override
  String get actionLoadMore => 'Load more';

  @override
  String get actionMore => 'More options';

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
  String get actionSend => 'Send';

  @override
  String get actionSkip => 'Skip';

  @override
  String distanceKm(String value) {
    return '$value km';
  }

  @override
  String distanceM(String value) {
    return '$value m';
  }

  @override
  String durationMin(String value) {
    return '$value min';
  }

  @override
  String get signInTitle => 'Welcome to TAMAM Partner';

  @override
  String get signInSubtitle =>
      'Enter your phone number to reach your partner account';

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
      'By continuing you agree to the Partner Terms and the Privacy Policy.';

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
  String get errorTitle => 'Something went wrong';

  @override
  String get errorOfflineTitle => 'You are offline';

  @override
  String get emptyTitle => 'Nothing here yet';

  @override
  String get errorGeneric => 'An unexpected error occurred. Please try again.';

  @override
  String get errorNetwork => 'We could not reach the server. Try again.';

  @override
  String get errorOffline => 'Check your internet connection and try again.';

  @override
  String get errorNotFound => 'We could not find that.';

  @override
  String get errorForbidden => 'You are not allowed to do that.';

  @override
  String get errorValidation => 'Please check the details you entered.';

  @override
  String get errorRateLimited =>
      'Too many attempts. Wait a moment and try again.';

  @override
  String get errorSessionExpired =>
      'Your session expired. Please sign in again.';

  @override
  String get errorAccountRestricted =>
      'Your account is temporarily restricted.';

  @override
  String get errorAccountSuspended =>
      'Your account is suspended. Contact support.';

  @override
  String get errorFeatureDisabled => 'That feature is switched off right now.';

  @override
  String get errorDuplicateRequest => 'This request was already sent.';

  @override
  String get errorInvalidTransition =>
      'The job status changed. Refresh and try again.';

  @override
  String get errorVersionConflict =>
      'The job was updated elsewhere. Please try again.';

  @override
  String get errorOfferExpired => 'That offer expired.';

  @override
  String get errorOfferTaken => 'Another partner took this job.';

  @override
  String get errorPartnerNotAvailable => 'You must be online to receive jobs.';

  @override
  String get errorPartnerNotApproved =>
      'Your account is still under review, so you cannot go online yet.';

  @override
  String get errorOutsideZone => 'You are outside your approved working zones.';

  @override
  String get errorOutsideHours =>
      'This service is outside working hours right now.';

  @override
  String get errorStaleLocation =>
      'Your location is too old. Make sure location is on and try again.';

  @override
  String get errorImpossibleMovement =>
      'That location reading is not plausible. Check your GPS accuracy.';

  @override
  String get errorPickupOtpInvalid => 'That pickup code is not correct.';

  @override
  String get errorDeliveryOtpInvalid => 'That delivery code is not correct.';

  @override
  String get errorTripPinInvalid => 'That trip PIN is not correct.';

  @override
  String get errorQuoteNotApproved =>
      'The customer must approve the quote first.';

  @override
  String get errorRatingNotAllowed => 'This job cannot be rated.';

  @override
  String get errorInsufficientBalance =>
      'Your balance is not enough for this withdrawal.';

  @override
  String get errorUploadInvalid => 'That file type is not supported.';

  @override
  String get errorUploadTooLarge => 'That file is too large.';

  @override
  String get errorOtpInvalid => 'That code is not correct.';

  @override
  String get errorOtpExpired => 'The code expired. Request a new one.';

  @override
  String get errorOtpCooldown =>
      'Wait a moment before requesting another code.';

  @override
  String get errorOtpTooManyAttempts =>
      'Too many wrong attempts. Request a new code.';

  @override
  String get errorCannotCall => 'This device cannot place the call.';

  @override
  String get errorCannotOpenLink => 'The link could not be opened.';

  @override
  String get locationUnavailable => 'We could not get your location right now.';

  @override
  String get homeGreeting => 'Have a good shift';

  @override
  String get homeStatusOnline => 'Online and ready for jobs';

  @override
  String get homeStatusOffline => 'Offline';

  @override
  String get homeTodayEarnings => 'Earnings today';

  @override
  String get homeCompletedJobs => 'Jobs today';

  @override
  String get homeWaitingTitle => 'Waiting for your first offer';

  @override
  String get homeWaitingBody =>
      'Stay inside your working zone and we will send you the nearest suitable job as soon as one comes up.';

  @override
  String get homeOfflineEmptyTitle => 'You are offline right now';

  @override
  String get homeOfflineEmptyBody =>
      'Tap the toggle above to start receiving offers.';

  @override
  String get homeProfileUnavailable =>
      'We could not load your profile right now';

  @override
  String homePendingOffers(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'You have $countString offers waiting';
  }

  @override
  String get statsRating => 'Rating';

  @override
  String get statsCompleted => 'Completed jobs';

  @override
  String get statsAcceptance => 'Acceptance rate';

  @override
  String get availabilityOnline => 'Online';

  @override
  String get availabilityOffline => 'Offline';

  @override
  String get availabilityBusy => 'On a job';

  @override
  String availabilityToggleSemantics(String state) {
    return 'Work status: $state. Tap to change it.';
  }

  @override
  String get availabilityPermissionDenied =>
      'We need location permission to run a work shift.';

  @override
  String get availabilityServiceDisabled =>
      'Location services are off on your device. Turn them on and try again.';

  @override
  String availabilityExpiredDocuments(String documents) {
    return 'Expired: $documents. Renew them before going online.';
  }

  @override
  String get availabilityActiveJobBlocksOffline =>
      'You cannot go offline until the current job is finished.';

  @override
  String get goOnlineTitle => 'Start your shift';

  @override
  String get goOnlineSubtitle =>
      'Check your permissions and roles before going online.';

  @override
  String get goOnlineConfirm => 'Go online';

  @override
  String get goOnlineDone => 'You are online — good luck!';

  @override
  String get goOnlineLocationTitle => 'Location while you work';

  @override
  String get goOnlineLocationBody =>
      'We follow your location only while you are online, to send you the nearest jobs and show the customer that you are arriving. Tracking stops the moment you go offline.';

  @override
  String get goOnlineForegroundBody =>
      'A persistent notification stays up during your shift — that is what keeps tracking alive when the screen is off.';

  @override
  String get goOnlinePermissionAlways => 'Location permission: always — ideal';

  @override
  String get goOnlinePermissionWhileInUse =>
      'Location permission: while using the app';

  @override
  String get goOnlinePermissionPending => 'Location permission required';

  @override
  String get goOnlineRoles => 'Roles active this shift';

  @override
  String get goOnlineVehicle => 'Vehicle';

  @override
  String get goOnlineNoVehicle => 'No active vehicle for your current role.';

  @override
  String get goOfflineTitle => 'Go offline';

  @override
  String get goOfflineMessage =>
      'You will not receive new offers until you go online again.';

  @override
  String get goOfflineConfirm => 'Go offline';

  @override
  String get backgroundLimitedBanner =>
      'Permission is \"while in use\" only — tracking may pause when the screen is off.';

  @override
  String get foregroundNotificationTitle => 'TAMAM — shift in progress';

  @override
  String get foregroundNotificationIdle => 'Online and waiting for offers';

  @override
  String get foregroundNotificationOnJob => 'Job in progress — tracking is on';

  @override
  String get interruptionPermission =>
      'Location permission was revoked, so you were set offline.';

  @override
  String get interruptionServiceDisabled =>
      'Location services were switched off, so you were set offline.';

  @override
  String get interruptionServer =>
      'The server ended your shift. You can go online again.';

  @override
  String get interruptionGeneric => 'Your work shift stopped.';

  @override
  String get resumeWorkTitle => 'Resume your shift?';

  @override
  String get resumeWorkBody =>
      'The server still lists you as online, but tracking on this device is stopped.';

  @override
  String get resumeWorkConfirm => 'Resume';

  @override
  String get resumeWorkDecline => 'Go offline';

  @override
  String get warningNoActiveVehicle =>
      'No active vehicle — activate one before your shift.';

  @override
  String warningDocumentExpired(String document) {
    return '$document has expired.';
  }

  @override
  String warningDocumentRejected(String document) {
    return '$document was rejected. Upload it again.';
  }

  @override
  String warningDocumentExpiring(String document, int days) {
    final intl.NumberFormat daysNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String daysString = daysNumberFormat.format(days);

    return '$document expires in $daysString days.';
  }

  @override
  String get offerTitle => 'New job';

  @override
  String get offerAccept => 'Accept';

  @override
  String get offerDecline => 'Decline';

  @override
  String offerSecondsLeft(int seconds) {
    final intl.NumberFormat secondsNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String secondsString = secondsNumberFormat.format(seconds);

    return '$secondsString s';
  }

  @override
  String offerQueuePosition(int count) {
    final intl.NumberFormat countNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String countString = countNumberFormat.format(count);

    return 'and $countString more waiting';
  }

  @override
  String get offerEstimatedEarnings => 'Your estimated earnings';

  @override
  String get offerPickup => 'Pickup';

  @override
  String get offerServiceLocation => 'Service location';

  @override
  String get offerDestination => 'Destination';

  @override
  String get offerWaypoint => 'Stop on the way';

  @override
  String get offerToPickup => 'Distance to you';

  @override
  String get offerEta => 'Time to arrive';

  @override
  String get offerTripDistance => 'Trip distance';

  @override
  String get jobTypeRide => 'Ride';

  @override
  String get jobTypeDelivery => 'Delivery';

  @override
  String get jobTypeFood => 'Food delivery';

  @override
  String get jobTypeHomeService => 'Home service';

  @override
  String get jobTypeOther => 'Service';

  @override
  String get jobStatusDraft => 'Draft';

  @override
  String get jobStatusSearching => 'Finding a partner';

  @override
  String get jobStatusAssigned => 'Assigned to you';

  @override
  String get jobStatusEnRoute => 'You are on the way';

  @override
  String get jobStatusArrived => 'You arrived';

  @override
  String get jobStatusWaitingCustomer => 'Waiting for the customer';

  @override
  String get jobStatusInProgress => 'In progress';

  @override
  String get jobStatusInspection => 'Inspection in progress';

  @override
  String get jobStatusQuoteRequired => 'Quote required';

  @override
  String get jobStatusQuoteSubmitted => 'Quote sent — waiting for the customer';

  @override
  String get jobStatusQuoteApproved => 'Quote approved';

  @override
  String get jobStatusQuoteRejected => 'Quote rejected';

  @override
  String get jobStatusWorkStarted => 'Work started';

  @override
  String get jobStatusWaitingForParts => 'Waiting for parts';

  @override
  String get jobStatusWorkCompleted => 'Work finished — awaiting the customer';

  @override
  String get jobStatusCustomerConfirmed => 'Customer confirmed';

  @override
  String get jobStatusCompleted => 'Completed';

  @override
  String get jobStatusCancelled => 'Cancelled';

  @override
  String get jobStatusNoPartner => 'No partner available';

  @override
  String get jobStatusDisputed => 'Disputed';

  @override
  String get urgencyStandard => 'Standard';

  @override
  String get urgencyUrgent => 'Urgent';

  @override
  String get urgencyEmergency => 'Emergency';

  @override
  String get paymentCash => 'Cash';

  @override
  String get paymentCard => 'Card';

  @override
  String get paymentWallet => 'Wallet';

  @override
  String get paymentBank => 'Bank transfer';

  @override
  String get paymentOnline => 'Online payment';

  @override
  String get roleDriver => 'Driver';

  @override
  String get roleCourier => 'Courier';

  @override
  String get roleTechnician => 'Technician';

  @override
  String get roleServiceProvider => 'Service provider';

  @override
  String get roleDriverCaption => 'Rides by car inside your city';

  @override
  String get roleCourierCaption => 'Delivering parcels and food';

  @override
  String get roleTechnicianCaption =>
      'Repairs and maintenance at the customer address';

  @override
  String get roleServiceProviderCaption =>
      'Specialised home services with a quote';

  @override
  String get jobActionEnRoute => 'I am on the way';

  @override
  String get jobActionArrive => 'I have arrived';

  @override
  String get jobActionStartRide => 'Start the trip';

  @override
  String get jobActionPickedUp => 'Package picked up';

  @override
  String get jobActionStartInspection => 'Start the inspection';

  @override
  String get jobActionCompleteRide => 'Finish the trip';

  @override
  String get jobActionDeliver => 'Deliver the package';

  @override
  String get jobActionSubmitQuote => 'Send the quote';

  @override
  String get jobActionStartWork => 'Start the work';

  @override
  String get jobActionCompleteWork => 'Finish the work';

  @override
  String get jobActionResumeWork => 'Resume the work';

  @override
  String get jobActionWaitingForParts => 'Waiting for parts';

  @override
  String get jobActionChangeOrder => 'Add extra work';

  @override
  String get jobPassiveAwaitQuote =>
      'Your quote is with the customer; waiting for their decision.';

  @override
  String get jobPassiveAwaitConfirmation =>
      'Waiting for the customer to confirm the work is done.';

  @override
  String get jobPassiveCancelled => 'This job was cancelled.';

  @override
  String get jobPassiveNothing => 'Nothing to do right now.';

  @override
  String get jobNavigate => 'Navigate';

  @override
  String get navigateWith => 'Navigate with';

  @override
  String get navigateGoogleMaps => 'Google Maps';

  @override
  String get navigateWaze => 'Waze';

  @override
  String get navigateUnavailable =>
      'No navigation app is installed on this device.';

  @override
  String get jobCurrentTarget => 'Your next stop';

  @override
  String get jobCallCustomer => 'Call';

  @override
  String get jobChatCustomer => 'Chat';

  @override
  String jobWaitingSince(String duration) {
    return 'Waiting for the customer for $duration';
  }

  @override
  String arriveTooFar(int meters) {
    final intl.NumberFormat metersNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String metersString = metersNumberFormat.format(meters);

    return 'You are $metersString m from the location. Get closer, then confirm arrival.';
  }

  @override
  String get jobVersionConflictHint =>
      'The job changed while you were working on it — review the details before continuing.';

  @override
  String get tripPinTitle => 'Trip PIN';

  @override
  String get tripPinSubtitle => 'Ask the rider for the PIN shown in their app.';

  @override
  String get pickupOtpTitle => 'Pickup code';

  @override
  String get pickupOtpSubtitle => 'Ask the sender for the pickup code.';

  @override
  String get completeRideConfirm =>
      'The trip ends now and the final fare is calculated.';

  @override
  String get cancelJobTitle => 'Cancel the job';

  @override
  String get cancelJobSubtitle =>
      'Pick a clear reason — cancellations affect your acceptance rate.';

  @override
  String get cancelJobConfirm => 'Confirm cancellation';

  @override
  String get cancelJobReasonRequired => 'Details (required)';

  @override
  String get cancelJobReasonOptional => 'More details (optional)';

  @override
  String get cancelJobNoShowAfterArrival =>
      'The \"customer did not show\" option unlocks after you confirm arrival and the waiting time is over.';

  @override
  String get cancelReasonNoShow => 'The customer did not show';

  @override
  String get cancelReasonUnreachable => 'Could not reach the customer';

  @override
  String get cancelReasonWrongAddress => 'Wrong address';

  @override
  String get cancelReasonVehicleIssue => 'Vehicle problem';

  @override
  String get cancelReasonSafety => 'Safety concern';

  @override
  String get cancelReasonOther => 'Other';

  @override
  String get releaseJobTitle => 'Return the job to dispatch';

  @override
  String get releaseJobSubtitle =>
      'The job goes to another partner and is not counted as a cancellation.';

  @override
  String get releaseJobReason => 'Why are you returning it?';

  @override
  String get releaseJobConfirm => 'Return the job';

  @override
  String get releaseJobDone => 'The job went back to dispatch.';

  @override
  String get podTitle => 'Proof of delivery';

  @override
  String get podSubtitle => 'Confirm that the package reached the recipient.';

  @override
  String podSubtitleNamed(String name) {
    return 'Confirm the package reached $name.';
  }

  @override
  String get podModeOtp => 'Delivery code';

  @override
  String get podModeManual => 'Signature and photo';

  @override
  String get podOtpHint =>
      'Ask the recipient for the delivery code shown in their app.';

  @override
  String get podReceiverName => 'Recipient name';

  @override
  String get podPhotoLabel => 'Delivery photo';

  @override
  String get podPhotoHint =>
      'One clear photo of the package where you left it.';

  @override
  String get podSignatureLabel => 'Recipient signature';

  @override
  String get podSignatureHint =>
      'Ask the recipient to sign inside the frame with their finger.';

  @override
  String get completeWorkTitle => 'Finish the work';

  @override
  String get completeWorkSubtitle =>
      'Document what you did before handing the job back to the customer.';

  @override
  String get completeWorkPhotos => 'Photos after the work';

  @override
  String get completeWorkPhotosHint =>
      'Clear photos of the result — they protect you if anything is disputed.';

  @override
  String get completeWorkApprovedTotal => 'Approved total';

  @override
  String get completeWorkCustomerConfirms =>
      'The customer confirms the work is done, then your earnings land in your balance.';

  @override
  String get completionTitle => 'Job done';

  @override
  String completionSubtitle(String number) {
    return 'Job $number';
  }

  @override
  String get completionAwaitingTitle => 'Awaiting the customer';

  @override
  String get completionAwaitingSubtitle =>
      'You finished the work. Earnings are added once the customer confirms.';

  @override
  String get completionCollectCash =>
      'Collect the amount from the customer in cash.';

  @override
  String get completionPaidElectronically =>
      'Already paid electronically — do not collect cash.';

  @override
  String get completionYourEarnings => 'Your earnings from this job';

  @override
  String get completionRateCustomer => 'Rate the customer';

  @override
  String get completionBackHome => 'Back to home';

  @override
  String get jobsTitle => 'Jobs';

  @override
  String get jobsFilterAll => 'All';

  @override
  String get jobsFilterActive => 'Active';

  @override
  String get jobsFilterCompleted => 'Completed';

  @override
  String get jobsFilterCancelled => 'Cancelled';

  @override
  String get jobsFilterByDate => 'Filter by date';

  @override
  String get jobsEmptyTitle => 'No jobs';

  @override
  String get jobsEmptyBody => 'Every job you complete shows up here.';

  @override
  String get jobDetailTitle => 'Job details';

  @override
  String get jobEarningsBreakdown => 'Earnings breakdown';

  @override
  String get jobNoBreakdown => 'No breakdown is available for this job.';

  @override
  String get jobTotalCharged => 'Total charged to the customer';

  @override
  String get jobRatingTitle => 'How the customer rated you';

  @override
  String get jobRatingUnavailable => 'The customer has not rated you yet.';

  @override
  String jobCancelledReason(String reason) {
    return 'Cancellation reason: $reason';
  }

  @override
  String get jobReportProblem => 'Report a problem';

  @override
  String get ratingTitle => 'Rate the customer';

  @override
  String get ratingPrompt => 'How was your experience with the customer?';

  @override
  String get ratingCustomer => 'The customer';

  @override
  String get ratingCommentOptional => 'Comments (optional)';

  @override
  String get ratingSubmit => 'Submit rating';

  @override
  String get ratingThanks => 'Thanks for your rating!';

  @override
  String get ratingTagPolite => 'Polite';

  @override
  String get ratingTagPunctual => 'On time';

  @override
  String get ratingTagClearAddress => 'Clear address';

  @override
  String get ratingTagEasyParking => 'Easy parking';

  @override
  String get ratingTagLate => 'Late';

  @override
  String get ratingTagRude => 'Rude';

  @override
  String get ratingTagWrongAddress => 'Wrong address';

  @override
  String get ratingTagExtraStops => 'Unagreed extra stops';

  @override
  String get chatTitle => 'Chat';

  @override
  String get chatHint => 'Write a message…';

  @override
  String get chatEmptyTitle => 'No messages yet';

  @override
  String get chatEmptyBody => 'Write a message to reach the customer.';

  @override
  String get chatLoadOlder => 'Show older messages';

  @override
  String get chatSendPhoto => 'Send a photo';

  @override
  String get chatSendLocation => 'Send location';

  @override
  String get chatSharedLocation => 'Location shared';

  @override
  String get quoteBuilderTitle => 'Quote';

  @override
  String get quoteBuilderChangeOrderTitle => 'Extra work';

  @override
  String get quoteItemsTitle => 'Line items';

  @override
  String get quoteAddItem => 'Add a line';

  @override
  String get quoteEditItem => 'Edit the line';

  @override
  String get quoteEmptyHint =>
      'Add at least one line before the quote can reach the customer.';

  @override
  String get quoteItemDescription => 'What is this line for?';

  @override
  String get quoteItemQuantity => 'Quantity';

  @override
  String get quoteItemUnitPrice => 'Unit price';

  @override
  String quoteLineTotal(String total) {
    return 'Line total: $total';
  }

  @override
  String get quoteKindLabor => 'Labour';

  @override
  String get quoteKindParts => 'Parts';

  @override
  String get quoteKindFee => 'Fees';

  @override
  String get quoteDiscount => 'Discount';

  @override
  String get quoteDiscountTooLarge =>
      'The discount is larger than the line items.';

  @override
  String get quoteDescriptionLabel => 'Notes for the customer';

  @override
  String get quoteDurationLabel => 'Estimated duration (minutes)';

  @override
  String get quoteDurationHint => 'Helps the customer plan their day.';

  @override
  String get quotePreviewTitle => 'Preview';

  @override
  String get quotePreviewTotal => 'Estimated total';

  @override
  String get quotePreviewDisclaimer =>
      'This preview is calculated on your device only. The server recalculates tax and final fees when you send it, and its figures are the ones that count.';

  @override
  String get quoteSubmit => 'Send the quote';

  @override
  String get quoteSubmitChangeOrder => 'Send the extra work';

  @override
  String get quoteSubmitted => 'The quote was sent to the customer.';

  @override
  String get quoteChangeOrderHint =>
      'Extra work is added to the approved quote once the customer accepts it.';

  @override
  String quoteRejectionNote(String note) {
    return 'The customer wrote: $note';
  }

  @override
  String get quoteVersionConflict =>
      'The quote changed elsewhere. Refresh and send it again.';

  @override
  String quoteTitle(int revision) {
    final intl.NumberFormat revisionNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String revisionString = revisionNumberFormat.format(revision);

    return 'Quote #$revisionString';
  }

  @override
  String quoteChangeOrderTitle(int revision) {
    final intl.NumberFormat revisionNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String revisionString = revisionNumberFormat.format(revision);

    return 'Extra work #$revisionString';
  }

  @override
  String get quoteTotal => 'Total';

  @override
  String get quoteTax => 'Tax';

  @override
  String quoteEstimatedDuration(String minutes) {
    return 'Estimated duration: $minutes min';
  }

  @override
  String get quoteStatusDraft => 'Draft';

  @override
  String get quoteStatusSubmitted => 'Awaiting the customer';

  @override
  String get quoteStatusApproved => 'Approved';

  @override
  String get quoteStatusRejected => 'Rejected';

  @override
  String get quoteStatusCancelled => 'Cancelled';

  @override
  String get quoteStatusSuperseded => 'Replaced by a newer quote';

  @override
  String get earningsTitle => 'Earnings';

  @override
  String get earningsToday => 'Today';

  @override
  String get earningsWeek => 'This week';

  @override
  String get earningsMonth => 'This month';

  @override
  String earningsCompletedJobs(String count) {
    return '$count completed jobs';
  }

  @override
  String get earningsGross => 'Gross earnings';

  @override
  String get earningsCommission => 'TAMAM commission';

  @override
  String get earningsBonuses => 'Bonuses';

  @override
  String get earningsAdjustments => 'Adjustments';

  @override
  String get earningsNet => 'Your net earnings';

  @override
  String get earningsWithdrawals => 'Withdrawals';

  @override
  String get earningsBalance => 'Available balance';

  @override
  String get statementTitle => 'Statement';

  @override
  String get statementEmptyTitle => 'No entries';

  @override
  String get statementEmptyBody =>
      'Every movement on your wallet shows up here.';

  @override
  String statementBalanceAfter(String balance) {
    return 'Balance after: $balance';
  }

  @override
  String get withdrawTitle => 'Withdraw';

  @override
  String withdrawAvailable(String amount) {
    return 'Available to withdraw: $amount';
  }

  @override
  String get withdrawAmount => 'Amount';

  @override
  String get withdrawAmountInvalid => 'Enter a valid amount.';

  @override
  String get withdrawAll => 'Withdraw all';

  @override
  String get withdrawToAccount => 'To the bank account';

  @override
  String get withdrawConfirm => 'Confirm withdrawal';

  @override
  String get withdrawProcessingHint =>
      'Withdrawals are reviewed on working days; the transfer arrives after approval.';

  @override
  String get withdrawRequested => 'Your withdrawal request was sent.';

  @override
  String get withdrawalsTitle => 'Withdrawals';

  @override
  String get withdrawalsEmptyTitle => 'No withdrawals';

  @override
  String get withdrawalsEmptyBody =>
      'Your withdrawal requests and their status appear here.';

  @override
  String withdrawalFee(String fee) {
    return 'Transfer fee: $fee';
  }

  @override
  String get withdrawalStatusRequested => 'Under review';

  @override
  String get withdrawalStatusApproved => 'Approved';

  @override
  String get withdrawalStatusPaid => 'Paid';

  @override
  String get withdrawalStatusRejected => 'Rejected';

  @override
  String get bankAccountAdd => 'Add a bank account';

  @override
  String get bankAccountHint =>
      'The account must be in your own name, as it appears on your ID.';

  @override
  String get bankAccountHolder => 'Account holder name';

  @override
  String get bankAccountBankName => 'Bank name';

  @override
  String get bankAccountIban => 'IBAN';

  @override
  String get onboardingStepPersonal => 'Your details';

  @override
  String get onboardingStepRoles => 'What you do';

  @override
  String get onboardingStepSkills => 'Your skills';

  @override
  String get onboardingStepDocuments => 'Documents';

  @override
  String get onboardingStepVehicle => 'Vehicle';

  @override
  String get onboardingStepZones => 'Working zones';

  @override
  String get onboardingStepReview => 'Review';

  @override
  String onboardingStepCounter(int step, int total) {
    final intl.NumberFormat stepNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String stepString = stepNumberFormat.format(step);
    final intl.NumberFormat totalNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String totalString = totalNumberFormat.format(total);

    return 'Step $stepString of $totalString';
  }

  @override
  String get onboardingFullName => 'Full name';

  @override
  String get onboardingDateOfBirth => 'Date of birth';

  @override
  String get onboardingDateOfBirthHint => 'Pick your date of birth';

  @override
  String get onboardingNationalId => 'National ID number';

  @override
  String get onboardingCity => 'City';

  @override
  String get onboardingEmailOptional => 'E-mail (optional)';

  @override
  String get onboardingPhotoHint =>
      'A clear headshot on a light background — the customer sees it when you arrive.';

  @override
  String get onboardingRolesHint =>
      'Pick everything you plan to do. You can change this later in your preferences.';

  @override
  String get onboardingSkillsHint =>
      'Choose the services you are good at so you only get suitable work.';

  @override
  String get onboardingSkillsLabel => 'Skill';

  @override
  String get onboardingSkillsHelper =>
      'Type a skill and add it (for example: pipework).';

  @override
  String get onboardingYearsOfExperience => 'Years of experience';

  @override
  String get onboardingNoCategories => 'No categories are available right now';

  @override
  String get onboardingDocumentsHint =>
      'Upload clear, fully visible documents. They are reviewed within one working day.';

  @override
  String get onboardingDocumentsComplete => 'All required documents are in.';

  @override
  String get onboardingDocumentsPending =>
      'Some required documents are still missing.';

  @override
  String get onboardingVehicleHint =>
      'Add the vehicle you will work with. You can add more later.';

  @override
  String get onboardingZonesHint =>
      'Pick the areas where you want to receive jobs.';

  @override
  String get onboardingNoZones => 'No zones are available right now';

  @override
  String get onboardingReviewHint =>
      'Check your details before sending — you can edit any step.';

  @override
  String get onboardingReviewIncomplete =>
      'Complete the earlier steps to see the summary.';

  @override
  String get onboardingAcceptTerms =>
      'I accept the Partner Terms and the Privacy Policy.';

  @override
  String get onboardingReadTerms => 'Read the terms';

  @override
  String get onboardingSubmit => 'Submit for review';

  @override
  String get documentNotUploaded => 'Not uploaded';

  @override
  String get onboardingStatusTitle => 'Your application';

  @override
  String get onboardingDraftTitle => 'Your application is not finished';

  @override
  String get onboardingDraftBody =>
      'Finish the remaining steps, then send the application for review.';

  @override
  String get onboardingUnderReviewTitle => 'Under review';

  @override
  String get onboardingUnderReviewBody =>
      'We are checking your details and documents. We will let you know by notification and SMS within one working day.';

  @override
  String get onboardingApprovedTitle => 'You are approved';

  @override
  String get onboardingApprovedBody =>
      'Welcome to TAMAM. You can go online and start receiving jobs.';

  @override
  String get onboardingRejectedTitle => 'Your application needs changes';

  @override
  String get onboardingRejectedBody =>
      'Fix the points below, then send it again.';

  @override
  String get onboardingRejectedWhatToFix => 'What to fix';

  @override
  String get onboardingRejectedNoDocumentDetail =>
      'The reviewer did not give a specific reason. Contact support for details.';

  @override
  String get onboardingResubmit => 'Send it again';

  @override
  String get onboardingSuspendedTitle => 'Your account is suspended';

  @override
  String get onboardingSuspendedBody =>
      'Contact support to find out why and how to reactivate.';

  @override
  String get onboardingContactSupport => 'Contact support';

  @override
  String get onboardingReviewProgress => 'Review progress';

  @override
  String onboardingDocumentsApproved(int approved, int total) {
    final intl.NumberFormat approvedNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String approvedString = approvedNumberFormat.format(approved);
    final intl.NumberFormat totalNumberFormat =
        intl.NumberFormat.decimalPattern(localeName);
    final String totalString = totalNumberFormat.format(total);

    return '$approvedString of $totalString documents approved';
  }

  @override
  String onboardingSubmittedOn(String date) {
    return 'Submitted on $date';
  }

  @override
  String get onboardingFixRejection => 'Fix this step, then continue.';

  @override
  String get onboardingSeeReasons => 'See the reasons';

  @override
  String get documentsTitle => 'My documents';

  @override
  String get documentsRequired => 'Required documents';

  @override
  String get documentsOther => 'Other documents';

  @override
  String get documentsReviewHint =>
      'Documents are reviewed within one working day. We will tell you about any change.';

  @override
  String get documentsBlockingWarning =>
      'You cannot go online until every required document is approved and valid.';

  @override
  String get documentUpload => 'Upload';

  @override
  String get documentReupload => 'Upload again';

  @override
  String get documentUploadHint =>
      'Photograph the whole document clearly, or upload a PDF.';

  @override
  String get documentUploadFailed => 'The upload failed. Please try again.';

  @override
  String get documentUploaded => 'Document uploaded.';

  @override
  String get documentNumber => 'Document number';

  @override
  String get documentExpiryDate => 'Expiry date';

  @override
  String get documentExpiryHint => 'Pick the expiry date';

  @override
  String documentExpiresOn(String date) {
    return 'Expires on $date';
  }

  @override
  String documentRejectionReason(String reason) {
    return 'Rejected because: $reason';
  }

  @override
  String get documentStatusPending => 'Under review';

  @override
  String get documentStatusApproved => 'Approved';

  @override
  String get documentStatusRejected => 'Rejected';

  @override
  String get documentStatusExpired => 'Expired';

  @override
  String get documentId => 'National ID';

  @override
  String get documentDrivingLicense => 'Driving licence';

  @override
  String get documentVehicleLicense => 'Vehicle licence';

  @override
  String get documentInsurance => 'Insurance';

  @override
  String get documentProfessionalCertificate => 'Professional certificate';

  @override
  String get documentBusiness => 'Business registration';

  @override
  String get documentProfilePicture => 'Profile photo';

  @override
  String get vehiclesTitle => 'My vehicles';

  @override
  String get vehiclesAdd => 'Add a vehicle';

  @override
  String get vehiclesEmptyTitle => 'No vehicles';

  @override
  String get vehiclesEmptyBody =>
      'Add your vehicle so it can be approved before you start working.';

  @override
  String get vehicleDetailTitle => 'Vehicle details';

  @override
  String get vehicleType => 'Vehicle type';

  @override
  String get vehicleBrand => 'Make';

  @override
  String get vehicleModel => 'Model';

  @override
  String get vehicleYear => 'Year';

  @override
  String get vehicleColor => 'Colour';

  @override
  String get vehiclePlate => 'Plate number';

  @override
  String get vehicleSeats => 'Seats';

  @override
  String get vehiclePhotos => 'Vehicle photos';

  @override
  String get vehiclePhotosHint =>
      'At least one front view and one of the number plate.';

  @override
  String get vehicleDocuments => 'Vehicle documents';

  @override
  String get vehicleActive => 'Active vehicle';

  @override
  String get vehicleIsActive => 'This is the vehicle you are working with.';

  @override
  String get vehicleActivate => 'Make this the active one';

  @override
  String vehicleActivated(String vehicle) {
    return '$vehicle is now your active vehicle.';
  }

  @override
  String get vehicleNotActivatable =>
      'A vehicle cannot be activated before it is approved.';

  @override
  String get vehicleReviewNotice =>
      'A new vehicle is reviewed before you can work with it.';

  @override
  String get vehicleSubmittedForReview => 'The vehicle was sent for review.';

  @override
  String get vehicleStatusPending => 'Under review';

  @override
  String get vehicleStatusApproved => 'Approved';

  @override
  String get vehicleStatusRejected => 'Rejected';

  @override
  String get vehicleStatusSuspended => 'Suspended';

  @override
  String get accountTitle => 'Account';

  @override
  String get accountNoName => 'Add your name';

  @override
  String get accountApproved => 'Approved partner';

  @override
  String get accountNotApproved => 'Under review';

  @override
  String get accountGroupWork => 'Work';

  @override
  String get accountGroupActivity => 'Activity';

  @override
  String get accountGroupSettings => 'Settings';

  @override
  String get accountGroupHelp => 'Help and safety';

  @override
  String get accountSignOut => 'Sign out';

  @override
  String get accountSignOutConfirm =>
      'You will be set offline and tracking on this device will stop.';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profilePhone => 'Phone number';

  @override
  String get profilePhoneLocked => 'Contact support to change your number.';

  @override
  String get profileEmail => 'E-mail';

  @override
  String get profileSaved => 'Changes saved';

  @override
  String get workPreferencesTitle => 'Work preferences';

  @override
  String get workPreferencesActiveRoles => 'Active roles';

  @override
  String get workPreferencesActiveRolesHint =>
      'Choose what you want to receive this shift, from the roles you are approved for.';

  @override
  String get workPreferencesRolesApplyNextShift =>
      'This choice applies on this device from your next shift.';

  @override
  String get workPreferencesZones => 'Working zones';

  @override
  String get workPreferencesZonesHint => 'The areas where jobs reach you.';

  @override
  String get workPreferencesCategories => 'Services';

  @override
  String get workPreferencesCategoriesHint =>
      'The services approved on your profile.';

  @override
  String get workPreferencesCategoriesReviewNotice =>
      'Adding a new service may need a review and extra documents.';

  @override
  String get workPreferencesSaved => 'Your preferences were saved';

  @override
  String get preferencesTitle => 'Preferences';

  @override
  String get preferencesLanguage => 'Language';

  @override
  String get preferencesAppearance => 'Appearance';

  @override
  String get preferencesNotificationsMovedHint =>
      'Notification settings now live on their own page.';

  @override
  String get themeSystem => 'System';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String get notificationSettingsTitle => 'Notification settings';

  @override
  String get notificationSettingsOffersAlwaysOn =>
      'Job-offer alerts stay on during a shift — without them, jobs cannot reach you.';

  @override
  String get preferencesPush => 'Push notifications';

  @override
  String get preferencesPushHint => 'Job and earnings updates.';

  @override
  String get preferencesSms => 'SMS';

  @override
  String get preferencesEmail => 'E-mail';

  @override
  String get preferencesMarketing => 'Marketing offers';

  @override
  String get preferencesMarketingHint => 'Only incentives and bonuses.';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsEmptyTitle => 'No notifications';

  @override
  String get notificationsEmptyBody =>
      'We will tell you here about your jobs and earnings.';

  @override
  String get notificationsMarkAllRead => 'Mark all read';

  @override
  String get sessionsTitle => 'Active devices';

  @override
  String get sessionsEmptyTitle => 'No other devices';

  @override
  String get sessionsThisDevice => 'This device';

  @override
  String sessionsLastSeen(String when) {
    return 'Last active $when';
  }

  @override
  String get sessionsRevoke => 'End session';

  @override
  String get sessionsSignOutAll => 'Sign out everywhere';

  @override
  String get sessionsSignOutAllConfirm =>
      'Every session ends, including this device.';

  @override
  String get legalTitle => 'Terms and privacy';

  @override
  String get legalTermsTitle => 'Partner terms';

  @override
  String get legalTermsBody =>
      'Working with TAMAM means giving accurate details, keeping your documents valid, treating customers with respect, and completing the jobs you accept. TAMAM commission is taken on every completed job at the rate published on this page, and repeated cancellations or refusals can reduce the offers you receive.';

  @override
  String get legalCommissionTitle => 'Commission and earnings';

  @override
  String get legalCommissionBody =>
      'Your earnings are the job total minus the TAMAM commission and any published fees. They are added to your balance as soon as the job completes and the customer confirms, and you can withdraw them to your bank account at any time above the minimum withdrawal amount.';

  @override
  String get legalTrackingTitle => 'Location tracking';

  @override
  String get legalTrackingBody =>
      'Your location is recorded only while you are online, and recording stops the moment you go offline or the permission is revoked. We use it to send you the nearest jobs, show the customer that you are arriving, and settle disputes. We do not share your location with third parties for marketing.';

  @override
  String get legalPrivacyTitle => 'Privacy';

  @override
  String get legalPrivacyBody =>
      'We keep your details and documents for as long as the law requires, and only for verification and accounting. The customer sees your first name, photo, rating and vehicle details; your phone number is not shown directly when number masking is on.';

  @override
  String legalTermsVersion(String version) {
    return 'Terms version $version';
  }

  @override
  String get legalDeleteAccount => 'Request account deletion';

  @override
  String get legalDeleteAccountHint => 'Opens a support request for review.';

  @override
  String get legalDeleteAccountConfirm =>
      'We will open a support request to delete your account. Outstanding earnings are settled first, and job and invoicing records may be kept as the law requires.';

  @override
  String get legalDeleteAccountCta => 'Send request';

  @override
  String get legalDeleteAccountSubject => 'Partner account deletion request';

  @override
  String get legalDeleteAccountBody =>
      'I would like my TAMAM partner account and personal data deleted.';

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
  String get supportEmptyTitle => 'No support requests';

  @override
  String get supportEmptyBody => 'Open a request if you need help.';

  @override
  String get supportTicketTitle => 'Support request';

  @override
  String get supportReplyHint => 'Write a reply…';

  @override
  String get ticketCategoryJob => 'Job issue';

  @override
  String get ticketCategoryPayment => 'Earnings and payment';

  @override
  String get ticketCategoryAccount => 'Account and documents';

  @override
  String get ticketCategoryCustomer => 'Customer behaviour';

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
  String get mediaAttachPhotos => 'Attach photos';

  @override
  String get mediaCamera => 'Camera';

  @override
  String get mediaGallery => 'Gallery';

  @override
  String get bannerLeaveAppTitle => 'Open an external link';

  @override
  String bannerLeaveAppMessage(String host) {
    return '$host will open outside the app.';
  }

  @override
  String bannerPromoCopied(String code) {
    return 'Code $code copied.';
  }

  @override
  String get chaletOwnerTitle => 'My chalets';

  @override
  String get chaletOwnerEmpty => 'No chalets';

  @override
  String get chaletOwnerEmptyBody => 'Chalets you manage will appear here.';

  @override
  String get chaletOwnerPending => 'Awaiting approval';

  @override
  String get chaletOwnerRejected => 'Rejected';

  @override
  String get chaletOwnerLive => 'Bookable';

  @override
  String get chaletOwnerPaused => 'Paused';

  @override
  String get chaletOccupancy => 'Occupancy';

  @override
  String chaletOccupancyValue(int percent) {
    return '$percent%';
  }

  @override
  String get chaletRevenue => 'Revenue';

  @override
  String get chaletBookingsCount => 'Bookings';

  @override
  String get chaletCancelledCount => 'Cancellations';

  @override
  String get chaletAverageRate => 'Average hourly rate';

  @override
  String chaletQuietestDay(String day) {
    return 'Quietest day: $day';
  }

  @override
  String get chaletByWeekday => 'Occupancy by day';

  @override
  String get chaletByHour => 'Occupancy by hour';

  @override
  String get chaletGapsTitle => 'Gaps between bookings';

  @override
  String get chaletGapsEmpty => 'No gaps today';

  @override
  String get chaletGapsBody =>
      'A gap is empty time boxed in between two bookings — hard to sell at the full rate.';

  @override
  String chaletGapDuration(int minutes) {
    return '$minutes minutes empty';
  }

  @override
  String get chaletBookingsTitle => 'Bookings';

  @override
  String get chaletBookingsEmpty => 'No bookings yet';

  @override
  String get chaletSourceTamam => 'Through TAMAM';

  @override
  String get chaletSourceManual => 'You recorded it';

  @override
  String get chaletAddExternal => 'Record a phone booking';

  @override
  String get chaletAddExternalBody =>
      'A booking you take by phone occupies the calendar exactly like a TAMAM one, so this stays the only calendar you keep.';

  @override
  String get chaletGuestName => 'Guest name';

  @override
  String get chaletGuestPhone => 'Guest phone';

  @override
  String get chaletAutomationTitle => 'How it sells';

  @override
  String get chaletSmartPricing => 'Smart Pricing';

  @override
  String get chaletSmartPricingBody =>
      'Moves the rate with how full your calendar is. Never below the minimum you set.';

  @override
  String get chaletGapFiller => 'Gap offers';

  @override
  String get chaletGapFillerBody =>
      'Offers the hours boxed in between two bookings at a reduced rate.';

  @override
  String get chaletLastMinute => 'Last-minute offers';

  @override
  String get chaletLastMinuteBody =>
      'Discounts hours that start soon and are still empty.';

  @override
  String get chaletInstantBookingSetting => 'Instant booking';

  @override
  String get chaletInstantBookingBody =>
      'Lets a guest confirm without waiting for you.';

  @override
  String chaletFloorNotice(String rate) {
    return 'Your minimum rate: $rate';
  }

  @override
  String get chaletSave => 'Save';
}
