import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_material_design_icons/flutter_material_design_icons.dart';
import 'package:gpt_markdown/gpt_markdown.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../services/ai_service.dart';

class AIAssistantSheet extends StatefulWidget {
  final String token;
  final String sessionId;
  final String? serverName;

  const AIAssistantSheet({
    super.key,
    required this.token,
    required this.sessionId,
    this.serverName,
  });

  @override
  State<AIAssistantSheet> createState() => _AIAssistantSheetState();
}

typedef _Summary = String Function(Map<String, dynamic> args);

class _Tool {
  final IconData icon;
  final String label;
  final _Summary summary;
  const _Tool(this.icon, this.label, this.summary);
}

String _arg(Map<String, dynamic> a, String key) => a[key]?.toString() ?? '';

final Map<String, _Tool> _tools = {
  'runCommand': _Tool(MdiIcons.consoleLine, 'Run command', (a) => _arg(a, 'command')),
  'readFile': _Tool(MdiIcons.fileDocumentOutline, 'Read file', (a) => _arg(a, 'path')),
  'writeFile': _Tool(MdiIcons.fileEditOutline, 'Write file', (a) => _arg(a, 'path')),
  'editFile': _Tool(MdiIcons.fileEditOutline, 'Edit file', (a) => _arg(a, 'path')),
  'listDirectory': _Tool(MdiIcons.folderOutline, 'List directory', (a) => _arg(a, 'path')),
  'statPath': _Tool(MdiIcons.informationOutline, 'Inspect path', (a) => _arg(a, 'path')),
  'makeDirectory': _Tool(MdiIcons.folderPlusOutline, 'Create directory', (a) => _arg(a, 'path')),
  'deleteFile': _Tool(MdiIcons.trashCanOutline, 'Delete file', (a) => _arg(a, 'path')),
  'removeDirectory': _Tool(MdiIcons.trashCanOutline, 'Remove directory',
      (a) => a['recursive'] == true ? '${_arg(a, 'path')} (recursive)' : _arg(a, 'path')),
  'movePath': _Tool(MdiIcons.fileMoveOutline, 'Move', (a) => '${_arg(a, 'source')} → ${_arg(a, 'destination')}'),
  'changePermissions': _Tool(MdiIcons.lockOutline, 'Change permissions', (a) => '${_arg(a, 'path')} → ${_arg(a, 'mode')}'),
  'findDirectories': _Tool(MdiIcons.magnify, 'Find directories', (a) => _arg(a, 'query')),
};

enum _Role { user, assistant, system, tool }

class _Msg {
  _Msg(
    this.role, {
    this.text = '',
    this.streaming = false,
    this.callId,
    this.tool,
    this.args,
    this.status = '',
  });

  final _Role role;
  String text;
  bool streaming;
  final String? callId;
  String? tool;
  Map<String, dynamic>? args;
  String status;
  dynamic result;
  String? error;
}

class _AIAssistantSheetState extends State<AIAssistantSheet> with SingleTickerProviderStateMixin {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <_Msg>[];
  final _speech = stt.SpeechToText();

