import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/realtime/socket_client.dart';
import 'package:tamam_customer/core/storage/secure_token_store.dart';

/// The `/tracking` namespace: job status, partner position and ETA.
///
/// One socket for the whole app; screens join and leave `job:<id>` rooms.
final Provider<SocketClient> trackingSocketProvider = Provider<SocketClient>((Ref ref) {
  final SecureTokenStore store = ref.watch(secureTokenStoreProvider);
  final SocketClient client = SocketClient(
    baseUrl: ref.watch(appEnvProvider).socketBaseUrl,
    namespace: WsNamespace.tracking,
    accessToken: () async => (await store.read())?.accessToken,
    listenTo: <String>[
      WsEvent.jobStatus,
      WsEvent.jobLocation,
      WsEvent.jobEta,
      WsEvent.error,
    ],
  );
  ref.onDispose(client.dispose);
  return client;
});

/// The `/chat` namespace: in-job messaging.
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
