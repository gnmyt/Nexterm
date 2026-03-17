import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../utils/auth_manager.dart';
import '../utils/api_client.dart';
import '../services/api_config.dart';
import '../services/device_code_service.dart';

class DeviceSetupScreen extends StatefulWidget {
  final AuthManager authManager;

  const DeviceSetupScreen({super.key, required this.authManager});

  @override
  State<DeviceSetupScreen> createState() => _DeviceSetupScreenState();
}

class _DeviceSetupScreenState extends State<DeviceSetupScreen> {
  final _serverUrlController = TextEditingController();
  final _serverUrlFocusNode = FocusNode();
  final _deviceCodeService = DeviceCodeService();

  int _step = 1;
  bool _isLoading = false;
  bool _showCode = false;
  
  String? _deviceCode;
  String? _deviceToken;
  Timer? _pollTimer;
  
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkExistingServerUrl();
  }

  Future<void> _checkExistingServerUrl() async {
    await ApiConfig.loadFromPrefs();
    if (ApiConfig.baseUrl != ApiConfig.defaultBaseUrl && ApiConfig.baseUrl.isNotEmpty) {
      String savedUrl = ApiConfig.baseUrl;
      if (savedUrl.endsWith('/api')) {
        savedUrl = savedUrl.substring(0, savedUrl.length - 4);
      }
      savedUrl = savedUrl.replaceFirst(RegExp(r'^https?://'), '');
      _serverUrlController.text = savedUrl;
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _serverUrlController.dispose();
    _serverUrlFocusNode.dispose();
    super.dispose();
  }

  Future<void> _validateAndConnect() async {
    final url = _serverUrlController.text.trim();
    if (url.isEmpty) {
      setState(() => _error = 'Please enter a server URL');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final normalizedUrl = ApiClient.normalizeBaseUrl(url);
    
    try {
      final response = await ApiClient.get('/service/is-fts');
      if (response.statusCode == 200) {
        await ApiConfig.setBaseUrl(normalizedUrl);
        await _createDeviceCode();
        setState(() {
          _step = 2;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to connect to server';
          _isLoading = false;
        });
      }
    } catch (e) {
      await ApiConfig.setBaseUrl(normalizedUrl);
      try {
        final retryResponse = await ApiClient.get('/service/is-fts');
        if (retryResponse.statusCode == 200) {
          await _createDeviceCode();
          setState(() {
            _step = 2;
            _isLoading = false;
          });
        } else {
          setState(() {
            _error = 'Failed to connect to server';
            _isLoading = false;
          });
        }
      } catch (e) {
        setState(() {
          _error = 'Failed to connect to server. Please check the URL.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _createDeviceCode() async {
    final response = await _deviceCodeService.createCode();
    if (response.error != null) {
      setState(() => _error = response.error);
      return;
    }
    setState(() {
      _deviceCode = response.code;
      _deviceToken = response.token;
    });
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _pollForAuth());
  }

  Future<void> _pollForAuth() async {
    if (_deviceToken == null) return;

    final response = await _deviceCodeService.pollToken(_deviceToken!);
    
    if (response.isAuthorized && response.token != null) {
      _pollTimer?.cancel();
      await widget.authManager.loginWithToken(response.token!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Successfully authenticated!')),
        );
      }
    } else if (response.isInvalid) {
      await _createDeviceCode();
    }
  }

  void _handleShowCode() {
    setState(() => _showCode = true);
    _startPolling();
  }

  Future<void> _handleOpenBrowser() async {
    if (_deviceCode == null) return;
    
    String baseUrl = ApiConfig.baseUrl;
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.substring(0, baseUrl.length - 4);
    }
    
    final linkUrl = Uri.parse('$baseUrl/link?code=$_deviceCode');
    
    try {
      await launchUrl(linkUrl, mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open browser: $e')),
        );
      }
    }
    
    _startPolling();
  }

  Future<void> _copyCode() async {
    if (_deviceCode == null) return;
    await Clipboard.setData(ClipboardData(text: _deviceCode!));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Code copied to clipboard')),
      );
    }
  }

  void _goBack() {
    _pollTimer?.cancel();
    setState(() {
      _step = 1;
      _showCode = false;
      _deviceCode = null;
      _deviceToken = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset(
                    'favicon.png',
                    width: 100,
                    height: 100,
                    fit: BoxFit.contain,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'Nexterm',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                
                if (_step == 1) _buildServerUrlStep(colorScheme),
                if (_step == 2 && !_showCode) _buildAuthChoiceStep(colorScheme),
                if (_step == 2 && _showCode) _buildCodeDisplayStep(colorScheme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildServerUrlStep(ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Enter the URL of your Nexterm server to connect.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        TextFormField(
          controller: _serverUrlController,
          focusNode: _serverUrlFocusNode,
          decoration: InputDecoration(
            labelText: 'Server URL',
            hintText: 'nexterm.example.com',
            prefixIcon: Icon(MdiIcons.serverNetwork),
            border: const OutlineInputBorder(),
            errorText: _error,
          ),
          keyboardType: TextInputType.url,
          enabled: !_isLoading,
          onFieldSubmitted: (_) => _validateAndConnect(),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _isLoading ? null : _validateAndConnect,
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
          child: _isLoading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Connect'),
        ),
      ],
    );
  }

  Widget _buildAuthChoiceStep(ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Choose how you want to authenticate with the server.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        
        _AuthOptionCard(
          icon: MdiIcons.qrcode,
          title: 'Show Code',
          description: 'Display a code to enter on the web interface',
          onTap: _handleShowCode,
          colorScheme: colorScheme,
        ),
        const SizedBox(height: 12),
        _AuthOptionCard(
          icon: MdiIcons.openInNew,
          title: 'Open in Browser',
          description: 'Open your browser to authorize automatically',
          onTap: _handleOpenBrowser,
          colorScheme: colorScheme,
        ),
        
        const SizedBox(height: 24),
        OutlinedButton(
          onPressed: _goBack,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
          child: const Text('Back'),
        ),
      ],
    );
  }

  Widget _buildCodeDisplayStep(ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Enter this code on your Nexterm web interface or open in browser to authorize.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _deviceCode ?? '----',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                  letterSpacing: 4,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(width: 16),
              IconButton(
                onPressed: _copyCode,
                icon: Icon(MdiIcons.contentCopy),
                tooltip: 'Copy code',
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 24),
        
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Waiting for authorization...',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 32),
        
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _goBack,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: _handleOpenBrowser,
                icon: Icon(MdiIcons.openInNew),
                label: const Text('Open Browser'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _AuthOptionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;
  final ColorScheme colorScheme;

  const _AuthOptionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
    required this.colorScheme,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: colorScheme.surfaceContainerHighest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Icon(icon, size: 40, color: colorScheme.primary),
              const SizedBox(height: 12),
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
