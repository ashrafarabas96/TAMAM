import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/status_pill.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/fare_option_card.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The receipt for a finished job: the server's breakdown, the payment record
/// and the delivery proof when there is one.
class ReceiptScreen extends ConsumerWidget {
  const ReceiptScreen({required this.jobId, super.key});

  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.receiptTitle)),
      body: AsyncView<Job>(
        value: ref.watch(jobProvider(jobId)),
        onRetry: () => ref.invalidate(jobProvider(jobId)),
        builder: (Job job) => ListView(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          children: <Widget>[
            TamamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          JobLabels.jobType(l10n, job.type),
                          style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                        ),
                      ),
                      StatusPill.forJobStatus(
                        status: job.status,
                        label: JobLabels.status(l10n, job.status),
                      ),
                    ],
                  ),
                  const SizedBox(height: TamamSpacing.s1),
                  Text(
                    '${job.number} · ${units.dateTime(job.completedAt ?? job.createdAt)}',
                    style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                  ),
                  const SizedBox(height: TamamSpacing.s4),
                  FareBreakdownList(
                    lines: job.breakdown,
                    total: job.displayTotal == null
                        ? null
                        : Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  l10n.checkoutTotal,
                                  style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                                ),
                              ),
                              MoneyText(job.displayTotal!),
                            ],
                          ),
                  ),
                  if (job.cancellationFee != null && job.cancellationFee!.amount > 0) ...<Widget>[
                    const SizedBox(height: TamamSpacing.s3),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            l10n.receiptCancellationFee,
                            style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                          ),
                        ),
                        MoneyText(job.cancellationFee!, emphasis: MoneyEmphasis.subtle),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s4),
            _PaymentCard(jobId: jobId),
            if (job.delivery?.proofOfDeliveryPhotoUrl != null) ...<Widget>[
              const SizedBox(height: TamamSpacing.s4),
              TamamCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      l10n.receiptProofOfDelivery,
                      style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                    ),
                    if (job.delivery!.proofReceiverName != null)
                      Text(
                        l10n.receiptReceivedBy(job.delivery!.proofReceiverName!),
                        style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                      ),
                    const SizedBox(height: TamamSpacing.s3),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(TamamRadius.md),
                      child: Image.network(
                        job.delivery!.proofOfDeliveryPhotoUrl!,
                        height: 180,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (BuildContext _, Object __, StackTrace? ___) => Container(
                          height: 120,
                          color: colors.skeleton,
                          alignment: Alignment.center,
                          child: Icon(Icons.image_not_supported_outlined, color: colors.textTertiary),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PaymentCard extends ConsumerWidget {
  const _PaymentCard({required this.jobId});

  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return ref.watch(jobPaymentProvider(jobId)).when(
          skipLoadingOnRefresh: true,
          loading: () => const SizedBox.shrink(),
          error: (Object _, StackTrace __) => const SizedBox.shrink(),
          data: (JobPayment? payment) {
            if (payment == null) return const SizedBox.shrink();
            return TamamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    l10n.receiptPayment,
                    style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                  ),
                  const SizedBox(height: TamamSpacing.s3),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          JobLabels.paymentMethod(l10n, payment.method),
                          style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                        ),
                      ),
                      StatusPill(
                        label: _statusLabel(l10n, payment.status),
                        tone: payment.isSettled
                            ? PillTone.success
                            : payment.hasFailed
                                ? PillTone.danger
                                : PillTone.warning,
                      ),
                    ],
                  ),
                  if (payment.refundedAmount.amount > 0) ...<Widget>[
                    const SizedBox(height: TamamSpacing.s2),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            l10n.receiptRefunded,
                            style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                          ),
                        ),
                        MoneyText(
                          payment.refundedAmount,
                          emphasis: MoneyEmphasis.subtle,
                          color: colors.success,
                        ),
                      ],
                    ),
                  ],
                  if (payment.failureReason != null) ...<Widget>[
                    const SizedBox(height: TamamSpacing.s2),
                    Text(
                      payment.failureReason!,
                      style: TamamType.bodySm.toTextStyle(color: colors.danger),
                    ),
                  ],
                ],
              ),
            );
          },
        );
  }

  String _statusLabel(AppLocalizations l10n, PaymentStatus status) {
    switch (status) {
      case PaymentStatus.captured:
        return l10n.paymentStatusCaptured;
      case PaymentStatus.authorized:
        return l10n.paymentStatusAuthorized;
      case PaymentStatus.failed:
        return l10n.paymentStatusFailed;
      case PaymentStatus.refunded:
      case PaymentStatus.partiallyRefunded:
        return l10n.paymentStatusRefunded;
      case PaymentStatus.cancelled:
        return l10n.paymentStatusCancelled;
      case PaymentStatus.pending:
        return l10n.paymentStatusPending;
    }
  }
}
