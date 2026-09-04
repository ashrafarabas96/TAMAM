import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Where the API lives, chosen on the device instead of at build time.
///
/// A test build installed on a real phone cannot know the address of the
/// laptop running the stack -- it changes with every network. So the address is
/// asked for once, verified against `/health/live`, and kept in preferences.
/// If it later stops answering (a new Wi-Fi, a new DHCP lease) the app asks
/// again rather than failing with an opaque network error.
const String kServerBaseUrlKey = 'tamam.serverBaseUrl';

/// Returns a saved address that is answering right now, or null when the app
/// should show [ServerSetupApp] first.
Future<String?> resolveServerBaseUrl(SharedPreferences prefs) async {
  final String? saved = prefs.getString(kServerBaseUrlKey);
  if (saved == null || saved.isEmpty) return null;
  return await probeServer(saved) ? saved : null;
}

/// Turns whatever the user typed into a full API base URL.
///
/// Accepts `192.168.1.20`, `192.168.1.20:3000` or a complete URL, so a person
/// reading an IP off an ipconfig screen cannot really get it wrong.
String normaliseServerInput(String raw) {
  String value = raw.trim();
  if (value.isEmpty) return value;
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    value = 'http://$value';
  }
  Uri? uri = Uri.tryParse(value);
  if (uri == null || uri.host.isEmpty) return value;
  // Only an address with no port of its own gets 3000, and only over http --
  // someone who pastes an https URL means its default port, not the dev one.
  if (!uri.hasPort && uri.scheme == 'http') uri = uri.replace(port: 3000);
  final String authority = uri.hasPort ? '${uri.host}:${uri.port}' : uri.host;
  return '${uri.scheme}://$authority/api/v1';
}

/// True when `<origin>/health/live` answers 200 within a few seconds.
Future<bool> probeServer(String apiBaseUrl) async {
  final Uri? uri = Uri.tryParse(apiBaseUrl);
  if (uri == null) return false;
  final String origin = '${uri.scheme}://${uri.host}:${uri.port}';
  try {
    final Response<dynamic> response = await Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 4),
        validateStatus: (int? _) => true,
      ),
    ).get<dynamic>('$origin/health/live');
    return response.statusCode == 200;
  } on Object {
    return false;
  }
}

/// The one screen shown before anything else when no server is known.
class ServerSetupApp extends StatefulWidget {
  const ServerSetupApp({
    required this.prefs,
    required this.onReady,
    this.previous,
    super.key,
  });

  final SharedPreferences prefs;

  /// Called with the verified API base URL once the person taps continue.
  final ValueChanged<String> onReady;

  /// A previously saved address that stopped answering, offered as a starting point.
  final String? previous;

  @override
  State<ServerSetupApp> createState() => _ServerSetupAppState();
}

class _ServerSetupAppState extends State<ServerSetupApp> {
  late final TextEditingController _controller = TextEditingController(
    text: _hostOf(widget.previous) ?? '',
  );
  bool _busy = false;
  String? _error;

  static String? _hostOf(String? apiBaseUrl) {
    if (apiBaseUrl == null) return null;
    final Uri? uri = Uri.tryParse(apiBaseUrl);
    return uri == null || uri.host.isEmpty ? null : uri.host;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    final String url = normaliseServerInput(_controller.text);
    if (url.isEmpty) {
      setState(() => _error = 'اكتب عنوان الحاسوب أولاً');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final bool reachable = await probeServer(url);
    if (!mounted) return;
    if (!reachable) {
      setState(() {
        _busy = false;
        _error = 'لم أصل إلى الخادم على هذا العنوان. تأكّد أن الهاتف والحاسوب '
            'على نفس شبكة الواي فاي، وأن النظام يعمل على الحاسوب.';
      });
      return;
    }
    await widget.prefs.setString(kServerBaseUrlKey, url);
    if (!mounted) return;
    widget.onReady(url);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF0F766E),
      ),
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Text(
                        'الاتصال بالنظام',
                        style: Theme.of(context).textTheme.headlineSmall,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        widget.previous == null
                            ? 'اكتب عنوان الحاسوب الذي يعمل عليه النظام. '
                                'تجده بكتابة ipconfig في موجّه الأوامر — السطر IPv4 Address.'
                            : 'العنوان المحفوظ لم يعد يستجيب. ربما تغيّرت الشبكة. اكتبه من جديد.',
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      Directionality(
                        textDirection: TextDirection.ltr,
                        child: TextField(
                          controller: _controller,
                          autofocus: true,
                          keyboardType: TextInputType.url,
                          textAlign: TextAlign.center,
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            hintText: '192.168.1.20',
                            labelText: 'IP',
                          ),
                          onSubmitted: (String _) => _busy ? null : _connect(),
                        ),
                      ),
                      if (_error != null) ...<Widget>[
                        const SizedBox(height: 16),
                        Text(
                          _error!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error),
                          textAlign: TextAlign.center,
                        ),
                      ],
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _busy ? null : _connect,
                        child: _busy
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('اتصال'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
