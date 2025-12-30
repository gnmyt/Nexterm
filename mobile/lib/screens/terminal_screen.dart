import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:xterm/xterm.dart';
import 'package:web_socket_channel/io.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:async';
import '../models/server.dart';
import '../utils/auth_manager.dart';
import '../utils/snippet_manager.dart';
import '../utils/api_client.dart';
import '../services/connection_service.dart';

class TerminalScreen extends StatefulWidget {
  final Server server;
  final AuthManager authManager;
  final SnippetManager snippetManager;

  const TerminalScreen({
    super.key,
    required this.server,
    required this.authManager,
    required this.snippetManager,
  });

  @override
  State<TerminalScreen> createState() => _TerminalScreenState();
}

class _TerminalScreenState extends State<TerminalScreen> {
  late Terminal terminal;
  IOWebSocketChannel? _channel;
  StreamSubscription? _channelSubscription;
  bool _connected = false;
  String? _errorMessage;
  final FocusNode _terminalFocusNode = FocusNode();
  bool _showKeyboardToolbar = false;
  bool _ctrlPressed = false;
  bool _altPressed = false;
  String? _currentSessionId;

  @override
  void initState() {
    super.initState();
    _terminalFocusNode.addListener(() {
      if (mounted) setState(() => _showKeyboardToolbar = _terminalFocusNode.hasFocus);
    });
    terminal = Terminal(maxLines: 10000);
    terminal.onOutput = (data) {
      if (!mounted || _channel == null) return;
      String processed = data;
      if ((_ctrlPressed || _altPressed) && data.length == 1) {
        final code = data.codeUnitAt(0);
        if (_ctrlPressed) {
          if (code >= 65 && code <= 90) {
            processed = String.fromCharCode(code - 64);
          } else if (code >= 97 && code <= 122) {
            processed = String.fromCharCode(code - 96);
          }
        } else if (_altPressed) {
          processed = '\x1b$data';
        }
        if (mounted) setState(() { _ctrlPressed = false; _altPressed = false; });
      }
      _channel?.sink.add(processed);
    };
    terminal.onResize = (w, h, _, __) {
      if (mounted && _connected && _channel != null) _channel?.sink.add('\x01$w,$h');
    };
    _connectToServer();
  }

  void _connectToServer() async {
    try {
      if (mounted) setState(() => _errorMessage = null);
      terminal.write('Connecting to ${widget.server.name}...\r\n');

      final token = widget.authManager.sessionToken;
      if (token == null) {
        if (mounted) setState(() => _errorMessage = 'No session token available');
        terminal.write('Error: Not authenticated\r\n');
        return;
      }

      final isPve = widget.server.isPve;
      final isTelnet = widget.server.protocol == 'telnet';
      final identityId = widget.server.identities?.isNotEmpty == true ? widget.server.identities!.first : null;

      if (!isPve && !isTelnet && identityId == null) {
        if (mounted) setState(() => _errorMessage = 'No identity configured for this server');
        terminal.write('Error: No identity configured\r\n');
        return;
      }

      terminal.write('Creating session...\r\n');
      final session = await ConnectionService.createSession(
        token: token,
        entryId: widget.server.id is int ? widget.server.id : int.parse(widget.server.id.toString()),
        identityId: identityId ?? 0,
      );
      _currentSessionId = session.sessionId;

      final queryParams = <String, String>{
        'sessionToken': token,
        'entryId': widget.server.id.toString(),
        'sessionId': session.sessionId,
        if (identityId != null) 'identityId': identityId.toString(),
      };

      _channel = IOWebSocketChannel.connect(
        Uri.parse(ApiClient.buildWebSocketUrl('/ws/term', queryParams: queryParams)),
        headers: {'User-Agent': ApiClient.userAgent},
      );
      _channelSubscription = _channel!.stream.listen(
        (data) {
          if (data is String) {
            terminal.write(data.startsWith('\x02') ? data.substring(1) : data);
          }
        },
        onError: (error) {
          if (mounted) setState(() { _errorMessage = 'Connection error: $error'; _connected = false; });
          terminal.write('\r\nConnection error: $error\r\n');
        },
        onDone: () {
          if (mounted) setState(() => _connected = false);
          terminal.write('\r\nConnection closed\r\n');
        },
      );

      if (mounted) setState(() => _connected = true);
      await Future.delayed(const Duration(milliseconds: 100));
      _channel?.sink.add(terminal.viewHeight > 0 && terminal.viewWidth > 0
          ? '\x01${terminal.viewWidth},${terminal.viewHeight}'
          : '\x0180,30');
    } catch (e) {
      if (mounted) setState(() { _errorMessage = 'Failed to connect: $e'; _connected = false; });
      terminal.write('Failed to connect: $e\r\n');
    }
  }

