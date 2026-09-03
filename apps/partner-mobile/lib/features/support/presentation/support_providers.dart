import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/support/data/support_repository.dart';

final Provider<SupportRepository> supportRepositoryProvider =
    Provider<SupportRepository>((Ref ref) => SupportRepository(ref.watch(apiClientProvider)));

final FutureProvider<List<SupportTicket>> supportTicketsProvider =
    FutureProvider<List<SupportTicket>>((Ref ref) async {
  final CursorPage<SupportTicket> page = await ref.watch(supportRepositoryProvider).tickets();
  return page.items;
});

final FutureProviderFamily<SupportTicket, String> supportTicketProvider =
    FutureProvider.family<SupportTicket, String>(
  (Ref ref, String id) => ref.watch(supportRepositoryProvider).ticket(id),
);

final FutureProvider<List<Dispute>> disputesProvider = FutureProvider<List<Dispute>>((Ref ref) async {
  final CursorPage<Dispute> page = await ref.watch(supportRepositoryProvider).disputes();
  return page.items;
});

final FutureProviderFamily<Dispute, String> disputeProvider = FutureProvider.family<Dispute, String>(
  (Ref ref, String id) => ref.watch(supportRepositoryProvider).dispute(id),
);
