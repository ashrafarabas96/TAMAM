import 'package:latlong2/latlong.dart';

/// Decoder for Google's encoded-polyline format, which the pricing service uses
/// for `routePolyline`.
abstract final class PolylineCodec {
  /// Returns an empty list for an empty or malformed payload — a broken route
  /// must degrade to "no line drawn", never to a crash.
  static List<LatLng> decode(String? encoded, {int precision = 5}) {
    if (encoded == null || encoded.isEmpty) return const <LatLng>[];
    final double factor = _pow10(precision).toDouble();
    final List<LatLng> points = <LatLng>[];
    final int length = encoded.length;
    int index = 0;
    int lat = 0;
    int lng = 0;

    while (index < length) {
      int shift = 0;
      int result = 0;
      int byte;
      // latitude delta
      do {
        if (index >= length) return points;
        byte = encoded.codeUnitAt(index++) - 63;
        if (byte < 0) return points;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += (result & 1) != 0 ? ~(result >> 1) : result >> 1;

      shift = 0;
      result = 0;
      // longitude delta
      do {
        if (index >= length) return points;
        byte = encoded.codeUnitAt(index++) - 63;
        if (byte < 0) return points;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += (result & 1) != 0 ? ~(result >> 1) : result >> 1;

      points.add(LatLng(lat / factor, lng / factor));
    }
    return points;
  }

  static int _pow10(int exponent) {
    int result = 1;
    for (int i = 0; i < exponent; i++) {
      result *= 10;
    }
    return result;
  }
}