  void _disconnect() {
    _channelSubscription?.cancel();
    _channel?.sink.close();
    if (_currentSessionId != null && widget.authManager.sessionToken != null) {
      ConnectionService.deleteSession(token: widget.authManager.sessionToken!, sessionId: _currentSessionId!);
      _currentSessionId = null;
    }
    if (mounted) setState(() => _connected = false);
  }

  void _sendSpecialKey(String key) {
    String seq = '';
    switch (key) {
      case 'CTRL': if (mounted) setState(() => _ctrlPressed = !_ctrlPressed); return;
      case 'ALT': if (mounted) setState(() => _altPressed = !_altPressed); return;
      case 'ESC': seq = '\x1b'; break;
      case 'TAB': seq = '\t'; break;
      case 'UP': seq = '\x1b[A'; break;
      case 'DOWN': seq = '\x1b[B'; break;
      case 'LEFT': seq = '\x1b[D'; break;
      case 'RIGHT': seq = '\x1b[C'; break;
      case 'HOME': seq = '\x1b[H'; break;
      case 'END': seq = '\x1b[F'; break;
      case 'PGUP': seq = '\x1b[5~'; break;
      case 'PGDN': seq = '\x1b[6~'; break;
      default:
        if (key.length == 1) {
          final code = key.codeUnitAt(0);
          if (_ctrlPressed) {
            if (code >= 65 && code <= 90) {
              seq = String.fromCharCode(code - 64);
            } else if (code >= 97 && code <= 122) {
              seq = String.fromCharCode(code - 96);
            }
          } else if (_altPressed) {
            seq = '\x1b$key';
          } else {
            seq = key;
          }
        }
    }
    if (seq.isNotEmpty) {
      _channel?.sink.add(seq);
      if (mounted) setState(() { _ctrlPressed = false; _altPressed = false; });
    }
  }

