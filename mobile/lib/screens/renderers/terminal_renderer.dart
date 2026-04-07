import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:web_socket_channel/io.dart';
import 'package:xterm/xterm.dart';

import '../../services/session_manager.dart';
import '../../utils/ai_manager.dart';
import '../../utils/snippet_manager.dart';
import '../../utils/terminal_settings.dart';
import '../widgets/ai_command_sheet.dart';

class TerminalRenderer extends StatefulWidget {
  final AppSession session;
  final String token;
  final SnippetManager snippetManager;
  final TerminalSettings terminalSettings;
  final AIManager aiManager;
  final VoidCallback? onDisconnected;

  const TerminalRenderer({
    super.key,
    required this.session,
    required this.token,
    required this.snippetManager,
    required this.terminalSettings,
    required this.aiManager,
    this.onDisconnected,
  });

  @override
  State<TerminalRenderer> createState() => _TerminalRendererState();
}

class _TerminalRendererState extends State<TerminalRenderer> {
  Terminal get _terminal => widget.session.terminal!;
  IOWebSocketChannel? get _channel => widget.session.termChannel;
  bool _connected = false;
  String? _errorMessage;
  final FocusNode _terminalFocusNode = FocusNode();
  bool _showKeyboardToolbar = false;
  bool _ctrlPressed = false;
  bool _altPressed = false;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _terminalFocusNode.addListener(_onFocusChanged);
    widget.session.showSnippets = _showSnippets;
    widget.session.showAI = _showAISheet;
    _setupTerminal();
  }

  void _onFocusChanged() {
    if (mounted) setState(() => _showKeyboardToolbar = _terminalFocusNode.hasFocus);
  }

  void _setupTerminal() {
    if (_initialized) return;
    _initialized = true;

    _terminal.onOutput = (data) {
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

    _terminal.onResize = (w, h, _, __) {
      if (mounted && _connected && _channel != null) {
        _channel?.sink.add('\x01$w,$h');
      }
    };

    if (widget.session.termSubscription == null) {
      _terminal.write('Connecting to ${widget.session.server.name}...\r\n');
      widget.session.termSubscription = _channel?.stream.listen(
        (data) {
          if (data is String) {
            _terminal.write(data.startsWith('\x02') ? data.substring(1) : data);
          }
        },
        onError: (error) {
          if (mounted) setState(() { _errorMessage = 'Connection error: $error'; _connected = false; });
          _terminal.write('\r\nConnection error: $error\r\n');
          widget.session.isConnected = false;
          widget.onDisconnected?.call();
        },
        onDone: () {
          if (mounted) setState(() => _connected = false);
          _terminal.write('\r\nConnection closed\r\n');
          widget.session.isConnected = false;
          widget.onDisconnected?.call();
        },
      );

      if (mounted) setState(() => _connected = true);
      widget.session.isConnected = true;

      Future.delayed(const Duration(milliseconds: 100), () {
        if (_channel == null) return;
        _channel?.sink.add(_terminal.viewHeight > 0 && _terminal.viewWidth > 0
            ? '\x01${_terminal.viewWidth},${_terminal.viewHeight}'
            : '\x0180,30');
      });
    } else {
      _connected = widget.session.isConnected;
    }
  }

  @override
  void dispose() {
    _terminalFocusNode.removeListener(_onFocusChanged);
    _terminalFocusNode.dispose();
    super.dispose();
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
            seq = code >= 65 && code <= 90
                ? String.fromCharCode(code - 64)
                : code >= 97 && code <= 122
                    ? String.fromCharCode(code - 96)
                    : key;
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

  void _sendFunctionKey(int n) {
    const fnKeys = <int, String>{
      1: '\x1bOP', 2: '\x1bOQ', 3: '\x1bOR', 4: '\x1bOS',
      5: '\x1b[15~', 6: '\x1b[17~', 7: '\x1b[18~', 8: '\x1b[19~',
      9: '\x1b[20~', 10: '\x1b[21~', 11: '\x1b[23~', 12: '\x1b[24~',
    };
    final seq = fnKeys[n];
    if (seq != null) _channel?.sink.add(seq);
  }

  String _getRecentOutput() {
    final buffer = _terminal.buffer;
    final lines = <String>[];
    final totalLines = buffer.lines.length;
    final start = (totalLines - 50).clamp(0, totalLines);
    for (int i = start; i < totalLines; i++) {
      lines.add(buffer.lines[i].getText());
    }
    final output = lines.join('\n').trimRight();
    return output.length > 1500 ? output.substring(output.length - 1500) : output;
  }

  void _showAISheet() {
    if (!mounted) return;
    final serverId = widget.session.server.id;
    final entryId = serverId is int ? serverId : int.tryParse(serverId.toString());

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => AICommandSheet(
        token: widget.token,
        entryId: entryId,
        recentOutput: _getRecentOutput(),
        onCommandAccepted: (command) {
          _channel?.sink.add(command);
        },
      ),
    );
  }

  void _showSnippets() {
    if (!mounted) return;
    final sm = widget.snippetManager;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      clipBehavior: Clip.antiAliasWithSaveLayer,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7, minChildSize: 0.5, maxChildSize: 0.95, expand: false,
        builder: (ctx, scrollController) {
          if (sm.isLoading) return const Center(child: CircularProgressIndicator());
          if (sm.error != null) {
            return Center(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(MdiIcons.alertCircleOutline, size: 48, color: Theme.of(ctx).colorScheme.error),
                const SizedBox(height: 16),
                Text('Failed to load snippets', style: Theme.of(ctx).textTheme.titleMedium),
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
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.terminalSettings,
      builder: (context, child) {
        return Stack(
          children: [
            Positioned.fill(
              child: Column(
                children: [
                  if (_errorMessage != null) _errorBanner(),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _terminalFocusNode.requestFocus(),
                      child: TerminalView(
                        _terminal,
                        theme: widget.terminalSettings.colorTheme.theme,
                        textStyle: TerminalStyle(
                          fontSize: widget.terminalSettings.fontSize,
                          fontFamily: GoogleFonts.jetBrainsMono().fontFamily ?? 'monospace',
                          height: 1.2,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        focusNode: _terminalFocusNode,
                        autofocus: true,
                      ),
                    ),
                  ),
                  if (_showKeyboardToolbar) _buildKeyboardToolbar(),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _errorBanner() {
    final colors = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity, padding: const EdgeInsets.all(8), color: colors.errorContainer,
      child: Row(children: [
        Icon(MdiIcons.alertCircleOutline, color: colors.onErrorContainer),
        const SizedBox(width: 8),
        Expanded(child: Text(_errorMessage!, style: TextStyle(color: colors.onErrorContainer))),
        IconButton(icon: Icon(MdiIcons.close), onPressed: () => setState(() => _errorMessage = null), color: colors.onErrorContainer),
      ]),
    );
  }

  Widget _buildKeyboardToolbar() {
    final ts = widget.terminalSettings;
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
              _toolbarBtn('ESC'), const SizedBox(width: 8),
              _toolbarBtn('TAB'), const SizedBox(width: 8),
              for (final group in ts.groupOrder)
                if (ts.isGroupEnabled(group)) ..._buildGroupButtons(group),
            ]),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildGroupButtons(ToolbarGroup group) {
    switch (group) {
      case ToolbarGroup.modifiers:
        return [
          _toolbarBtn('CTRL', isToggle: true, isActive: _ctrlPressed), const SizedBox(width: 8),
          _toolbarBtn('ALT', isToggle: true, isActive: _altPressed), const SizedBox(width: 16),
        ];
      case ToolbarGroup.signals:
        return [
          _toolbarBtn('^C', onPressed: () => _channel?.sink.add('\x03'), compact: true), const SizedBox(width: 8),
          _toolbarBtn('^Z', onPressed: () => _channel?.sink.add('\x1a'), compact: true), const SizedBox(width: 8),
          _toolbarBtn('^D', onPressed: () => _channel?.sink.add('\x04'), compact: true), const SizedBox(width: 16),
        ];
      case ToolbarGroup.arrows:
        return [
          _toolbarBtn('↑', onPressed: () => _sendSpecialKey('UP'), compact: true), const SizedBox(width: 8),
          _toolbarBtn('↓', onPressed: () => _sendSpecialKey('DOWN'), compact: true), const SizedBox(width: 8),
          _toolbarBtn('←', onPressed: () => _sendSpecialKey('LEFT'), compact: true), const SizedBox(width: 8),
          _toolbarBtn('→', onPressed: () => _sendSpecialKey('RIGHT'), compact: true), const SizedBox(width: 16),
        ];
      case ToolbarGroup.navigation:
        return [
          _toolbarBtn('HOME', compact: true), const SizedBox(width: 8),
          _toolbarBtn('END', compact: true), const SizedBox(width: 8),
          _toolbarBtn('PGUP', compact: true), const SizedBox(width: 8),
          _toolbarBtn('PGDN', compact: true), const SizedBox(width: 16),
        ];
      case ToolbarGroup.functionKeys:
        return [
          for (int i = 1; i <= 12; i++) ...[
            _toolbarBtn('F$i', onPressed: () => _sendFunctionKey(i), compact: true),
            if (i < 12) const SizedBox(width: 8),
          ],
        ];
    }
  }

  Widget _toolbarBtn(String label, {VoidCallback? onPressed, bool isToggle = false, bool isActive = false, bool compact = false}) {
    final theme = Theme.of(context);
    final bgColor = isActive ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHighest;
    final fgColor = isActive ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface;
    return Material(
      color: bgColor, borderRadius: BorderRadius.circular(12), elevation: isActive ? 2 : 0,
      child: InkWell(
        onTap: onPressed ?? () => _sendSpecialKey(label),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: BoxConstraints(minWidth: compact ? 44 : 56, minHeight: 44),
          padding: EdgeInsets.symmetric(horizontal: compact ? 12 : 16, vertical: 10),
          child: Center(child: Text(label, style: TextStyle(fontSize: compact ? 13 : 14, fontWeight: FontWeight.w600, color: fgColor))),
        ),
      ),
    );
  }
}