  AIAssistantChannel? _channel;
  late final AnimationController _pulse;
  Timer? _retryTimer;
  int _retryAttempts = 0;
  bool _running = false;
  bool _ready = false;
  bool _hasInput = false;
  bool _speechEnabled = false;
  bool _listening = false;
  String? _connectionError;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))
      ..addListener(() {
        if (mounted) setState(() {});
      });
    _input.addListener(() {
      final has = _input.text.trim().isNotEmpty;
      if (has != _hasInput) setState(() => _hasInput = has);
    });
    _initSpeech();
    _channel = AIAssistantChannel(
      token: widget.token,
      sessionId: widget.sessionId,
      onEvent: _handleEvent,
      onClosed: _handleClosed,
    )..connect();
  }

  void _handleClosed(int? code, String? reason) {
    if (!mounted) return;
    setState(() {
      _ready = false;
      _running = false;
      _endStreaming();
      _abortRunningTools();

      if (code != null && code >= 4000) {
        _connectionError = (reason?.isNotEmpty ?? false) ? reason : 'Connection to the assistant was lost.';
        return;
      }
      if (code == 1000 || code == 1005) return;

      _retryAttempts += 1;
      if (_retryAttempts <= 5) {
        _connectionError = 'Connection lost. Reconnecting...';
        final delayMs = (1000 * (1 << _retryAttempts)).clamp(0, 10000);
        _retryTimer = Timer(Duration(milliseconds: delayMs), () {
          if (mounted) _channel?.connect();
        });
      } else {
        _connectionError = 'Connection to the assistant was lost.';
      }
    });
  }

  @override
  void dispose() {
    if (_listening) _speech.stop();
    _retryTimer?.cancel();
    _channel?.dispose();
    _pulse.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _initSpeech() async {
    try {
      final enabled = await _speech.initialize(
        onStatus: (status) {
          if (status == 'notListening' && mounted) _stopListening();
        },
        onError: (_) {
          if (mounted) _stopListening();
        },
      );
      if (mounted) setState(() => _speechEnabled = enabled);
    } catch (_) {}
  }

  void _stopListening() {
    _listening = false;
    _pulse.stop();
    _pulse.reset();
    if (mounted) setState(() {});
  }

  void _toggleListening() {
    if (_listening) {
      _speech.stop();
      _stopListening();
      return;
    }
    setState(() => _listening = true);
    _pulse.repeat(reverse: true);
    _speech.listen(
      onResult: (result) {
        if (!mounted) return;
        _input.text = result.recognizedWords;
        _input.selection = TextSelection.collapsed(offset: _input.text.length);
        if (result.finalResult) _stopListening();
      },
      listenOptions: stt.SpeechListenOptions(
        listenMode: stt.ListenMode.dictation,
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 3),
      ),
    );
  }

  _Msg? _toolFor(String? callId) {
    if (callId == null) return null;
    for (final m in _messages) {
      if (m.role == _Role.tool && m.callId == callId) return m;
    }
    return null;
  }

  void _handleEvent(Map<String, dynamic> msg) {
    if (!mounted) return;
    setState(() {
      switch (msg['type']) {
        case 'ready':
          _ready = true;
          _retryAttempts = 0;
          _connectionError = null;
        case 'text-delta':
          _appendAssistant(msg['delta']?.toString() ?? '');
        case 'tool-call':
          _endStreaming();
          _upsertTool(msg['callId']?.toString(), msg, 'running');
        case 'confirm-request':
          _upsertTool(msg['callId']?.toString(), msg, 'awaiting-confirm');
        case 'tool-result':
          final result = msg['result'];
          final denied = result is Map && result['denied'] == true;
          _patchTool(msg['callId']?.toString(), denied ? 'denied' : 'done', result: result);
        case 'tool-error':
          _patchTool(msg['callId']?.toString(), 'error', error: msg['error']?.toString());
        case 'done':
          _endStreaming();
          _running = false;
        case 'aborted':
          _endStreaming();
          _abortRunningTools();
          _running = false;
        case 'error':
          _endStreaming();
          _running = false;
          _messages.add(_Msg(_Role.system, text: msg['message']?.toString() ?? 'Something went wrong.'));
      }
    });
    _scrollToBottom();
  }

  void _appendAssistant(String delta) {
    if (delta.isEmpty) return;
    final last = _messages.isNotEmpty ? _messages.last : null;
    if (last != null && last.role == _Role.assistant && last.streaming) {
      last.text += delta;
    } else {
      _messages.add(_Msg(_Role.assistant, text: delta, streaming: true));
    }
  }

  void _endStreaming() {
    final last = _messages.isNotEmpty ? _messages.last : null;
    if (last != null && last.role == _Role.assistant) last.streaming = false;
  }

  void _upsertTool(String? callId, Map<String, dynamic> msg, String status) {
    if (callId == null) return;
    final existing = _toolFor(callId);
    if (existing == null) {
      _messages.add(_Msg(
        _Role.tool,
        callId: callId,
        tool: msg['tool']?.toString(),
        args: _asMap(msg['args']),
        status: status,
      ));
    } else {
      existing.status = status;
    }
  }

  void _patchTool(String? callId, String status, {dynamic result, String? error}) {
    final tool = _toolFor(callId);
    if (tool == null) return;
    tool.status = status;
    tool.result = result ?? tool.result;
    tool.error = error ?? tool.error;
  }

  void _abortRunningTools() {
    for (final m in _messages) {
      if (m.role == _Role.tool && (m.status == 'running' || m.status == 'awaiting-confirm')) {
        m.status = 'aborted';
      }
    }
  }

  Map<String, dynamic> _asMap(dynamic v) => v is Map<String, dynamic> ? v : {};

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  void _send() {
    final content = _input.text.trim();
    if (content.isEmpty || _running || !_ready) return;
    if (_listening) {
      _speech.stop();
      _stopListening();
    }
    _channel?.sendPrompt(content);
    setState(() {
      _messages.add(_Msg(_Role.user, text: content));
      _input.clear();
      _running = true;
    });
    _scrollToBottom();
  }

  void _stop() {
    _channel?.abort();
    setState(() {
      _endStreaming();
      _abortRunningTools();
      _running = false;
    });
  }

  void _confirm(String callId, bool allow) {
    _channel?.confirm(callId, allow);
    setState(() => _patchTool(callId, allow ? 'running' : 'denied'));
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.9,
        child: SafeArea(
          top: false,
          child: Column(children: [
            _header(cs),
            Expanded(child: _body(cs)),
            _composer(cs),
          ]),
        ),
      ),
    );
  }

  Widget _header(ColorScheme cs) => Column(children: [
        Container(
          margin: const EdgeInsets.only(top: 12, bottom: 4),
          width: 36,
          height: 4,
          decoration: BoxDecoration(color: cs.outlineVariant, borderRadius: BorderRadius.circular(2)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 8, 8),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(10)),
              child: Icon(MdiIcons.robotHappyOutline, color: cs.onPrimaryContainer, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('AI Assistant',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                if (widget.serverName?.isNotEmpty ?? false)
                  Text(widget.serverName!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.outline)),
              ]),
            ),
            IconButton(
              icon: Icon(MdiIcons.close, size: 20),
              onPressed: () => Navigator.pop(context),
              style: IconButton.styleFrom(tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            ),
          ]),
        ),
        Divider(height: 1, color: cs.outlineVariant.withValues(alpha: 0.4)),
      ]);

  Widget _body(ColorScheme cs) {
    if (_messages.isEmpty && _connectionError == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(MdiIcons.robotHappyOutline, size: 48, color: cs.outline),
            const SizedBox(height: 16),
            Text(
              'Ask the assistant to inspect or change this server. It can run commands and read or edit files directly over the connection.',
              textAlign: TextAlign.center,
              style: TextStyle(color: cs.outline, fontSize: 14, height: 1.4),
            ),
          ]),
        ),
      );
    }

    final extra = (_running ? 1 : 0) + (_connectionError != null ? 1 : 0);
    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.all(16),
      itemCount: _messages.length + extra,
      itemBuilder: (context, i) {
        if (i < _messages.length) return _message(cs, _messages[i]);
        if (_running && i == _messages.length) return _typing(cs);
        return _errorBanner(cs);
      },
    );
  }

  Widget _message(ColorScheme cs, _Msg m) => switch (m.role) {
        _Role.user => Align(
            alignment: Alignment.centerRight,
            child: Container(
              margin: const EdgeInsets.only(bottom: 12, left: 40),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(color: cs.primary, borderRadius: BorderRadius.circular(16)),
              child: SelectableText(m.text, style: TextStyle(color: cs.onPrimary, fontSize: 14, height: 1.4)),
            ),
          ),
        _Role.assistant => Container(
            margin: const EdgeInsets.only(bottom: 12, right: 24),
            child: GptMarkdown(m.text, style: TextStyle(color: cs.onSurface, fontSize: 14, height: 1.5)),
          ),
        _Role.system => Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: cs.errorContainer, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              Icon(MdiIcons.alertCircleOutline, size: 16, color: cs.onErrorContainer),
              const SizedBox(width: 8),
              Expanded(child: Text(m.text, style: TextStyle(fontSize: 13, color: cs.onErrorContainer))),
            ]),
          ),
        _Role.tool => _toolCard(cs, m),
      };

  Widget _toolCard(ColorScheme cs, _Msg m) {
    final tool = _tools[m.tool];
    final summary = tool?.summary(m.args ?? {}) ?? '';
    final result = m.result;
    final exitCode = m.tool == 'runCommand' && m.status == 'done' && result is Map && result['denied'] != true
        ? result['exitCode'] as int?
        : null;
    final failed = exitCode != null && exitCode != 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cs.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: failed ? cs.error.withValues(alpha: 0.5) : cs.outlineVariant.withValues(alpha: 0.4)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
          child: Row(children: [
            Icon(tool?.icon ?? MdiIcons.consoleLine, size: 16, color: cs.onSurfaceVariant),
            const SizedBox(width: 8),
            Text(tool?.label ?? m.tool ?? 'Tool',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: cs.onSurface)),
            const Spacer(),
            _toolStatus(cs, m, exitCode, failed),
          ]),
        ),
        if (summary.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: Text(summary, style: GoogleFonts.jetBrainsMono(fontSize: 12, color: cs.onSurfaceVariant, height: 1.4)),
          ),
        if (m.status == 'awaiting-confirm') _confirmActions(cs, m),
        if (m.status == 'denied') _note(cs, 'You denied this action.'),
        if (m.status == 'aborted') _note(cs, 'Stopped.'),
        if (m.status == 'error') _note(cs, m.error ?? 'Failed.', error: true),
        if (m.status == 'done') _toolResult(cs, m),
      ]),
    );
  }

  Widget _toolStatus(ColorScheme cs, _Msg m, int? exitCode, bool failed) => switch (m.status) {
        'running' => SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: cs.primary)),
        'done' => failed
            ? Text('exit $exitCode', style: TextStyle(fontSize: 12, color: cs.error, fontWeight: FontWeight.w600))
            : Icon(MdiIcons.check, size: 16, color: Colors.green),
        'denied' => Icon(MdiIcons.cancel, size: 16, color: cs.error),
        'aborted' => Icon(MdiIcons.stop, size: 16, color: cs.outline),
        'error' => Icon(MdiIcons.close, size: 16, color: cs.error),
        _ => const SizedBox.shrink(),
      };

  Widget _confirmActions(ColorScheme cs, _Msg m) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Allow this action?', style: TextStyle(fontSize: 13, color: cs.onSurface)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _confirm(m.callId!, false),
                icon: Icon(MdiIcons.cancel, size: 16),
                label: const Text('Deny'),
                style: OutlinedButton.styleFrom(
                    foregroundColor: cs.error, side: BorderSide(color: cs.error.withValues(alpha: 0.5))),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                onPressed: () => _confirm(m.callId!, true),
                icon: Icon(MdiIcons.check, size: 16),
                label: const Text('Allow'),
              ),
            ),
          ]),
        ]),
      );

  Widget _note(ColorScheme cs, String text, {bool error = false}) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        child: Text(text, style: TextStyle(fontSize: 12, color: error ? cs.error : cs.outline)),
      );

  Widget _toolResult(ColorScheme cs, _Msg m) {
    final result = m.result;
    if (result is! Map || result['denied'] == true) return const SizedBox.shrink();

    Widget output(String text, {bool stderr = false}) => Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: cs.surface, borderRadius: BorderRadius.circular(8)),
          child: SelectableText(text,
              style: GoogleFonts.jetBrainsMono(fontSize: 12, height: 1.4, color: stderr ? cs.error : cs.onSurface)),
        );

    switch (m.tool) {
      case 'runCommand':
        final stdout = result['stdout']?.toString() ?? '';
        final stderr = result['stderr']?.toString() ?? '';
        return Column(children: [
          if (stdout.isNotEmpty) output(stdout),
          if (stderr.isNotEmpty) output(stderr, stderr: true),
        ]);
      case 'readFile':
        final content = result['content']?.toString() ?? '';
        return output(content + (result['truncated'] == true ? '\n… [truncated]' : ''));
      case 'listDirectory':
        final entries = (result['entries'] as List?) ?? [];
        if (entries.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
          child: Wrap(spacing: 8, runSpacing: 4, children: [
            for (final e in entries)
              if (e is Map)
                Text('${e['name']}${e['type'] == 'folder' ? '/' : ''}',
                    style: GoogleFonts.jetBrainsMono(
                        fontSize: 12, color: e['type'] == 'folder' ? cs.primary : cs.onSurfaceVariant)),
          ]),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _typing(ColorScheme cs) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        child: Row(children: [
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: cs.primary)),
          const SizedBox(width: 10),
          Text('Thinking...', style: TextStyle(color: cs.outline, fontSize: 13)),
        ]),
      );

  Widget _errorBanner(ColorScheme cs) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: cs.errorContainer, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Icon(MdiIcons.alertCircleOutline, size: 16, color: cs.onErrorContainer),
          const SizedBox(width: 8),
          Expanded(child: Text(_connectionError!, style: TextStyle(fontSize: 13, color: cs.onErrorContainer))),
        ]),
      );

  Widget _composer(ColorScheme cs) => Container(
        decoration: BoxDecoration(
          color: cs.surface,
          border: Border(top: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4))),
        ),
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          if (_speechEnabled)
            GestureDetector(
              onTap: _ready ? _toggleListening : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.only(right: 4, bottom: 2),
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _listening ? cs.error.withValues(alpha: 0.15) : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: _listening
                      ? [
                          BoxShadow(
                            color: cs.error.withValues(alpha: 0.2 * _pulse.value),
                            blurRadius: 8 + 4 * _pulse.value,
                            spreadRadius: _pulse.value,
                          ),
                        ]
                      : null,
                ),
                child: Icon(_listening ? MdiIcons.microphone : MdiIcons.microphoneOutline,
                    size: 22, color: _listening ? cs.error : cs.outline),
              ),
            ),
          Expanded(
            child: Container(
              constraints: const BoxConstraints(maxHeight: 120),
              decoration: BoxDecoration(color: cs.surfaceContainerHigh, borderRadius: BorderRadius.circular(20)),
              child: TextField(
                controller: _input,
                enabled: _ready,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                style: TextStyle(fontSize: 15, color: cs.onSurface),
                decoration: InputDecoration(
                  hintText: !_ready
                      ? 'Connecting...'
                      : _listening
                          ? 'Listening...'
                          : 'Message the assistant...',
                  hintStyle: TextStyle(color: cs.outline.withValues(alpha: 0.7)),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _running
              ? IconButton.filled(
                  onPressed: _stop,
                  icon: Icon(MdiIcons.stop),
                  style: IconButton.styleFrom(backgroundColor: cs.error, foregroundColor: cs.onError),
                )
              : IconButton.filled(
                  onPressed: _hasInput && _ready ? _send : null,
                  icon: Icon(MdiIcons.send),
                ),
        ]),
      );
}
