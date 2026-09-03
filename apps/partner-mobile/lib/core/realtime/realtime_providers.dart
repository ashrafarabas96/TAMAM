import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/realtime/socket_client.dart';
import 'package:tamam_partner/core/storage/secure_token_store.dart';

/// Extra `/tracking` events the gateway sends only to partners.
abstract final class PartnerWsEvent {
  /// `{ intervalSeconds }` — pushed on connect and whenever the operator
  /// retunes tracking; the work session adopts it for its upload cadence.
  static const String trackingConfig = 'tracking:config';
}

/// The `/tracking` namespace: job offers, job status, ETA and the upload
/// cadence, plus the channel this app *publishes* location batches on.
///
/// One socket for the whole app; it is connected while a session exists and
/// torn down on sign-out.
final Provider<SocketClient> trackingSocketProvider = Provider<SocketClient>((Ref ref) {
  final SecureTokenStore store = ref.watch(secureTokenStoreProvider);
  final SocketClient client = SocketClient(
    baseUrl: ref.watch(appEnvProvider).socketBaseUrl,
    namespace: WsNamespace.tracking,
    accessToken: () async => (await store.read())?.accessToken,
    listenTo: <String>[
      WsEvent.jobOffer,
      WsEvent.jobOfferExpired,
      WsEvent.jobStatus,
      WsEvent.jobEta,
      PartnerWsEvent.trackingConfig,
      WsEvent.error,
    ],
  );
  ref.onDispose(client.dispose);
  return client;
});

/// The `/chat` namespace: in-job messaging with the customer.
final Provider<SocketClient> chatSocketProvider = Provider<SocketClient>((Ref ref) {
  final SecureTokenStore store = ref.watch(secureTokenStoreProvider);
  final SocketClient client = SocketClient(
    baseUrl: ref.watch(appEnvProvider).socketBaseUrl,
    namespace: WsNamespace.chat,
    accessToken: () async => (await store.read())?.accessToken,
    listenTo: <String>[
      WsEvent.chatMessage,
      WsEvent.chatDelivery,
      WsEvent.error,
    ],
  );
  ref.onDispose(client.dispose);
  return client;
});
