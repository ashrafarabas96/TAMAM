import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/section_header.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';
import 'package:tamam_customer/features/chalet/presentation/chalet_providers.dart';
import 'package:tamam_customer/features/chalet/presentation/widgets/chalet_price_sheet.dart';
import 'package:tamam_customer/features/chalet/presentation/widgets/chalet_slot_picker.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// One chalet, and the whole choice of when to book it.
///
/// Day, length and start time, in that order: the day narrows what is free, the
/// length decides which start times fit, and only then are start times worth
/// showing. Asking for a time first would mean offering times that cannot hold
/// the stay the customer wants.
class ChaletDetailScreen extends ConsumerStatefulWidget {
  const ChaletDetailScreen({required this.chaletId, super.key});

  final String chaletId;

  @override
  ConsumerState<ChaletDetailScreen> createState() => _ChaletDetailScreenState();
}

class _ChaletDetailScreenState extends ConsumerState<ChaletDetailScreen> {
  DateTime _day = DateTime.now();
  int? _durationMinutes;
  DateTime? _startAt;
  final int _guests = 2;
  bool _holding = false;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<ChaletDetail> detail = ref.watch(chaletDetailProvider(widget.chaletId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.chaletTitle)),
      body: AsyncView<ChaletDetail>(
        value: detail,
        onRetry: () => ref.invalidate(chaletDetailProvider(widget.chaletId)),
        builder: _body,
      ),
    );
  }

  Widget _body(ChaletDetail chalet) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final TextTheme text = Theme.of(context).textTheme;
    final bool isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final int duration = _durationMinutes ?? chalet.scheduling.minimumBookingDurationMinutes;

    final ChaletSlotQuery query = ChaletSlotQuery(
      chaletId: chalet.id,
      date: _day,
      durationMinutes: duration,
    );
    final AsyncValue<ChaletAvailability> availability = ref.watch(chaletAvailabilityProvider(query));

    return ListView(
      padding: const EdgeInsets.all(TamamSpacing.s4),
      children: <Widget>[
        Text(
          isArabic ? chalet.nameAr : chalet.nameEn,
          style: text.headlineSmall?.copyWith(color: colors.textPrimary),
        ),
        const SizedBox(height: TamamSpacing.s1),
        Text(chalet.addressLine, style: text.bodyMedium?.copyWith(color: colors.textSecondary)),
        const SizedBox(height: TamamSpacing.s2),
        Row(
          children: <Widget>[
            MoneyText(chalet.baseHourlyRate),
            Text(l10n.chaletPerHour, style: text.bodySmall?.copyWith(color: colors.textSecondary)),
            const Spacer(),
            Icon(Icons.group_outlined, size: 16, color: colors.textTertiary),
            const SizedBox(width: TamamSpacing.s1),
            Text(
              l10n.chaletUpToGuests(chalet.maximumGuests),
              style: text.bodySmall?.copyWith(color: colors.textSecondary),
            ),
          ],
        ),

        const SizedBox(height: TamamSpacing.s5),
        SectionHeader(title: l10n.chaletPickDay),
        _DayStrip(selected: _day, onSelect: _selectDay),

        const SizedBox(height: TamamSpacing.s4),
        SectionHeader(title: l10n.chaletPickDuration),
        ChaletDurationPicker(
          scheduling: chalet.scheduling,
          selectedMinutes: duration,
          onSelect: _selectDuration,
        ),

        const SizedBox(height: TamamSpacing.s4),
        SectionHeader(title: l10n.chaletPickTime),
        AsyncView<ChaletAvailability>(
          value: availability,
          onRetry: () => ref.invalidate(chaletAvailabilityProvider(query)),
          builder: (ChaletAvailability data) => ChaletSlotPicker(
            availability: data,
            scheduling: chalet.scheduling,
            selectedStart: _startAt,
            onSelect: (DateTime at) => setState(() => _startAt = at),
          ),
        ),

        if (_startAt != null) ...<Widget>[
          const SizedBox(height: TamamSpacing.s5),
          _PriceBlock(
            chaletId: chalet.id,
            selection: ChaletSelection(
              startAt: _startAt!,
              durationMinutes: duration,
              guestCount: _guests,
            ),
          ),
        ],

        if (chalet.amenities.isNotEmpty) ...<Widget>[
          const SizedBox(height: TamamSpacing.s5),
          SectionHeader(title: l10n.chaletAmenities),
          Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: chalet.amenities
                .map((String code) => Chip(label: Text(code)))
                .toList(growable: false),
          ),
        ],

        const SizedBox(height: TamamSpacing.s5),
        SectionHeader(title: l10n.chaletOpeningHours),
        TamamCard(
          child: Text(
            l10n.chaletFrom(chalet.scheduling.openingTime, chalet.scheduling.closingTime),
            style: text.bodyMedium?.copyWith(color: colors.textSecondary),
          ),
        ),

        const SizedBox(height: TamamSpacing.s6),
        TamamButton(
          label: _startAt == null ? l10n.chaletSelectTimeFirst : l10n.chaletBookNow,
          busy: _holding,
          onPressed: _startAt == null
              ? null
              : () => unawaited(_hold(chalet, duration)),
        ),
        const SizedBox(height: TamamSpacing.s6),
      ],
    );
  }

  /// Changing the day or the length invalidates the chosen time: a start that
  /// worked for four hours on Thursday may not exist for six on Friday, and
  /// silently keeping it would send an impossible window to the server.
  void _selectDay(DateTime day) => setState(() {
        _day = day;
        _startAt = null;
      });

  void _selectDuration(int minutes) => setState(() {
        _durationMinutes = minutes;
        _startAt = null;
      });

  Future<void> _hold(ChaletDetail chalet, int duration) async {
    final DateTime? startAt = _startAt;
    if (startAt == null) return;

    setState(() => _holding = true);
    try {
      final ChaletBooking booking = await ref.read(chaletBookingProvider.notifier).hold(
            chaletId: chalet.id,
            selection: ChaletSelection(
              startAt: startAt,
              durationMinutes: duration,
              guestCount: _guests,
            ),
          );
      if (!mounted) return;
      await context.push(Routes.chaletBooking(booking.id));
      // The slot may have been taken or released while the sheet was open.
      ref.invalidate(chaletAvailabilityProvider);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      AppFeedback.showFailure(context, failure);
    } finally {
      if (mounted) setState(() => _holding = false);
    }
  }
}

