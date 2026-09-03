import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/features/home/presentation/widgets/availability_toggle.dart';
import 'package:tamam_partner/l10n/l10n.dart';

import '../support/harness.dart';

/// The ONLINE/OFFLINE pill is the single most important control in the app: it
/// is a *display* of the server's answer, so it must never flip on its own and
/// must never accept a tap while a transition is in flight.
void main() {
  late List<Override> overrides;
  late AppLocalizations ar;

  setUp(() async {
    overrides = await testOverrides();
    ar = await loadL10n();
  });

  testWidgets('reads OFFLINE when the partner is not online', (WidgetTester tester) async {
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: false, busy: false, onTap: () {}),
      overrides: overrides,
    );

    expect(find.text(ar.availabilityOffline), findsOneWidget);
    expect(find.text(ar.availabilityOnline), findsNothing);
    expect(find.byIcon(Icons.power_settings_new_rounded), findsOneWidget);
  });

  testWidgets('reads ONLINE and shows the bolt when online', (WidgetTester tester) async {
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: true, busy: false, onTap: () {}),
      overrides: overrides,
    );

    expect(find.text(ar.availabilityOnline), findsOneWidget);
    expect(find.byIcon(Icons.bolt_rounded), findsOneWidget);
  });

  testWidgets('reads "on a job" while a job is running, whatever the raw status',
      (WidgetTester tester) async {
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: true, busy: false, onJob: true, onTap: () {}),
      overrides: overrides,
    );

    expect(find.text(ar.availabilityBusy), findsOneWidget);
    expect(find.text(ar.availabilityOnline), findsNothing);
  });

  testWidgets('asks the parent to start a transition when tapped', (WidgetTester tester) async {
    int taps = 0;
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: false, busy: false, onTap: () => taps++),
      overrides: overrides,
    );

    await tester.tap(find.byKey(const Key('availability-toggle')));
    await tester.pump();

    expect(taps, 1);
  });

  testWidgets('ignores taps while a transition is in flight', (WidgetTester tester) async {
    int taps = 0;
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: false, busy: true, onTap: () => taps++),
      overrides: overrides,
    );

    await tester.tap(find.byKey(const Key('availability-toggle')));
    await tester.pump();

    expect(taps, 0);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('exposes a toggle to screen readers with the state in the label',
      (WidgetTester tester) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: true, busy: false, onTap: () {}),
      overrides: overrides,
    );

    expect(
      find.bySemanticsLabel(ar.availabilityToggleSemantics(ar.availabilityOnline)),
      findsOneWidget,
    );
    handle.dispose();
  });

  testWidgets('lays out right-to-left under the Arabic locale', (WidgetTester tester) async {
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: true, busy: false, onTap: () {}),
      overrides: overrides,
    );

    expect(
      Directionality.of(tester.element(find.byKey(const Key('availability-toggle')))),
      TextDirection.rtl,
    );
  });

  testWidgets('still reads correctly in English', (WidgetTester tester) async {
    final AppLocalizations en = await loadL10n(const Locale('en'));
    await pumpAppWidget(
      tester,
      AvailabilityToggle(online: false, busy: false, onTap: () {}),
      overrides: overrides,
      locale: const Locale('en'),
    );

    expect(find.text(en.availabilityOffline), findsOneWidget);
  });
}
