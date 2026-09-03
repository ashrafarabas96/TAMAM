import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';
import 'package:tamam_partner/features/quotes/domain/quote_draft.dart';

/// `GET|POST /jobs/:id/quotes`.
class QuotesRepository {
  const QuotesRepository(this._api);

  final ApiClient _api;

  Future<List<Quote>> list(String jobId) async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.jobQuotes(jobId));
    final List<Quote> quotes = raw.map(Quote.fromJson).toList()
      ..sort((Quote a, Quote b) => b.revision.compareTo(a.revision));
    return quotes;
  }

  /// Submits a draft; the server recomputes every total and returns the job
  /// in its new state (QUOTE_SUBMITTED, or WORK_STARTED for a change order).
  Future<Job> submit(String jobId, QuoteDraft draft, {required int version}) async =>
      Job.fromJson(await _api.postObject(ApiPaths.jobQuotes(jobId), body: draft.toRequestBody(version: version)));
}