  Widget _buildKeyboardToolbar() {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainer,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8, offset: const Offset(0, -2))],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              _buildToolbarButton('ESC'), const SizedBox(width: 8),
              _buildToolbarButton('TAB'), const SizedBox(width: 8),
              _buildToolbarButton('CTRL', isToggle: true, isActive: _ctrlPressed), const SizedBox(width: 8),
              _buildToolbarButton('ALT', isToggle: true, isActive: _altPressed), const SizedBox(width: 16),
              _buildToolbarButton('^C', onPressed: () => _channel?.sink.add('\x03'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('^Z', onPressed: () => _channel?.sink.add('\x1a'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('^D', onPressed: () => _channel?.sink.add('\x04'), compact: true), const SizedBox(width: 16),
              _buildToolbarButton('↑', onPressed: () => _sendSpecialKey('UP'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('↓', onPressed: () => _sendSpecialKey('DOWN'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('←', onPressed: () => _sendSpecialKey('LEFT'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('→', onPressed: () => _sendSpecialKey('RIGHT'), compact: true), const SizedBox(width: 16),
              _buildToolbarButton('HOME', compact: true), const SizedBox(width: 8),
              _buildToolbarButton('END', compact: true), const SizedBox(width: 8),
              _buildToolbarButton('PGUP', compact: true), const SizedBox(width: 8),
              _buildToolbarButton('PGDN', compact: true), const SizedBox(width: 16),
              _buildToolbarButton('-', onPressed: () => _channel?.sink.add('-'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('|', onPressed: () => _channel?.sink.add('|'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('/', onPressed: () => _channel?.sink.add('/'), compact: true), const SizedBox(width: 8),
              _buildToolbarButton('~', onPressed: () => _channel?.sink.add('~'), compact: true),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _buildToolbarButton(String label, {VoidCallback? onPressed, IconData? icon, bool isToggle = false, bool isActive = false, bool compact = false}) {
    final theme = Theme.of(context);
    final bgColor = isActive ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHighest;
    final fgColor = isActive ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface;
    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(12),
      elevation: isActive ? 2 : 0,
      child: InkWell(
        onTap: onPressed ?? () => _sendSpecialKey(label),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: BoxConstraints(minWidth: compact ? 44 : 56, minHeight: 44),
          padding: EdgeInsets.symmetric(horizontal: compact ? 12 : 16, vertical: 10),
          child: icon != null
              ? Column(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(icon, size: 18, color: fgColor),
                  const SizedBox(height: 2),
                  Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: fgColor)),
                ])
              : Center(child: Text(label, style: TextStyle(fontSize: compact ? 13 : 14, fontWeight: FontWeight.w600, letterSpacing: 0.2, color: fgColor))),
        ),
      ),
    );
  }

  void _showSnippets() {
    if (!mounted) return;
    final token = widget.authManager.sessionToken;
    if (token == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Not authenticated')));
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      clipBehavior: Clip.antiAliasWithSaveLayer,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7, minChildSize: 0.5, maxChildSize: 0.95, expand: false,
        builder: (ctx, scrollController) {
          final sm = widget.snippetManager;
          if (sm.isLoading) return const Center(child: CircularProgressIndicator());
          if (sm.error != null) {
            return Center(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(MdiIcons.alertCircleOutline, size: 48, color: Theme.of(ctx).colorScheme.error),
                const SizedBox(height: 16),
                Text('Failed to load snippets', style: Theme.of(ctx).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(sm.error!, style: Theme.of(ctx).textTheme.bodySmall, textAlign: TextAlign.center),
              ]),
            ));
          }
          if (sm.snippets.isEmpty) {
            return Center(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(MdiIcons.codeBracesBox, size: 48, color: Theme.of(ctx).colorScheme.onSurfaceVariant),
                const SizedBox(height: 16),
                Text('No snippets available', style: Theme.of(ctx).textTheme.titleMedium),
              ]),
            ));
          }
          return Column(children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(ctx).colorScheme.surface,
                border: Border(bottom: BorderSide(color: Theme.of(ctx).colorScheme.outlineVariant)),
              ),
              child: Row(children: [
                Icon(MdiIcons.codeBraces, color: Theme.of(ctx).colorScheme.primary),
                const SizedBox(width: 12),
                Text('Snippets', style: Theme.of(ctx).textTheme.titleLarge),
                const Spacer(),
                IconButton(icon: Icon(MdiIcons.close), onPressed: () => Navigator.pop(ctx)),
              ]),
            ),
            Expanded(child: ListView.builder(
              controller: scrollController,
              itemCount: sm.snippets.length,
              itemBuilder: (ctx, i) {
                final s = sm.snippets[i];
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Theme.of(ctx).colorScheme.primaryContainer,
                    child: Icon(MdiIcons.console, color: Theme.of(ctx).colorScheme.onPrimaryContainer, size: 20),
                  ),
                  title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: s.description != null ? Text(s.description!, maxLines: 2, overflow: TextOverflow.ellipsis) : null,
                  trailing: Icon(MdiIcons.chevronRight, size: 16),
                  onTap: () { Navigator.pop(ctx); _channel?.sink.add(s.command); },
                );
              },
            )),
          ]);
        },
      ),
    );
  }

  @override
  void dispose() {
    _channelSubscription?.cancel();
    _channel?.sink.close();
    if (_currentSessionId != null && widget.authManager.sessionToken != null) {
      ConnectionService.deleteSession(token: widget.authManager.sessionToken!, sessionId: _currentSessionId!);
    }
    _terminalFocusNode.dispose();
    terminal.onOutput = null;
    terminal.onResize = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) { _disconnect(); Navigator.of(context).pop(); }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.server.name),
          leading: IconButton(icon: Icon(MdiIcons.arrowLeft), onPressed: () { _disconnect(); Navigator.of(context).pop(); }),
          actions: [if (_connected) IconButton(icon: Icon(MdiIcons.codeBraces), onPressed: _showSnippets, tooltip: 'Snippets')],
        ),
        body: Column(children: [
          if (_errorMessage != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              color: Theme.of(context).colorScheme.errorContainer,
              child: Row(children: [
                Icon(MdiIcons.alertCircleOutline, color: Theme.of(context).colorScheme.onErrorContainer),
                const SizedBox(width: 8),
                Expanded(child: Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer))),
                IconButton(icon: Icon(MdiIcons.close), onPressed: () { if (mounted) setState(() => _errorMessage = null); }, color: Theme.of(context).colorScheme.onErrorContainer),
              ]),
            ),
          Expanded(
            child: SafeArea(
              bottom: false,
              child: TerminalView(
                terminal,
                textStyle: TerminalStyle(fontSize: 13, fontFamily: GoogleFonts.jetBrainsMono().fontFamily ?? 'monospace', height: 1.2),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                focusNode: _terminalFocusNode,
                autofocus: true,
              ),
            ),
          ),
          if (_showKeyboardToolbar) _buildKeyboardToolbar(),
        ]),
      ),
    );
  }
}
