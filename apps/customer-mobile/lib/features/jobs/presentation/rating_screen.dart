import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/avatar.dart';
import 'package:tamam_customer/core/widgets/rating_stars.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Rate the partner after a completed job: stars, quick tags and a comment.
class RatingScreen extends ConsumerStatefulWidget {
  const RatingScreen({required this.jobId, super.key});

  final String jobId;

  @override
  ConsumerState<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends ConsumerState<RatingScreen> {
  /// Fixed tag vocabulary; the server stores them verbatim on the review.
  static const List<String> _positiveTags = <String>[
    'PUNCTUAL',
    'POLITE',
    'CLEAN',
    'PROFESSIONAL',
    'GOOD_PRICE',
    'CAREFUL_DRIVING',
  ];
  static const List<String> _negativeTags = <String>[
    'LATE',
    'RUDE',
    'UNCLEAN',
    'UNPROFESSIONAL',
    'OVERCHARGED',
    'UNSAFE_DRIVING',
  ];

  final TextEditingController _comment = TextEditingController();
  final Set<String> _tags = <String>{};
  int _rating = 0;
  bool _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  List<String> get _tagOptions => _rating >= 4 ? _positiveTags : _negativeTags;

  Future<void> _submit() async {
    if (_rating == 0) return;
    setState(() => _busy = true);
    try {
      await ref.read(jobsRepositoryProvider).rate(
            widget.jobId,
            rating: _rating,
            tags: _tags.toList(growable: false),
            comment: _comment.text,
          );
      if (!mounted) return;
      AppFeedback.showMessage(context, context.l10n.ratingThanks, icon: Icons.favorite_rounded);
      context.pushReplacement(Routes.jobReceipt(widget.jobId));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.ratingTitle)),
      body: AsyncView<Job>(
        value: ref.watch(jobProvider(widget.jobId)),
        onRetry: () => ref.invalidate(jobProvider(widget.jobId)),
        builder: (Job job) => ListView(
          padding: const EdgeInsets.all(TamamSpacing.s5),
          children: <Widget>[
            const SizedBox(height: TamamSpacing.s4),
            Center(
              child: TamamAvatar(
                initials: job.partner?.fullName.isNotEmpty ?? false
                    ? job.partner!.fullName.substring(0, 1)
                    : '#',
                imageUrl: job.partner?.profileImageUrl,
                size: 88,
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            Text(
              job.partner?.fullName ?? l10n.ratingPartnerFallback,
              textAlign: TextAlign.center,
              style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
            ),
            const SizedBox(height: TamamSpacing.s1),
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
                _tags.clear();
              }),
            ),
            if (_rating > 0) ...<Widget>[
              const SizedBox(height: TamamSpacing.s5),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: TamamSpacing.s2,
                runSpacing: TamamSpacing.s2,
                children: _tagOptions
                    .map(
                      (String tag) => FilterChip(
                        label: Text(_tagLabel(l10n, tag)),
                        selected: _tags.contains(tag),
                        onSelected: (bool selected) => setState(() {
                          if (selected) {
                            if (_tags.length < 6) _tags.add(tag);
                          } else {
                            _tags.remove(tag);
                          }
                        }),
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: TamamSpacing.s5),
              TextField(
                controller: _comment,
                maxLines: 3,
                maxLength: 500,
                decoration: InputDecoration(
                  labelText: l10n.ratingComment,
                  alignLabelWithHint: true,
                ),
              ),
            ],
            const SizedBox(height: TamamSpacing.s4),
            TamamButton(
              label: l10n.actionSend,
              busy: _busy,
              onPressed: _rating == 0 ? null : () => unawaited(_submit()),
            ),
            const SizedBox(height: TamamSpacing.s2),
            TamamButton(
              label: l10n.actionSkip,
              variant: TamamButtonVariant.ghost,
              onPressed: () => context.pushReplacement(Routes.jobReceipt(widget.jobId)),
            ),
          ],
        ),
      ),
    );
  }

  String _tagLabel(AppLocalizations l10n, String tag) {
    switch (tag) {
      case 'PUNCTUAL':
        return l10n.ratingTagPunctual;
      case 'POLITE':
        return l10n.ratingTagPolite;
      case 'CLEAN':
        return l10n.ratingTagClean;
      case 'PROFESSIONAL':
        return l10n.ratingTagProfessional;
      case 'GOOD_PRICE':
        return l10n.ratingTagGoodPrice;
      case 'CAREFUL_DRIVING':
        return l10n.ratingTagCarefulDriving;
      case 'LATE':
        return l10n.ratingTagLate;
      case 'RUDE':
        return l10n.ratingTagRude;
      case 'UNCLEAN':
        return l10n.ratingTagUnclean;
      case 'UNPROFESSIONAL':
        return l10n.ratingTagUnprofessional;
      case 'OVERCHARGED':
        return l10n.ratingTagOvercharged;
      default:
        return l10n.ratingTagUnsafeDriving;
    }
  }
}