/// The next fourteen days. Beyond that a date picker would serve better, but a
/// chalet is usually booked for this weekend or the next.
class _DayStrip extends StatelessWidget {
  const _DayStrip({required this.selected, required this.onSelect});

  final DateTime selected;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final DateTime today = DateTime.now();
    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: 14,
        separatorBuilder: (_, __) => const SizedBox(width: TamamSpacing.s2),
        itemBuilder: (BuildContext context, int index) {
          final DateTime day = DateTime(today.year, today.month, today.day + index);
          final bool active = day.year == selected.year &&
              day.month == selected.month &&
              day.day == selected.day;
          return Semantics(
            button: true,
            selected: active,
            child: Material(
              color: active ? colors.primary : colors.surfaceAlt,
              borderRadius: BorderRadius.circular(TamamRadius.card),
              child: InkWell(
                onTap: () => onSelect(day),
                borderRadius: BorderRadius.circular(TamamRadius.card),
                child: SizedBox(
                  width: 60,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      Text(
                        MaterialLocalizations.of(context).narrowWeekdays[day.weekday % 7],
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: active ? colors.textOnBrand : colors.textSecondary,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${day.day}',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: active ? colors.textOnBrand : colors.textPrimary,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Prices the chosen window, and says why if it will not work.
class _PriceBlock extends ConsumerWidget {
  const _PriceBlock({required this.chaletId, required this.selection});

  final String chaletId;
  final ChaletSelection selection;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final ({String chaletId, ChaletSelection selection}) args =
        (chaletId: chaletId, selection: selection);
    final AsyncValue<ChaletSlotCheck> check = ref.watch(chaletSlotCheckProvider(args));

    return AsyncView<ChaletSlotCheck>(
      value: check,
      onRetry: () => ref.invalidate(chaletSlotCheckProvider(args)),
      loading: const Padding(
        padding: EdgeInsets.all(TamamSpacing.s4),
        child: Center(child: CircularProgressIndicator()),
      ),
      builder: (ChaletSlotCheck data) {
        if (!data.available) {
          return TamamCard(
            background: context.colors.warningSoft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(Icons.error_outline_rounded, color: context.colors.warning),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(child: Text(_reasonText(l10n, data.reason))),
              ],
            ),
          );
        }
        final ChaletPrice? price = data.price;
        if (price == null) return const SizedBox.shrink();
        return TamamCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              SectionHeader(title: l10n.chaletPriceTitle),
              ChaletPriceSheet(price: price),
            ],
          ),
        );
      },
    );
  }

  static String _reasonText(AppLocalizations l10n, ChaletSlotReason reason) {
    switch (reason) {
      case ChaletSlotReason.overlapsBooking:
        return l10n.chaletSlotTaken;
      case ChaletSlotReason.overlapsBlock:
        return l10n.chaletSlotBlocked;
      case ChaletSlotReason.outsideHours:
        return l10n.chaletSlotOutsideHours;
      case ChaletSlotReason.durationOutOfBounds:
        return l10n.chaletSlotTooShort;
      case ChaletSlotReason.notOnInterval:
        return l10n.chaletSlotOffGrid;
      case ChaletSlotReason.free:
        return l10n.chaletSlotTaken;
    }
  }
}
