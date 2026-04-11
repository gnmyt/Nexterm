import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../utils/auth_manager.dart';
import '../utils/api_client.dart';
import '../services/api_config.dart';

class QrScannerScreen extends StatefulWidget {
  final AuthManager authManager;
  const QrScannerScreen({super.key, required this.authManager});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final _controller = MobileScannerController();
  bool _scanned = false, _authorizing = false;
  String? _error, _code, _server;

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  Map<String, String>? _parse(String value) {
    try {
      final uri = Uri.parse(value);
      if (uri.scheme == 'nexterm' && uri.host == 'authorize') {
        final code = uri.queryParameters['code'], server = uri.queryParameters['server'];
        if (code != null && server != null) return {'code': code, 'server': Uri.decodeComponent(server)};
      }
    } catch (_) {}
    return null;
  }

  void _onDetect(BarcodeCapture capture) {
    if (_scanned || _authorizing) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    final parsed = _parse(raw);
    if (parsed == null) { setState(() => _error = 'Invalid QR code'); return; }
    setState(() { _scanned = true; _code = parsed['code']; _server = parsed['server']; _error = null; });
    _controller.stop();
  }

  String _norm(String url) {
    url = url.trim().toLowerCase().replaceAll(RegExp(r'/+$'), '');
    return url.endsWith('/api') ? url.substring(0, url.length - 4) : url;
  }

  Future<void> _authorize() async {
    if (_code == null || _server == null) return;
    setState(() { _authorizing = true; _error = null; });

    final target = _norm(_server!);
    final account = widget.authManager.accountManager.accounts.cast<dynamic>().firstWhere(
      (a) { final n = _norm(a.baseUrl); return n == target || n == '$target/api' || '$target/api' == n; },
      orElse: () => null,
    );
    if (account == null) { setState(() { _error = 'No matching account found'; _authorizing = false; }); return; }

    final prev = ApiConfig.baseUrl;
    ApiConfig.setBaseUrlSync(account.baseUrl);
    try {
      final resp = await ApiClient.post('/auth/device/authorize', body: {'code': _code}, token: account.token);
      final data = json.decode(resp.body);
      if (resp.statusCode == 200 && !(data['code'] is int)) {
        if (mounted) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Login authorized'))); Navigator.pop(context); }
      } else {
        setState(() { _error = data['message'] ?? 'Authorization failed'; _authorizing = false; });
      }
    } catch (_) {
      setState(() { _error = 'Connection error'; _authorizing = false; });
    } finally { ApiConfig.setBaseUrlSync(prev); }
  }

  void _reset() {
    setState(() { _scanned = false; _authorizing = false; _code = null; _server = null; _error = null; });
    _controller.start();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(child: _scanned ? _confirmBody(cs, tt) : _scanBody(cs, tt)),
    );
  }

  Widget _scanBody(ColorScheme cs, TextTheme tt) => Column(children: [
    Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 20, 12),
      child: Row(children: [
        IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
        const SizedBox(width: 4),
        Text('Scan QR Code', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
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
        Text('Point your camera at the QR code on the login page',
          style: TextStyle(fontSize: 14, color: cs.outline), textAlign: TextAlign.center),
        if (_error != null) Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(_error!, style: TextStyle(fontSize: 13, color: cs.error), textAlign: TextAlign.center),
        ),
      ]),
    ),
  ]);

  Widget _confirmBody(ColorScheme cs, TextTheme tt) => ListView(
    padding: const EdgeInsets.only(bottom: 24),
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 20, 12),
        child: Row(children: [
          IconButton(icon: const Icon(Icons.arrow_back), onPressed: _authorizing ? null : _reset),
          const SizedBox(width: 4),
          Text('Authorize Login', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(14)),
              child: Icon(MdiIcons.monitorSmall, color: cs.onPrimaryContainer, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Web Login Request', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              Padding(padding: const EdgeInsets.only(top: 2),
                child: Text(_server ?? '', style: TextStyle(fontSize: 12, color: cs.outline), overflow: TextOverflow.ellipsis)),
            ])),
          ]),
        ),
      ),
      const SizedBox(height: 4),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(16)),
          child: Column(children: [
            _detailRow(MdiIcons.key, 'Device Code', _code ?? '', cs),
            Divider(height: 1, indent: 56, color: cs.outlineVariant.withValues(alpha: 0.3)),
            _detailRow(MdiIcons.web, 'Server', _server ?? '', cs),
          ]),
        ),
      ),
      if (_error != null) Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: cs.errorContainer, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            Icon(MdiIcons.alertCircle, color: cs.onErrorContainer, size: 18),
            const SizedBox(width: 10),
            Expanded(child: Text(_error!, style: TextStyle(fontSize: 13, color: cs.onErrorContainer))),
          ]),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
        child: FilledButton(
          onPressed: _authorizing ? null : _authorize,
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: _authorizing
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : const Text('Approve'),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: OutlinedButton(
          onPressed: _authorizing ? null : () => Navigator.pop(context),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('Cancel'),
        ),
      ),
    ],
  );

  Widget _detailRow(IconData icon, String label, String value, ColorScheme cs) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    child: Row(children: [
      Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: cs.onPrimaryContainer, size: 18),
      ),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 12, color: cs.outline)),
        Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
      ])),
    ]),
  );
}

class _OverlayPainter extends CustomPainter {
  final Color borderColor, overlayColor;
  _OverlayPainter(this.borderColor, this.overlayColor);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width * 0.7, l = (size.width - s) / 2, t = (size.height - s) / 2.5;
    final rrect = RRect.fromRectAndRadius(Rect.fromLTWH(l, t, s, s), const Radius.circular(16));
    canvas.drawPath(Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height))..addRRect(rrect)..fillType = PathFillType.evenOdd, Paint()..color = overlayColor);

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
