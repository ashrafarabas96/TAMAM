import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';

/// A support ticket (`SupportTicketDto`).
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.number,
    required this.category,
    required this.status,
    required this.subject,
    required this.description,
    required this.createdAt,
    required this.updatedAt,
    this.jobId,
    this.attachmentUrls = const <String>[],
    this.messages = const <SupportMessage>[],
  });

  factory SupportTicket.fromJson(JsonMap json) => SupportTicket(
        id: readStringOr(json, 'id', ''),
        number: readStringOr(json, 'number', ''),
        category: TicketCategory.fromValue(readString(json, 'category')) ?? TicketCategory.other,
        status: TicketStatus.fromValue(readString(json, 'status')) ?? TicketStatus.open,
        subject: readStringOr(json, 'subject', ''),
        description: readStringOr(json, 'description', ''),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        updatedAt: readDateTimeOr(json, 'updatedAt', DateTime.now()),
        jobId: readString(json, 'jobId'),
        attachmentUrls: readStringList(json, 'attachmentUrls'),
        messages: readList<SupportMessage>(json, 'messages', SupportMessage.fromJson),
      );

  final String id;
  final String number;
  final TicketCategory category;
  final TicketStatus status;
  final String subject;
  final String description;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? jobId;
  final List<String> attachmentUrls;
  final List<SupportMessage> messages;

  bool get isOpen => status != TicketStatus.closed && status != TicketStatus.resolved;
}

/// One message in a ticket thread.
class SupportMessage {
  const SupportMessage({
    required this.id,
    required this.authorRole,
    required this.text,
    required this.createdAt,
    this.authorName,
    this.attachmentUrls = const <String>[],
  });

  factory SupportMessage.fromJson(JsonMap json) => SupportMessage(
        id: readStringOr(json, 'id', ''),
        authorRole: readStringOr(json, 'authorRole', 'USER'),
        text: readStringOr(json, 'text', ''),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        authorName: readString(json, 'authorName'),
        attachmentUrls: readStringList(json, 'attachmentUrls'),
      );

  final String id;

  /// `USER` (the customer) or `AGENT` (support).
  final String authorRole;
  final String text;
  final DateTime createdAt;
  final String? authorName;
  final List<String> attachmentUrls;

  bool get isFromAgent => authorRole == 'AGENT';
}

/// A dispute opened on a completed job (`DisputeDto`).
class Dispute {
  const Dispute({
    required this.id,
    required this.number,
    required this.jobId,
    required this.status,
    required this.reason,
    required this.description,
    required this.refund,
    required this.createdAt,
    this.requestedRefund,
    this.decisionReason,
    this.evidenceUrls = const <String>[],
    this.messages = const <DisputeMessage>[],
  });

  factory Dispute.fromJson(JsonMap json) => Dispute(
        id: readStringOr(json, 'id', ''),
        number: readStringOr(json, 'number', ''),
        jobId: readStringOr(json, 'jobId', ''),
        status: DisputeStatus.fromValue(readString(json, 'status')) ?? DisputeStatus.open,
        reason: readStringOr(json, 'reason', 'OTHER'),
        description: readStringOr(json, 'description', ''),
        refund: readObject<Money>(json, 'refund', Money.fromJson) ?? const Money.zero('ILS'),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        requestedRefund: readObject<Money>(json, 'requestedRefund', Money.fromJson),
        decisionReason: readString(json, 'decisionReason'),
        evidenceUrls: readStringList(json, 'evidenceUrls'),
        messages: readList<DisputeMessage>(json, 'messages', DisputeMessage.fromJson),
      );

  final String id;
  final String number;
  final String jobId;
  final DisputeStatus status;
  final String reason;
  final String description;
  final Money refund;
  final DateTime createdAt;
  final Money? requestedRefund;
  final String? decisionReason;
  final List<String> evidenceUrls;
  final List<DisputeMessage> messages;

  bool get isResolved =>
      status != DisputeStatus.open && status != DisputeStatus.underReview;
}

class DisputeMessage {
  const DisputeMessage({
    required this.id,
    required this.text,
    required this.createdAt,
    this.authorName,
  });

  factory DisputeMessage.fromJson(JsonMap json) => DisputeMessage(
        id: readStringOr(json, 'id', ''),
        text: readStringOr(json, 'text', ''),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        authorName: readString(json, 'authorName'),
      );

