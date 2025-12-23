import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../utils/auth_manager.dart';
import '../utils/api_client.dart';
import '../services/api_config.dart';

class LoginScreen extends StatefulWidget {
  final AuthManager authManager;

  const LoginScreen({super.key, required this.authManager});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serverUrlController = TextEditingController();
  final _serverUrlFocusNode = FocusNode();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _totpController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  final bool _showTotpField = false;
  bool _hasServerUrl = false;
  bool _isCheckingUrl = true;

  @override
  void initState() {
    super.initState();
    _checkServerUrl();
  }

  Future<void> _checkServerUrl() async {
    await ApiConfig.loadFromPrefs();
    setState(() {
      _hasServerUrl =
          ApiConfig.baseUrl != ApiConfig.defaultBaseUrl &&
          ApiConfig.baseUrl.isNotEmpty;
      if (_hasServerUrl) {
        String savedUrl = ApiConfig.baseUrl;
        if (savedUrl.endsWith('/api')) {
          savedUrl = savedUrl.substring(0, savedUrl.length - 4);
        }
        _serverUrlController.text = savedUrl;
      }
      _isCheckingUrl = false;
    });
  }

  Future<void> _saveServerUrl() async {
    final url = _serverUrlController.text.trim();
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a server URL')),
      );
      return;
    }

    final normalizedUrl = ApiClient.normalizeBaseUrl(url);
    await ApiConfig.setBaseUrl(normalizedUrl);

    setState(() {
      _hasServerUrl = true;
    });
  }

  @override
  void dispose() {
    _serverUrlFocusNode.dispose();
    _serverUrlController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _totpController.dispose();
    super.dispose();
  }

  Future<void> _showTotpDialog() async {
    final controller = TextEditingController();
    bool isSubmitting = false;
    String? dialogError;

    Future<void> submitTotp(StateSetter setDialogState, BuildContext dialogContext) async {
      if (controller.text.length != 6) {
        setDialogState(() => dialogError = 'Code must be 6 digits');
        return;
      }
      setDialogState(() {
        isSubmitting = true;
        dialogError = null;
      });

      final error = await widget.authManager.login(
        _usernameController.text,
        _passwordController.text,
        totpCode: int.tryParse(controller.text),
      );

      if (error == null) {
        if (dialogContext.mounted) Navigator.of(dialogContext).pop();
      } else {
        setDialogState(() {
          isSubmitting = false;
          dialogError = error == 'totp_required' ? 'Invalid code' : error;
        });
      }
    }

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: !isSubmitting,
        child: StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            icon: Icon(MdiIcons.shieldKey, size: 48),
            title: const Text('Two-Factor Authentication'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('This account has two-factor authentication enabled.',
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(
                    labelText: 'TOTP Code',
                    hintText: '000000',
                    prefixIcon: Icon(MdiIcons.numeric),
                    border: const OutlineInputBorder(),
                    errorText: dialogError,
                    enabled: !isSubmitting,
                  ),
                  onSubmitted: (_) => submitTotp(setDialogState, dialogContext),
                ),
                const SizedBox(height: 8),
                Text('Enter the 6-digit code from your authenticator app.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant)),
              ],
            ),
            actions: [
              TextButton(
                onPressed: isSubmitting ? null : () => Navigator.of(dialogContext).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: isSubmitting ? null : () => submitTotp(setDialogState, dialogContext),
                child: isSubmitting
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Verify'),
              ),
            ],
          ),
        ),
      ),
    ).then((_) => controller.dispose());
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      int? totpCode;
      if (_showTotpField && _totpController.text.isNotEmpty) {
        totpCode = int.tryParse(_totpController.text);
      }

      final error = await widget.authManager.login(
        _usernameController.text,
        _passwordController.text,
        totpCode: totpCode,
      );

      setState(() {
        _isLoading = false;
      });

      if (error != null && mounted) {
        if (error == 'totp_required') {
          await _showTotpDialog();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(error),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingUrl) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
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
                  TextFormField(
                    controller: _serverUrlController,
                    focusNode: _serverUrlFocusNode,
                    decoration: InputDecoration(
                      labelText: 'Server URL',
                      hintText: 'nexterm.example.com',
                      prefixIcon: Icon(MdiIcons.serverNetwork),
                      border: const OutlineInputBorder(),
                      filled: _hasServerUrl,
                      fillColor: _hasServerUrl
                          ? Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest
                                .withValues(alpha: 0.3)
                          : null,
                      suffixIcon: _hasServerUrl
                          ? IconButton(
                              icon: Icon(MdiIcons.pencil),
                              onPressed: () {
                                String savedUrl = ApiConfig.baseUrl;
                                if (savedUrl.endsWith('/api')) {
                                  savedUrl = savedUrl.substring(
                                    0,
                                    savedUrl.length - 4,
                                  );
                                }
                                savedUrl = savedUrl.replaceFirst(
                                  RegExp(r'^https?://'),
                                  '',
                                );
                                setState(() {
                                  _hasServerUrl = false;
                                  _serverUrlController.text = savedUrl;
                                });
                                _serverUrlFocusNode.requestFocus();
                              },
                            )
                          : null,
                    ),
                    keyboardType: TextInputType.url,
                    enabled: !_isLoading,
                    readOnly: _hasServerUrl,
                  ),
                  if (!_hasServerUrl) ...[
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _isLoading ? null : _saveServerUrl,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Continue'),
                    ),
                  ],
                  if (_hasServerUrl) ...[
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _usernameController,
                      decoration: InputDecoration(
                        labelText: 'Username',
                        prefixIcon: Icon(MdiIcons.accountOutline),
                        border: const OutlineInputBorder(),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your username';
                        }
                        return null;
                      },
                      enabled: !_isLoading,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: Icon(MdiIcons.lockOutline),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? MdiIcons.eyeOutline
                                : MdiIcons.eyeOffOutline,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                        ),
                        border: const OutlineInputBorder(),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your password';
                        }
                        return null;
                      },
                      enabled: !_isLoading,
                      onFieldSubmitted: (_) {
                        if (!_showTotpField) {
                          _handleLogin();
                        }
                      },
                    ),
                    if (_showTotpField) ...[
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _totpController,
                        decoration: InputDecoration(
                          labelText: 'Two-Factor Code',
                          prefixIcon: Icon(MdiIcons.shieldKey),
                          border: const OutlineInputBorder(),
                          helperText:
                              'Enter 6-digit code from your authenticator app',
                        ),
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter your TOTP code';
                          }
                          if (value.length != 6) {
                            return 'TOTP code must be 6 digits';
                          }
                          return null;
                        },
                        enabled: !_isLoading,
                        onFieldSubmitted: (_) => _handleLogin(),
                      ),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _isLoading ? null : _handleLogin,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Login'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
