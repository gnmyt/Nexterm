import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';
import '../utils/auth_manager.dart';
import '../utils/api_client.dart';
import '../services/api_config.dart';
import '../services/device_code_service.dart';

class DeviceSetupScreen extends StatefulWidget {
  final AuthManager authManager;
  final bool isAddingServer;

  const DeviceSetupScreen({super.key, required this.authManager, this.isAddingServer = false});

  @override
  State<DeviceSetupScreen> createState() => _DeviceSetupScreenState();
}

enum _SubStep { choice, code, qrWaiting }

class _DeviceSetupScreenState extends State<DeviceSetupScreen> {
  final _urlController = TextEditingController();
  final _urlFocus = FocusNode();
  final _codeService = DeviceCodeService();

  int _step = 1;
  _SubStep _subStep = _SubStep.choice;
  bool _isLoading = false;
  bool _loggedIn = false;
  String? _deviceCode, _deviceToken, _error, _previousBaseUrl;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _previousBaseUrl = ApiConfig.baseUrl;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    if (widget.isAddingServer && _previousBaseUrl != null && !_loggedIn) {
      ApiConfig.setBaseUrlSync(_previousBaseUrl!);
    }
    _urlController.dispose();
    _urlFocus.dispose();
    super.dispose();
  }

  Future<bool> _tryConnect(String url) async {
    ApiConfig.setBaseUrlSync(ApiClient.normalizeBaseUrl(url));
    try {
      return (await ApiClient.get('/service/is-fts')).statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<void> _validateAndConnect() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) { setState(() => _error = 'Please enter a server URL'); return; }
    setState(() { _isLoading = true; _error = null; });
    if (await _tryConnect(url)) {
      await _createDeviceCode();
      setState(() { _step = 2; _isLoading = false; });
    } else {
      setState(() { _error = 'Failed to connect to server'; _isLoading = false; });
    }
  }

  Future<void> _createDeviceCode() async {
    final r = await _codeService.createCode();
    if (r.error != null) { setState(() => _error = r.error); return; }
    setState(() { _deviceCode = r.code; _deviceToken = r.token; });
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _pollForAuth());
  }

  Future<void> _pollForAuth() async {
    if (_deviceToken == null) return;
    final r = await _codeService.pollToken(_deviceToken!);
    if (r.isAuthorized && r.token != null) {
      _pollTimer?.cancel();
      _loggedIn = true;
      final label = _urlController.text.trim().replaceFirst(RegExp(r'^https?://'), '');
      await widget.authManager.loginWithToken(r.token!, baseUrl: ApiConfig.baseUrl, label: label);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Successfully authenticated!')));
        if (widget.isAddingServer) Navigator.pop(context);
      }
    } else if (r.isInvalid) {
      await _createDeviceCode();
    }
  }

  void _handleShowCode() {
    setState(() => _subStep = _SubStep.code);
    _startPolling();
  }

  Future<void> _handleScanQr() async {
    final result = await Navigator.push<Map<String, String>>(
      context, MaterialPageRoute(builder: (_) => const _QrScannerPage()),
    );
    if (result == null || !mounted) return;
    final token = result['token'], server = result['server'];
    if (token == null || server == null) return;
    setState(() { _isLoading = true; _error = null; });
    if (await _tryConnect(Uri.decodeComponent(server))) {
      _urlController.text = Uri.decodeComponent(server);
      _deviceToken = token;
      _startPolling();
      setState(() { _step = 2; _subStep = _SubStep.qrWaiting; _isLoading = false; });
    } else {
      setState(() { _error = 'Failed to connect to server'; _isLoading = false; });
    }
  }

  Future<void> _handleOpenBrowser() async {
    if (_deviceCode == null) return;
    var baseUrl = ApiConfig.baseUrl;
    if (baseUrl.endsWith('/api')) baseUrl = baseUrl.substring(0, baseUrl.length - 4);
    try {
      await launchUrl(Uri.parse('$baseUrl/link?code=$_deviceCode'), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not open browser: $e')));
    }
    _startPolling();
  }

  Future<void> _copyCode() async {
    if (_deviceCode == null) return;
    await Clipboard.setData(ClipboardData(text: _deviceCode!));
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Code copied to clipboard')));
  }

  void _goBack() {
    _pollTimer?.cancel();
    setState(() { _step = 1; _subStep = _SubStep.choice; _deviceCode = null; _deviceToken = null; _error = null; });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: widget.isAddingServer ? AppBar(title: const Text('Add Server')) : null,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset('favicon.png', width: 100, height: 100, fit: BoxFit.contain),
                ),
                const SizedBox(height: 24),
                Text('Nexterm', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                const SizedBox(height: 48),
                if (_step == 1) _buildServerUrlStep(cs),
                if (_step == 2 && _subStep == _SubStep.choice) _buildAuthChoiceStep(cs),
                if (_step == 2 && _subStep == _SubStep.code) _buildCodeDisplayStep(cs),
                if (_step == 2 && _subStep == _SubStep.qrWaiting) _buildQrWaitingStep(cs),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildServerUrlStep(ColorScheme cs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Enter the URL of your Nexterm server to connect.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant), textAlign: TextAlign.center),
        const SizedBox(height: 24),
        TextFormField(
          controller: _urlController, focusNode: _urlFocus,
          decoration: InputDecoration(
            labelText: 'Server URL', hintText: 'nexterm.example.com',
            prefixIcon: Icon(MdiIcons.serverNetwork), border: const OutlineInputBorder(), errorText: _error,
          ),
          keyboardType: TextInputType.url, enabled: !_isLoading,
          onFieldSubmitted: (_) => _validateAndConnect(),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _isLoading ? null : _validateAndConnect,
          style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
          child: _isLoading
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : const Text('Connect'),
        ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: Divider(color: cs.outlineVariant)),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text('or', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant))),
          Expanded(child: Divider(color: cs.outlineVariant)),
        ]),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _isLoading ? null : _handleScanQr,
          icon: Icon(MdiIcons.qrcodeScan), label: const Text('Scan QR Code'),
          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
        ),
      ],
    );
  }

  Widget _authOption(ColorScheme cs, {required IconData icon, required String title, required String subtitle, required VoidCallback onTap}) {
    return Card(
      elevation: 0, color: cs.surfaceContainerHigh,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
        leading: Container(
          width: 42, height: 42,
          decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: cs.onPrimaryContainer, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
        trailing: Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
    );
  }

  Widget _buildAuthChoiceStep(ColorScheme cs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Choose how to authenticate with the server.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant), textAlign: TextAlign.center),
        const SizedBox(height: 24),
        _authOption(cs, icon: MdiIcons.numeric, title: 'Enter Code', subtitle: 'Display a code to enter on the web interface', onTap: _handleShowCode),
        const SizedBox(height: 8),
        _authOption(cs, icon: MdiIcons.openInNew, title: 'Open in Browser', subtitle: 'Open your browser to authorize', onTap: _handleOpenBrowser),
        const SizedBox(height: 24),
        OutlinedButton(onPressed: _goBack,
          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)), child: const Text('Back')),
      ],
    );
  }

  Widget _waitingIndicator(ColorScheme cs, String label) {
    return Column(children: [
      Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant)),
      const SizedBox(height: 16),
      ClipRRect(borderRadius: BorderRadius.circular(4), child: const LinearProgressIndicator()),
    ]);
  }

  Widget _buildCodeDisplayStep(ColorScheme cs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Enter this code on your Nexterm web interface.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant), textAlign: TextAlign.center),
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(color: cs.surfaceContainerHighest, borderRadius: BorderRadius.circular(16)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(_deviceCode ?? '----',
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                fontWeight: FontWeight.bold, fontFamily: 'monospace', letterSpacing: 4, color: cs.primary)),
            const SizedBox(width: 16),
            IconButton(onPressed: _copyCode, icon: Icon(MdiIcons.contentCopy), tooltip: 'Copy code'),
          ]),
        ),
        const SizedBox(height: 24),
        _waitingIndicator(cs, 'Waiting for authorization...'),
        const SizedBox(height: 32),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: _goBack,
            style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)), child: const Text('Back'))),
          const SizedBox(width: 12),
          Expanded(child: FilledButton.icon(onPressed: _handleOpenBrowser, icon: Icon(MdiIcons.openInNew), label: const Text('Open Browser'),
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)))),
        ]),
      ],
    );
  }

  Widget _buildQrWaitingStep(ColorScheme cs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        _waitingIndicator(cs, 'Connecting to server...'),
        const SizedBox(height: 32),
        OutlinedButton(onPressed: _goBack,
          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)), child: const Text('Cancel')),
      ],
    );
  }
}

class _QrScannerPage extends StatefulWidget {
  const _QrScannerPage();
  @override
  State<_QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<_QrScannerPage> {
  final _controller = MobileScannerController();
  bool _handled = false;
  String? _error;

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    try {
      final uri = Uri.parse(raw);
      if (uri.scheme == 'nexterm' && uri.host == 'devicelink') {
        final token = uri.queryParameters['token'];
        final server = uri.queryParameters['server'];
        if (token != null && server != null) {
          _handled = true;
          _controller.stop();
          Navigator.pop(context, {'token': token, 'server': server});
          return;
        }
      }
    } catch (_) {}
    setState(() => _error = 'Invalid QR code. Use the Link Device feature in your web browser.');
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
          child: ClipRRect(borderRadius: BorderRadius.circular(16), child: MobileScanner(controller: _controller, onDetect: _onDetect)),
        )),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(children: [
            Text('Open "Link Device" in your web browser and scan the QR code shown there.',
              style: TextStyle(fontSize: 14, color: cs.outline), textAlign: TextAlign.center),
            if (_error != null) Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: TextStyle(fontSize: 13, color: cs.error), textAlign: TextAlign.center)),
          ]),
        ),
      ])),
    );
  }
}
