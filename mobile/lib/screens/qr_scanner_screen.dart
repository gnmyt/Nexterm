import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../utils/auth_manager.dart';
import '../utils/api_client.dart';
import '../services/api_config.dart';
import '../widgets/qr_scanner_page.dart';

class QrScannerScreen extends StatefulWidget {
  final AuthManager authManager;
  const QrScannerScreen({super.key, required this.authManager});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  bool _authorizing = false;
  String? _error, _code, _server;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openScanner());
  }

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

  Future<void> _openScanner() async {
    final result = await Navigator.push<Map<String, String>>(context, MaterialPageRoute(
      builder: (_) => QrScannerPage(
        title: 'Scan QR Code',
        hint: 'Point your camera at the QR code on the login page',
        onDetect: (raw) {
          final parsed = _parse(raw);
          if (parsed == null) return false;
          Navigator.pop(context, parsed);
          return true;
        },
      ),
    ));
    if (!mounted) return;
    if (result == null) { Navigator.pop(context); return; }
    setState(() { _code = result['code']; _server = result['server']; });
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

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    if (_code == null) return const Scaffold(body: SizedBox.shrink());
    return Scaffold(body: SafeArea(child: _confirmBody(cs, tt)));
  }

  Widget _confirmBody(ColorScheme cs, TextTheme tt) => ListView(
    padding: const EdgeInsets.only(bottom: 24),
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 20, 12),
        child: Row(children: [
          IconButton(icon: const Icon(Icons.arrow_back), onPressed: _authorizing ? null : _openScanner),
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
