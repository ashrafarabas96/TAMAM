import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/avatar.dart';
import 'package:tamam_partner/core/widgets/rating_stars.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Rate the customer after a completed job.
///
/// The tag list is deliberately partner-flavoured: the things that actually
/// make a pickup easy or hard.
class RateCustomerScreen extends ConsumerStatefulWidget {
  const RateCustomerScreen({required this.jobId, super.key});

  final String jobId;

  @override
  ConsumerState<RateCustomerScreen> createState() => _RateCustomerScreenState();
}

class _RateCustomerScreenState extends ConsumerState<RateCustomerScreen> {
  static const List<String> _positiveTags = <String>['PUNCTUAL', 'POLITE', 'CLEAR_ADDRESS', 'EASY_PARKING'];
  static const List<String> _negativeTags = <String>['LATE', 'RUDE', 'WRONG_ADDRESS', 'EXTRA_STOPS'];

  final TextEditingController _comment = TextEditingController();
  Set<String> _tags = <String>{};
  int _rating = 0;
  bool _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  String _tagLabel(AppLocalizations l10n, String tag) {
    switch (tag) {
      case 'PUNCTUAL':
        return l10n.ratingTagPunctual;
      case 'POLITE':
        return l10n.ratingTagPolite;
      case 'CLEAR_ADDRESS':
        return l10n.ratingTagClearAddress;
      case 'EASY_PARKING':
        return l10n.ratingTagEasyParking;
      case 'LATE':
        return l10n.ratingTagLate;
      case 'RUDE':
        return l10n.ratingTagRude;
      case 'WRONG_ADDRESS':
        return l10n.ratingTagWrongAddress;
      case 'EXTRA_STOPS':
        return l10n.ratingTagExtraStops;
      default:
        return tag;
    }
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await ref.read(jobsRepositoryProvider).rateCustomer(
            widget.jobId,
            rating: _rating,
            tags: _tags.toList(growable: false),
            comment: _comment.text,
          );
      ref.invalidate(myJobRatingProvider(widget.jobId));
      if (!mounted) return;
      AppFeedback.showMessage(context, context.l10n.ratingThanks, icon: Icons.check_rounded);
      context.go(Routes.home);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, failure);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final List<String> tags = _rating >= 4 ? _positiveTags : _negativeTags;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.ratingTitle)),
      body: AsyncView<Job>(
        value: ref.watch(jobProvider(widget.jobId)),
        onRetry: () => ref.invalidate(jobProvider(widget.jobId)),
        builder: (Job job) {
          final JobCustomerCard? customer = job.customer;
          return Column(
            children: <Widget>[
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(TamamSpacing.s5),
                  children: <Widget>[
                    Center(
                      child: TamamAvatar(
                        initials: customer?.initials ?? '#',
                        imageUrl: customer?.profileImageUrl,
                        size: 88,
                      ),
                    ),
                    const SizedBox(height: TamamSpacing.s3),
                    Text(
                      customer?.fullName ?? l10n.ratingCustomer,
                      textAlign: TextAlign.center,
                      style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                    ),
                    Text(
                      l10n.ratingPrompt,
                      textAlign: TextAlign.center,
                      style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                    ),
                    const SizedBox(height: TamamSpacing.s5),
                    RatingInput(
                      value: _rating,
                      onChanged: (int value) => setState(() {
                        _rating = value;
                        _tags = <String>{};
                      }),
                    ),
                    if (_rating > 0) ...<Widget>[
                      const SizedBox(height: TamamSpacing.s5),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: TamamSpacing.s2,
                        runSpacing: TamamSpacing.s2,
                        children: <Widget>[
                          for (final String tag in tags)
                            FilterChip(
                              label: Text(_tagLabel(l10n, tag)),
                              selected: _tags.contains(tag),
                              onSelected: (bool selected) => setState(() {
                                _tags = selected
                                    ? <String>{..._tags, tag}
                                    : _tags.where((String t) => t != tag).toSet();
                              }),
                            ),
                        ],
                      ),
                      const SizedBox(height: TamamSpacing.s4),
                      TextField(
                        controller: _comment,
                        maxLines: 3,
                        maxLength: 500,
                        decoration: InputDecoration(
                          labelText: l10n.ratingCommentOptional,
                          alignLabelWithHint: true,
                          counterText: '',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(TamamSpacing.s5, 0, TamamSpacing.s5, TamamSpacing.s4),
                  child: Column(
                    children: <Widget>[
                      TamamButton(
                        label: l10n.ratingSubmit,
                        busy: _busy,
                        onPressed: _rating == 0 ? null : () => unawaited(_submit()),
                      ),
                      TextButton(
                        onPressed: () => context.go(Routes.home),
                        child: Text(l10n.actionSkip),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
