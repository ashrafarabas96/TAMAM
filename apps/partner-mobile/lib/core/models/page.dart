import 'package:tamam_partner/core/models/json.dart';

/// Cursor pagination is the platform default (spec §112).
class CursorPage<T> {
  const CursorPage({required this.items, required this.nextCursor, this.total});

  factory CursorPage.fromJson(JsonMap json, T Function(JsonMap json) itemFromJson) => CursorPage<T>(
        items: readList<T>(json, 'items', itemFromJson),
        nextCursor: readString(json, 'nextCursor'),
        total: readInt(json, 'total'),
      );

  const CursorPage.empty()
      : items = const <Never>[],
        nextCursor = null,
        total = 0;

  final List<T> items;
  final String? nextCursor;
  final int? total;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  /// Appends the next page, keeping the newest cursor.
  CursorPage<T> concat(CursorPage<T> next) => CursorPage<T>(
        items: <T>[...items, ...next.items],
        nextCursor: next.nextCursor,
        total: next.total ?? total,
      );
}
