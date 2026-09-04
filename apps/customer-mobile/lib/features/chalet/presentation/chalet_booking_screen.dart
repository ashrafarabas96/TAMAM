import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';
import 'package:tamam_customer/features/chalet/presentation/chalet_providers.dart';
import 'package:tamam_customer/features/chalet/presentation/widgets/chalet_hold_timer.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The held booking, and the decision to confirm it.
///
/// A hold is a promise with a clock on it: the slot is the customer's while
/// they pay, and theirs to lose if they do not. Both halves are shown — the
/// countdown while it runs, and a plain statement when it lapses — because a
/// customer timed out without warning has been treated badly, and one who
/// never knew there was a clock cannot have been rushed by it.
class ChaletBookingScreen extends ConsumerStatefulWidget {
  const ChaletBookingScreen({required this.bookingId, super.key});

  final String bookingId;

  @override
  ConsumerState<ChaletBookingScreen> createState() => _ChaletBookingScreenState();
}

class _ChaletBookingScreenState extends ConsumerState<ChaletBookingScreen> {
  bool _confirming = false;
  bool _expired = false;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final ChaletBooking? booking = ref.watch(chaletBookingProvider).valueOrNull;

    if (booking == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.chaletTitle)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final bool confirmed = booking.status == ChaletBookingStatus.confirmed;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.chaletTitle)),
      body: ListView(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        children: <Widget>[
          if (confirmed)
            _ConfirmedBanner(booking: booking)
          else if (booking.holdExpiresAt != null)
            ChaletHoldTimer(
              expiresAt: booking.holdExpiresAt!,
              onExpired: () => setState(() => _expired = true),
            ),

          const SizedBox(height: TamamSpacing.s4),
          _BookingSummary(booking: booking),

          const SizedBox(height: TamamSpacing.s6),
          if (!confirmed)
            TamamButton(
              label: l10n.chaletConfirm,
              busy: _confirming,
              // A lapsed hold no longer holds anything; offering Confirm would
              // promise something the server has already given away.
              onPressed: _expired ? null : () => unawaited(_confirm(booking)),
            ),
          if (!confirmed) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            TamamButton(
              label: l10n.chaletCancelBooking,
              variant: TamamButtonVariant.ghost,
              onPressed: () => unawaited(_cancel(booking)),
            ),
          ],
          if (confirmed) ...<Widget>[
            TamamButton(
              label: l10n.actionContinue,
              onPressed: () => context.go(Routes.orders),
            ),
          ],
          const SizedBox(height: TamamSpacing.s6),
        ],
      ),
    );
  }

  Future<void> _confirm(ChaletBooking booking) async {
    setState(() => _confirming = true);
    try {
      await ref.read(chaletBookingProvider.notifier).confirm(booking.id);
      if (!mounted) return;
      AppFeedback.showMessage(context, context.l10n.chaletConfirmed);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      // The commonest failure here is the hold having lapsed a moment ago;
      // the server's own message says so, and the timer catches up.
      AppFeedback.showFailure(context, failure);
      setState(() => _expired = true);
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  Future<void> _cancel(ChaletBooking booking) async {
    final bool sure = await AppFeedback.confirm(
      context,
      title: context.l10n.chaletCancelBooking,
      message: context.l10n.chaletCancelReason,
      confirmLabel: context.l10n.chaletCancelBooking,
    );
    if (!sure || !mounted) return;

    try {
      await ref.read(chaletBookingProvider.notifier).cancel(booking.id, 'customer');
      if (!mounted) return;
      context.pop();
    } on AppFailure catch (failure) {
      if (!mounted) return;
      AppFeedback.showFailure(context, failure);
    }
  }
}

class _ConfirmedBanner extends StatelessWidget {
  const _ConfirmedBanner({required this.booking});

  final ChaletBooking booking;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final AppLocalizations l10n = context.l10n;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.successSoft,
        borderRadius: BorderRadius.circular(TamamRadius.card),
      ),
      child: Padding(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        child: Row(
          children: <Widget>[
            Icon(Icons.check_circle_rounded, color: colors.success),
            const SizedBox(width: TamamSpacing.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    l10n.chaletConfirmed,
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(color: colors.textPrimary),
                  ),
                  const SizedBox(height: TamamSpacing.s1),
                  Text(
                    l10n.chaletConfirmedBody(booking.bookingNumber),
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: colors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BookingSummary extends StatelessWidget {
  const _BookingSummary({required this.booking});

  final ChaletBooking booking;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final TextTheme text = Theme.of(context).textTheme;
    final MaterialLocalizations material = MaterialLocalizations.of(context);

    String at(DateTime instant) {
      final DateTime local = instant.toLocal();
      return '${material.formatMediumDate(local)} '
          '${material.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
    }

    return TamamCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _Line(label: l10n.chaletBookingFrom(at(booking.startAt))),
          const SizedBox(height: TamamSpacing.s2),
          _Line(label: l10n.chaletBookingTo(at(booking.endAt))),
          if (booking.cleaningDurationMinutes > 0) ...<Widget>[
            const SizedBox(height: TamamSpacing.s2),
            Text(
              l10n.chaletCleaningNote(booking.cleaningDurationMinutes),
              style: text.bodySmall?.copyWith(color: colors.textTertiary),
            ),
          ],
          const Divider(height: TamamSpacing.s6),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.chaletPriceTotal,
                  style: text.titleSmall?.copyWith(color: colors.textPrimary),
                ),
              ),
              MoneyText(booking.total, style: text.titleMedium),
            ],
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Text(
        label,
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(color: context.colors.textPrimary),
      );
}
