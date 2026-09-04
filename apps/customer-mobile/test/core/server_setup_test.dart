import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/env/server_setup.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('normaliseServerInput', () {
    test('turns a bare IP into a full API base URL on the dev port', () {
      expect(
        normaliseServerInput('192.168.1.20'),
        'http://192.168.1.20:3000/api/v1',
      );
    });

    test('keeps a port the person typed', () {
      expect(
        normaliseServerInput('192.168.1.20:8080'),
        'http://192.168.1.20:8080/api/v1',
      );
    });

    test('accepts a complete URL unchanged', () {
      expect(
        normaliseServerInput('http://10.0.0.5:3000/api/v1'),
        'http://10.0.0.5:3000/api/v1',
      );
    });

    test('leaves an https host on its own default port, not the dev one', () {
      expect(
        normaliseServerInput('https://api.tamam.app'),
        'https://api.tamam.app/api/v1',
      );
    });

    test('ignores surrounding whitespace', () {
      expect(
        normaliseServerInput('  192.168.1.20  '),
        'http://192.168.1.20:3000/api/v1',
      );
    });

    test('returns empty for empty input rather than inventing a URL', () {
      expect(normaliseServerInput('   '), '');
    });
  });

  group('resolveServerBaseUrl', () {
    test('returns null when nothing has been saved', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      expect(await resolveServerBaseUrl(prefs), isNull);
    });

    test('returns null when the saved address no longer answers', () async {
      // 203.0.113.0/24 is reserved for documentation and routes nowhere, so the
      // probe fails the way a stale address on a changed network would.
      SharedPreferences.setMockInitialValues(<String, Object>{
        kServerBaseUrlKey: 'http://203.0.113.1:3000/api/v1',
      });
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      expect(await resolveServerBaseUrl(prefs), isNull);
    });
  });

  group('probeServer', () {
    test('says no rather than throwing when the host is unreachable', () async {
      expect(await probeServer('http://203.0.113.1:3000/api/v1'), isFalse);
    });

    test('says no on input that is not a usable URL', () async {
      expect(await probeServer('not a url'), isFalse);
    });
  });
}
