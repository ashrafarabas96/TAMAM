import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/session/session_state.dart';
import 'package:tamam_partner/features/account/data/partner_repository.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';

final Provider<PartnerRepository> partnerRepositoryProvider =
    Provider<PartnerRepository>((Ref ref) => PartnerRepository(ref.watch(apiClientProvider)));

/// The full partner profile (`GET /partners/me`).
///
/// Re-fetched whenever the session user changes (sign-in, approval), and
/// invalidated explicitly after every onboarding step, document upload or
/// vehicle change so the home warnings and the wizard never show stale data.
final FutureProvider<PartnerProfile> partnerProfileProvider = FutureProvider<PartnerProfile>((Ref ref) {
  ref.watch(sessionControllerProvider.select((SessionState s) => s.user?.id));
  return ref.watch(partnerRepositoryProvider).me();
});

final FutureProvider<List<PartnerDocument>> partnerDocumentsProvider =
    FutureProvider<List<PartnerDocument>>((Ref ref) => ref.watch(partnerRepositoryProvider).documents());

final FutureProvider<List<BankAccount>> bankAccountsProvider =
    FutureProvider<List<BankAccount>>((Ref ref) => ref.watch(partnerRepositoryProvider).bankAccounts());
