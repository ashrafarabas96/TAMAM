import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// Captured strokes; each stroke is a list of points in local coordinates.
typedef SignatureStrokes = List<List<Offset>>;

/// A finger-drawn signature, used as proof of delivery.
///
/// Implemented with a [CustomPainter] rather than a package so the stroke style
/// matches the design tokens and the PNG we upload is produced by the same code
/// that drew it (no second rendering path to keep in sync).
class SignaturePad extends StatefulWidget {
  const SignaturePad({
    required this.semanticLabel,
    super.key,
    this.height = 180,
    this.strokeWidth = 2.8,
    this.onChanged,
  });

  /// Describes the pad for screen readers (drawing itself is not accessible,
  /// so the proof-of-delivery sheet also offers a typed receiver name).
  final String semanticLabel;

  final double height;
  final double strokeWidth;

  /// Fires with `true` as soon as there is at least one stroke.
  final ValueChanged<bool>? onChanged;

  @override
  State<SignaturePad> createState() => SignaturePadState();
}

class SignaturePadState extends State<SignaturePad> {
  final SignatureStrokes _strokes = <List<Offset>>[];
  Size _size = Size.zero;

  bool get isEmpty => _strokes.every((List<Offset> stroke) => stroke.length < 2);

  void clear() {
    setState(_strokes.clear);
    widget.onChanged?.call(false);
  }

  /// Rasterises the signature to an opaque white PNG at 2× for legibility.
  ///
  /// Returns `null` when nothing was drawn, so the caller never uploads a blank
  /// image and can keep the "signature optional" rule honest.
  Future<Uint8List?> toPngBytes({double pixelRatio = 2}) async {
    if (isEmpty || _size.isEmpty) return null;
    final ui.PictureRecorder recorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(recorder)..scale(pixelRatio);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, _size.width, _size.height),
      Paint()..color = const Color(0xFFFFFFFF),
    );
    _paintStrokes(canvas, _strokes, const Color(0xFF191922), widget.strokeWidth);
    final ui.Picture picture = recorder.endRecording();
    final ui.Image image = await picture.toImage(
      (_size.width * pixelRatio).round(),
      (_size.height * pixelRatio).round(),
    );
    try {
      final ByteData? data = await image.toByteData(format: ui.ImageByteFormat.png);
      return data?.buffer.asUint8List();
    } finally {
      image.dispose();
      picture.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        _size = Size(constraints.maxWidth, widget.height);
        return Semantics(
          label: widget.semanticLabel,
          child: Container(
            height: widget.height,
            decoration: BoxDecoration(
              color: colors.surfaceAlt,
              borderRadius: BorderRadius.circular(TamamRadius.md),
              border: Border.all(color: colors.border),
            ),
            child: GestureDetector(
              onPanStart: (DragStartDetails details) {
                setState(() => _strokes.add(<Offset>[details.localPosition]));
              },
              onPanUpdate: (DragUpdateDetails details) {
                setState(() {
                  if (_strokes.isEmpty) _strokes.add(<Offset>[]);
                  _strokes.last.add(details.localPosition);
                });
              },
              onPanEnd: (DragEndDetails _) => widget.onChanged?.call(!isEmpty),
              child: CustomPaint(
                size: Size(constraints.maxWidth, widget.height),
                painter: _SignaturePainter(
                  strokes: _strokes,
                  color: colors.textPrimary,
                  strokeWidth: widget.strokeWidth,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

void _paintStrokes(Canvas canvas, SignatureStrokes strokes, Color color, double strokeWidth) {
  final Paint paint = Paint()
    ..color = color
    ..strokeWidth = strokeWidth
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..style = PaintingStyle.stroke;
  for (final List<Offset> stroke in strokes) {
    if (stroke.length < 2) continue;
    final Path path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
    for (int i = 1; i < stroke.length; i++) {
      path.lineTo(stroke[i].dx, stroke[i].dy);
    }
    canvas.drawPath(path, paint);
  }
}

class _SignaturePainter extends CustomPainter {
  const _SignaturePainter({required this.strokes, required this.color, required this.strokeWidth});

  final SignatureStrokes strokes;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) => _paintStrokes(canvas, strokes, color, strokeWidth);

  // The stroke list is mutated in place, so identity comparison would miss
  // every new point; repainting on each drag update is the correct behaviour.
  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
