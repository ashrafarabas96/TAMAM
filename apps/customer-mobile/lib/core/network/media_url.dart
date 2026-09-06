import 'package:tamam_customer/core/env/app_env.dart';

/// Rewrites media URLs that point at a host only the API machine can reach.
///
/// The API mints public media URLs from `S3_PUBLIC_BASE_URL`, which in a local
/// stack is `http://localhost:9000/tamam-public`. That is correct from the
/// server's own shell and meaningless on a phone: `localhost` there is the
/// phone. Banner creatives, chalet photos and avatars all resolved to nothing.
///
/// In production this never fires — a CDN host is not a loopback address, so the
/// URL is returned untouched. It only rescues the local-testing case, where the
/// app already knows a reachable address for the same machine: the one the API
/// itself is being served from.
const Set<String> _localHosts = <String>{
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '10.0.2.2', // the Android emulator's alias for its host
  'host.docker.internal',
  'minio',    // the compose service name, reachable only inside the network
};

String resolveMediaUrl(String rawUrl, AppEnv env) {
  if (rawUrl.isEmpty) return rawUrl;

  final Uri? media = Uri.tryParse(rawUrl);
  if (media == null || !media.hasScheme || media.host.isEmpty) return rawUrl;
  if (!_localHosts.contains(media.host)) return rawUrl;

  final Uri? api = Uri.tryParse(env.apiBaseUrl);
  if (api == null || api.host.isEmpty) return rawUrl;
  // Already pointing at the machine we talk to: nothing to gain by rewriting.
  if (api.host == media.host) return rawUrl;

  // Keep the media port — object storage is on a different port from the API —
  // and swap only the host, which is the part that was unreachable.
  return media.replace(scheme: api.scheme, host: api.host).toString();
}
