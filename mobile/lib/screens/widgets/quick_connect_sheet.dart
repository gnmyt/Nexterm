import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_material_design_icons/flutter_material_design_icons.dart';

import '../../models/server.dart';

Future<Map<String, dynamic>?> showQuickConnectSheet(BuildContext context, Server server) {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => QuickConnectSheet(server: server),
  );
}

List<String> allowedAuthTypesFor(String? protocol) {
  switch (protocol?.toLowerCase()) {
    case 'rdp':
    case 'vnc':
      return const ['password-only', 'password'];
    case 'ssh':
    default:
      return const ['password', 'ssh', 'both'];
  }
}

const Map<String, String> _authLabels = {
  'password-only': 'No Username',
  'password': 'Password',
  'ssh': 'SSH Key',
  'both': 'Key+Pass',
};

class QuickConnectSheet extends StatefulWidget {
  final Server server;

  const QuickConnectSheet({super.key, required this.server});

  @override
  State<QuickConnectSheet> createState() => _QuickConnectSheetState();
}

class _QuickConnectSheetState extends State<QuickConnectSheet> {
  late final List<String> _authOptions;
  late String _authType;

  final _username = TextEditingController();
  final _password = TextEditingController();
  final _passphrase = TextEditingController();

  String? _sshKey;
  String? _keyName;

  @override
  void initState() {
    super.initState();
    _authOptions = allowedAuthTypesFor(widget.server.protocol);
    _authType = _authOptions.first;
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _passphrase.dispose();
    super.dispose();
  }

  bool get _showUsername => _authType != 'password-only';
  bool get _showPassword => _authType == 'password' || _authType == 'password-only' || _authType == 'both';
  bool get _showKey => _authType == 'ssh' || _authType == 'both';

  Future<void> _pickKey() async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    try {
      String content;
      if (file.bytes != null) {
        content = utf8.decode(file.bytes!, allowMalformed: true);
      } else if (file.path != null) {
        content = await File(file.path!).readAsString();
      } else {
        return;
      }
      setState(() {
        _sshKey = content;
        _keyName = file.name;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to read key: $e'), behavior: SnackBarBehavior.floating));
      }
    }
  }

  void _toast(String message) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating));

  bool _validate() {
    if (_showUsername && _username.text.trim().isEmpty) {
      _toast('Username is required');
      return false;
    }
    if (_showPassword && _password.text.isEmpty) {
      _toast('Password is required');
      return false;
    }
    if (_showKey && (_sshKey == null || _sshKey!.isEmpty)) {
      _toast('SSH key is required');
      return false;
    }
    return true;
  }

  void _connect() {
    if (!_validate()) return;

    final directIdentity = <String, dynamic>{'type': _authType};
    if (_showUsername) directIdentity['username'] = _username.text.trim();

    if (_authType == 'password' || _authType == 'password-only') {
      directIdentity['password'] = _password.text;
    } else if (_authType == 'both') {
      directIdentity['password'] = _password.text;
      directIdentity['sshKey'] = _sshKey;
      if (_passphrase.text.isNotEmpty) directIdentity['passphrase'] = _passphrase.text;
    } else {
      directIdentity['sshKey'] = _sshKey;
      if (_passphrase.text.isNotEmpty) directIdentity['passphrase'] = _passphrase.text;
    }

    Navigator.pop(context, directIdentity);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4), width: 36, height: 4,
              decoration: BoxDecoration(color: cs.outlineVariant, borderRadius: BorderRadius.circular(2)),
            )),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
                  child: Icon(MdiIcons.cursorDefaultClick, color: cs.onPrimaryContainer, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Quick Connect', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  Text(widget.server.name, style: TextStyle(fontSize: 12, color: cs.outline), overflow: TextOverflow.ellipsis),
                ])),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (_showUsername) ...[
                  _label('Username'),
                  _field(_username, hint: 'Username', icon: MdiIcons.accountCircleOutline),
                  const SizedBox(height: 14),
                ],
                _label('Authentication'),
                DropdownButtonFormField<String>(
                  initialValue: _authType,
                  decoration: _decoration(icon: MdiIcons.shieldAccountOutline),
                  items: [
                    for (final opt in _authOptions)
                      DropdownMenuItem(value: opt, child: Text(_authLabels[opt] ?? opt)),
                  ],
                  onChanged: (v) { if (v != null) setState(() => _authType = v); },
                ),
                if (_showPassword) ...[
                  const SizedBox(height: 14),
                  _label('Password'),
                  _field(_password, hint: 'Password', icon: MdiIcons.lockOutline, obscure: true),
                ],
                if (_showKey) ...[
                  const SizedBox(height: 14),
                  _label('SSH Private Key'),
                  Material(
                    color: cs.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      onTap: _pickKey,
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        child: Row(children: [
                          Icon(MdiIcons.fileUploadOutline, size: 20, color: cs.outline),
                          const SizedBox(width: 12),
                          Expanded(child: Text(
                            _keyName ?? 'Select key file',
                            style: TextStyle(fontSize: 14, color: _keyName != null ? cs.onSurface : cs.outline),
                            overflow: TextOverflow.ellipsis,
                          )),
                          if (_keyName != null) Icon(MdiIcons.checkCircle, size: 18, color: cs.primary),
                        ]),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _label('Passphrase (optional)'),
                  _field(_passphrase, hint: 'Passphrase', icon: MdiIcons.lockOutline, obscure: true),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _connect,
                    icon: Icon(MdiIcons.connection, size: 18),
                    label: const Text('Connect'),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6, left: 2),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.outline)),
      );

  Widget _field(TextEditingController controller, {required String hint, required IconData icon, bool obscure = false}) => TextField(
        controller: controller,
        obscureText: obscure,
        autocorrect: false,
        enableSuggestions: false,
        decoration: _decoration(hint: hint, icon: icon),
      );

  InputDecoration _decoration({String? hint, required IconData icon}) {
    final cs = Theme.of(context).colorScheme;
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 20),
      filled: true,
      fillColor: cs.surfaceContainerHigh,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: cs.primary, width: 1.5)),
    );
  }
}
