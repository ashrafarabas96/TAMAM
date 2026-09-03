import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/offline_banner.dart';
import 'package:tamam_partner/features/onboarding/domain/onboarding_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/features/onboarding/presentation/steps/documents_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/steps/personal_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/steps/review_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/steps/roles_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/steps/skills_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/steps/vehicle_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/steps/zones_step.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The seven-step registration wizard.
///
/// Resumable by construction: every step is its own server call, and the entry
/// point is `OnboardingFlow.resumeAt(profile)` — a partner who reinstalls the
/// app lands exactly where they stopped, with what they already sent intact.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key, this.initialStep});

  /// Deep-link override (`/onboarding?step=4`), used by rejection notices.
  final int? initialStep;

  static String title(AppLocalizations l10n, OnboardingStep step) {
    switch (step) {
      case OnboardingStep.personal:
        return l10n.onboardingStepPersonal;
      case OnboardingStep.roles:
        return l10n.onboardingStepRoles;
      case OnboardingStep.skills:
        return l10n.onboardingStepSkills;
      case OnboardingStep.documents:
        return l10n.onboardingStepDocuments;
      case OnboardingStep.vehicle:
        return l10n.onboardingStepVehicle;
      case OnboardingStep.zones:
        return l10n.onboardingStepZones;
      case OnboardingStep.review:
        return l10n.onboardingStepReview;
    }
  }

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  bool _jumped = false;

  /// Applies `?step=` once the controller has loaded, so a rejection notice
  /// can drop the partner straight onto the step that needs fixing.
  void _applyInitialStep() {
    final int? step = widget.initialStep;
    if (_jumped || step == null) return;
    _jumped = true;
    ref.read(onboardingProvider.notifier).goTo(OnboardingStep.fromNumber(step));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AsyncValue<OnboardingState> value = ref.watch(onboardingProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: AsyncView<OnboardingState>(
        value: value,
        onRetry: () => ref.invalidate(onboardingProvider),
        builder: (OnboardingState state) {
          final OnboardingController controller = ref.read(onboardingProvider.notifier);
          WidgetsBinding.instance.addPostFrameCallback((_) => _applyInitialStep());
          return Column(
            children: <Widget>[
              _Header(
                state: state,
                onBack: () {
                  if (!controller.back() && context.canPop()) context.pop();
                },
              ),
              const OfflineBanner(),
              if (state.profile?.isRejected ?? false)
                Container(
                  width: double.infinity,
                  color: colors.dangerSoft,
                  padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4, vertical: TamamSpacing.s2),
                  child: Row(
                    children: <Widget>[
                      Icon(Icons.error_outline_rounded, size: TamamSize.iconSm, color: TamamSemantic.dangerStrong),
                      const SizedBox(width: TamamSpacing.s2),
                      Expanded(
                        child: Text(
                          l10n.onboardingFixRejection,
                          style: TamamType.labelMd.toTextStyle(color: TamamSemantic.dangerStrong),
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push(Routes.onboardingStatus),
                        child: Text(l10n.onboardingSeeReasons),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(TamamSpacing.s5),
                  child: _StepBody(state: state),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StepBody extends StatelessWidget {
  const _StepBody({required this.state});

  final OnboardingState state;

  @override
  Widget build(BuildContext context) {
    switch (state.step) {
      case OnboardingStep.personal:
        return PersonalStep(state: state);
      case OnboardingStep.roles:
        return RolesStep(state: state);
      case OnboardingStep.skills:
        return SkillsStep(state: state);
      case OnboardingStep.documents:
        return DocumentsStep(state: state);
      case OnboardingStep.vehicle:
        return VehicleStep(state: state);
      case OnboardingStep.zones:
        return ZonesStep(state: state);
      case OnboardingStep.review:
        return ReviewStep(state: state);
    }
  }
}

/// Purple header with the step title and a segmented progress bar.
class _Header extends StatelessWidget {
  const _Header({required this.state, required this.onBack});

  final OnboardingState state;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final int count = state.stepCount;
    final int index = state.stepIndex;

    return Container(
      color: colors.surfaceBrand,
      padding: EdgeInsets.only(
        top: MediaQuery.paddingOf(context).top + TamamSpacing.s1,
        left: TamamSpacing.s2,
        right: TamamSpacing.s2,
        bottom: TamamSpacing.s4,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              if (state.isFirst)
                const SizedBox(width: TamamSize.touchTargetMin)
              else
                IconButton(
                  onPressed: state.busy ? null : onBack,
                  icon: const Icon(Icons.arrow_back_rounded),
                  color: colors.textOnBrand,
                  tooltip: l10n.actionBack,
                ),
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    OnboardingScreen.title(l10n, state.step),
                    style: TamamType.headingMd.toTextStyle(color: colors.textOnBrand),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: TamamSpacing.s2, left: TamamSpacing.s2),
                child: Text(
                  l10n.onboardingStepCounter(index + 1, count),
                  style: TamamType.labelMd.toTextStyle(color: TamamBrand.purple200),
                ),
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2),
            child: Row(
              children: <Widget>[
                for (int i = 0; i < count; i++) ...<Widget>[
                  if (i > 0) const SizedBox(width: 4),
                  Expanded(
                    child: AnimatedContainer(
                      duration: TamamMotion.durationBase,
                      height: 4,
                      decoration: BoxDecoration(
                        color: i <= index ? colors.accent : TamamBrand.purple700,
                        borderRadius: BorderRadius.circular(TamamRadius.pill),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