  final String id;
  final String text;
  final DateTime createdAt;
  final String? authorName;
}

/// The reasons a customer can report a partner for (`reportSchema`).
enum ReportReason {
  unsafeDriving('UNSAFE_DRIVING'),
  rudeBehaviour('RUDE_BEHAVIOUR'),
  wrongRoute('WRONG_ROUTE'),
  overcharge('OVERCHARGE'),
  damage('DAMAGE'),
  harassment('HARASSMENT'),
  noShow('NO_SHOW'),
  fraud('FRAUD'),
  other('OTHER');

  const ReportReason(this.value);

  final String value;
}

/// The reasons a dispute can be opened for (`openDisputeSchema`).
enum DisputeReason {
  notCompleted('NOT_COMPLETED'),
  poorQuality('POOR_QUALITY'),
  overcharged('OVERCHARGED'),
  damage('DAMAGE'),
  itemMissing('ITEM_MISSING'),
  partnerMisconduct('PARTNER_MISCONDUCT'),
  other('OTHER');

  const DisputeReason(this.value);

  final String value;
}

/// Tickets, reports and disputes.
class SupportRepository {
  const SupportRepository(this._api);

  final ApiClient _api;

  Future<CursorPage<SupportTicket>> tickets({String? cursor, int limit = 20}) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.supportTickets,
      query: <String, Object?>{'cursor': cursor, 'limit': limit},
    );
    return CursorPage<SupportTicket>.fromJson(json, SupportTicket.fromJson);
  }

  Future<SupportTicket> ticket(String id) async =>
      SupportTicket.fromJson(await _api.getObject(ApiPaths.supportTicket(id)));

  Future<SupportTicket> createTicket({
    required TicketCategory category,
    required String subject,
    required String description,
    String? jobId,
    List<String> attachmentMediaIds = const <String>[],
  }) async =>
      SupportTicket.fromJson(
        await _api.postObject(
          ApiPaths.supportTickets,
          body: <String, Object?>{
            'category': category.value,
            'subject': subject,
            'description': description,
            'attachmentMediaIds': attachmentMediaIds,
            if (jobId != null) 'jobId': jobId,
          },
        ),
      );

  Future<void> replyToTicket(String id, {required String text, List<String> attachmentMediaIds = const <String>[]}) async {
    await _api.postObject(
      ApiPaths.supportTicketMessages(id),
      body: <String, Object?>{'text': text, 'attachmentMediaIds': attachmentMediaIds, 'internal': false},
    );
  }

  /// Reports a partner or an incident on a job; support opens a ticket for it.
  Future<void> report({
    required String jobId,
    required ReportReason reason,
    String? description,
    List<String> attachmentMediaIds = const <String>[],
  }) async {
    await _api.postObject(
      ApiPaths.supportReports,
      body: <String, Object?>{
        'jobId': jobId,
        'reason': reason.value,
        'attachmentMediaIds': attachmentMediaIds,
        if (description != null && description.isNotEmpty) 'description': description,
      },
    );
  }

  Future<CursorPage<Dispute>> disputes({String? cursor, int limit = 20}) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.disputes,
      query: <String, Object?>{'cursor': cursor, 'limit': limit},
    );
    return CursorPage<Dispute>.fromJson(json, Dispute.fromJson);
  }

  Future<Dispute> dispute(String id) async => Dispute.fromJson(await _api.getObject(ApiPaths.dispute(id)));

  Future<Dispute> openDispute({
    required String jobId,
    required DisputeReason reason,
    required String description,
    int? requestedRefundMinor,
    List<String> evidenceMediaIds = const <String>[],
  }) async =>
      Dispute.fromJson(
        await _api.postObject(
          ApiPaths.disputes,
          body: <String, Object?>{
            'jobId': jobId,
            'reason': reason.value,
            'description': description,
            'evidenceMediaIds': evidenceMediaIds,
            if (requestedRefundMinor != null) 'requestedRefundMinor': requestedRefundMinor,
          },
        ),
      );

  Future<void> replyToDispute(String id, {required String text, List<String> evidenceMediaIds = const <String>[]}) async {
    await _api.postObject(
      ApiPaths.disputeMessages(id),
      body: <String, Object?>{'text': text, 'evidenceMediaIds': evidenceMediaIds, 'internal': false},
    );
  }
}
