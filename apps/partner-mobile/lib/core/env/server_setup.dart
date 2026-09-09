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

/// What the phone found at an address. Each outcome has a different fix, and
/// "could not connect" told a person none of them.
enum ServerProbe {
  /// `/health/live` answered 200 with a JSON body.
  ok,

  /// The address is not something a phone can open at all.
  badAddress,

  /// Nothing answered within the timeout. On a test stack this is almost
  /// always the Windows firewall, a different Wi-Fi, or the wrong adapter's IP.
  timeout,

  /// The computer answered but nothing listens on that port: the stack is down.
  refused,

  /// Something answered, but it is not TAMAM (a router page, another service).
  notTamam,
}

/// Probes `<origin>/health/live` and says what was found there.
Future<ServerProbe> probeServerDetailed(String apiBaseUrl) async {
  final Uri? uri = Uri.tryParse(apiBaseUrl);
  if (uri == null || uri.host.isEmpty) return ServerProbe.badAddress;
  final String origin = '${uri.scheme}://${uri.host}:${uri.port}';
  try {
    final Response<dynamic> response = await Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
        validateStatus: (int? _) => true,
      ),
    ).get<dynamic>('$origin/health/live');
    final dynamic body = response.data;
    final bool looksLikeTamam = body is Map && body['status'] != null ||
        (body is String && body.contains('"status"'));
    return response.statusCode == 200 && looksLikeTamam
        ? ServerProbe.ok
        : ServerProbe.notTamam;
  } on DioException catch (error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return ServerProbe.timeout;
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        final String reason = '${error.error ?? error.message}'.toLowerCase();
        return reason.contains('refused')
            ? ServerProbe.refused
            : ServerProbe.timeout;
      // ignore: no_default_cases
      default:
        return ServerProbe.notTamam;
    }
  } on Object {
    return ServerProbe.timeout;
  }
}

/// True when `<origin>/health/live` answers 200 within a few seconds.
Future<bool> probeServer(String apiBaseUrl) async =>
    await probeServerDetailed(apiBaseUrl) == ServerProbe.ok;

/// The message shown for each failed probe: what happened, then what to do,
/// most likely cause first. [testUrl] is the address to try in a browser.
String describeProbeFailure(ServerProbe probe, String testUrl) {
  switch (probe) {
    case ServerProbe.ok:
      return '';
    case ServerProbe.badAddress:
      return 'هذا ليس عنواناً صحيحاً. اكتب الأرقام كما تظهر في سطر IPv4 Address، مثل 192.168.1.20.';
    case ServerProbe.timeout:
      return 'الهاتف لم يجد الحاسوب على هذا العنوان.\n\n'
          'الأسباب المعتادة بالترتيب:\n'
          '١. جدار حماية ويندوز يمنع الاتصال: على الحاسوب شغّل الملف OPEN-FOR-PHONE.bat مرة واحدة.\n'
          '٢. الهاتف على شبكة مختلفة: أغلق بيانات الجوال، ولا تستخدم شبكة الضيوف.\n'
          '٣. العنوان ليس عنوان الواي فاي: في ipconfig اختر السطر تحت Wi-Fi، لا vEthernet أو WSL.\n\n'
          'للتجربة افتح في متصفح الهاتف:\n$testUrl';
    case ServerProbe.refused:
      return 'وصلت إلى الحاسوب لكن النظام لا يعمل عليه الآن.\n'
          'شغّل START-WINDOWS.bat وانتظر رسالة "TAMAM is running" ثم اضغط اتصال مرة أخرى.';
    case ServerProbe.notTamam:
      return 'هذا العنوان يجيب لكنه ليس نظام TAMAM. تأكد أنه عنوان الحاسوب الذي يعمل عليه النظام '
          'وأن المنفذ 3000، ثم جرّب في متصفح الهاتف:\n$testUrl';
  }
}

/// The browser-openable address behind an API base URL.
String healthUrlOf(String apiBaseUrl) {
  final Uri? uri = Uri.tryParse(apiBaseUrl);
  if (uri == null || uri.host.isEmpty) return '';
  return '${uri.scheme}://${uri.host}:${uri.port}/health/live';
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
    final ServerProbe probe = await probeServerDetailed(url);
    if (!mounted) return;
    if (probe != ServerProbe.ok) {
      setState(() {
        _busy = false;
        _error = describeProbeFailure(probe, healthUrlOf(url));
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
        // The brand primary. This screen runs before the app's own theme
        // exists, so the value is spelled out here rather than imported.
        colorSchemeSeed: const Color(0xFF5B32F6),
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
                        SelectableText(
                          _error!,
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              height: 1.5),
                          textAlign: TextAlign.start,
                        ),
                      ],
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _busy ? null : _connect,
                        child: _busy
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
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
