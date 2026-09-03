import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/format/money_formatter.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/earnings/presentation/earnings_providers.dart';
import 'package:tamam_partner/features/quotes/presentation/widgets/quote_item_sheet.dart';
import 'package:tamam_partner/l10n/l10n.dart';
import 'package:uuid/uuid.dart';

/// Request a payout to a saved bank account.
///
/// The request carries an `Idempotency-Key` generated once per sheet, so a
/// retry after a timeout can never withdraw twice — the server replays the
/// first answer instead.
class WithdrawSheet extends ConsumerStatefulWidget {
  const WithdrawSheet({required this.balance, super.key});

  final Money balance;

  static Future<bool> show(BuildContext context, {required Money balance}) async =>
      await SheetScaffold.show<bool>(context, (BuildContext _) => WithdrawSheet(balance: balance)) ?? false;

  @override
  ConsumerState<WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends ConsumerState<WithdrawSheet> {
  final TextEditingController _amount = TextEditingController();
  final String _idempotencyKey = const Uuid().v4();
  String? _bankAccountId;
  bool _busy = false;
  AppFailure? _failure;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  int? get _amountMinor {
    final int? minor = parseMajorToMinor(_amount.text, widget.balance.currency);
    if (minor == null || minor <= 0 || minor > widget.balance.amount) return null;
    return minor;
  }

  Future<void> _submit() async {
    final int? minor = _amountMinor;
    final String? accountId = _bankAccountId;
    if (minor == null || accountId == null) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      await ref.read(earningsRepositoryProvider).requestWithdrawal(
            amountMinor: minor,
            bankAccountId: accountId,
            idempotencyKey: _idempotencyKey,
          );
      ref
        ..invalidate(withdrawalsProvider)
        ..invalidate(walletProvider);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _failure = failure;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final MoneyFormatter money = ref.watch(moneyFormatterProvider);
    final AsyncValue<List<BankAccount>> accounts = ref.watch(bankAccountsProvider);

    return SheetScaffold(
      title: l10n.withdrawTitle,
      subtitle: l10n.withdrawAvailable(money.format(widget.balance)),
      footer: TamamButton(
        label: l10n.withdrawConfirm,
        busy: _busy,
        onPressed: _amountMinor == null || _bankAccountId == null ? null : () => unawaited(_submit()),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          TextField(
            controller: _amount,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            inputFormatters: <TextInputFormatter>[FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.,٫]'))],
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(
              labelText: l10n.withdrawAmount,
              suffixText: MoneyFormatter.symbolFor(widget.balance.currency),
              errorText: _amount.text.isNotEmpty && _amountMinor == null ? l10n.withdrawAmountInvalid : null,
            ),
          ),
          const SizedBox(height: TamamSpacing.s2),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton(
              onPressed: () {
                _amount.text = minorToEditable(widget.balance.amount, widget.balance.currency);
                setState(() {});
              },
              child: Text(l10n.withdrawAll),
            ),
          ),
          const SizedBox(height: TamamSpacing.s2),
          Text(l10n.withdrawToAccount, style: TamamType.labelLg.toTextStyle(color: colors.textSecondary)),
          const SizedBox(height: TamamSpacing.s2),
          accounts.when(
            loading: () => const LinearProgressIndicator(),
            error: (Object error, StackTrace _) => Text(
              localizedFailure(l10n, asFailure(error)),
              style: TamamType.bodySm.toTextStyle(color: colors.danger),
            ),
            data: (List<BankAccount> list) {
              if (list.isEmpty) {
                return TamamButton(
                  label: l10n.bankAccountAdd,
                  variant: TamamButtonVariant.outline,
                  icon: Icons.account_balance_rounded,
                  onPressed: () => unawaited(_addAccount()),
                );
              }
              _bankAccountId ??= list.firstWhere(
                (BankAccount a) => a.isDefault,
                orElse: () => list.first,
              ).id;
              return Column(
                children: <Widget>[
                  for (final BankAccount account in list)
                    RadioListTile<String>(
                      value: account.id,
                      groupValue: _bankAccountId,
                      contentPadding: EdgeInsets.zero,
                      title: Text(account.bankName),
                      subtitle: Text(account.maskedIban, textDirection: TextDirection.ltr),
                      onChanged: (String? value) => setState(() => _bankAccountId = value),
                    ),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton.icon(
                      onPressed: () => unawaited(_addAccount()),
                      icon: const Icon(Icons.add_rounded),
                      label: Text(l10n.bankAccountAdd),
                    ),
                  ),
                ],
              );
            },
          ),
          if (_failure != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s2),
            Text(localizedFailure(l10n, _failure!), style: TamamType.bodySm.toTextStyle(color: colors.danger)),
          ],
          const SizedBox(height: TamamSpacing.s2),
          Text(l10n.withdrawProcessingHint, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary)),
        ],
      ),
    );
  }

  Future<void> _addAccount() async {
    final bool added = await BankAccountSheet.show(context);
    if (added) ref.invalidate(bankAccountsProvider);
  }
}

/// Adds a payout destination. The IBAN never comes back from the server in
/// full — only its last four characters — so this is a write-only form.
class BankAccountSheet extends ConsumerStatefulWidget {
  const BankAccountSheet({super.key});

  static Future<bool> show(BuildContext context) async =>
      await SheetScaffold.show<bool>(context, (BuildContext _) => const BankAccountSheet()) ?? false;

  @override
  ConsumerState<BankAccountSheet> createState() => _BankAccountSheetState();
}

class _BankAccountSheetState extends ConsumerState<BankAccountSheet> {
  final TextEditingController _bank = TextEditingController();
  final TextEditingController _holder = TextEditingController();
  final TextEditingController _iban = TextEditingController();
  bool _busy = false;
  AppFailure? _failure;

  @override
  void dispose() {
    _bank.dispose();
    _holder.dispose();
    _iban.dispose();
    super.dispose();
  }

  bool get _valid =>
      _bank.text.trim().length >= 2 && _holder.text.trim().length >= 2 && _iban.text.trim().length >= 15;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      await ref.read(partnerRepositoryProvider).addBankAccount(
            bankName: _bank.text.trim(),
            accountHolder: _holder.text.trim(),
            iban: _iban.text.trim().replaceAll(' ', '').toUpperCase(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _failure = failure;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    return SheetScaffold(
      title: l10n.bankAccountAdd,
      subtitle: l10n.bankAccountHint,
      footer: TamamButton(
        label: l10n.actionSave,
        busy: _busy,
        onPressed: _valid ? () => unawaited(_submit()) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          TextField(
            controller: _bank,
            textCapitalization: TextCapitalization.words,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.bankAccountBankName, errorText: _failure?.errorFor('bankName')),
          ),
          const SizedBox(height: TamamSpacing.s3),
          TextField(
            controller: _holder,
            textCapitalization: TextCapitalization.words,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(
              labelText: l10n.bankAccountHolder,
              errorText: _failure?.errorFor('accountHolder'),
            ),
          ),
          const SizedBox(height: TamamSpacing.s3),
          TextField(
            controller: _iban,
            textDirection: TextDirection.ltr,
            textCapitalization: TextCapitalization.characters,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.bankAccountIban, errorText: _failure?.errorFor('iban')),
          ),
          if (_failure != null && _failure!.fieldErrors.isEmpty) ...<Widget>[
            const SizedBox(height: TamamSpacing.s2),
            Text(localizedFailure(l10n, _failure!), style: TamamType.bodySm.toTextStyle(color: colors.danger)),
          ],
          const SizedBox(height: TamamSpacing.s2),
        ],
      ),
    );
  }
}
