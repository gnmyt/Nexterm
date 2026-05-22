import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QrScannerPage extends StatefulWidget {
  final String title;
  final String hint;
  final bool Function(String value) onDetect;

  const QrScannerPage({super.key, required this.title, required this.hint, required this.onDetect});

  @override
  State<QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<QrScannerPage> {
  final _controller = MobileScannerController();
  bool _handled = false;
  String? _error;

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    if (widget.onDetect(raw)) {
      _handled = true;
      _controller.stop();
    } else {
      setState(() => _error = 'Invalid QR code');
    }
  }

  void reset() {
    setState(() { _handled = false; _error = null; });
    _controller.start();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 20, 12),
          child: Row(children: [
            IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
            const SizedBox(width: 4),
            Text(widget.title, style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const Spacer(),
            ValueListenableBuilder(
              valueListenable: _controller,
              builder: (_, state, __) => IconButton(
                icon: Icon(state.torchState == TorchState.on ? Icons.flash_on : Icons.flash_off),
                onPressed: () => _controller.toggleTorch(),
              ),
            ),
          ]),
        ),
        Expanded(child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(children: [
              MobileScanner(controller: _controller, onDetect: _onDetect),
              CustomPaint(painter: _OverlayPainter(cs.primary, Colors.black54), child: const SizedBox.expand()),
            ]),
          ),
        )),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(children: [
            Text(widget.hint, style: TextStyle(fontSize: 14, color: cs.outline), textAlign: TextAlign.center),
            if (_error != null) Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: TextStyle(fontSize: 13, color: cs.error), textAlign: TextAlign.center)),
          ]),
        ),
      ])),
    );
  }
}

class _OverlayPainter extends CustomPainter {
  final Color borderColor, overlayColor;
  _OverlayPainter(this.borderColor, this.overlayColor);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width * 0.7, l = (size.width - s) / 2, t = (size.height - s) / 2.5;
    final rrect = RRect.fromRectAndRadius(Rect.fromLTWH(l, t, s, s), const Radius.circular(16));
    canvas.drawPath(
      Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height))..addRRect(rrect)..fillType = PathFillType.evenOdd,
      Paint()..color = overlayColor,
    );

    final cl = 28.0, r = 16.0, rect = rrect.outerRect;
    final p = Paint()..color = borderColor..strokeWidth = 4..style = PaintingStyle.stroke..strokeCap = StrokeCap.round;
    for (final c in [
      [rect.left, rect.top + cl, rect.left, rect.top + r, rect.left, rect.top, rect.left + r, rect.top, rect.left + cl, rect.top],
      [rect.right - cl, rect.top, rect.right - r, rect.top, rect.right, rect.top, rect.right, rect.top + r, rect.right, rect.top + cl],
      [rect.left, rect.bottom - cl, rect.left, rect.bottom - r, rect.left, rect.bottom, rect.left + r, rect.bottom, rect.left + cl, rect.bottom],
      [rect.right - cl, rect.bottom, rect.right - r, rect.bottom, rect.right, rect.bottom, rect.right, rect.bottom - r, rect.right, rect.bottom - cl],
    ]) {
      canvas.drawPath(Path()..moveTo(c[0], c[1])..lineTo(c[2], c[3])..quadraticBezierTo(c[4], c[5], c[6], c[7])..lineTo(c[8], c[9]), p);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
